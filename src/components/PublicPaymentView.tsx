import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Landmark,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Clock3,
  AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PaymentLinkRecord } from '../types/kost';
import { getPaymentLinkPublicInCloud, confirmPaymentLinkPublicInCloud } from '../services/kostFirestore';
import {
  buildPdfReceiptInputFromLink,
  buildShareablePaymentUrl,
  downloadReceiptPdf,
} from '../utils/receiptPdf';
import { buildWhatsAppUrl, formatDateID, formatIDR, formatMonthYear } from '../utils/format';
import { PropertyLogo } from './PropertyLogo';

interface PublicPaymentViewProps {
  linkId: string;
}

const ACCENT_HEADER_CLASS = {
  teal: 'from-[#0b4642] via-[#0f6b64] to-[#0d8278]',
  navy: 'from-[#0F172A] to-[#1E3A8A]',
  slate: 'from-[#0F172A] to-[#334155]',
};

export const PublicPaymentView: React.FC<PublicPaymentViewProps> = ({ linkId }) => {
  const [linkData, setLinkData] = useState<PaymentLinkRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [confirmMethod, setConfirmMethod] = useState('Transfer BCA');
  const [confirmNote, setConfirmNote] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const fetchLink = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getPaymentLinkPublicInCloud(linkId);
      if (!res) {
        setErrorMsg('Tautan tagihan tidak ditemukan atau sudah tidak berlaku.');
        setLinkData(null);
      } else {
        setLinkData(res);
        setConfirmMethod(res.preferredMethod || 'Transfer BCA');
      }
    } catch {
      setErrorMsg('Gagal memuat rincian pembayaran. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  useEffect(() => {
    if (!linkData || linkData.status !== 'Lunas' || linkData.receiptSnapshot?.showQrVerification === false) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(buildShareablePaymentUrl(linkData.id), {
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
  }, [linkData]);

  useEffect(() => {
    if (!copiedMsg) return;
    const t = window.setTimeout(() => setCopiedMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [copiedMsg]);

  const handleCopyAccount = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsg(`${label} disalin`);
    } catch {
      setCopiedMsg(`${label} siap disalin`);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkData) return;
    setSubmittingConfirm(true);
    setErrorMsg(null);
    try {
      await confirmPaymentLinkPublicInCloud(linkData.id, confirmMethod, confirmNote);
      setLinkData((prev) =>
        prev
          ? {
              ...prev,
              status: 'Menunggu Verifikasi',
              confirmationMethod: confirmMethod,
              confirmationNote: confirmNote.trim() || undefined,
              confirmedAt: new Date().toISOString(),
            }
          : prev
      );
    } catch {
      setErrorMsg('Gagal mengirim konfirmasi pembayaran. Silakan hubungi admin via WhatsApp.');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!linkData) return;
    setDownloadingPdf(true);
    try {
      const filename = await downloadReceiptPdf(buildPdfReceiptInputFromLink(linkData));
      setPdfNotice(`Bukti kwitansi ${filename} berhasil diunduh.`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Memuat tautan pembayaran resmi...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl surface-card border border-slate-200 p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="font-display font-semibold text-lg text-slate-900">
              Tautan Tidak Tersedia
            </h1>
            <p className="text-sm text-slate-600">
              {errorMsg || 'Data tagihan tidak ditemukan.'}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchLink}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl btn-primary text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Coba Muat Ulang</span>
          </button>
        </div>
      </div>
    );
  }

  const lateFee = linkData.lateFee ?? 0;
  const grandTotal = linkData.amount + lateFee;
  const isPaid = linkData.status === 'Lunas';
  const isPendingVerify = linkData.status === 'Menunggu Verifikasi';
  const snap = linkData.receiptSnapshot;
  const accentTheme = snap?.accentTheme ?? 'teal';

  const waAdminConfirmText = isPendingVerify
    ? `Halo ${linkData.adminName}, saya *${linkData.tenantName}* (${
        linkData.roomName || `Kamar ${linkData.roomNumber}`
      }) sudah membayar tagihan *${formatMonthYear(linkData.month)}* sebesar *${formatIDR(
        grandTotal
      )}* via *${linkData.confirmationMethod || confirmMethod}* (Invoice ${
        linkData.invoiceNo
      }). Mohon diverifikasi agar kwitansi PDF terbit.`
    : `Halo ${linkData.adminName}, saya *${linkData.tenantName}* (${
        linkData.roomName || `Kamar ${linkData.roomNumber}`
      }) ingin menanyakan tagihan *${formatMonthYear(linkData.month)}* (${linkData.invoiceNo}).`;

  const waAdminUrl = linkData.whatsappAdmin
    ? buildWhatsAppUrl(linkData.whatsappAdmin, waAdminConfirmText)
    : '';

  return (
    <div className="min-h-screen text-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header Card */}
        <div
          className={`rounded-2xl bg-gradient-to-br ${ACCENT_HEADER_CLASS[accentTheme]} text-white p-6 shadow-md no-print`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <PropertyLogo className="w-11 h-11" />
              <div>
                <p className="text-xs text-teal-100 font-medium">
                  Portal Pembayaran &amp; Kwitansi Digital
                </p>
                <h1 className="font-display font-bold text-xl">{linkData.propertyName}</h1>
                {linkData.propertyAddress && (
                  <p className="text-xs text-teal-100/90 mt-0.5">{linkData.propertyAddress}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-teal-100">
                No. Invoice
              </p>
              <p className="font-mono-num text-sm font-semibold">{linkData.invoiceNo}</p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-teal-100">Total Tagihan Sewa</p>
              <p className="font-mono-num text-2xl sm:text-3xl font-bold mt-0.5">
                {formatIDR(grandTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLink}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-medium text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Segarkan Status</span>
            </button>
          </div>
        </div>

        {/* Main Content Surface */}
        {isPaid ? (
          <div
            id="printable-receipt"
            className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 bg-emerald-50/70 border-b border-emerald-200/80 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Pembayaran Lunas &amp; Terverifikasi</p>
                  <p className="text-xs text-emerald-700">
                    Kwitansi resmi PDF siap diunduh di bawah ini
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-semibold"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {downloadingPdf ? 'Menyiapkan PDF...' : 'Unduh Bukti Kwitansi (PDF)'}
                  </span>
                </button>
              </div>
            </div>

            {pdfNotice && (
              <div className="px-6 py-2.5 bg-teal-50 border-b border-teal-200 text-xs text-teal-800 no-print">
                {pdfNotice}
              </div>
            )}

            <div className="p-6 sm:p-9 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="flex items-center gap-3">
                  {(snap?.showLogo ?? true) && <PropertyLogo className="w-9 h-9" />}
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-950">
                      {linkData.propertyName}
                    </h2>
                    {(snap?.showAddress ?? true) && linkData.propertyAddress && (
                      <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                        {linkData.propertyAddress}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold tracking-wide text-teal-700">
                    {snap?.title || 'KWITANSI SEWA RESMI'}
                  </p>
                  <p className="font-mono-num text-xs font-semibold text-slate-900 mt-1">
                    {linkData.invoiceNo}
                  </p>
                  {snap?.subtitle && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{snap.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 text-sm border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Penyewa &amp; Unit</p>
                  <p className="font-semibold text-slate-950 text-base">
                    {linkData.tenantName}
                  </p>
                  <p className="text-xs text-slate-600">
                    {linkData.roomName || `Kamar ${linkData.roomNumber}`}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs text-slate-500">Periode &amp; Pembayaran</p>
                  <p className="font-semibold text-slate-950 text-base">
                    {formatMonthYear(linkData.month)}
                  </p>
                  <p className="font-mono-num text-xs text-slate-600">
                    {formatDateID(linkData.paidDate)} ·{' '}
                    {linkData.method || linkData.preferredMethod || 'Transfer Bank'}
                  </p>
                </div>
              </div>

              <div className="border-b border-slate-200 pb-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">
                    Sewa {linkData.roomName || `Kamar ${linkData.roomNumber}`} (
                    {formatMonthYear(linkData.month)})
                  </span>
                  <span className="font-mono-num font-semibold text-slate-950">
                    {formatIDR(linkData.amount)}
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
                {(snap?.includedItemsText ||
                  'WiFi 100 Mbps, Air Bersih & Kebersihan Area Bersama') && (
                  <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
                    <span>
                      {snap?.includedItemsText ||
                        'WiFi 100 Mbps, Air Bersih & Kebersihan Area Bersama'}
                    </span>
                    <span className="shrink-0">Termasuk</span>
                  </div>
                )}
                {snap?.showDepositInfo &&
                  typeof snap.depositAmount === 'number' &&
                  snap.depositAmount > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Uang Jaminan / Deposit ({snap.depositStatus ?? 'Disimpan'})
                      </span>
                      <span className="font-mono-num">{formatIDR(snap.depositAmount)}</span>
                    </div>
                  )}
                {snap?.customRoomNote && (
                  <p className="text-xs text-slate-500 pt-1">
                    Catatan: {snap.customRoomNote}
                  </p>
                )}
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>LUNAS · TERVERIFIKASI</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total Dibayarkan</p>
                  <p className="font-mono-num text-2xl sm:text-3xl font-bold text-slate-950 mt-0.5">
                    {formatIDR(grandTotal)}
                  </p>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-200 flex items-center justify-between gap-4">
                {qrDataUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={qrDataUrl}
                      alt={`QR Verifikasi ${linkData.invoiceNo}`}
                      className="w-16 h-16 rounded border border-slate-200 p-0.5 bg-white shrink-0"
                    />
                    <div className="text-[11px] text-slate-500 leading-snug">
                      <p className="font-semibold text-slate-700">Cek Keaslian &amp; PDF</p>
                      <p>Scan QR untuk buka kwitansi &amp; unduh salinan PDF</p>
                    </div>
                  </div>
                ) : (
                  <span />
                )}
                <div className="text-right text-xs text-slate-500 shrink-0">
                  <p>{snap?.signerLabel || 'Pengelola Properti'}</p>
                  <p className="font-semibold text-slate-900 mt-3">{linkData.adminName}</p>
                </div>
              </div>

              {snap?.footerNote && (
                <p className="text-xs text-slate-500 pt-3 border-t border-slate-100 leading-relaxed">
                  {snap.footerNote}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 no-print">
            {/* Invoice Breakdown Card */}
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs text-slate-500">Tagihan Untuk</p>
                  <p className="font-display font-semibold text-base text-slate-900">
                    {linkData.tenantName} · {linkData.roomName || `Kamar ${linkData.roomNumber}`}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    isPendingVerify ? 'text-amber-700' : 'text-rose-700'
                  }`}
                >
                  <Clock3 className="w-3.5 h-3.5" />
                  <span>
                    {isPendingVerify ? 'Menunggu Verifikasi Admin' : 'Menunggu Pembayaran'}
                  </span>
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">
                    Sewa Bulan {formatMonthYear(linkData.month)}
                  </span>
                  <span className="font-mono-num font-medium text-slate-900">
                    {formatIDR(linkData.amount)}
                  </span>
                </div>
                {lateFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-rose-700">Denda Keterlambatan</span>
                    <span className="font-mono-num font-medium text-rose-700">
                      {formatIDR(lateFee)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Total Transfer</span>
                  <span className="font-mono-num text-lg font-bold text-teal-800">
                    {formatIDR(grandTotal)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Jatuh tempo setiap tanggal{' '}
                <span className="font-mono-num font-semibold text-slate-800">
                  {linkData.dueDay}
                </span>{' '}
                · Metode rekomendasi unit ini:{' '}
                <span className="font-semibold text-teal-700">
                  {linkData.preferredMethod}
                </span>
              </p>
            </div>

            {/* Payment Channels */}
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="font-display font-semibold text-base text-slate-900">
                  Pilihan Saluran Pembayaran
                </h2>
                {copiedMsg && (
                  <span className="text-xs font-medium text-teal-700">{copiedMsg}</span>
                )}
              </div>

              {(linkData.bankName || linkData.accountNumber) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-teal-800">
                    <Landmark className="w-4 h-4" aria-hidden="true" />
                    <span className="font-display text-xs font-semibold">
                      Transfer Bank {linkData.bankName || 'Rekening Pengelola'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono-num text-lg font-bold text-slate-900">
                        {linkData.accountNumber || '-'}
                      </p>
                      {linkData.accountHolder && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          a.n. {linkData.accountHolder}
                        </p>
                      )}
                    </div>
                    {linkData.accountNumber && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyAccount(linkData.accountNumber!, 'Nomor rekening')
                        }
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Salin No. Rek</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {linkData.qrisImageUrl && (
                <div className="pt-4 border-t border-slate-100 space-y-3 text-center">
                  <div className="inline-flex items-center gap-1.5 font-display text-xs font-semibold text-slate-700">
                    <QrCode className="w-4 h-4 text-teal-700" aria-hidden="true" />
                    <span>Scan QRIS Pembayaran</span>
                  </div>
                  <div className="max-w-[240px] mx-auto bg-white p-3 rounded-xl border border-slate-200">
                    <img
                      src={linkData.qrisImageUrl}
                      alt={`QRIS ${linkData.propertyName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-auto rounded-lg object-contain"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Mendukung GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin Mandiri &amp; QRIS bank lainnya.
                  </p>
                </div>
              )}

              {linkData.externalPaymentLink && (
                <a
                  href={linkData.externalPaymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-3 rounded-xl btn-secondary text-sm font-semibold text-teal-800"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  <span>Buka Tautan Pembayaran Khusus Kamar</span>
                </a>
              )}
            </div>

            {/* Tenant Payment Confirmation Form OR Pending Status */}
            {isPendingVerify ? (
              <div className="rounded-2xl bg-amber-50 border border-amber-300/80 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <h3 className="font-display font-semibold text-base text-amber-950">
                      Konfirmasi Pembayaran Terkirim
                    </h3>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Anda mengonfirmasi pembayaran via{' '}
                      <span className="font-semibold">
                        {linkData.confirmationMethod || 'Transfer Bank'}
                      </span>
                      {linkData.confirmationNote ? ` (${linkData.confirmationNote})` : ''}.
                      Setelah pengelola memverifikasi mutasi, tombol{' '}
                      <span className="font-semibold">Unduh Bukti Kwitansi PDF</span> akan muncul
                      otomatis di halaman ini.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {waAdminUrl && (
                    <a
                      href={waAdminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Kirim Bukti Transfer ke WhatsApp Admin</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={fetchLink}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-xs font-medium text-amber-900"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cek Status Kwitansi PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleConfirmPayment}
                className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4"
              >
                <div>
                  <h3 className="font-display font-semibold text-base text-slate-900">
                    Konfirmasi Sudah Bayar
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kirim pemberitahuan ke pengelola agar pembayaran langsung diverifikasi dan kwitansi PDF diterbitkan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Metode yang Digunakan
                    </label>
                    <select
                      value={confirmMethod}
                      onChange={(e) => setConfirmMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                    >
                      <option value="Transfer BCA">Transfer BCA</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Transfer Mandiri">Transfer Mandiri</option>
                      <option value="Tunai">Tunai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Catatan / Nama Pengirim (opsional)
                    </label>
                    <input
                      type="text"
                      maxLength={180}
                      placeholder="Misal: Transfer a.n. Rizky jam 14:20"
                      value={confirmNote}
                      onChange={(e) => setConfirmNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {waAdminUrl && (
                    <a
                      href={waAdminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tanya Admin via WhatsApp</span>
                    </a>
                  )}
                  <button
                    type="submit"
                    disabled={submittingConfirm}
                    className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl btn-primary text-sm font-medium ml-auto"
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {submittingConfirm
                        ? 'Mengirim Konfirmasi...'
                        : 'Saya Sudah Transfer / Bayar'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
