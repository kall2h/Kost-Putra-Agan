import { jsPDF } from 'jspdf';
import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  MessageSquareText,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ExpenseCategory,
  ExpenseRecord,
  IncomeRecord,
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
  formatShortMonth,
} from '../utils/format';
import {
  buildAnnualFinanceWhatsAppSummary,
  buildMonthlyFinanceWhatsAppSummary,
} from '../utils/messageTemplates';
import { getRoomDisplayName } from '../data/initialData';
import {
  buildMultiTableExcelCsv,
  CsvCell,
  downloadCsvFile,
} from '../utils/csv';
import {
  AnnualMonthRow,
  exportAnnualFinanceExcelReport,
  exportFinanceExcelReport,
} from '../utils/financeExcel';
import { CashflowTrendChart } from './CashflowTrendChart';
import { MonthCalendarPicker } from './MonthCalendarPicker';

interface FinanceViewProps {
  payments: PaymentRecord[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  rooms: Room[];
  settings: PropertySettings;
  cashflowHistory: MonthlyHistoricalSummary[];
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onOpenAddIncome: () => void;
  onEditIncome: (income: IncomeRecord) => void;
  onDeleteIncome: (id: string) => Promise<void> | void;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => Promise<void> | void;
  onOpenReceipt?: (payment: PaymentRecord) => void;
  onNavigatePayments?: () => void;
  onExportSuccess: (msg: string) => void;
}

const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: 'Listrik', label: 'Listrik PLN & Token' },
  { key: 'Air', label: 'Air PDAM & Filter' },
  { key: 'Bahan', label: 'Keperluan & Kebersihan' },
  { key: 'Tagihan', label: 'WiFi & Tagihan Rutin' },
  { key: 'Lainnya', label: 'Perawatan & Lainnya' },
];

type LedgerFilter = 'all' | 'income' | 'expense';

interface LedgerRow {
  uid: string;
  kind: 'income-rent' | 'income-extra' | 'expense';
  direction: 'income' | 'expense';
  date: string;
  category: string;
  title: string;
  subtitle?: string;
  method: string;
  amount: number;
  payment?: PaymentRecord;
  incomeRecord?: IncomeRecord;
  expenseRecord?: ExpenseRecord;
}

interface PendingDeleteTarget {
  type: 'income' | 'expense';
  id: string;
  title: string;
  category: string;
  amount: number;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  payments,
  incomes,
  expenses,
  rooms,
  settings,
  cashflowHistory,
  selectedMonth,
  onChangeMonth,
  onOpenAddIncome,
  onEditIncome,
  onDeleteIncome,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
  onOpenReceipt,
  onNavigatePayments,
  onExportSuccess,
}) => {
  const [reportMode, setReportMode] = useState<'monthly' | 'yearly'>('monthly');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [waReportOpen, setWaReportOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PendingDeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedYear = selectedMonth.slice(0, 4);
  const roomByNumber = useMemo(
    () => new Map(rooms.map((r) => [r.number, r])),
    [rooms]
  );

  const activeFinancePeriods = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => set.add(p.month));
    incomes.forEach((i) => set.add(i.month));
    expenses.forEach((e) => set.add(e.month));
    return set;
  }, [payments, incomes, expenses]);

  // Monthly aggregates
  const monthPaidPayments = useMemo(
    () =>
      payments
        .filter((p) => p.month === selectedMonth && p.status === 'Lunas')
        .sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || '')),
    [payments, selectedMonth]
  );

  const monthPendingPayments = useMemo(
    () =>
      payments.filter(
        (p) => p.month === selectedMonth && p.status === 'Belum Bayar'
      ),
    [payments, selectedMonth]
  );

  const monthExtraIncomes = useMemo(
    () =>
      incomes
        .filter((i) => i.month === selectedMonth)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [incomes, selectedMonth]
  );

  const monthExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.month === selectedMonth)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, selectedMonth]
  );

  const monthRentBaseIncome = useMemo(
    () => monthPaidPayments.reduce((acc, p) => acc + p.amount, 0),
    [monthPaidPayments]
  );

  const monthLateFeeIncome = useMemo(
    () => monthPaidPayments.reduce((acc, p) => acc + (p.lateFee ?? 0), 0),
    [monthPaidPayments]
  );

  const monthRentTotal = monthRentBaseIncome + monthLateFeeIncome;

  const monthExtraIncomeTotal = useMemo(
    () => monthExtraIncomes.reduce((acc, i) => acc + i.amount, 0),
    [monthExtraIncomes]
  );

  const monthIncome = monthRentTotal + monthExtraIncomeTotal;

  const totalExpense = useMemo(
    () => monthExpenses.reduce((acc, e) => acc + e.amount, 0),
    [monthExpenses]
  );

  const netProfit = monthIncome - totalExpense;

  const monthlyPendingAmount = useMemo(
    () =>
      monthPendingPayments.reduce(
        (acc, p) => acc + p.amount + (p.lateFee ?? 0),
        0
      ),
    [monthPendingPayments]
  );

  const monthlyCategoryTotals = useMemo(() => {
    return EXPENSE_CATEGORIES.map((cat) => {
      const sum = monthExpenses
        .filter((e) => e.category === cat.key)
        .reduce((acc, e) => acc + e.amount, 0);
      const pct = totalExpense > 0 ? Math.round((sum / totalExpense) * 100) : 0;
      return { category: cat.key, label: cat.label, amount: sum, pct };
    });
  }, [monthExpenses, totalExpense]);

  // Annual aggregates (12 months of selectedYear)
  const annualPaidPayments = useMemo(
    () =>
      payments.filter(
        (p) => p.month.startsWith(`${selectedYear}-`) && p.status === 'Lunas'
      ),
    [payments, selectedYear]
  );

  const annualPendingPayments = useMemo(
    () =>
      payments.filter(
        (p) => p.month.startsWith(`${selectedYear}-`) && p.status === 'Belum Bayar'
      ),
    [payments, selectedYear]
  );

  const annualExtraIncomes = useMemo(
    () =>
      incomes
        .filter((i) => i.month.startsWith(`${selectedYear}-`))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [incomes, selectedYear]
  );

  const annualExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.month.startsWith(`${selectedYear}-`))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, selectedYear]
  );

  const annualRentBaseIncome = useMemo(
    () => annualPaidPayments.reduce((acc, p) => acc + p.amount, 0),
    [annualPaidPayments]
  );

  const annualLateFeeIncome = useMemo(
    () => annualPaidPayments.reduce((acc, p) => acc + (p.lateFee ?? 0), 0),
    [annualPaidPayments]
  );

  const annualRentTotal = annualRentBaseIncome + annualLateFeeIncome;

  const annualExtraIncomeTotal = useMemo(
    () => annualExtraIncomes.reduce((acc, i) => acc + i.amount, 0),
    [annualExtraIncomes]
  );

  const annualIncome = annualRentTotal + annualExtraIncomeTotal;

  const annualExpense = useMemo(
    () => annualExpenses.reduce((acc, e) => acc + e.amount, 0),
    [annualExpenses]
  );

  const annualNetProfit = annualIncome - annualExpense;

  const annualPendingAmount = useMemo(
    () =>
      annualPendingPayments.reduce(
        (acc, p) => acc + p.amount + (p.lateFee ?? 0),
        0
      ),
    [annualPendingPayments]
  );

  const annualMonthlyRows: AnnualMonthRow[] = useMemo(() => {
    const rows: AnnualMonthRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const paidForMonth = annualPaidPayments.filter((p) => p.month === ym);
      const extraIncForMonth = annualExtraIncomes.filter((i) => i.month === ym);
      const expForMonth = annualExpenses.filter((e) => e.month === ym);
      const income =
        paidForMonth.reduce((acc, p) => acc + p.amount + (p.lateFee ?? 0), 0) +
        extraIncForMonth.reduce((acc, i) => acc + i.amount, 0);
      const expense = expForMonth.reduce((acc, e) => acc + e.amount, 0);
      rows.push({
        month: ym,
        label: formatShortMonth(ym),
        paidCount: paidForMonth.length,
        income,
        expense,
        net: income - expense,
      });
    }
    return rows;
  }, [selectedYear, annualPaidPayments, annualExtraIncomes, annualExpenses]);

  const annualChartData: MonthlyHistoricalSummary[] = useMemo(
    () =>
      annualMonthlyRows.map((row) => ({
        month: row.month,
        label: row.label,
        income: row.income,
        expense: row.expense,
      })),
    [annualMonthlyRows]
  );

  const annualCategoryTotals = useMemo(() => {
    return EXPENSE_CATEGORIES.map((cat) => {
      const sum = annualExpenses
        .filter((e) => e.category === cat.key)
        .reduce((acc, e) => acc + e.amount, 0);
      const pct = annualExpense > 0 ? Math.round((sum / annualExpense) * 100) : 0;
      return { category: cat.key, label: cat.label, amount: sum, pct };
    });
  }, [annualExpenses, annualExpense]);

  // Active mode computed views
  const activeIncome = reportMode === 'yearly' ? annualIncome : monthIncome;
  const activeRentBase =
    reportMode === 'yearly' ? annualRentBaseIncome : monthRentBaseIncome;
  const activeLateFee =
    reportMode === 'yearly' ? annualLateFeeIncome : monthLateFeeIncome;
  const activeRentTotal =
    reportMode === 'yearly' ? annualRentTotal : monthRentTotal;
  const activeExtraIncome =
    reportMode === 'yearly' ? annualExtraIncomeTotal : monthExtraIncomeTotal;
  const activeExpense = reportMode === 'yearly' ? annualExpense : totalExpense;
  const activeNet = reportMode === 'yearly' ? annualNetProfit : netProfit;
  const activeCategoryTotals =
    reportMode === 'yearly' ? annualCategoryTotals : monthlyCategoryTotals;
  const activePendingCount =
    reportMode === 'yearly'
      ? annualPendingPayments.length
      : monthPendingPayments.length;
  const activePendingAmount =
    reportMode === 'yearly' ? annualPendingAmount : monthlyPendingAmount;

  const incomeBreakdownRows = useMemo(() => {
    const items = [
      {
        key: 'rent',
        label: 'Uang Kost (Sewa Kamar)',
        amount: activeRentBase,
        pct: activeIncome > 0 ? Math.round((activeRentBase / activeIncome) * 100) : 0,
      },
      ...(activeLateFee > 0
        ? [
            {
              key: 'late-fee',
              label: 'Denda Keterlambatan',
              amount: activeLateFee,
              pct: activeIncome > 0 ? Math.round((activeLateFee / activeIncome) * 100) : 0,
            },
          ]
        : []),
      {
        key: 'extra',
        label: 'Pemasukan Tambahan Kost',
        amount: activeExtraIncome,
        pct: activeIncome > 0 ? Math.round((activeExtraIncome / activeIncome) * 100) : 0,
      },
    ];
    return items;
  }, [activeIncome, activeRentBase, activeLateFee, activeExtraIncome]);

  // Unified Cashbook Ledger Rows (Pemasukan Uang Kost + Pemasukan Tambahan + Pengeluaran Keperluan Kost)
  const unifiedLedgerRows: LedgerRow[] = useMemo(() => {
    const targetPayments =
      reportMode === 'yearly' ? annualPaidPayments : monthPaidPayments;
    const targetExtraIncomes =
      reportMode === 'yearly' ? annualExtraIncomes : monthExtraIncomes;
    const targetExpenses =
      reportMode === 'yearly' ? annualExpenses : monthExpenses;

    const rentRows: LedgerRow[] = targetPayments.map((p) => {
      const room = roomByNumber.get(p.roomNumber);
      const unitLabel = room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`;
      const feeText =
        p.lateFee && p.lateFee > 0
          ? `Termasuk denda ${formatIDR(p.lateFee)}`
          : undefined;
      return {
        uid: `pay-${p.id}`,
        kind: 'income-rent',
        direction: 'income',
        date: p.paidDate || `${p.month}-01`,
        category: 'Uang Kost',
        title: `${unitLabel} · ${p.tenantName}`,
        subtitle: [p.invoiceNo, feeText, p.notes].filter(Boolean).join(' · '),
        method: p.method || 'Transfer',
        amount: p.amount + (p.lateFee ?? 0),
        payment: p,
      };
    });

    const extraRows: LedgerRow[] = targetExtraIncomes.map((inc) => ({
      uid: `inc-${inc.id}`,
      kind: 'income-extra',
      direction: 'income',
      date: inc.date,
      category: inc.category,
      title: inc.title,
      subtitle: inc.notes,
      method: inc.method || '-',
      amount: inc.amount,
      incomeRecord: inc,
    }));

    const expenseRows: LedgerRow[] = targetExpenses.map((exp) => ({
      uid: `exp-${exp.id}`,
      kind: 'expense',
      direction: 'expense',
      date: exp.date,
      category: exp.category,
      title: exp.title,
      subtitle: exp.notes,
      method: 'Operasional',
      amount: exp.amount,
      expenseRecord: exp,
    }));

    return [...rentRows, ...extraRows, ...expenseRows].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return a.uid.localeCompare(b.uid);
    });
  }, [
    reportMode,
    annualPaidPayments,
    monthPaidPayments,
    annualExtraIncomes,
    monthExtraIncomes,
    annualExpenses,
    monthExpenses,
    roomByNumber,
  ]);

  const filteredLedgerRows = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return unifiedLedgerRows.filter((row) => {
      if (ledgerFilter !== 'all' && row.direction !== ledgerFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        (row.subtitle?.toLowerCase().includes(q) ?? false) ||
        row.method.toLowerCase().includes(q)
      );
    });
  }, [unifiedLedgerRows, ledgerFilter, ledgerSearch]);

  const ledgerCounts = useMemo(() => {
    let income = 0;
    let expense = 0;
    unifiedLedgerRows.forEach((r) => {
      if (r.direction === 'income') income += 1;
      else expense += 1;
    });
    return { all: unifiedLedgerRows.length, income, expense };
  }, [unifiedLedgerRows]);

  const filteredTotals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filteredLedgerRows.forEach((r) => {
      if (r.direction === 'income') totalIn += r.amount;
      else totalOut += r.amount;
    });
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filteredLedgerRows]);

  const waSummaryText = useMemo(
    () =>
      reportMode === 'yearly'
        ? buildAnnualFinanceWhatsAppSummary({
            settings,
            year: selectedYear,
            rooms,
            payments,
            expenses,
            incomes,
          })
        : buildMonthlyFinanceWhatsAppSummary({
            settings,
            month: selectedMonth,
            rooms,
            payments,
            expenses,
            incomes,
          }),
    [reportMode, settings, selectedYear, selectedMonth, rooms, payments, expenses, incomes]
  );

  const handleSelectYear = (yearStr: string) => {
    const mm = selectedMonth.slice(5, 7) || '11';
    onChangeMonth(`${yearStr}-${mm}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'income') {
        await onDeleteIncome(deleteTarget.id);
      } else {
        await onDeleteExpense(deleteTarget.id);
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      if (reportMode === 'yearly') {
        await exportAnnualFinanceExcelReport({
          selectedYear,
          settings,
          rooms,
          payments,
          incomes,
          expenses,
          monthlyRows: annualMonthlyRows,
          categoryTotals: annualCategoryTotals.map(({ category, amount, pct }) => ({
            category,
            amount,
            pct,
          })),
          annualIncome,
          annualExpense,
          annualNetProfit,
        });
        onExportSuccess(`Rekap Excel Tahun ${selectedYear} berhasil diunduh`);
      } else {
        await exportFinanceExcelReport({
          selectedMonth,
          settings,
          rooms,
          payments,
          incomes,
          expenses,
          categoryTotals: monthlyCategoryTotals.map(({ category, amount, pct }) => ({
            category,
            amount,
            pct,
          })),
          monthIncome,
          totalExpense,
          netProfit,
        });
        onExportSuccess(
          `Laporan Excel ${formatMonthYear(selectedMonth)} berhasil diunduh`
        );
      }
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
        doc.setTextColor(20, 45, 50);
        doc.text(heading, margin, y);
        y += 7;
      };
      const table = (
        headers: string[],
        rows: (string | number)[][],
        widths: number[]
      ) => {
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

      if (reportMode === 'yearly') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(20, 45, 50);
        doc.text(
          `REKAP KEUANGAN TAHUNAN ${selectedYear} - ${(
            settings.name || 'KOST PUTRA AGAN'
          ).toUpperCase()}`,
          margin,
          y
        );
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(90, 100, 110);
        doc.text(
          `Periode: Januari - Desember ${selectedYear} | Pengelola: ${
            settings.adminName || 'Admin'
          }`,
          margin,
          y
        );
        y += 10;

        section(`1. RINGKASAN KEUANGAN TAHUN ${selectedYear}`);
        table(
          ['Komponen', 'Keterangan', 'Nominal (Rp)'],
          [
            [
              'Pemasukan Uang Kost (Sewa Lunas)',
              `${annualPaidPayments.length} transaksi sewa kamar`,
              money(annualRentTotal),
            ],
            [
              'Pemasukan Tambahan Kost',
              `${annualExtraIncomes.length} catatan pemasukan lainnya`,
              money(annualExtraIncomeTotal),
            ],
            [
              'Total Pemasukan Periode',
              `${annualPaidPayments.length + annualExtraIncomes.length} transaksi masuk`,
              money(annualIncome),
            ],
            [
              'Total Pengeluaran Keperluan Kost',
              `${annualExpenses.length} pos biaya`,
              money(annualExpense),
            ],
            [
              `Laba / Arus Kas Bersih ${selectedYear}`,
              annualNetProfit >= 0 ? 'Surplus Tahunan' : 'Defisit Tahunan',
              money(annualNetProfit),
            ],
          ],
          [95, 95, pageWidth - margin * 2 - 190]
        );

        section(`2. REKAPITULASI PER BULAN (${selectedYear})`);
        table(
          [
            'No',
            'Bulan',
            'Sewa Lunas',
            'Pemasukan (Rp)',
            'Pengeluaran (Rp)',
            'Laba Bersih (Rp)',
          ],
          [
            ...annualMonthlyRows.map((r, idx) => [
              idx + 1,
              formatMonthYear(r.month),
              `${r.paidCount} unit`,
              money(r.income),
              money(r.expense),
              money(r.net),
            ]),
            [
              '',
              `TOTAL ${selectedYear}`,
              `${annualPaidPayments.length} unit`,
              money(annualIncome),
              money(annualExpense),
              money(annualNetProfit),
            ],
          ],
          [14, 52, 42, 54, 54, pageWidth - margin * 2 - 216]
        );

        section(`3. REKAP PENGELUARAN PER KATEGORI (${selectedYear})`);
        table(
          ['No', 'Kategori', 'Persentase', 'Total (Rp)'],
          [
            ...annualCategoryTotals.map((c, idx) => [
              idx + 1,
              c.label,
              `${c.pct}%`,
              money(c.amount),
            ]),
            ['', 'TOTAL', '100%', money(annualExpense)],
          ],
          [15, 75, 40, pageWidth - margin * 2 - 130]
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
        doc.save(`rekap-tahunan-kost-putra-agan-${selectedYear}.pdf`);
        onExportSuccess(`Laporan PDF Tahun ${selectedYear} berhasil diunduh`);
      } else {
        const periodLabel = formatMonthYear(selectedMonth);
        const incomePdfRows: (string | number)[][] = [
          ...monthPaidPayments
            .slice()
            .sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''))
            .map((p) => {
              const room = roomByNumber.get(p.roomNumber);
              return [
                p.paidDate || `${selectedMonth}-01`,
                p.invoiceNo || '-',
                room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`,
                `Uang Kost (${p.tenantName})`,
                p.method || '-',
                money(p.amount + (p.lateFee ?? 0)),
              ];
            }),
          ...monthExtraIncomes
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((inc) => [
              inc.date,
              '-',
              inc.category,
              inc.title,
              inc.method || '-',
              money(inc.amount),
            ]),
        ].map((row, idx) => [idx + 1, ...row]);

        const sortedExpenses = [...monthExpenses].sort((a, b) =>
          a.date.localeCompare(b.date)
        );

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
        doc.text(
          `Periode: ${periodLabel} | Pengelola: ${settings.adminName || 'Admin'}`,
          margin,
          y
        );
        y += 10;

        section('1. RINGKASAN KEUANGAN PERIODE');
        table(
          ['Komponen', 'Keterangan', 'Nominal (Rp)'],
          [
            [
              'Pemasukan Uang Kost (Sewa Lunas)',
              `${monthPaidPayments.length} transaksi sewa kamar`,
              money(monthRentTotal),
            ],
            [
              'Pemasukan Tambahan Kost',
              `${monthExtraIncomes.length} transaksi lainnya`,
              money(monthExtraIncomeTotal),
            ],
            [
              'Total Pemasukan Periode',
              `${monthPaidPayments.length + monthExtraIncomes.length} transaksi masuk`,
              money(monthIncome),
            ],
            [
              'Pengeluaran Keperluan Kost',
              `${sortedExpenses.length} transaksi`,
              money(totalExpense),
            ],
            ['Laba / Arus Kas Bersih', netProfit >= 0 ? 'Surplus' : 'Defisit', money(netProfit)],
          ],
          [90, 90, pageWidth - margin * 2 - 180]
        );

        section('2. RINCIAN PEMASUKAN (UANG KOST & TAMBAHAN)');
        table(
          ['No', 'Tanggal', 'Invoice / Ref', 'Unit / Kategori', 'Keterangan', 'Metode', 'Total (Rp)'],
          incomePdfRows.length
            ? incomePdfRows
            : [['-', '-', '-', '-', 'Belum ada pemasukan', '-', money(0)]],
          [10, 24, 30, 32, 84, 30, pageWidth - margin * 2 - 210]
        );

        section('3. PENGELUARAN KEPERLUAN KOST');
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
            ...monthlyCategoryTotals.map((c, idx) => [
              idx + 1,
              c.label,
              `${c.pct}%`,
              money(c.amount),
            ]),
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
      }
    } catch (err) {
      console.error('Gagal mengekspor PDF:', err);
      onExportSuccess('Gagal membuat file PDF. Silakan coba ekspor Excel atau CSV.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (reportMode === 'yearly') {
      const sortedPaid = [...annualPaidPayments].sort((a, b) =>
        (a.paidDate || a.month).localeCompare(b.paidDate || b.month)
      );
      const sortedExtra = [...annualExtraIncomes].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const sortedExp = [...annualExpenses].sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const incomeCsvRows: CsvCell[][] = [
        ...sortedPaid.map((p) => {
          const room = roomByNumber.get(p.roomNumber);
          return [
            formatMonthYear(p.month),
            p.paidDate || `${p.month}-01`,
            p.invoiceNo,
            room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`,
            `Uang Kost · ${p.tenantName}`,
            p.method || '-',
            p.amount + (p.lateFee ?? 0),
          ];
        }),
        ...sortedExtra.map((inc) => [
          formatMonthYear(inc.month),
          inc.date,
          '-',
          inc.category,
          inc.title,
          inc.method || '-',
          inc.amount,
        ]),
      ].map((r, idx) => [idx + 1, ...r]);

      const csv = buildMultiTableExcelCsv(
        `REKAP KEUANGAN TAHUNAN ${selectedYear} - ${(
          settings.name || 'KOST PUTRA AGAN'
        ).toUpperCase()}`,
        `Periode: Januari - Desember ${selectedYear} | Pengelola: ${
          settings.adminName || 'Admin'
        }`,
        [
          {
            title: `1. RINGKASAN KEUANGAN TAHUN ${selectedYear}`,
            headers: ['No', 'Komponen Keuangan', 'Keterangan', 'Nominal (Rp)'],
            rows: [
              [
                1,
                'Pemasukan Uang Kost (Sewa Lunas)',
                `${sortedPaid.length} transaksi`,
                annualRentTotal,
              ],
              [
                2,
                'Pemasukan Tambahan Kost',
                `${sortedExtra.length} transaksi`,
                annualExtraIncomeTotal,
              ],
              [
                3,
                'Total Pemasukan Periode',
                `${sortedPaid.length + sortedExtra.length} transaksi`,
                annualIncome,
              ],
              [
                4,
                'Total Pengeluaran Keperluan Kost',
                `${sortedExp.length} transaksi`,
                annualExpense,
              ],
              [
                5,
                `Laba / Arus Kas Bersih ${selectedYear}`,
                annualNetProfit >= 0 ? 'Surplus' : 'Defisit',
                annualNetProfit,
              ],
            ],
          },
          {
            title: `2. REKAPITULASI PER BULAN (${selectedYear})`,
            headers: [
              'No',
              'Bulan',
              'Sewa Lunas',
              'Pemasukan (Rp)',
              'Pengeluaran (Rp)',
              'Laba Bersih (Rp)',
            ],
            rows: [
              ...annualMonthlyRows.map((r, idx) => [
                idx + 1,
                formatMonthYear(r.month),
                r.paidCount,
                r.income,
                r.expense,
                r.net,
              ]),
              [
                '',
                `TOTAL TAHUN ${selectedYear}`,
                sortedPaid.length,
                annualIncome,
                annualExpense,
                annualNetProfit,
              ],
            ],
          },
          {
            title: `3. RINCIAN PEMASUKAN TAHUN ${selectedYear}`,
            headers: [
              'No',
              'Periode',
              'Tanggal',
              'No. Invoice / Ref',
              'Unit / Kategori',
              'Keterangan',
              'Metode',
              'Total (Rp)',
            ],
            rows:
              incomeCsvRows.length > 0
                ? incomeCsvRows
                : [['-', '-', '-', '-', 'Belum ada pemasukan', '-', '-', 0]],
          },
          {
            title: `4. RINCIAN PENGELUARAN TAHUN ${selectedYear}`,
            headers: ['No', 'Bulan', 'Tanggal', 'Kategori', 'Keperluan', 'Catatan', 'Nominal (Rp)'],
            rows:
              sortedExp.length > 0
                ? sortedExp.map((e, idx) => [
                    idx + 1,
                    formatMonthYear(e.month),
                    e.date,
                    e.category,
                    e.title,
                    e.notes?.trim() || '-',
                    e.amount,
                  ])
                : [['-', '-', '-', '-', 'Belum ada pengeluaran', '-', 0]],
          },
        ]
      );

      downloadCsvFile(csv, `rekap-tahunan-kost-putra-agan-${selectedYear}.csv`);
      onExportSuccess(`Laporan CSV Tahun ${selectedYear} berhasil diunduh`);
      return;
    }

    const periodLabel = formatMonthYear(selectedMonth);
    const paidList = [...monthPaidPayments].sort((a, b) =>
      (a.paidDate || '').localeCompare(b.paidDate || '')
    );
    const sortedExtra = [...monthExtraIncomes].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const sortedExpenses = [...monthExpenses].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const combinedIncomeCsv: CsvCell[][] = [
      ...paidList.map((p) => {
        const room = roomByNumber.get(p.roomNumber);
        const unitLabel = room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`;
        const lateFee = p.lateFee ?? 0;
        return [
          p.paidDate || `${selectedMonth}-01`,
          p.invoiceNo || '-',
          unitLabel,
          `Uang Kost · ${p.tenantName}`,
          p.method || '-',
          p.amount,
          lateFee,
          p.amount + lateFee,
        ];
      }),
      ...sortedExtra.map((inc) => [
        inc.date,
        '-',
        inc.category,
        inc.title,
        inc.method || '-',
        inc.amount,
        0,
        inc.amount,
      ]),
    ].map((r, idx) => [idx + 1, ...r]);

    const incomeRows: CsvCell[][] =
      combinedIncomeCsv.length > 0
        ? [
            ...combinedIncomeCsv,
            ['', '', '', '', '', 'TOTAL PEMASUKAN', '', '', monthIncome],
          ]
        : [['-', '-', '-', 'Belum ada pemasukan', '-', '-', 0, 0, 0]];

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
            [1, 'Pemasukan Uang Kost (Sewa Lunas)', `${paidList.length} transaksi`, monthRentTotal],
            [2, 'Pemasukan Tambahan Kost', `${sortedExtra.length} transaksi`, monthExtraIncomeTotal],
            [3, 'Total Pemasukan Periode', `${paidList.length + sortedExtra.length} transaksi`, monthIncome],
            [4, 'Total Pengeluaran Keperluan Kost', `${sortedExpenses.length} pos biaya`, totalExpense],
            [5, 'Laba / Arus Kas Bersih', netProfit >= 0 ? 'Surplus' : 'Defisit', netProfit],
          ],
        },
        {
          title: '2. TABEL PEMASUKAN (UANG KOST & TAMBAHAN)',
          headers: [
            'No',
            'Tanggal',
            'No. Invoice / Ref',
            'Unit / Kategori',
            'Penyewa / Keterangan',
            'Metode Bayar',
            'Nominal Pokok (Rp)',
            'Denda (Rp)',
            'Total Diterima (Rp)',
          ],
          rows: incomeRows,
        },
        {
          title: '3. TABEL PENGELUARAN KEPERLUAN KOST',
          headers: [
            'No',
            'Tanggal',
            'Kategori',
            'Keterangan Pengeluaran',
            'Catatan',
            'Nominal (Rp)',
          ],
          rows: expenseRows,
        },
        {
          title: '4. REKAP PENGELUARAN PER KATEGORI',
          headers: ['No', 'Kategori Biaya', 'Porsi (%)', 'Total Kategori (Rp)'],
          rows: [
            ...monthlyCategoryTotals.map((c, idx) => [
              idx + 1,
              c.label,
              `${c.pct}%`,
              c.amount,
            ]),
            ['', 'TOTAL KATEGORI', '100%', totalExpense],
          ],
        },
      ]
    );

    downloadCsvFile(csv, `laporan-keuangan-kost-putra-agan-${selectedMonth}.csv`);
    onExportSuccess(`Laporan CSV ${periodLabel} berhasil diunduh`);
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(waSummaryText);
      onExportSuccess(
        reportMode === 'yearly'
          ? `Ringkasan tahunan ${selectedYear} disalin untuk WhatsApp`
          : `Ringkasan laporan ${formatMonthYear(selectedMonth)} disalin untuk WhatsApp`
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
    link.setAttribute(
      'download',
      reportMode === 'yearly'
        ? `ringkasan-tahunan-${selectedYear}.txt`
        : `ringkasan-laporan-${selectedMonth}.txt`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportSuccess(
      reportMode === 'yearly'
        ? `Ringkasan tahunan ${selectedYear} diunduh (.TXT)`
        : `Ringkasan laporan ${formatMonthYear(selectedMonth)} diunduh (.TXT)`
    );
  };

  const marginPct =
    activeIncome > 0 ? Math.round((activeNet / activeIncome) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Baris Mode Rekap (Bulanan / Tahunan), Kalender, Aksi Catat & Ekspor */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Mode Rekap Keuangan"
            className="inline-flex items-center gap-1 p-1 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={reportMode === 'monthly'}
              onClick={() => setReportMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                reportMode === 'monthly'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Rekap Bulanan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reportMode === 'yearly'}
              onClick={() => setReportMode('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                reportMode === 'yearly'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Rekap Tahunan
            </button>
          </div>

          {reportMode === 'monthly' ? (
            <MonthCalendarPicker
              mode="month"
              value={selectedMonth}
              onChange={onChangeMonth}
              activePeriods={activeFinancePeriods}
              ariaLabel="Pilih Bulan dan Tahun Keuangan"
            />
          ) : (
            <MonthCalendarPicker
              mode="year"
              value={selectedYear}
              onChange={handleSelectYear}
              activePeriods={activeFinancePeriods}
              ariaLabel="Pilih Tahun Rekap Keuangan"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddIncome}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Catat Pemasukan</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-primary text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Catat Pengeluaran</span>
          </button>

          <button
            type="button"
            onClick={() => setWaReportOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl btn-secondary text-xs font-medium"
          >
            <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {reportMode === 'yearly' ? 'Ringkasan WA' : 'WA'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl btn-secondary text-xs font-medium disabled:opacity-60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{exportingExcel ? 'Menyiapkan...' : 'Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl btn-secondary text-xs font-medium disabled:opacity-60"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{exportingPdf ? '...' : 'PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl btn-secondary text-xs font-medium"
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
              {reportMode === 'yearly'
                ? `Ringkasan Laporan Tahunan ${selectedYear} (Siap Kirim WA)`
                : 'Ringkasan Laporan Bulanan (Siap Kirim WA)'}
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

      {/* Ringkasan Pemasukan, Pengeluaran & Laba Bersih Terpadu */}
      <section
        aria-label={
          reportMode === 'yearly'
            ? 'Ringkasan Keuangan Tahunan'
            : 'Ringkasan Keuangan Bulanan'
        }
        className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/[0.07]"
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {reportMode === 'yearly'
                ? `Total Pemasukan (${selectedYear})`
                : `Total Pemasukan (${formatMonthYear(selectedMonth)})`}
            </p>
            <ArrowDownLeft
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
          </div>
          <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1.5">
            {formatIDR(activeIncome)}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-mono-num">
            Uang Kost {formatIDR(activeRentTotal)}
            {activeExtraIncome > 0
              ? ` · Tambahan ${formatIDR(activeExtraIncome)}`
              : ''}
          </p>
          {activePendingCount > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono-num">
              {activePendingCount} tagihan belum bayar ({formatIDR(activePendingAmount)})
            </p>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {reportMode === 'yearly'
                ? `Total Pengeluaran (${selectedYear})`
                : 'Total Pengeluaran'}
            </p>
            <ArrowUpRight
              className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
              aria-hidden="true"
            />
          </div>
          <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1.5">
            {formatIDR(activeExpense)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Keperluan kost &amp; operasional ·{' '}
            <span className="font-mono-num">
              {reportMode === 'yearly' ? annualExpenses.length : monthExpenses.length}{' '}
              transaksi
            </span>
          </p>
        </div>

        <div className="p-4 sm:p-5 focal-surface">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {reportMode === 'yearly'
              ? `Laba / Arus Kas Bersih (${selectedYear})`
              : 'Laba / Arus Kas Bersih'}
          </p>
          <p
            className={`font-mono-num text-2xl font-semibold mt-1.5 ${
              activeNet >= 0
                ? 'text-teal-800 dark:text-teal-300'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatIDR(activeNet)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {activeNet >= 0 ? 'Surplus bersih' : 'Defisit'}
            {activeIncome > 0 ? ` · Margin ${marginPct}%` : ''}
          </p>
        </div>
      </section>

      {/* Komposisi Pemasukan & Pengeluaran + Tren Arus Kas */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="xl:col-span-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
            <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
              {reportMode === 'yearly'
                ? `Komposisi Keuangan (${selectedYear})`
                : 'Komposisi Pemasukan & Pengeluaran'}
            </h2>
          </div>

          {/* Sumber Pemasukan */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Sumber Pemasukan
              </span>
              <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                {formatIDR(activeIncome)}
              </span>
            </div>

            {incomeBreakdownRows.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-700 dark:text-slate-200">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-3 font-mono-num text-xs">
                    <span className="text-slate-400 dark:text-slate-500">
                      {item.pct}%
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white w-28 text-right">
                      {formatIDR(item.amount)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(item.pct, item.amount > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200/80 dark:border-white/[0.07] pt-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Pos Pengeluaran (Keperluan Kost)
              </span>
              <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                {formatIDR(activeExpense)}
              </span>
            </div>

            {activeCategoryTotals.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-700 dark:text-slate-200">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-3 font-mono-num text-xs">
                    <span className="text-slate-400 dark:text-slate-500">
                      {item.pct}%
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white w-28 text-right">
                      {formatIDR(item.amount)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-500 ease-out"
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
              {reportMode === 'yearly'
                ? `Tren Arus Kas 12 Bulan (${selectedYear})`
                : 'Tren Arus Kas 6 Bulan Terakhir'}
            </h2>
          </div>
          <CashflowTrendChart
            data={reportMode === 'yearly' ? annualChartData : cashflowHistory}
            activeMonth={reportMode === 'yearly' ? undefined : selectedMonth}
            height={268}
          />
        </section>
      </div>

      {/* Rekapitulasi 12 Bulan (khusus mode Tahunan) */}
      {reportMode === 'yearly' && (
        <section className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
              Rekapitulasi Per Bulan · Tahun {selectedYear}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Klik bulan untuk melihat rincian bulanan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Bulan</th>
                  <th className="py-3 px-4 text-center">Sewa Lunas</th>
                  <th className="py-3 px-4 text-right">Pemasukan</th>
                  <th className="py-3 px-4 text-right">Pengeluaran</th>
                  <th className="py-3 px-4 text-right">Laba Bersih</th>
                  <th className="py-3 px-5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-sm">
                {annualMonthlyRows.map((row) => {
                  const hasActivity = row.income > 0 || row.expense > 0;
                  return (
                    <tr
                      key={row.month}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 px-5 font-medium text-slate-900 dark:text-white">
                        {formatMonthYear(row.month)}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono-num text-xs text-slate-600 dark:text-slate-300">
                        {row.paidCount > 0 ? `${row.paidCount} unit` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                        {row.income > 0 ? formatIDR(row.income) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-amber-700 dark:text-amber-400">
                        {row.expense > 0 ? formatIDR(row.expense) : '-'}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono-num font-semibold ${
                          !hasActivity
                            ? 'text-slate-400 dark:text-slate-500 font-normal'
                            : row.net >= 0
                            ? 'text-teal-700 dark:text-teal-300'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {hasActivity ? formatIDR(row.net) : '-'}
                      </td>
                      <td className="py-2.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onChangeMonth(row.month);
                            setReportMode('monthly');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-secondary text-xs font-medium"
                        >
                          <span>Buka</span>
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-white/[0.12] bg-slate-50/80 dark:bg-white/[0.03] text-sm font-semibold">
                  <td className="py-3 px-5 text-slate-900 dark:text-white">
                    Total Tahun {selectedYear}
                  </td>
                  <td className="py-3 px-4 text-center font-mono-num text-xs text-slate-700 dark:text-slate-200">
                    {annualPaidPayments.length} unit
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                    {formatIDR(annualIncome)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-amber-700 dark:text-amber-400">
                    {formatIDR(annualExpense)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono-num ${
                      annualNetProfit >= 0
                        ? 'text-teal-700 dark:text-teal-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatIDR(annualNetProfit)}
                  </td>
                  <td className="py-3 px-5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Buku Kas Terpadu: Pemasukan & Pengeluaran */}
      <section className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
              {reportMode === 'yearly'
                ? `Buku Kas Pemasukan & Pengeluaran · Tahun ${selectedYear}`
                : `Buku Kas Pemasukan & Pengeluaran · ${formatMonthYear(selectedMonth)}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-num">
              Masuk {formatIDR(filteredTotals.totalIn)} · Keluar{' '}
              {formatIDR(filteredTotals.totalOut)} · Saldo{' '}
              {formatIDR(filteredTotals.net)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenAddIncome}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Pemasukan</span>
            </button>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl btn-primary text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Pengeluaran</span>
            </button>
          </div>
        </div>

        {/* Filter Mutasi & Pencarian */}
        <div className="px-5 py-3 border-b border-slate-200/70 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.015]">
          <div
            role="tablist"
            aria-label="Filter Mutasi Kas"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={ledgerFilter === 'all'}
              onClick={() => setLedgerFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                ledgerFilter === 'all'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua ({ledgerCounts.all})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ledgerFilter === 'income'}
              onClick={() => setLedgerFilter('income')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                ledgerFilter === 'income'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pemasukan ({ledgerCounts.income})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ledgerFilter === 'expense'}
              onClick={() => setLedgerFilter('expense')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                ledgerFilter === 'expense'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pengeluaran ({ledgerCounts.expense})
            </button>
          </div>

          <div className="relative flex-1 min-w-[210px] max-w-xs">
            <label htmlFor="ledger-search" className="sr-only">
              Cari mutasi keuangan
            </label>
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="ledger-search"
              type="search"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Cari uraian, kategori, kamar..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl input-surface border text-xs"
            />
          </div>
        </div>

        {filteredLedgerRows.length === 0 ? (
          <div className="p-8 text-center space-y-2.5">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {ledgerSearch.trim()
                ? 'Tidak ada transaksi yang cocok dengan kata kunci pencarian'
                : reportMode === 'yearly'
                ? `Belum ada mutasi tercatat di Tahun ${selectedYear}`
                : `Belum ada mutasi tercatat di ${formatMonthYear(selectedMonth)}`}
            </p>
            {!ledgerSearch.trim() && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onOpenAddIncome}
                  className="min-h-[38px] px-4 py-2 rounded-xl btn-secondary text-xs font-medium"
                >
                  Catat Pemasukan
                </button>
                <button
                  type="button"
                  onClick={onOpenAddExpense}
                  className="min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-medium"
                >
                  Catat Pengeluaran
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Tanggal</th>
                  <th className="py-3 px-4">Jenis</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Uraian Transaksi</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-sm">
                {filteredLedgerRows.map((row) => {
                  const isIncome = row.direction === 'income';
                  return (
                    <tr
                      key={row.uid}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-5 font-mono-num text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateID(row.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            isIncome
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{isIncome ? 'Pemasukan' : 'Pengeluaran'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {row.title}
                        </p>
                        {row.subtitle && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {row.subtitle}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.method}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                          isIncome
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isIncome ? '+' : '-'} {formatIDR(row.amount)}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {row.kind === 'income-rent' && row.payment && (
                            <>
                              {onOpenReceipt && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReceipt(row.payment!)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-secondary text-xs font-medium"
                                  title="Lihat kwitansi sewa"
                                  aria-label={`Lihat kwitansi ${row.title}`}
                                >
                                  <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span className="hidden sm:inline">Kwitansi</span>
                                </button>
                              )}
                              {onNavigatePayments && (
                                <button
                                  type="button"
                                  onClick={onNavigatePayments}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                                  title="Kelola di menu Pembayaran"
                                  aria-label={`Kelola ${row.title} di menu Pembayaran`}
                                >
                                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </>
                          )}

                          {row.kind === 'income-extra' && row.incomeRecord && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditIncome(row.incomeRecord!)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-500/10 transition-colors"
                                title="Edit catatan pemasukan"
                                aria-label={`Edit ${row.title}`}
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'income',
                                    id: row.incomeRecord!.id,
                                    title: row.incomeRecord!.title,
                                    category: row.incomeRecord!.category,
                                    amount: row.incomeRecord!.amount,
                                  })
                                }
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                title="Hapus catatan pemasukan"
                                aria-label={`Hapus ${row.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </>
                          )}

                          {row.kind === 'expense' && row.expenseRecord && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditExpense(row.expenseRecord!)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-500/10 transition-colors"
                                title="Edit catatan pengeluaran"
                                aria-label={`Edit ${row.title}`}
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'expense',
                                    id: row.expenseRecord!.id,
                                    title: row.expenseRecord!.title,
                                    category: row.expenseRecord!.category,
                                    amount: row.expenseRecord!.amount,
                                  })
                                }
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                title="Hapus catatan pengeluaran"
                                aria-label={`Hapus ${row.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Konfirmasi Hapus Mutasi */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/55 animate-backdrop-in"
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-finance-title"
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl p-5 space-y-4 animate-modal-in"
          >
            <div className="space-y-1">
              <h3
                id="delete-finance-title"
                className="font-display font-semibold text-base text-slate-900 dark:text-white"
              >
                {deleteTarget.type === 'income'
                  ? 'Hapus Catatan Pemasukan?'
                  : 'Hapus Catatan Pengeluaran?'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Transaksi{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {deleteTarget.title}
                </span>{' '}
                ({deleteTarget.category}) senilai{' '}
                <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                  {formatIDR(deleteTarget.amount)}
                </span>{' '}
                akan dihapus permanen dari buku kas.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="min-h-[38px] px-4 py-2 rounded-xl btn-secondary text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
