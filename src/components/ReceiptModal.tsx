import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Copy,
  CheckCircle2,
  ExternalLink,
  Download,
  Link2,
} from 'lucide-react';
import {
  MessageTemplate,
  PaymentRecord,
  PropertySettings,
  ReceiptTemplateConfig,
  Room,
} from '../types/kost';
import { DEFAULT_RECEIPT_TEMPLATE, getRoomDisplayName } from '../data/initialData';
import { PropertyLogo } from './PropertyLogo';
import { buildWhatsAppUrl, formatDateID, formatIDR, formatMonthYear } from '../utils/format';
import { DEFAULT_MESSAGE_TEMPLATES, renderMessageTemplate } from '../utils/messageTemplates';
import {
  buildPdfReceiptInputFromAdmin,
  buildShareablePaymentUrl,
  downloadReceiptPdf,
} from '../utils/receiptPdf';

interface ReceiptModalProps {
  payment: PaymentRecord | null;
  room?: Room | null;
  templates?: MessageTemplate[];
  receiptTemplate?: ReceiptTemplateConfig;
  settings: PropertySettings;
  onClose: () => void;
  onCopySuccess: (msg: string) => void;
  onEnsurePaymentLink?: (payment: PaymentRecord, room?: Room | null) => Promise<string>;
}

const ACCENT_TOP_CLASS = {
  teal: 'border-t-[3px] border-t-teal-700',
  navy: 'border-t-[3px] border-t-blue-900',
  slate: 'border-t-[3px] border-t-slate-700',
};

const ACCENT_TEXT_CLASS = {
  teal: 'text-teal-700',
  navy: 'text-blue-900',
  slate: 'text-slate-700',
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  room,
  templates = [],
  receiptTemplate = DEFAULT_RECEIPT_TEMPLATE,
  settings,
  onClose,
  onCopySuccess,
  onEnsurePaymentLink,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const shareUrl = payment?.paymentLinkId
    ? buildShareablePaymentUrl(payment.paymentLinkId)
    : '';
  const lateFee = payment?.lateFee ?? 0;
  const grandTotal = (payment?.amount ?? 0) + lateFee;

  useEffect(() => {
    let cancelled = false;
    if (!payment || !receiptTemplate.showQrVerification) {
      setQrDataUrl('');
      return;
    }
    const payload = shareUrl
      ? shareUrl
      : `${payment.invoiceNo} | ${payment.tenantName} | LUNAS ${formatIDR(grandTotal)}`;

    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [payment, receiptTemplate.showQrVerification, shareUrl, grandTotal]);

  if (!payment) return null;

  const activeTemplates = templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;
  const lunasTemplate =
    activeTemplates.find((t) => t.category === 'lunas') ??
    DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === 'lunas')!;

  const waText = renderMessageTemplate(lunasTemplate.body, {
    settings,
    room,
    payment,
    month: payment.month,
    paymentUrl: shareUrl,
  });

  const waUrl = buildWhatsAppUrl(room?.tenant?.phone ?? '', waText);

  const handleCopyWA = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      onCopySuccess(`Detail kwitansi Kamar ${payment.roomNumber} disalin untuk WhatsApp`);
    } catch {
      onCopySuccess(`Kwitansi ${payment.invoiceNo} siap dikirim`);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const filename = await downloadReceiptPdf(
        buildPdfReceiptInputFromAdmin({
          payment,
          room,
          settings,
          template: receiptTemplate,
        })
      );
      onCopySuccess(`Kwitansi PDF ${filename} berhasil diunduh`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyOrCreateLink = async () => {
    let url = shareUrl;
    if (!url && onEnsurePaymentLink) {
      setCreatingLink(true);
      try {
        const linkId = await onEnsurePaymentLink(payment, room);
        url = buildShareablePaymentUrl(linkId);
      } finally {
        setCreatingLink(false);
      }
    }
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onCopySuccess(`Tautan kwitansi PDF ${payment.invoiceNo} disalin`);
    } catch {
      onCopySuccess(`Tautan kwitansi PDF siap dibagikan: ${url}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs no-print animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kwitansi Pembayaran Digital"
        className="relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#0f1a1e] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        {/* Minimal Top Action Bar */}
        <div className="px-6 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between no-print">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
            {payment.invoiceNo}
            {payment.receiptGeneratedAt ? ' · Kwitansi Otomatis' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup kwitansi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean, Spacious Receipt Surface */}
        <div
          id="printable-receipt"
          className={`flex-1 overflow-y-auto px-6 py-7 sm:px-9 sm:py-8 bg-white text-slate-900 space-y-6 ${
            ACCENT_TOP_CLASS[receiptTemplate.accentTheme] ?? ACCENT_TOP_CLASS.teal
          }`}
        >
          {/* 1. Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              {receiptTemplate.showLogo && <PropertyLogo className="w-9 h-9" />}
              <div>
                <h2 className="font-display font-bold text-base sm:text-lg text-slate-950">
                  {settings.name}
                </h2>
                {receiptTemplate.showAddress && settings.address && (
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed mt-0.5">
                    {settings.address}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-xs font-bold tracking-wide uppercase ${
                  ACCENT_TEXT_CLASS[receiptTemplate.accentTheme] ?? ACCENT_TEXT_CLASS.teal
                }`}
              >
                {receiptTemplate.title}
              </p>
              <p className="font-mono-num text-xs font-semibold text-slate-900 mt-1">
                {payment.invoiceNo}
              </p>
              {receiptTemplate.subtitle && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {receiptTemplate.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* 2. Key Summary (2-column open layout) */}
          <div className="grid grid-cols-2 gap-6 text-sm border-b border-slate-200 pb-5">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Penyewa &amp; Unit</p>
              <p className="font-semibold text-slate-950 text-base">{payment.tenantName}</p>
              <p className="text-xs text-slate-600">
                {room ? `${getRoomDisplayName(room)} · ${room.tier}` : `Kamar ${payment.roomNumber}`}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-slate-500">Periode &amp; Pembayaran</p>
              <p className="font-semibold text-slate-950 text-base">
                {formatMonthYear(payment.month)}
              </p>
              <p className="font-mono-num text-xs text-slate-600">
                {formatDateID(payment.paidDate)} · {payment.method ?? 'Transfer Bank'}
              </p>
            </div>
          </div>

          {/* 3. Rincian Nominal */}
          <div className="space-y-3 text-sm border-b border-slate-200 pb-5">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">
                Sewa {room ? getRoomDisplayName(room) : `Kamar ${payment.roomNumber}`} (
                {formatMonthYear(payment.month)})
              </span>
              <span className="font-mono-num font-semibold text-slate-950">
                {formatIDR(payment.amount)}
              </span>
            </div>

            {lateFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Denda Keterlambatan</span>
                <span className="font-mono-num font-semibold text-rose-700">
                  {formatIDR(lateFee)}
                </span>
              </div>
            )}

            {receiptTemplate.includedItemsText.trim() && (
              <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
                <span>{receiptTemplate.includedItemsText}</span>
                <span className="shrink-0">Termasuk</span>
              </div>
            )}

            {receiptTemplate.showDepositInfo &&
              typeof room?.tenant?.depositAmount === 'number' &&
              room.tenant.depositAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Uang Jaminan / Deposit ({room.tenant.depositStatus ?? 'Disimpan'})
                  </span>
                  <span className="font-mono-num">
                    {formatIDR(room.tenant.depositAmount)}
                  </span>
                </div>
              )}

            {room?.receiptProfile?.customReceiptNote?.trim() && (
              <p className="text-xs text-slate-500 pt-1">
                Catatan: {room.receiptProfile.customReceiptNote}
              </p>
            )}
          </div>

          {/* 4. Total Highlight */}
          <div className="flex items-end justify-between gap-4">
            <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>LUNAS · TERVERIFIKASI</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Dibayarkan</p>
              <p className="font-mono-num text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight mt-0.5">
                {formatIDR(grandTotal)}
              </p>
            </div>
          </div>

          {/* 5. Verification QR & Signer */}
          <div className="pt-5 border-t border-slate-200 flex items-center justify-between gap-4">
            {receiptTemplate.showQrVerification && qrDataUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={qrDataUrl}
                  alt={`QR Verifikasi ${payment.invoiceNo}`}
                  className="w-16 h-16 rounded border border-slate-200 p-0.5 bg-white shrink-0"
                />
                <div className="text-[11px] text-slate-500 leading-snug">
                  <p className="font-semibold text-slate-700">Cek Keaslian &amp; PDF</p>
                  <p>
                    {shareUrl
                      ? 'Scan QR untuk buka kwitansi & unduh salinan PDF'
                      : `Ref: ${payment.invoiceNo}`}
                  </p>
                </div>
              </div>
            ) : (
              <span />
            )}

            <div className="text-right text-xs text-slate-500 shrink-0">
              <p>{receiptTemplate.signerLabel}</p>
              <p className="font-semibold text-slate-900 mt-3">{settings.adminName}</p>
            </div>
          </div>

          {receiptTemplate.footerNote.trim() && (
            <p className="text-xs text-slate-500 pt-3 border-t border-slate-100 leading-relaxed">
              {receiptTemplate.footerNote}
            </p>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#0D1219] border-t border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2.5 no-print">
          <button
            type="button"
            disabled={creatingLink}
            onClick={handleCopyOrCreateLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{shareUrl ? 'Salin Link PDF' : 'Buat Link PDF'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWA}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin WA</span>
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-700/25 dark:border-teal-400/25 bg-teal-50/80 dark:bg-teal-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Kirim ke WA</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? 'Membuat...' : 'Unduh PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
