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

export function buildShareablePaymentUrl(linkId?: string | null): string {
  if (!linkId) return '';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return origin ? `${origin}/?bayar=${encodeURIComponent(linkId)}` : `?bayar=${encodeURIComponent(linkId)}`;
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
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const [r, g, b] = ACCENT_RGB[input.template.accentTheme] ?? ACCENT_RGB.teal;
  const lateFee = input.lateFee ?? 0;
  const grandTotal = input.amount + lateFee;

  // Top accent ribbon
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageWidth, 8, 'F');

  let y = 20;

  // Brand + Document Title
  if (input.template.showLogo) {
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin, y - 4, 11, 11, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('KPA', margin + 5.5, y + 3, { align: 'center' });
  }

  const brandOffset = input.template.showLogo ? margin + 15 : margin;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(input.propertyName, brandOffset, y + 1);

  if (input.template.showAddress && input.propertyAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const addrLines = doc.splitTextToSize(input.propertyAddress, 85);
    doc.text(addrLines, brandOffset, y + 6);
  }

  // Right side Receipt Heading & Invoice No
  doc.setTextColor(r, g, b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(input.template.title.toUpperCase(), pageWidth - margin, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  if (input.template.subtitle) {
    doc.text(input.template.subtitle, pageWidth - margin, y + 5, { align: 'right' });
  }
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(input.invoiceNo, pageWidth - margin, y + 10.5, { align: 'right' });

  y += 22;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // 2-column Metadata Block
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y - 4, contentWidth, 30, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DITERIMA DARI PENYEWA', margin + 5, y + 2);
  doc.text('PERIODE & PEMBAYARAN', pageWidth - margin - 5, y + 2, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(input.tenantName, margin + 5, y + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(formatMonthYear(input.month), pageWidth - margin - 5, y + 8.5, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const unitLabel = input.roomTier
    ? `${input.roomName} · ${input.roomTier}`
    : input.roomName;
  doc.text(unitLabel, margin + 5, y + 14.5);
  doc.text(
    `Tanggal Bayar: ${formatDateID(input.paidDate)}`,
    pageWidth - margin - 5,
    y + 14.5,
    { align: 'right' }
  );
  doc.text(
    `Metode: ${input.method || 'Transfer Bank'}`,
    pageWidth - margin - 5,
    y + 20,
    { align: 'right' }
  );

  y += 35;

  // Itemized Table Header
  doc.setFillColor(r, g, b);
  doc.rect(margin, y, contentWidth, 8.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('RINCIAN TAGIHAN', margin + 4, y + 5.7);
  doc.text('NOMINAL', pageWidth - margin - 4, y + 5.7, { align: 'right' });
  y += 14;

  // Row 1: Sewa Kamar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Sewa ${input.roomName} (${formatMonthYear(input.month)})`,
    margin + 4,
    y
  );
  doc.setFont('courier', 'bold');
  doc.text(formatIDR(input.amount), pageWidth - margin - 4, y, { align: 'right' });
  y += 7.5;

  // Row 2: Denda (if > 0)
  if (lateFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(190, 18, 60);
    doc.text('Denda Keterlambatan', margin + 4, y);
    doc.setFont('courier', 'bold');
    doc.text(formatIDR(lateFee), pageWidth - margin - 4, y, { align: 'right' });
    y += 7.5;
  }

  // Row 3: Included Facilities
  if (input.template.includedItemsText.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const incLines = doc.splitTextToSize(
      input.template.includedItemsText.trim(),
      contentWidth - 45
    );
    doc.text(incLines, margin + 4, y);
    doc.text('Termasuk', pageWidth - margin - 4, y, { align: 'right' });
    y += incLines.length * 4.5 + 3.5;
  }

  // Row 4: Deposit info (optional)
  if (
    input.template.showDepositInfo &&
    typeof input.depositAmount === 'number' &&
    input.depositAmount > 0
  ) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Status Uang Jaminan / Deposit (${input.depositStatus ?? 'Disimpan'})`,
      margin + 4,
      y
    );
    doc.setFont('courier', 'normal');
    doc.text(formatIDR(input.depositAmount), pageWidth - margin - 4, y, {
      align: 'right',
    });
    y += 7;
  }

  // Optional Room Custom Receipt Note / Payment Note
  const combinedNotes = [input.customRoomNote, input.paymentNotes]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');
  if (combinedNotes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(`Catatan: ${combinedNotes}`, contentWidth - 8);
    doc.text(noteLines, margin + 4, y);
    y += noteLines.length * 4.5 + 3;
  }

  // Line before total
  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // Total & Paid Badge
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(margin, y - 5, 50, 9, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87);
  doc.text('LUNAS · TERVERIFIKASI', margin + 25, y + 0.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DIBAYARKAN', pageWidth - margin, y - 1, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(formatIDR(grandTotal), pageWidth - margin, y + 6.5, { align: 'right' });

  y += 24;

  // Footer: QR Verification + Signer
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
      doc.addImage(qrDataUrl, 'PNG', margin, y, 24, 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Verifikasi Kwitansi Digital', margin + 27, y + 8);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.text(input.invoiceNo, margin + 27, y + 13);
      if (input.paymentLinkId) {
        doc.setFont('helvetica', 'normal');
        doc.text('Pindai QR untuk mengunduh salinan PDF resmi', margin + 27, y + 18);
      }
    } catch {
      // Non-fatal if QR rendering fails
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(input.template.signerLabel, pageWidth - margin, y + 6, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(input.adminName, pageWidth - margin, y + 17, { align: 'right' });

  y += 32;

  // Bottom Footer Note
  if (input.template.footerNote.trim()) {
    doc.setDrawColor(226, 232, 240);
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
