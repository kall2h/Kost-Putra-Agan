import React, { useMemo, useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock3,
  ReceiptText,
  Copy,
  CalendarPlus,
  ExternalLink,
  Pencil,
  Save,
  X,
  Download,
  Link2,
  FileText,
} from 'lucide-react';
import {
  MessageTemplate,
  PaymentLinkRecord,
  PaymentRecord,
  PaymentStatus,
  PropertySettings,
  ReceiptTemplateConfig,
  Room,
} from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import {
  buildWhatsAppUrl,
  formatDateID,
  formatIDR,
  formatMonthYear,
  getDueStatusInfo,
  getNextMonthISO,
} from '../utils/format';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
} from '../utils/messageTemplates';
import { buildShareablePaymentUrl } from '../utils/receiptPdf';
import { CurrencyInput } from './CurrencyInput';

interface PaymentsViewProps {
  payments: PaymentRecord[];
  rooms: Room[];
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
  paymentLinksById: Record<string, PaymentLinkRecord>;
  templates: MessageTemplate[];
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onMarkPaid: (paymentId: string) => void;
  onOpenReceipt: (payment: PaymentRecord) => void;
  onCopyReminder: (
    room: Room,
    amount: number,
    payment?: PaymentRecord | null
  ) => void;
  onOpenAddPayment: () => void;
  onOpenReceiptFormat: () => void;
  onCreateAndCopyPaymentLink: (
    payment: PaymentRecord,
    room?: Room | null
  ) => Promise<void>;
  onDownloadPdfReceipt: (payment: PaymentRecord) => Promise<void>;
  onGenerateMonthlyBills: (month: string) => Promise<void>;
  onUpdatePaymentDetails: (
    paymentId: string,
    payload: { amount: number; lateFee?: number; notes?: string }
  ) => Promise<void>;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments,
  rooms,
  settings,
  receiptTemplate,
  paymentLinksById,
  templates,
  selectedMonth,
  onChangeMonth,
  onMarkPaid,
  onOpenReceipt,
  onCopyReminder,
  onOpenAddPayment,
  onOpenReceiptFormat,
  onCreateAndCopyPaymentLink,
  onDownloadPdfReceipt,
  onGenerateMonthlyBills,
  onUpdatePaymentDetails,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [search, setSearch] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(() =>
    getNextMonthISO(selectedMonth)
  );
  const [generating, setGenerating] = useState(false);

  // Inline late fee / amount editor
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editLateFee, setEditLateFee] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const activeTemplates =
    templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;

  const monthOptions = useMemo(() => {
    const set = new Set(payments.map((p) => p.month));
    set.add(selectedMonth);
    const months = Array.from(set).sort().reverse();
    return months.length > 0 ? months : ['2026-11', '2026-10'];
  }, [payments, selectedMonth]);

  const monthPayments = useMemo(
    () => payments.filter((p) => p.month === selectedMonth),
    [payments, selectedMonth]
  );

  const summary = useMemo(() => {
    const collected = monthPayments
      .filter((p) => p.status === 'Lunas')
      .reduce((acc, p) => acc + p.amount + (p.lateFee ?? 0), 0);
    const pending = monthPayments
      .filter((p) => p.status === 'Belum Bayar')
      .reduce((acc, p) => acc + p.amount + (p.lateFee ?? 0), 0);
    const total = collected + pending;
    const rate = total > 0 ? Math.round((collected / total) * 100) : 0;
    return { collected, pending, rate, totalCount: monthPayments.length };
  }, [monthPayments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthPayments
      .filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (!q) return true;
        return (
          p.tenantName.toLowerCase().includes(q) ||
          p.roomNumber.toLowerCase().includes(q) ||
          p.invoiceNo.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Belum Bayar' ? -1 : 1;
        return a.roomNumber.localeCompare(b.roomNumber);
      });
  }, [monthPayments, statusFilter, search]);

  const missingForGenerateMonth = useMemo(() => {
    const existing = new Set(
      payments.filter((p) => p.month === generateMonth).map((p) => p.roomNumber)
    );
    return rooms.filter(
      (r) => r.status === 'Terisi' && r.tenant && !existing.has(r.number)
    ).length;
  }, [payments, rooms, generateMonth]);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await onGenerateMonthlyBills(generateMonth);
      onChangeMonth(generateMonth);
      setShowGenerator(false);
    } finally {
      setGenerating(false);
    }
  };

  const startEditPayment = (pay: PaymentRecord) => {
    setEditingPaymentId(pay.id);
    setEditAmount(pay.amount);
    setEditLateFee(pay.lateFee ?? 0);
    setEditNotes(pay.notes ?? '');
  };

  const handleSavePaymentEdit = async (paymentId: string) => {
    setSavingEdit(true);
    try {
      await onUpdatePaymentDetails(paymentId, {
        amount: editAmount,
        lateFee: editLateFee,
        notes: editNotes.trim() || undefined,
      });
      setEditingPaymentId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl gradient-hero-card border border-teal-800/20">
          <p className="text-xs text-teal-100">
            Terkumpul ({formatMonthYear(selectedMonth)})
          </p>
          <p className="font-mono-num text-xl sm:text-2xl font-semibold text-white mt-1.5">
            {formatIDR(summary.collected)}
          </p>
        </div>

        <div className="p-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Menunggu Pelunasan
          </p>
          <p className="font-mono-num text-xl sm:text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-1.5">
            {formatIDR(summary.pending)}
          </p>
        </div>

        <div className="p-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tingkat Kolektibilitas</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
              {summary.rate}%
            </p>
            <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
              · {summary.totalCount} tagihan
            </span>
          </div>
        </div>
      </div>

      {/* Filter, Generator & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            aria-label="Pilih Periode Bulan"
            className="px-3.5 py-2 rounded-lg input-surface border text-sm font-medium"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthYear(m)}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg surface-card border border-slate-200/90 dark:border-white/[0.08]">
            {(['all', 'Belum Bayar', 'Lunas'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'nav-active-gradient text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status === 'all' ? 'Semua' : status}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setGenerateMonth(getNextMonthISO(selectedMonth));
              setShowGenerator((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg surface-card border border-slate-200/90 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Buat Tagihan Bulanan</span>
          </button>

          <button
            type="button"
            onClick={onOpenReceiptFormat}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg surface-card border border-slate-200/90 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>
              Format Kwitansi PDF{receiptTemplate.autoGeneratePdfOnPaid ? ' (Auto)' : ''}
            </span>
          </button>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kamar, no. invoice..."
            className="w-full pl-9 pr-3 py-2 rounded-lg input-surface border text-sm placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Monthly Bill Generator Panel */}
      {showGenerator && (
        <form
          onSubmit={handleGenerateSubmit}
          className="p-4 sm:p-5 rounded-xl surface-card border border-teal-600/30 dark:border-teal-400/30 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <p className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Generate Tagihan Otomatis untuk Seluruh Kamar Terisi
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {missingForGenerateMonth > 0
                ? `Akan membuat ${missingForGenerateMonth} tagihan baru (status Belum Bayar) untuk periode ${formatMonthYear(
                    generateMonth
                  )}.`
                : `Semua kamar terisi sudah memiliki tagihan untuk periode ${formatMonthYear(
                    generateMonth
                  )}.`}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="month"
              required
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              className="px-3 py-2 rounded-lg input-surface border font-mono-num text-xs"
            />
            <button
              type="submit"
              disabled={generating || missingForGenerateMonth === 0}
              className="px-4 py-2 rounded-lg btn-primary text-xs font-medium disabled:opacity-50"
            >
              {generating ? 'Membuat...' : `Buat ${missingForGenerateMonth} Tagihan`}
            </button>
            <button
              type="button"
              onClick={() => setShowGenerator(false)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              aria-label="Tutup generator tagihan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Ledger Table */}
      <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.07] flex items-center justify-between">
          <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
            Pembayaran Sewa — {formatMonthYear(selectedMonth)}
          </h2>
          <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} baris
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ReceiptText className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto" />
            <p className="font-display font-medium text-slate-900 dark:text-white">
              Tidak ada data pembayaran ditemukan
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Catat pembayaran baru atau buat tagihan bulanan otomatis di atas.
            </p>
            <button
              type="button"
              onClick={onOpenAddPayment}
              className="px-4 py-2 rounded-lg btn-primary text-xs font-medium transition-colors"
            >
              Catat Pembayaran
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-5">Penyewa</th>
                  <th className="py-3.5 px-4">Kamar</th>
                  <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                  <th className="py-3.5 px-4">Tanggal / Tempo</th>
                  <th className="py-3.5 px-4">Metode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-sm">
                {filtered.map((pay) => {
                  const isPaid = pay.status === 'Lunas';
                  const roomObj = rooms.find((r) => r.number === pay.roomNumber);
                  const lateFee = pay.lateFee ?? 0;
                  const grandTotal = pay.amount + lateFee;
                  const dueDay = roomObj?.tenant?.dueDay ?? settings.defaultDueDay;
                  const dueInfo = !isPaid ? getDueStatusInfo(pay.month, dueDay) : null;
                  const linkRecord = pay.paymentLinkId
                    ? paymentLinksById[pay.paymentLinkId]
                    : undefined;
                  const isPendingVerify =
                    !isPaid && linkRecord?.status === 'Menunggu Verifikasi';

                  const tpl =
                    dueInfo?.tone === 'overdue'
                      ? activeTemplates.find((t) => t.category === 'tunggakan') ??
                        activeTemplates[0]
                      : activeTemplates.find((t) => t.category === 'tagihan') ??
                        activeTemplates[0];
                  const waText = roomObj
                    ? renderMessageTemplate(tpl.body, {
                        settings,
                        room: roomObj,
                        payment: pay,
                        month: pay.month,
                        paymentUrl: pay.paymentLinkId
                          ? buildShareablePaymentUrl(pay.paymentLinkId)
                          : undefined,
                      })
                    : '';
                  const waUrl = roomObj?.tenant
                    ? buildWhatsAppUrl(roomObj.tenant.phone, waText)
                    : '#';

                  const isEditingThis = editingPaymentId === pay.id;

                  return (
                    <React.Fragment key={pay.id}>
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-5">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {pay.tenantName}
                          </p>
                          <p className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500">
                            {pay.invoiceNo}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-200">
                          {roomObj ? getRoomDisplayName(roomObj) : `Kamar ${pay.roomNumber}`}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-num">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {formatIDR(grandTotal)}
                          </p>
                          {lateFee > 0 && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400">
                              Termasuk denda {formatIDR(lateFee)}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-xs">
                          {isPaid ? (
                            <span className="text-slate-600 dark:text-slate-300">
                              {formatDateID(pay.paidDate)}
                            </span>
                          ) : (
                            <span
                              className={
                                dueInfo?.tone === 'overdue'
                                  ? 'text-rose-600 dark:text-rose-400 font-medium'
                                  : dueInfo?.tone === 'due_soon'
                                  ? 'text-amber-600 dark:text-amber-300 font-medium'
                                  : 'text-slate-500 dark:text-slate-400'
                              }
                            >
                              {dueInfo?.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                          {pay.method ?? linkRecord?.confirmationMethod ?? '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Lunas</span>
                            </span>
                          ) : isPendingVerify ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                                <Clock3 className="w-3.5 h-3.5" />
                                <span>Menunggu Verifikasi</span>
                              </span>
                              {linkRecord?.confirmationNote && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                                  {linkRecord.confirmationNote}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                              <Clock3 className="w-3.5 h-3.5" />
                              <span>Belum Bayar</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {isPaid ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onDownloadPdfReceipt(pay)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-teal-700 dark:text-teal-300 transition-colors"
                                title="Unduh Kwitansi PDF"
                                aria-label={`Unduh PDF ${pay.invoiceNo}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenReceipt(pay)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                              >
                                <ReceiptText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                <span>Kwitansi</span>
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  isEditingThis
                                    ? setEditingPaymentId(null)
                                    : startEditPayment(pay)
                                }
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                                title="Atur denda / nominal tagihan"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onCreateAndCopyPaymentLink(pay, roomObj)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-teal-700 dark:text-teal-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                                title={
                                  pay.paymentLinkId
                                    ? 'Salin Link Pembayaran Bank/QRIS'
                                    : 'Buat & Salin Link Pembayaran'
                                }
                                aria-label="Salin Link Pembayaran"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              {roomObj && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onCopyReminder(roomObj, grandTotal, pay)
                                    }
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                                    title="Salin pesan pengingat WA"
                                    aria-label="Salin pengingat WA"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {roomObj.tenant && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-teal-700 dark:text-teal-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                                      title="Buka & kirim langsung ke WhatsApp penyewa"
                                      aria-label={`Kirim WA ke ${pay.tenantName}`}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => onMarkPaid(pay.id)}
                                className="px-3 py-1.5 rounded-lg btn-primary text-xs font-medium transition-colors whitespace-nowrap"
                              >
                                {isPendingVerify ? 'Verifikasi & PDF' : 'Tandai Lunas'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditingThis && (
                        <tr className="bg-slate-50 dark:bg-white/[0.03]">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  Sewa Dasar (Rp)
                                </label>
                                <CurrencyInput
                                  compact
                                  value={editAmount}
                                  onChange={setEditAmount}
                                  aria-label="Sewa Dasar (Rp)"
                                  className="w-40 pr-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  Denda Telat (Rp)
                                </label>
                                <CurrencyInput
                                  compact
                                  value={editLateFee}
                                  onChange={setEditLateFee}
                                  aria-label="Denda Telat (Rp)"
                                  className="w-36 pr-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                                />
                              </div>
                              <div className="flex-1 min-w-[180px]">
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  Catatan Tagihan
                                </label>
                                <input
                                  type="text"
                                  maxLength={300}
                                  placeholder="Misal: Denda telat 3 hari"
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPaymentId(null)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-xs"
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  disabled={savingEdit}
                                  onClick={() => handleSavePaymentEdit(pay.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg btn-primary text-xs font-medium"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>{savingEdit ? 'Menyimpan...' : 'Simpan'}</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
