import React, { useMemo, useState } from 'react';
import {
  Search,
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
  Clock3,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  MessageTemplate,
  PaymentLinkRecord,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  PropertySettings,
  ReceiptTemplateConfig,
  Room,
} from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import {
  buildInvoiceNumber,
  buildWhatsAppUrl,
  formatDateID,
  formatIDR,
  formatMonthYear,
  getDueStatusInfo,
  getNextMonthISO,
  getTodayISO,
} from '../utils/format';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
} from '../utils/messageTemplates';
import { buildShareablePaymentUrl } from '../utils/receiptPdf';
import { CurrencyInput } from './CurrencyInput';
import { MonthCalendarPicker } from './MonthCalendarPicker';

export interface PaymentUpdatePayload {
  tenantName: string;
  month: string;
  invoiceNo: string;
  amount: number;
  lateFee?: number;
  status: PaymentStatus;
  paidDate: string | null;
  method: PaymentMethod | null;
  notes?: string;
}

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
  onOpenPaymentLinkModal: (
    payment?: PaymentRecord | null,
    room?: Room | null
  ) => void;
  onDownloadPdfReceipt: (payment: PaymentRecord) => Promise<void>;
  onGenerateMonthlyBills: (month: string) => Promise<void>;
  onUpdatePaymentDetails: (
    paymentId: string,
    payload: PaymentUpdatePayload
  ) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'Transfer BCA',
  'QRIS',
  'Transfer Mandiri',
  'Tunai',
];

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
  onOpenPaymentLinkModal,
  onDownloadPdfReceipt,
  onGenerateMonthlyBills,
  onUpdatePaymentDetails,
  onDeletePayment,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [search, setSearch] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(() =>
    getNextMonthISO(selectedMonth)
  );
  const [generating, setGenerating] = useState(false);

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editTenantName, setEditTenantName] = useState('');
  const [editMonth, setEditMonth] = useState(selectedMonth);
  const [editAmount, setEditAmount] = useState(0);
  const [editLateFee, setEditLateFee] = useState(0);
  const [editStatus, setEditStatus] = useState<PaymentStatus>('Belum Bayar');
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('Transfer BCA');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingTarget, setDeletingTarget] = useState<PaymentRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const activeTemplates =
    templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;

  const activePaymentMonths = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => set.add(p.month));
    return set;
  }, [payments]);

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

  const pendingVerifications = useMemo(() => {
    return payments
      .filter((p) => {
        if (p.status === 'Lunas' || !p.paymentLinkId) return false;
        const link = paymentLinksById[p.paymentLinkId];
        return link?.status === 'Menunggu Verifikasi';
      })
      .map((p) => ({
        payment: p,
        link: paymentLinksById[p.paymentLinkId!],
        room: rooms.find((r) => r.number === p.roomNumber) ?? null,
      }));
  }, [payments, paymentLinksById, rooms]);

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
    setEditTenantName(pay.tenantName);
    setEditMonth(pay.month);
    setEditAmount(pay.amount);
    setEditLateFee(pay.lateFee ?? 0);
    setEditStatus(pay.status);
    setEditPaidDate(pay.paidDate || getTodayISO());
    setEditMethod(pay.method ?? 'Transfer BCA');
    setEditNotes(pay.notes ?? '');
    setEditError('');
  };

  const handleSavePaymentEdit = async (pay: PaymentRecord) => {
    const cleanName = editTenantName.trim();
    if (cleanName.length < 2) {
      setEditError('Nama penyewa minimal 2 karakter.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(editMonth)) {
      setEditError('Pilih periode bulan yang valid.');
      return;
    }
    setEditError('');
    setSavingEdit(true);

    const standardOldInv = buildInvoiceNumber(pay.month, pay.roomNumber);
    const nextInvoiceNo =
      pay.month !== editMonth && pay.invoiceNo === standardOldInv
        ? buildInvoiceNumber(editMonth, pay.roomNumber)
        : pay.invoiceNo;

    try {
      await onUpdatePaymentDetails(pay.id, {
        tenantName: cleanName,
        month: editMonth,
        invoiceNo: nextInvoiceNo,
        amount: editAmount,
        lateFee: editLateFee,
        status: editStatus,
        paidDate: editStatus === 'Lunas' ? editPaidDate || getTodayISO() : null,
        method: editStatus === 'Lunas' ? editMethod : null,
        notes: editNotes.trim() || undefined,
      });
      setEditingPaymentId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setDeletingBusy(true);
    try {
      await onDeletePayment(deletingTarget.id);
      if (editingPaymentId === deletingTarget.id) {
        setEditingPaymentId(null);
      }
      setDeletingTarget(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Ringkasan Pembayaran Terpadu */}
      <section
        aria-label="Ringkasan Pembayaran"
        className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-white/[0.07]"
      >
        <div className="p-4 sm:p-5 focal-surface">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Terkumpul ({formatMonthYear(selectedMonth)})
          </p>
          <p className="font-mono-num text-xl sm:text-2xl font-semibold text-teal-800 dark:text-teal-300 mt-1">
            {formatIDR(summary.collected)}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Menunggu Pelunasan
          </p>
          <p className="font-mono-num text-xl sm:text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-1">
            {formatIDR(summary.pending)}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tingkat Kolektibilitas
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
              {summary.rate}%
            </p>
            <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
              · {summary.totalCount} tagihan
            </span>
          </div>
        </div>
      </section>

      {/* Filter, Kalender & Pencarian */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <MonthCalendarPicker
            mode="month"
            value={selectedMonth}
            onChange={onChangeMonth}
            activePeriods={activePaymentMonths}
            ariaLabel="Pilih Periode Bulan Pembayaran"
          />

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
            onClick={() => onOpenPaymentLinkModal(null, null)}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-primary text-xs font-semibold whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Buat Link Pembayaran</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGenerateMonth(getNextMonthISO(selectedMonth));
              setShowGenerator((v) => !v);
            }}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium whitespace-nowrap"
          >
            <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Buat Tagihan</span>
          </button>

          <button
            type="button"
            onClick={onOpenReceiptFormat}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>
              Format Kwitansi{receiptTemplate.autoGeneratePdfOnPaid ? ' (Auto)' : ''}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kamar, invoice..."
            aria-label="Cari pembayaran"
            className="w-full pl-9 pr-3 py-2 rounded-lg input-surface border text-xs sm:text-sm placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Generator Tagihan Bulanan */}
      {showGenerator && (
        <form
          onSubmit={handleGenerateSubmit}
          className="p-4 rounded-xl surface-card border border-teal-600/30 dark:border-teal-400/30 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="space-y-0.5">
            <p className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Buat Tagihan Otomatis untuk Kamar Terisi
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {missingForGenerateMonth > 0
                ? `Akan membuat ${missingForGenerateMonth} tagihan baru periode ${formatMonthYear(
                    generateMonth
                  )}.`
                : `Semua kamar terisi sudah memiliki tagihan periode ${formatMonthYear(
                    generateMonth
                  )}.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              required
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              aria-label="Pilih bulan tagihan baru"
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
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      )}

      {/* Antrian Verifikasi Konfirmasi Masuk dari Link Pembayaran */}
      {pendingVerifications.length > 0 && (
        <section
          aria-label="Antrian Verifikasi Pembayaran"
          className="rounded-xl surface-card border border-amber-400/50 dark:border-amber-400/30 bg-amber-50/60 dark:bg-amber-500/[0.06] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-amber-200/70 dark:border-amber-400/20 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Clock3 className="w-4 h-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
              <h2 className="font-display font-semibold text-xs sm:text-sm">
                Konfirmasi Pembayaran Masuk ({pendingVerifications.length})
              </h2>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Klik Verifikasi untuk otomatis ubah ke Lunas, buat PDF &amp; siapkan kirim kwitansi
            </p>
          </div>
          <div className="divide-y divide-amber-200/60 dark:divide-amber-400/15">
            {pendingVerifications.map(({ payment: pay, link, room }) => {
              const total = pay.amount + (pay.lateFee ?? 0);
              return (
                <div
                  key={pay.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">
                      {pay.tenantName} ·{' '}
                      <span className="text-slate-600 dark:text-slate-300">
                        {room ? getRoomDisplayName(room) : `Kamar ${pay.roomNumber}`}
                      </span>{' '}
                      <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        ({formatMonthYear(pay.month)})
                      </span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatIDR(total)}
                      </span>{' '}
                      via{' '}
                      <span className="font-medium">
                        {link?.confirmationMethod || 'Transfer Bank'}
                      </span>
                      {link?.confirmationNote ? ` · ${link.confirmationNote}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenPaymentLinkModal(pay, room)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium"
                    >
                      <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Detail Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onMarkPaid(pay.id)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl btn-primary text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Verifikasi Lunas &amp; Kirim Kwitansi</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tabel Tagihan */}
      <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.07] flex items-center justify-between">
          <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
            Pembayaran Sewa · {formatMonthYear(selectedMonth)}
          </h2>
          <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} baris
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-2.5">
            <p className="font-display font-medium text-slate-900 dark:text-white">
              Tidak ada data pembayaran untuk filter ini
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Catat pembayaran baru atau buat tagihan bulanan otomatis.
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
                  <th className="py-3 px-5">Penyewa</th>
                  <th className="py-3 px-4">Kamar</th>
                  <th className="py-3 px-4 text-right">Total Tagihan</th>
                  <th className="py-3 px-4">Tanggal / Tempo</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
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
                        <td className="py-3 px-5">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {pay.tenantName}
                          </p>
                          <p className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500">
                            {pay.invoiceNo}
                          </p>
                          {pay.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[220px]">
                              {pay.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-200">
                          {roomObj ? getRoomDisplayName(roomObj) : `Kamar ${pay.roomNumber}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {formatIDR(grandTotal)}
                          </p>
                          {lateFee > 0 && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400">
                              Termasuk denda {formatIDR(lateFee)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-num text-xs">
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
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                          {pay.method ?? linkRecord?.confirmationMethod ?? '-'}
                        </td>
                        <td className="py-3 px-4">
                          {isPaid ? (
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              Lunas
                            </span>
                          ) : isPendingVerify ? (
                            <div>
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-300">
                                Menunggu Verifikasi
                              </span>
                              {linkRecord?.confirmationNote && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                                  {linkRecord.confirmationNote}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                              Belum Bayar
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                isEditingThis
                                  ? setEditingPaymentId(null)
                                  : startEditPayment(pay)
                              }
                              className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl btn-secondary ${
                                isEditingThis
                                  ? 'border-teal-500/50 text-teal-700 dark:text-teal-300'
                                  : ''
                              }`}
                              title="Edit riwayat & rincian pembayaran"
                              aria-label={`Edit pembayaran ${pay.tenantName}`}
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>

                            {isPaid ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onDownloadPdfReceipt(pay)}
                                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl btn-secondary text-teal-700 dark:text-teal-300"
                                  title="Unduh Kwitansi PDF"
                                  aria-label={`Unduh PDF ${pay.invoiceNo}`}
                                >
                                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenReceipt(pay)}
                                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium whitespace-nowrap"
                                >
                                  <ReceiptText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                                  <span>Kwitansi</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onOpenPaymentLinkModal(pay, roomObj)}
                                  className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl btn-secondary ${
                                    pay.paymentLinkId
                                      ? 'text-teal-700 dark:text-teal-300 border-teal-500/40'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                  title={
                                    pay.paymentLinkId
                                      ? 'Kelola & Salin Link Pembayaran'
                                      : 'Buat Link Pembayaran'
                                  }
                                  aria-label="Buat atau Salin Link Pembayaran"
                                >
                                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                                {roomObj && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onCopyReminder(roomObj, grandTotal, pay)
                                      }
                                      className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl btn-secondary"
                                      title="Salin pesan pengingat WA"
                                      aria-label="Salin pengingat WA"
                                    >
                                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                    {roomObj.tenant && (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl btn-secondary text-teal-700 dark:text-teal-300"
                                        title="Buka & kirim langsung ke WhatsApp penyewa"
                                        aria-label={`Kirim WA ke ${pay.tenantName}`}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                      </a>
                                    )}
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onMarkPaid(pay.id)}
                                  className="min-h-[36px] px-3.5 py-1.5 rounded-xl btn-primary text-xs font-medium whitespace-nowrap"
                                >
                                  {isPendingVerify ? 'Verifikasi & Kwitansi' : 'Tandai Lunas'}
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeletingTarget(pay)}
                              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl btn-secondary text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/40"
                              title="Hapus riwayat pembayaran"
                              aria-label={`Hapus riwayat ${pay.tenantName} (${pay.invoiceNo})`}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEditingThis && (
                        <tr className="bg-slate-50/90 dark:bg-white/[0.03]">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-display font-semibold text-xs text-slate-900 dark:text-white">
                                  Edit Riwayat Pembayaran · {pay.invoiceNo}
                                </p>
                                <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                                  Total baru: {formatIDR(editAmount + editLateFee)}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                  <label
                                    htmlFor={`edit-name-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Nama Penyewa
                                  </label>
                                  <input
                                    id={`edit-name-${pay.id}`}
                                    type="text"
                                    maxLength={100}
                                    value={editTenantName}
                                    onChange={(e) => setEditTenantName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-month-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Periode Bulan
                                  </label>
                                  <input
                                    id={`edit-month-${pay.id}`}
                                    type="month"
                                    value={editMonth}
                                    onChange={(e) => setEditMonth(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-amount-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Sewa Dasar (Rp)
                                  </label>
                                  <CurrencyInput
                                    id={`edit-amount-${pay.id}`}
                                    compact
                                    value={editAmount}
                                    onChange={setEditAmount}
                                    className="w-full pr-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-late-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Denda Telat (Rp)
                                  </label>
                                  <CurrencyInput
                                    id={`edit-late-${pay.id}`}
                                    compact
                                    value={editLateFee}
                                    onChange={setEditLateFee}
                                    className="w-full pr-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-status-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Status Pembayaran
                                  </label>
                                  <select
                                    id={`edit-status-${pay.id}`}
                                    value={editStatus}
                                    onChange={(e) => {
                                      const next = e.target.value as PaymentStatus;
                                      setEditStatus(next);
                                      if (next === 'Lunas' && !editPaidDate) {
                                        setEditPaidDate(getTodayISO());
                                      }
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                                  >
                                    <option value="Belum Bayar">Belum Bayar</option>
                                    <option value="Lunas">Lunas</option>
                                  </select>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-date-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Tanggal Bayar
                                  </label>
                                  <input
                                    id={`edit-date-${pay.id}`}
                                    type="date"
                                    disabled={editStatus !== 'Lunas'}
                                    value={editStatus === 'Lunas' ? editPaidDate : ''}
                                    onChange={(e) => setEditPaidDate(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs disabled:opacity-50"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-method-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Metode Bayar
                                  </label>
                                  <select
                                    id={`edit-method-${pay.id}`}
                                    disabled={editStatus !== 'Lunas'}
                                    value={editMethod}
                                    onChange={(e) =>
                                      setEditMethod(e.target.value as PaymentMethod)
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs disabled:opacity-50"
                                  >
                                    {PAYMENT_METHODS.map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-notes-${pay.id}`}
                                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                                  >
                                    Catatan Pembayaran
                                  </label>
                                  <input
                                    id={`edit-notes-${pay.id}`}
                                    type="text"
                                    maxLength={300}
                                    placeholder="Opsional (misal: koreksi nominal)"
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                                  />
                                </div>
                              </div>

                              {editError && (
                                <p className="text-xs text-rose-600 dark:text-rose-400">
                                  {editError}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setDeletingTarget(pay)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Hapus Riwayat</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPaymentId(null)}
                                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-xs font-medium"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={() => handleSavePaymentEdit(pay)}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-primary text-xs font-medium disabled:opacity-60"
                                  >
                                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>{savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                                  </button>
                                </div>
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

      {/* Modal Konfirmasi Hapus Riwayat Pembayaran */}
      {deletingTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-payment-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="animate-modal-in w-full max-w-md rounded-2xl surface-card border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#101c20] shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="delete-payment-title"
                  className="font-display font-semibold text-base text-slate-900 dark:text-white"
                >
                  Hapus Riwayat Pembayaran?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Data transaksi ini dan link pembayarannya akan dihapus permanen dari laporan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingTarget(null)}
                aria-label="Tutup konfirmasi hapus"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] space-y-1 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">
                {deletingTarget.tenantName} · Kamar {deletingTarget.roomNumber}
              </p>
              <p className="font-mono-num text-slate-500 dark:text-slate-400">
                {deletingTarget.invoiceNo} · {formatMonthYear(deletingTarget.month)}
              </p>
              <p className="font-mono-num font-semibold text-rose-600 dark:text-rose-400 pt-1">
                {formatIDR(deletingTarget.amount + (deletingTarget.lateFee ?? 0))} (
                {deletingTarget.status})
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingBusy}
                onClick={() => setDeletingTarget(null)}
                className="min-h-[38px] px-4 py-2 rounded-xl btn-secondary text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingBusy}
                onClick={handleConfirmDelete}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{deletingBusy ? 'Menghapus...' : 'Ya, Hapus Riwayat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
