import React, { useMemo, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  MessageSquareText,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  ExpenseCategory,
  ExpenseRecord,
  MonthlyHistoricalSummary,
  PaymentRecord,
  PropertySettings,
  Room,
} from '../types/kost';
import {
  buildWhatsAppUrl,
  formatDateID,
  formatIDR,
  formatMonthYear,
} from '../utils/format';
import { buildMonthlyFinanceWhatsAppSummary } from '../utils/messageTemplates';
import { CashflowTrendChart } from './CashflowTrendChart';

interface FinanceViewProps {
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  rooms: Room[];
  settings: PropertySettings;
  cashflowHistory: MonthlyHistoricalSummary[];
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onOpenAddExpense: () => void;
  onDeleteExpense: (id: string) => void;
  onExportSuccess: (msg: string) => void;
}

const CATEGORIES: ExpenseCategory[] = ['Listrik', 'Air', 'Bahan', 'Tagihan', 'Lainnya'];

export const FinanceView: React.FC<FinanceViewProps> = ({
  payments,
  expenses,
  rooms,
  settings,
  cashflowHistory,
  selectedMonth,
  onChangeMonth,
  onOpenAddExpense,
  onDeleteExpense,
  onExportSuccess,
}) => {
  const [waReportOpen, setWaReportOpen] = useState(false);

  const monthOptions = useMemo(() => {
    const set = new Set<string>([
      selectedMonth,
      ...payments.map((p) => p.month),
      ...expenses.map((e) => e.month),
    ]);
    return Array.from(set).sort().reverse();
  }, [payments, expenses, selectedMonth]);

  const monthIncome = useMemo(
    () =>
      payments
        .filter((p) => p.month === selectedMonth && p.status === 'Lunas')
        .reduce((acc, p) => acc + p.amount + (p.lateFee ?? 0), 0),
    [payments, selectedMonth]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.month === selectedMonth),
    [expenses, selectedMonth]
  );

  const totalExpense = useMemo(
    () => monthExpenses.reduce((acc, e) => acc + e.amount, 0),
    [monthExpenses]
  );

  const netProfit = monthIncome - totalExpense;

  const categoryTotals = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const sum = monthExpenses
        .filter((e) => e.category === cat)
        .reduce((acc, e) => acc + e.amount, 0);
      const pct = totalExpense > 0 ? Math.round((sum / totalExpense) * 100) : 0;
      return { category: cat, amount: sum, pct };
    });
  }, [monthExpenses, totalExpense]);

  const waSummaryText = useMemo(
    () =>
      buildMonthlyFinanceWhatsAppSummary({
        settings,
        month: selectedMonth,
        rooms,
        payments,
        expenses,
      }),
    [settings, selectedMonth, rooms, payments, expenses]
  );

  const handleExportCSV = () => {
    const header = 'Tanggal,Tipe,Kategori/Kamar,Deskripsi,Nominal (IDR)\n';
    const incomeRows = payments
      .filter((p) => p.month === selectedMonth && p.status === 'Lunas')
      .map(
        (p) =>
          `${p.paidDate ?? ''},Pemasukan,Kamar ${p.roomNumber},"Sewa ${p.tenantName}",${
            p.amount + (p.lateFee ?? 0)
          }`
      );
    const expenseRows = monthExpenses.map(
      (e) => `${e.date},Pengeluaran,${e.category},"${e.title}",-${e.amount}`
    );

    const csv = header + [...incomeRows, ...expenseRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `laporan-keuangan-kost-putra-agan-${selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportSuccess(
      `Laporan keuangan ${formatMonthYear(selectedMonth)} berhasil diunduh (CSV)`
    );
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(waSummaryText);
      onExportSuccess(
        `Ringkasan laporan ${formatMonthYear(selectedMonth)} disalin untuk WhatsApp`
      );
    } catch {
      onExportSuccess('Ringkasan laporan siap diteruskan');
    }
  };

  const handleDownloadSummaryTxt = () => {
    const blob = new Blob([waSummaryText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ringkasan-laporan-${selectedMonth}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportSuccess(`Ringkasan laporan ${formatMonthYear(selectedMonth)} diunduh (.TXT)`);
  };

  return (
    <div className="space-y-6">
      {/* Month Filter & Quick Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            aria-label="Pilih Periode Keuangan"
            className="px-3.5 py-2 rounded-lg surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthYear(m)}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Menampilkan arus kas &amp; rincian biaya periode terpilih
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWaReportOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-700/20 dark:border-teal-400/25 bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-500/10 dark:to-emerald-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium transition-colors"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Ringkasan Laporan WA</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-900/10 dark:border-teal-400/15 surface-card hover:bg-teal-50 dark:hover:bg-white/[0.05] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Expandable WhatsApp Executive Report Preview */}
      {waReportOpen && (
        <section className="rounded-xl surface-card border border-teal-600/25 dark:border-teal-400/25 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                Format Ringkasan Laporan Bulanan (Siap Teruskan ke WhatsApp)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cocok untuk laporan rutin ke pemilik properti atau arsip grup pengelola
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWaReportOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Tutup ringkasan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-slate-50 dark:bg-[#081316] border border-teal-900/[0.08] dark:border-teal-400/[0.12] text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
            {waSummaryText}
          </pre>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-900/15 dark:border-teal-400/20 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-white/[0.06]"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Teks</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSummaryTxt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-900/15 dark:border-teal-400/20 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-white/[0.06]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .TXT</span>
            </button>
            <a
              href={buildWhatsAppUrl(settings.whatsappAdmin, waSummaryText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-xs font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Teruskan ke WhatsApp</span>
            </a>
          </div>
        </section>
      )}

      {/* Top 3 Financial Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pemasukan ({formatMonthYear(selectedMonth)})
          </p>
          <p className="font-mono-num text-2xl sm:text-[28px] font-semibold text-slate-900 dark:text-white mt-2">
            {formatIDR(monthIncome)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
            Pembayaran sewa &amp; denda terverifikasi lunas
          </p>
        </div>

        <div className="p-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pengeluaran Operasional
          </p>
          <p className="font-mono-num text-2xl sm:text-[28px] font-semibold text-slate-900 dark:text-white mt-2">
            {formatIDR(totalExpense)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {monthExpenses.length} transaksi tercatat bulan ini
          </p>
        </div>

        <div className="p-5 rounded-xl gradient-hero-card border border-teal-500/30">
          <p className="text-xs text-teal-100">Laba Bersih</p>
          <p className="font-mono-num text-2xl sm:text-[28px] font-semibold text-white mt-2">
            {formatIDR(netProfit)}
          </p>
          <p className="text-xs text-teal-100/90 mt-1.5">
            Surplus bersih properti periode {formatMonthYear(selectedMonth)}
          </p>
        </div>
      </div>

      {/* Category Breakdown + 6-Month Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Pengeluaran per Kategori
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Distribusi biaya operasional {formatMonthYear(selectedMonth)}
              </p>
            </div>
            <span className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-300">
              100%
            </span>
          </div>

          <div className="space-y-4">
            {categoryTotals.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-3 font-mono-num text-xs">
                    <span className="text-slate-400 dark:text-slate-500">
                      {item.pct}%
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white w-28 text-right">
                      {formatIDR(item.amount)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-teal-950/10 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full gradient-bar transition-all duration-300"
                    style={{ width: `${Math.max(item.pct, item.amount > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-7 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6">
          <div className="border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3 mb-4">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Tren Arus Kas 6 Bulan Terakhir
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dinamika pemasukan dan pengeluaran properti
            </p>
          </div>
          <CashflowTrendChart data={cashflowHistory} height={240} />
        </section>
      </div>

      {/* Expense Ledger */}
      <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] overflow-hidden">
        <div className="px-5 py-4 border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Buku Kas Pengeluaran — {formatMonthYear(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Catat seluruh biaya listrik, air, internet, dan perawatan kamar
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-primary text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Pengeluaran</span>
          </button>
        </div>

        {monthExpenses.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Wallet className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Belum ada pengeluaran tercatat di {formatMonthYear(selectedMonth)}
            </p>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="px-4 py-2 rounded-lg btn-primary text-xs font-medium"
            >
              Catat Pengeluaran Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Keperluan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-5 text-right">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-900/[0.05] dark:divide-white/[0.05] text-sm">
                {monthExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-teal-500/[0.04] transition-colors"
                  >
                    <td className="py-3 px-5">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {exp.title}
                      </p>
                      {exp.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {exp.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {exp.category}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                      {formatDateID(exp.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-medium text-slate-900 dark:text-white">
                      {formatIDR(exp.amount)}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                        title="Hapus catatan pengeluaran"
                        aria-label={`Hapus ${exp.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
