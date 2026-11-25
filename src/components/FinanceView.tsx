import { jsPDF } from 'jspdf';
import React, { useMemo, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  MessageSquareText,
  Plus,
  Trash2,
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
import { getRoomDisplayName } from '../data/initialData';
import {
  buildMultiTableExcelCsv,
  CsvCell,
  downloadCsvFile,
} from '../utils/csv';
import { exportFinanceExcelReport } from '../utils/financeExcel';
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
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportFinanceExcelReport({
        selectedMonth,
        settings,
        rooms,
        payments,
        expenses,
        categoryTotals,
        monthIncome,
        totalExpense,
        netProfit,
      });
      onExportSuccess(
        `Laporan Excel ${formatMonthYear(selectedMonth)} berhasil diunduh`
      );
    } catch (err) {
      console.error('Gagal mengekspor Excel:', err);
      onExportSuccess('Gagal membuat file Excel, silakan coba ekspor CSV');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = 18;
      const periodLabel = formatMonthYear(selectedMonth);
      const roomByNumber = new Map(rooms.map((r) => [r.number, r]));
      const paidList = payments
        .filter((p) => p.month === selectedMonth && p.status === 'Lunas')
        .sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));
      const sortedExpenses = [...monthExpenses].sort((a, b) => a.date.localeCompare(b.date));
      const money = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
      const ensureSpace = (needed = 10) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };
      const section = (heading: string) => {
        ensureSpace(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(heading, margin, y);
        y += 7;
      };
      const table = (headers: string[], rows: (string | number)[][], widths: number[]) => {
        const rowHeight = 7;
        const drawRow = (cells: (string | number)[], isHeader = false) => {
          ensureSpace(rowHeight + 1);
          let x = margin;
          doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
          doc.setFontSize(8);
          cells.forEach((cell, i) => {
            const width = widths[i];
            if (isHeader) {
              doc.setFillColor(13, 148, 136);
              doc.setTextColor(255, 255, 255);
              doc.rect(x, y - 5, width, rowHeight, 'F');
            } else {
              doc.setTextColor(35, 45, 50);
              doc.setDrawColor(220, 226, 230);
              doc.rect(x, y - 5, width, rowHeight);
            }
            const value = String(cell ?? '-');
            const lines = doc.splitTextToSize(value, width - 3);
            doc.text(lines.slice(0, 1), x + 1.5, y);
            x += width;
          });
          y += rowHeight;
        };
        drawRow(headers, true);
        rows.forEach((row) => drawRow(row));
        y += 4;
      };
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(20, 45, 50);
      doc.text(
        `LAPORAN KEUANGAN - ${(settings.name || 'KOST PUTRA AGAN').toUpperCase()}`,
        margin,
        y
      );
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 100, 110);
      doc.text(`Periode: ${periodLabel} | Pengelola: ${settings.adminName || 'Admin'}`, margin, y);
      y += 10;
      section('1. RINGKASAN KEUANGAN PERIODE');
      table(
        ['Komponen', 'Keterangan', 'Nominal (Rp)'],
        [
          ['Total Pemasukan (Lunas)', `${paidList.length} transaksi`, money(monthIncome)],
          ['Pengeluaran Operasional', `${sortedExpenses.length} transaksi`, money(totalExpense)],
          ['Laba / Arus Kas Bersih', netProfit >= 0 ? 'Surplus' : 'Defisit', money(netProfit)],
        ],
        [90, 90, pageWidth - margin * 2 - 180]
      );
      section('2. PEMASUKAN SEWA KAMAR (LUNAS)');
      table(
        ['No', 'Tanggal', 'Invoice', 'Kamar/Unit', 'Penyewa', 'Metode', 'Sewa (Rp)', 'Denda (Rp)', 'Total (Rp)'],
        paidList.length
          ? paidList.map((p, idx) => {
              const room = roomByNumber.get(p.roomNumber);
              const lateFee = p.lateFee ?? 0;
              return [
                idx + 1,
                p.paidDate || `${selectedMonth}-01`,
                p.invoiceNo || '-',
                room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`,
                p.tenantName,
                p.method || '-',
                money(p.amount),
                money(lateFee),
                money(p.amount + lateFee),
              ];
            })
          : [['-', '-', '-', 'Belum ada pemasukan lunas', '-', '-', money(0), money(0), money(0)]],
        [10, 22, 24, 28, 35, 20, 28, 25, pageWidth - margin * 2 - 192]
      );
      section('3. PENGELUARAN OPERASIONAL');
      table(
        ['No', 'Tanggal', 'Kategori', 'Keterangan', 'Catatan', 'Nominal (Rp)'],
        sortedExpenses.length
          ? sortedExpenses.map((e, idx) => [
              idx + 1,
              e.date,
              e.category,
              e.title,
              e.notes?.trim() || '-',
              money(e.amount),
            ])
          : [['-', '-', '-', 'Belum ada pengeluaran', '-', money(0)]],
        [12, 25, 25, 60, 70, pageWidth - margin * 2 - 192]
      );
      section('4. REKAP PENGELUARAN PER KATEGORI');
      table(
        ['No', 'Kategori', 'Persentase', 'Total (Rp)'],
        [
          ...categoryTotals.map((c, idx) => [idx + 1, c.category, `${c.pct}%`, money(c.amount)]),
          ['', 'TOTAL', '100%', money(totalExpense)],
        ],
        [15, 70, 35, pageWidth - margin * 2 - 120]
      );
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - margin, pageHeight - 7, {
          align: 'right',
        });
      }
      doc.save(`laporan-keuangan-kost-putra-agan-${selectedMonth}.pdf`);
      onExportSuccess(`Laporan PDF ${periodLabel} berhasil diunduh`);
    } catch (err) {
      console.error('Gagal mengekspor PDF:', err);
      onExportSuccess('Gagal membuat file PDF. Silakan coba ekspor Excel atau CSV.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    const periodLabel = formatMonthYear(selectedMonth);
    const roomByNumber = new Map(rooms.map((r) => [r.number, r]));

    const paidList = payments
      .filter((p) => p.month === selectedMonth && p.status === 'Lunas')
      .sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));

    const sortedExpenses = [...monthExpenses].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const incomeRows: CsvCell[][] =
      paidList.length > 0
        ? [
            ...paidList.map((p, idx) => {
              const room = roomByNumber.get(p.roomNumber);
              const unitLabel = room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`;
              const lateFee = p.lateFee ?? 0;
              return [
                idx + 1,
                p.paidDate || `${selectedMonth}-01`,
                p.invoiceNo || '-',
                unitLabel,
                p.tenantName,
                p.method || '-',
                p.amount,
                lateFee,
                p.amount + lateFee,
              ];
            }),
            ['', '', '', '', '', 'TOTAL PEMASUKAN', '', '', monthIncome],
          ]
        : [['-', '-', '-', 'Belum ada pemasukan lunas', '-', '-', 0, 0, 0]];

    const expenseRows: CsvCell[][] =
      sortedExpenses.length > 0
        ? [
            ...sortedExpenses.map((e, idx) => [
              idx + 1,
              e.date || `${selectedMonth}-01`,
              e.category,
              e.title,
              e.notes?.trim() || '-',
              e.amount,
            ]),
            ['', '', '', '', 'TOTAL PENGELUARAN', totalExpense],
          ]
        : [['-', '-', '-', 'Belum ada pengeluaran tercatat', '-', 0]];

    const csv = buildMultiTableExcelCsv(
      `LAPORAN KEUANGAN - ${(settings.name || 'KOST PUTRA AGAN').toUpperCase()}`,
      `Periode: ${periodLabel} | Pengelola: ${settings.adminName || 'Admin'}`,
      [
        {
          title: '1. RINGKASAN KEUANGAN PERIODE',
          headers: ['No', 'Komponen Keuangan', 'Keterangan', 'Nominal (Rp)'],
          rows: [
            [1, 'Total Pemasukan Sewa (Lunas)', `${paidList.length} transaksi`, monthIncome],
            [2, 'Total Pengeluaran Operasional', `${sortedExpenses.length} pos biaya`, totalExpense],
            [3, 'Laba / Arus Kas Bersih', netProfit >= 0 ? 'Surplus' : 'Defisit', netProfit],
          ],
        },
        {
          title: '2. TABEL PEMASUKAN SEWA KAMAR (LUNAS)',
          headers: [
            'No',
            'Tanggal Bayar',
            'No. Invoice',
            'Unit / Kamar',
            'Penyewa',
            'Metode Bayar',
            'Sewa Pokok (Rp)',
            'Denda (Rp)',
            'Total Diterima (Rp)',
          ],
          rows: incomeRows,
        },
        {
          title: '3. TABEL PENGELUARAN OPERASIONAL',
          headers: ['No', 'Tanggal', 'Kategori', 'Keterangan Pengeluaran', 'Catatan', 'Nominal (Rp)'],
          rows: expenseRows,
        },
        {
          title: '4. REKAP PENGELUARAN PER KATEGORI',
          headers: ['No', 'Kategori Biaya', 'Porsi (%)', 'Total Kategori (Rp)'],
          rows: [
            ...categoryTotals.map((c, idx) => [idx + 1, c.category, `${c.pct}%`, c.amount]),
            ['', 'TOTAL KATEGORI', '100%', totalExpense],
          ],
        },
      ]
    );

    downloadCsvFile(csv, `laporan-keuangan-kost-putra-agan-${selectedMonth}.csv`);
    onExportSuccess(
      `Laporan CSV ${periodLabel} berhasil diunduh`
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
    <div className="space-y-4">
      {/* Baris Filter Bulan & Ekspor */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <select
          value={selectedMonth}
          onChange={(e) => onChangeMonth(e.target.value)}
          aria-label="Pilih Periode Keuangan"
          className="px-3.5 py-2 rounded-lg input-surface border text-xs sm:text-sm font-medium"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonthYear(m)}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWaReportOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
          >
            <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ringkasan WA</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-primary text-xs font-medium disabled:opacity-60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{exportingExcel ? 'Menyiapkan...' : 'Excel (.xlsx)'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium disabled:opacity-60"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{exportingPdf ? 'Menyiapkan...' : 'PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Preview Ringkasan Laporan WA */}
      {waReportOpen && (
        <section className="animate-modal-in rounded-xl surface-card border border-teal-600/30 dark:border-teal-400/30 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Ringkasan Laporan Bulanan (Siap Kirim WA)
            </h3>
            <button
              type="button"
              onClick={() => setWaReportOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Tutup ringkasan"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <pre className="p-3.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
            {waSummaryText}
          </pre>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Salin Teks</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSummaryTxt}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Unduh .TXT</span>
            </button>
            <a
              href={buildWhatsAppUrl(settings.whatsappAdmin, waSummaryText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Teruskan ke WhatsApp</span>
            </a>
          </div>
        </section>
      )}

      {/* Ringkasan Keuangan Terpadu */}
      <section
        aria-label="Ringkasan Keuangan"
        className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/[0.07]"
      >
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pemasukan ({formatMonthYear(selectedMonth)})
          </p>
          <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1.5">
            {formatIDR(monthIncome)}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
            Pembayaran sewa &amp; denda lunas
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pengeluaran Operasional
          </p>
          <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1.5">
            {formatIDR(totalExpense)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {monthExpenses.length} transaksi tercatat bulan ini
          </p>
        </div>

        <div className="p-4 sm:p-5 focal-surface">
          <p className="text-xs text-slate-500 dark:text-slate-400">Laba Bersih</p>
          <p className="font-mono-num text-2xl font-semibold text-teal-800 dark:text-teal-300 mt-1.5">
            {formatIDR(netProfit)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Surplus bersih periode {formatMonthYear(selectedMonth)}
          </p>
        </div>
      </section>

      {/* Kategori Pengeluaran + Tren Arus Kas */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="xl:col-span-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
            <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
              Pengeluaran per Kategori
            </h2>
            <span className="font-mono-num text-xs font-semibold text-slate-900 dark:text-white">
              {formatIDR(totalExpense)}
            </span>
          </div>

          <div className="space-y-3">
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
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full gradient-bar transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(item.pct, item.amount > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-7 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 space-y-3">
          <div className="border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
            <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
              Tren Arus Kas 6 Bulan Terakhir
            </h2>
          </div>
          <CashflowTrendChart
            data={cashflowHistory}
            activeMonth={selectedMonth}
            height={200}
          />
        </section>
      </div>

      {/* Buku Kas Pengeluaran */}
      <section className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
            Buku Kas Pengeluaran · {formatMonthYear(selectedMonth)}
          </h2>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-2 rounded-xl btn-primary text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tambah Pengeluaran</span>
          </button>
        </div>

        {monthExpenses.length === 0 ? (
          <div className="p-8 text-center space-y-2.5">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Belum ada pengeluaran tercatat di {formatMonthYear(selectedMonth)}
            </p>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-medium"
            >
              Catat Pengeluaran Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Keperluan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-5 text-right">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-sm">
                {monthExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
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
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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
