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
import { PaymentLinkRecord } from '../types/kost';
import { getPaymentLinkPublicInCloud, confirmPaymentLinkPublicInCloud } from '../services/kostFirestore';
import { buildPdfReceiptInputFromLink, downloadReceiptPdf } from '../utils/receiptPdf';
import { buildWhatsAppUrl, formatDateID, formatIDR, formatMonthYear } from '../utils/format';
import { PropertyLogo } from './PropertyLogo';

interface PublicPaymentViewProps {
  linkId: string;
}

const ACCENT_HEADER_CLASS = {
  teal: 'from-[#06383B] via-[#0B5A5A] to-[#0D9488]',
  navy: 'from-[#0F172A] via-[#1E3A8A] to-[#1D4ED8]',
  slate: 'from-[#0F172A] via-[#334155] to-[#475569]',
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
      <div className="min-h-screen bg-gradient-to-br from-[#F1FAF7] via-[#F7FCFA] to-[#E6F7F2] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Memuat tautan pembayaran resmi...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !linkData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F1FAF7] via-[#F7FCFA] to-[#E6F7F2] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-teal-900/10 shadow-sm p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
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
    <div className="min-h-screen bg-gradient-to-br from-[#F1FAF7] via-[#F7FCFA] to-[#E4F6F1] text-slate-900 py-8 px-4">
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
              <p className="text-[11px] uppercase tracking-wider text-teal-100">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-medium text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan Status</span>
            </button>
          </div>
        </div>

        {/* Main Content Surface */}
        {isPaid ? (
          <div
            id="printable-receipt"
            className="rounded-2xl bg-white border border-emerald-600/25 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
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

            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="flex items-center gap-3">
                  {(snap?.showLogo ?? true) && <PropertyLogo className="w-10 h-10" />}
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-950">
                      {linkData.propertyName}
                    </h2>
                    {(snap?.showAddress ?? true) && linkData.propertyAddress && (
                      <p className="text-xs text-slate-500 max-w-xs">
                        {linkData.propertyAddress}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-teal-700">
                    {snap?.title || 'KWITANSI SEWA RESMI'}
                  </p>
                  {snap?.subtitle && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{snap.subtitle}</p>
                  )}
                  <p className="font-mono-num text-xs font-semibold text-slate-900 mt-1">
                    {linkData.invoiceNo}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Diterima Dari</p>
                  <p className="font-semibold text-slate-950 mt-0.5">{linkData.tenantName}</p>
                  <p className="font-mono-num text-xs text-slate-600 mt-0.5">
                    {linkData.roomName || `Kamar ${linkData.roomNumber}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Periode Tagihan</p>
                  <p className="font-semibold text-slate-950 mt-0.5">
                    {formatMonthYear(linkData.month)}
                  </p>
                  <p className="font-mono-num text-xs text-slate-600 mt-0.5">
                    Dibayar: {formatDateID(linkData.paidDate)}
                  </p>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">
                    Sewa {linkData.roomName || `Kamar ${linkData.roomNumber}`} (
                    {formatMonthYear(linkData.month)})
                  </span>
                  <span className="font-mono-num font-medium text-slate-950">
                    {formatIDR(linkData.amount)}
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
                {(snap?.includedItemsText ||
                  'WiFi 100 Mbps, Air Bersih & Kebersihan Area Bersama') && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {snap?.includedItemsText ||
                        'WiFi 100 Mbps, Air Bersih & Kebersihan Area Bersama'}
                    </span>
                    <span>Termasuk</span>
                  </div>
                )}
                {snap?.showDepositInfo &&
                  typeof snap.depositAmount === 'number' &&
                  snap.depositAmount > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Status Deposit ({snap.depositStatus ?? 'Disimpan'})
                      </span>
                      <span className="font-mono-num">{formatIDR(snap.depositAmount)}</span>
                    </div>
                  )}
                {snap?.customRoomNote && (
                  <p className="text-xs italic text-slate-600 pt-1">
                    Catatan Kamar: {snap.customRoomNote}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Metode Pembayaran</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">
                    {linkData.method || linkData.preferredMethod || 'Transfer Bank'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total Dibayarkan</p>
                  <p className="font-mono-num text-2xl font-bold text-slate-950">
                    {formatIDR(grandTotal)}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>LUNAS · TERVERIFIKASI</span>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{snap?.signerLabel || 'Pengelola Properti'}</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{linkData.adminName}</p>
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
            <div className="rounded-2xl bg-white border border-teal-900/10 shadow-sm p-6 space-y-4">
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

            {/* Payment Channels (Bank Transfer, QRIS, External Link) */}
            <div className="rounded-2xl bg-white border border-teal-900/10 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-semibold text-base text-slate-900">
                  Pilihan Saluran Pembayaran
                </h2>
                {copiedMsg && (
                  <span className="text-xs font-medium text-teal-700">{copiedMsg}</span>
                )}
              </div>

              {(linkData.bankName || linkData.accountNumber) && (
                <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-700/15 space-y-2">
                  <div className="flex items-center gap-2 text-teal-800">
                    <Landmark className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-teal-700/20 text-xs font-medium text-teal-800 hover:bg-teal-50"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin No. Rek</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {linkData.qrisImageUrl && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-center">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                    <QrCode className="w-4 h-4 text-teal-700" />
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-teal-700/25 bg-teal-50/60 hover:bg-teal-100/70 text-sm font-semibold text-teal-800 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Tautan Pembayaran Khusus Kamar</span>
                </a>
              )}
            </div>

            {/* Tenant Payment Confirmation Form OR Pending Status */}
            {isPendingVerify ? (
              <div className="rounded-2xl bg-amber-50 border border-amber-300/80 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-xs font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Kirim Bukti Transfer ke WhatsApp Admin</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={fetchLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-amber-300 text-xs font-medium text-amber-900"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Cek Status Kwitansi PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleConfirmPayment}
                className="rounded-2xl bg-white border border-teal-900/10 shadow-sm p-6 space-y-4"
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
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Tanya Admin via WhatsApp</span>
                    </a>
                  )}
                  <button
                    type="submit"
                    disabled={submittingConfirm}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-sm font-medium ml-auto"
                  >
                    <CheckCircle2 className="w-4 h-4" />
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
