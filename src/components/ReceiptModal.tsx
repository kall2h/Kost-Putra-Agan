import React, { useState } from 'react';
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
  teal: 'border-t-4 border-t-teal-700',
  navy: 'border-t-4 border-t-blue-900',
  slate: 'border-t-4 border-t-slate-700',
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

  if (!payment) return null;

  const lateFee = payment.lateFee ?? 0;
  const grandTotal = payment.amount + lateFee;
  const shareUrl = payment.paymentLinkId
    ? buildShareablePaymentUrl(payment.paymentLinkId)
    : '';

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
        className="fixed inset-0 bg-black/55 backdrop-blur-xs no-print"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kwitansi Pembayaran Digital"
        className="relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-white to-[#F4FCFA] dark:from-[#0C1E22] dark:to-[#071418] border border-teal-900/[0.1] dark:border-teal-400/[0.16] shadow-xl overflow-hidden"
      >
        {/* Top Action Bar */}
        <div className="px-6 py-3.5 border-b border-teal-900/[0.08] dark:border-teal-400/[0.1] flex items-center justify-between no-print">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono-num truncate">
              {payment.invoiceNo}
            </span>
            {payment.receiptGeneratedAt && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                · Auto-PDF Aktif
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup kwitansi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Architectural Receipt Surface */}
        <div
          id="printable-receipt"
          className={`flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-slate-900 space-y-6 ${
            ACCENT_TOP_CLASS[receiptTemplate.accentTheme] ?? ACCENT_TOP_CLASS.teal
          }`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              {receiptTemplate.showLogo && <PropertyLogo className="w-10 h-10" />}
              <div>
                <h2 className="font-display font-bold text-lg text-slate-950">
                  {settings.name}
                </h2>
                {receiptTemplate.showAddress && (
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    {settings.address}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-[11px] uppercase tracking-wider font-semibold ${
                  ACCENT_TEXT_CLASS[receiptTemplate.accentTheme] ?? ACCENT_TEXT_CLASS.teal
                }`}
              >
                {receiptTemplate.title}
              </p>
              {receiptTemplate.subtitle && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {receiptTemplate.subtitle}
                </p>
              )}
              <p className="font-mono-num text-xs font-semibold text-slate-900 mt-0.5">
                {payment.invoiceNo}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Diterima Dari</p>
              <p className="font-semibold text-slate-950 mt-0.5">{payment.tenantName}</p>
              <p className="font-mono-num text-xs text-slate-600 mt-0.5">
                {room ? getRoomDisplayName(room) : `Kamar ${payment.roomNumber}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Periode Tagihan</p>
              <p className="font-semibold text-slate-950 mt-0.5">
                {formatMonthYear(payment.month)}
              </p>
              <p className="font-mono-num text-xs text-slate-600 mt-0.5">
                Dibayar: {formatDateID(payment.paidDate)}
              </p>
            </div>
          </div>

          {/* Itemized Breakdown */}
          <div className="border-t border-b border-slate-200 py-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">
                Sewa {room ? getRoomDisplayName(room) : `Kamar ${payment.roomNumber}`} (
                {formatMonthYear(payment.month)})
              </span>
              <span className="font-mono-num font-medium text-slate-950">
                {formatIDR(payment.amount)}
              </span>
            </div>
            {lateFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Denda Keterlambatan</span>
                <span className="font-mono-num font-medium text-rose-700">
                  {formatIDR(lateFee)}
                </span>
              </div>
            )}
            {receiptTemplate.includedItemsText.trim() && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{receiptTemplate.includedItemsText}</span>
                <span>Termasuk</span>
              </div>
            )}
            {receiptTemplate.showDepositInfo &&
              typeof room?.tenant?.depositAmount === 'number' &&
              room.tenant.depositAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Status Deposit ({room.tenant.depositStatus ?? 'Disimpan'})
                  </span>
                  <span className="font-mono-num">
                    {formatIDR(room.tenant.depositAmount)}
                  </span>
                </div>
              )}
            {room?.receiptProfile?.customReceiptNote?.trim() && (
              <p className="text-xs italic text-slate-600 pt-1">
                Catatan Profil Kamar: {room.receiptProfile.customReceiptNote}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Metode Pembayaran</p>
              <p className="text-sm font-medium text-slate-800 mt-0.5">
                {payment.method ?? 'Transfer Bank'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Dibayarkan</p>
              <p className="font-mono-num text-2xl font-bold text-slate-950">
                {formatIDR(grandTotal)}
              </p>
            </div>
          </div>

          {/* Verification Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>LUNAS · TERVERIFIKASI</span>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{receiptTemplate.signerLabel}</p>
              <p className="font-semibold text-slate-800 mt-0.5">{settings.adminName}</p>
            </div>
          </div>

          {receiptTemplate.footerNote.trim() && (
            <p className="text-xs text-slate-500 pt-3 border-t border-slate-100 leading-relaxed">
              {receiptTemplate.footerNote}
            </p>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0D1219] border-t border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2.5 no-print">
          <button
            type="button"
            disabled={creatingLink}
            onClick={handleCopyOrCreateLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{shareUrl ? 'Salin Link PDF' : 'Buat Link PDF'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWA}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin WA</span>
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-700/25 dark:border-teal-400/25 bg-teal-50/80 dark:bg-teal-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Kirim ke WA</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-xs sm:text-sm font-medium transition-colors"
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
