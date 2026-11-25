import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  DepositStatus,
  PaymentLinkRecord,
  PaymentMethod,
  PaymentRecord,
  PropertySettings,
  ReceiptAccentTheme,
  ReceiptTemplateConfig,
  Room,
} from '../types/kost';
import { DEFAULT_RECEIPT_TEMPLATE, getRoomDisplayName } from '../data/initialData';
import { formatDateID, formatIDR, formatMonthYear } from './format';

export interface ResolvedRoomPaymentProfile {
  useCustom: boolean;
  preferredMethod: PaymentMethod;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrisImageUrl: string;
  externalPaymentLink: string;
  autoPdfOnPaid: boolean;
  autoOpenWaOnPaid: boolean;
  customReceiptNote: string;
  accountSummary: string;
}

const PUBLIC_APP_URL_STORAGE_KEY = 'kpa_public_app_url';
let activePublicAppUrlCache = '';

export function normalizePublicBaseUrl(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export function setActivePublicAppUrl(raw?: string | null): void {
  const normalized = normalizePublicBaseUrl(raw);
  activePublicAppUrlCache = normalized;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (normalized) {
        window.localStorage.setItem(PUBLIC_APP_URL_STORAGE_KEY, normalized);
      } else {
        window.localStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access errors
    }
  }
}

export function getEffectivePublicBaseUrl(customBaseUrl?: string | null): string {
  const fromArg = normalizePublicBaseUrl(customBaseUrl);
  if (fromArg) return fromArg;

  if (activePublicAppUrlCache) return activePublicAppUrlCache;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = normalizePublicBaseUrl(
        window.localStorage.getItem(PUBLIC_APP_URL_STORAGE_KEY)
      );
      if (stored) {
        activePublicAppUrlCache = stored;
        return stored;
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const fromEnv = normalizePublicBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL);
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function isPreviewHostOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location?.hostname) return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.includes('aistudio')
  );
}

export function buildShareablePaymentUrl(
  linkId?: string | null,
  customBaseUrl?: string | null
): string {
  if (!linkId) return '';
  const origin = getEffectivePublicBaseUrl(customBaseUrl);
  return origin
    ? `${origin}/?bayar=${encodeURIComponent(linkId)}`
    : `?bayar=${encodeURIComponent(linkId)}`;
}

export function resolveRoomPaymentProfile(
  room: Room | null | undefined,
  settings: PropertySettings,
  receiptTemplate: ReceiptTemplateConfig = DEFAULT_RECEIPT_TEMPLATE
): ResolvedRoomPaymentProfile {
  const custom = room?.receiptProfile;
  const useCustom = Boolean(custom?.useCustom);

  const preferredMethod: PaymentMethod = useCustom
    ? custom?.preferredMethod ?? 'Transfer BCA'
    : 'Transfer BCA';

  const bankName =
    (useCustom && custom?.bankName?.trim()) ||
    settings.paymentBankName?.trim() ||
    'BCA';

  const accountNumber =
    (useCustom && custom?.accountNumber?.trim()) ||
    settings.paymentBankAccount?.trim() ||
    '';

  const accountHolder =
    (useCustom && custom?.accountHolder?.trim()) ||
    settings.paymentBankHolder?.trim() ||
    settings.adminName;

  const qrisImageUrl = settings.qrisImageUrl?.trim() || '';

  const externalPaymentLink =
    (useCustom && custom?.customPaymentUrl?.trim()) ||
    settings.externalPaymentLink?.trim() ||
    '';

  const autoPdfOnPaid = useCustom
    ? Boolean(custom?.autoPdfOnPaid)
    : receiptTemplate.autoGeneratePdfOnPaid;

  const autoOpenWaOnPaid = useCustom
    ? Boolean(custom?.autoOpenWaOnPaid)
    : receiptTemplate.autoOpenWaOnPaid;

  const customReceiptNote = custom?.customReceiptNote?.trim() || '';

  const bankPart = accountNumber
    ? `${bankName} ${accountNumber}${accountHolder ? ` a.n. ${accountHolder}` : ''}`
    : settings.paymentAccountInfo?.trim() || 'Transfer Bank Pengelola';

  const accountSummary =
    preferredMethod === 'QRIS'
      ? `QRIS ${settings.name}${accountNumber ? ` / ${bankPart}` : ''}`
      : qrisImageUrl
      ? `${bankPart} / QRIS ${settings.name}`
      : bankPart;

  return {
    useCustom,
    preferredMethod,
    bankName,
    accountNumber,
    accountHolder,
    qrisImageUrl,
    externalPaymentLink,
    autoPdfOnPaid,
    autoOpenWaOnPaid,
    customReceiptNote,
    accountSummary,
  };
}

const ACCENT_RGB: Record<ReceiptAccentTheme, [number, number, number]> = {
  teal: [15, 118, 110],
  navy: [30, 58, 138],
  slate: [51, 65, 85],
};

export interface PdfReceiptInput {
  invoiceNo: string;
  roomNumber: string;
  roomName: string;
  roomTier?: string;
  tenantName: string;
  month: string;
  amount: number;
  lateFee?: number;
  paidDate: string | null;
  method: string | null;
  paymentNotes?: string;
  depositAmount?: number;
  depositStatus?: DepositStatus;
  paymentLinkId?: string;
  propertyName: string;
  propertyAddress: string;
  adminName: string;
  template: ReceiptTemplateConfig;
  customRoomNote?: string;
}

export function buildPdfReceiptInputFromAdmin(params: {
  payment: PaymentRecord;
  room?: Room | null;
  settings: PropertySettings;
  template?: ReceiptTemplateConfig;
}): PdfReceiptInput {
  const { payment, room, settings, template = DEFAULT_RECEIPT_TEMPLATE } = params;
  return {
    invoiceNo: payment.invoiceNo,
    roomNumber: payment.roomNumber,
    roomName: room ? getRoomDisplayName(room) : `Kamar ${payment.roomNumber}`,
    roomTier: room?.tier,
    tenantName: payment.tenantName,
    month: payment.month,
    amount: payment.amount,
    lateFee: payment.lateFee,
    paidDate: payment.paidDate,
    method: payment.method ?? room?.receiptProfile?.preferredMethod ?? 'Transfer Bank',
    paymentNotes: payment.notes,
    depositAmount: room?.tenant?.depositAmount,
    depositStatus: room?.tenant?.depositStatus,
    paymentLinkId: payment.paymentLinkId,
    propertyName: settings.name,
    propertyAddress: settings.address,
    adminName: settings.adminName,
    template,
    customRoomNote: room?.receiptProfile?.customReceiptNote,
  };
}

export function buildPdfReceiptInputFromLink(link: PaymentLinkRecord): PdfReceiptInput {
  const snap = link.receiptSnapshot;
  const mergedTemplate: ReceiptTemplateConfig = {
    ...DEFAULT_RECEIPT_TEMPLATE,
    title: snap?.title || DEFAULT_RECEIPT_TEMPLATE.title,
    subtitle: snap?.subtitle || DEFAULT_RECEIPT_TEMPLATE.subtitle,
    accentTheme: snap?.accentTheme || DEFAULT_RECEIPT_TEMPLATE.accentTheme,
    includedItemsText:
      snap?.includedItemsText ?? DEFAULT_RECEIPT_TEMPLATE.includedItemsText,
    footerNote: snap?.footerNote ?? DEFAULT_RECEIPT_TEMPLATE.footerNote,
    signerLabel: snap?.signerLabel || DEFAULT_RECEIPT_TEMPLATE.signerLabel,
    showLogo: snap?.showLogo ?? DEFAULT_RECEIPT_TEMPLATE.showLogo,
    showAddress: snap?.showAddress ?? DEFAULT_RECEIPT_TEMPLATE.showAddress,
    showQrVerification:
      snap?.showQrVerification ?? DEFAULT_RECEIPT_TEMPLATE.showQrVerification,
    showDepositInfo:
      snap?.showDepositInfo ?? DEFAULT_RECEIPT_TEMPLATE.showDepositInfo,
  };

  return {
    invoiceNo: link.invoiceNo,
    roomNumber: link.roomNumber,
    roomName: link.roomName || `Kamar ${link.roomNumber}`,
    tenantName: link.tenantName,
    month: link.month,
    amount: link.amount,
    lateFee: link.lateFee,
    paidDate: link.paidDate,
    method: link.method || link.preferredMethod || 'Transfer Bank',
    depositAmount: snap?.depositAmount,
    depositStatus: snap?.depositStatus,
    paymentLinkId: link.id,
    propertyName: link.propertyName,
    propertyAddress: link.propertyAddress || '',
    adminName: link.adminName,
    template: mergedTemplate,
    customRoomNote: snap?.customRoomNote,
  };
}

export async function generateReceiptPdfDocument(input: PdfReceiptInput): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const [r, g, b] = ACCENT_RGB[input.template.accentTheme] ?? ACCENT_RGB.teal;
  const lateFee = input.lateFee ?? 0;
  const grandTotal = input.amount + lateFee;

  // Minimal 3mm top accent stripe
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageWidth, 3, 'F');

  let y = 20;

  // 1. Header: Property Brand (left) + Receipt Title & Invoice No (right)
  if (input.template.showLogo) {
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin, y - 4, 10, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('KPA', margin + 5, y + 2.3, { align: 'center' });
  }

  const brandOffset = input.template.showLogo ? margin + 14 : margin;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.propertyName, brandOffset, y + 0.5);

  if (input.template.showAddress && input.propertyAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const addrLines = doc.splitTextToSize(input.propertyAddress, 85);
    doc.text(addrLines, brandOffset, y + 5.5);
  }

  doc.setTextColor(r, g, b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(input.template.title.toUpperCase(), pageWidth - margin, y, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(input.invoiceNo, pageWidth - margin, y + 5.5, { align: 'right' });

  if (input.template.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(input.template.subtitle, pageWidth - margin, y + 10.5, { align: 'right' });
  }

  y += 20;

  // Subtle hairline divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // 2. Clean 2-Column Key Summary (no heavy shaded card)
  const rightColX = pageWidth - margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Penyewa & Unit', margin, y);
  doc.text('Periode & Tanggal Bayar', rightColX, y, { align: 'right' });

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(input.tenantName, margin, y);
  doc.text(formatMonthYear(input.month), rightColX, y, { align: 'right' });

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const unitLabel = input.roomTier
    ? `${input.roomName} · ${input.roomTier}`
    : input.roomName;
  doc.text(unitLabel, margin, y);
  doc.text(
    `${formatDateID(input.paidDate)} · ${input.method || 'Transfer Bank'}`,
    rightColX,
    y,
    { align: 'right' }
  );

  y += 11;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // 3. Itemized Lines (clean typography, open whitespace)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('RINCIAN PEMBAYARAN', margin, y);
  doc.text('NOMINAL', rightColX, y, { align: 'right' });
  y += 8;

  // Main Rent Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Sewa ${input.roomName} (${formatMonthYear(input.month)})`,
    margin,
    y
  );
  doc.setFont('courier', 'bold');
  doc.text(formatIDR(input.amount), rightColX, y, { align: 'right' });
  y += 7.5;

  // Late Fee (if > 0)
  if (lateFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(190, 18, 60);
    doc.text('Denda Keterlambatan', margin, y);
    doc.setFont('courier', 'bold');
    doc.text(formatIDR(lateFee), rightColX, y, { align: 'right' });
    y += 7.5;
  }

  // Included Facilities (quiet subline)
  if (input.template.includedItemsText.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const incLines = doc.splitTextToSize(
      input.template.includedItemsText.trim(),
      contentWidth - 36
    );
    doc.text(incLines, margin, y);
    doc.text('Termasuk', rightColX, y, { align: 'right' });
    y += incLines.length * 4.5 + 3.5;
  }

  // Deposit info (optional)
  if (
    input.template.showDepositInfo &&
    typeof input.depositAmount === 'number' &&
    input.depositAmount > 0
  ) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Uang Jaminan / Deposit (${input.depositStatus ?? 'Disimpan'})`,
      margin,
      y
    );
    doc.setFont('courier', 'normal');
    doc.text(formatIDR(input.depositAmount), rightColX, y, { align: 'right' });
    y += 7;
  }

  // Optional Note
  const combinedNotes = [input.customRoomNote, input.paymentNotes]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');
  if (combinedNotes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const noteLines = doc.splitTextToSize(`Catatan: ${combinedNotes}`, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 3;
  }

  // 4. Total Highlight Band
  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(4, 120, 87);
  doc.text('STATUS: LUNAS', margin, y + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Dibayarkan', rightColX, y - 2, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(formatIDR(grandTotal), rightColX, y + 5.5, { align: 'right' });

  y += 22;

  // 5. Verification QR + Signer
  const qrPayload = input.paymentLinkId
    ? buildShareablePaymentUrl(input.paymentLinkId)
    : `${input.invoiceNo} | ${input.tenantName} | LUNAS ${formatIDR(grandTotal)}`;

  if (input.template.showQrVerification) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      doc.addImage(qrDataUrl, 'PNG', margin, y, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('Cek Keaslian & Salinan PDF', margin + 23, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        input.paymentLinkId
          ? 'Pindai QR untuk membuka kwitansi resmi'
          : `Ref: ${input.invoiceNo}`,
        margin + 23,
        y + 12.5
      );
    } catch {
      // Non-fatal if QR rendering fails
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(input.template.signerLabel, rightColX, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(input.adminName, rightColX, y + 15, { align: 'right' });

  y += 28;

  // 6. Quiet Footer Note
  if (input.template.footerNote.trim()) {
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const footerLines = doc.splitTextToSize(input.template.footerNote.trim(), contentWidth);
    doc.text(footerLines, margin, y);
  }

  return doc;
}

export async function downloadReceiptPdf(input: PdfReceiptInput): Promise<string> {
  const doc = await generateReceiptPdfDocument(input);
  const safeRoom = input.roomNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeMonth = input.month.replace(/[^0-9-]/g, '');
  const filename = `Kwitansi-${safeRoom || 'Kamar'}-${safeMonth}.pdf`;
  doc.save(filename);
  return filename;
}
