import ExcelJS from 'exceljs';
import {
  ExpenseCategory,
  ExpenseRecord,
  IncomeRecord,
  PaymentRecord,
  PropertySettings,
  Room,
} from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import { formatMonthYear } from './format';

export interface FinanceExcelExportParams {
  selectedMonth: string;
  settings: PropertySettings;
  rooms: Room[];
  payments: PaymentRecord[];
  incomes?: IncomeRecord[];
  expenses: ExpenseRecord[];
  categoryTotals: {
    category: ExpenseCategory;
    amount: number;
    pct: number;
  }[];
  monthIncome: number;
  totalExpense: number;
  netProfit: number;
}

const CURRENCY_FORMAT = '"Rp "#,##0;-"Rp "#,##0;"-"';
const DATE_FORMAT = 'dd mmm yyyy';

const THIN_BORDER_COLOR = { argb: 'FFCBD5E1' };
const HEADER_BORDER_COLOR = { argb: 'FF0F766E' };

const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: THIN_BORDER_COLOR },
  left: { style: 'thin', color: THIN_BORDER_COLOR },
  bottom: { style: 'thin', color: THIN_BORDER_COLOR },
  right: { style: 'thin', color: THIN_BORDER_COLOR },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: HEADER_BORDER_COLOR },
  left: { style: 'thin', color: HEADER_BORDER_COLOR },
  bottom: { style: 'medium', color: HEADER_BORDER_COLOR },
  right: { style: 'thin', color: HEADER_BORDER_COLOR },
};

const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF0F766E' } },
  left: { style: 'thin', color: THIN_BORDER_COLOR },
  bottom: { style: 'double', color: { argb: 'FF0F766E' } },
  right: { style: 'thin', color: THIN_BORDER_COLOR },
};

const parseIsoDate = (isoDate?: string | null): Date | string => {
  if (!isoDate) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
};

const estimateCellVisualLength = (cell: ExcelJS.Cell): number => {
  const val = cell.value;
  if (val === null || val === undefined) return 0;

  if (val instanceof Date) {
    return 13; // e.g., "16 Nov 2026"
  }

  if (typeof val === 'number') {
    if (cell.numFmt && cell.numFmt.includes('Rp')) {
      const formatted = Math.abs(Math.round(val)).toLocaleString('id-ID');
      return `Rp ${formatted}`.length + (val < 0 ? 1 : 0);
    }
    if (cell.numFmt && cell.numFmt.includes('%')) {
      return 7;
    }
    return String(val).length;
  }

  if (typeof val === 'object') {
    if ('formula' in val && val.result !== undefined) {
      if (typeof val.result === 'number' && cell.numFmt?.includes('Rp')) {
        const formatted = Math.abs(Math.round(val.result)).toLocaleString('id-ID');
        return `Rp ${formatted}`.length + (val.result < 0 ? 1 : 0);
      }
      return String(val.result).length;
    }
    return 14;
  }

  return String(val).length;
};

const LABEL_CHIP_COLORS: Record<string, { fill: string; text: string }> = {
  Pemasukan: { fill: 'FFDCFCE7', text: 'FF065F46' },
  Pengeluaran: { fill: 'FFFEF3C7', text: 'FF92400E' },
  QRIS: { fill: 'FFCCFBF1', text: 'FF0F766E' },
  'Transfer BCA': { fill: 'FFDBEAFE', text: 'FF1D4ED8' },
  'Transfer Mandiri': { fill: 'FFE0E7FF', text: 'FF3730A3' },
  Tunai: { fill: 'FFDCFCE7', text: 'FF047857' },
  'Uang Kost': { fill: 'FFDCFCE7', text: 'FF065F46' },
  Parkir: { fill: 'FFE0F2FE', text: 'FF0369A1' },
  Laundry: { fill: 'FFCCFBF1', text: 'FF0F766E' },
  Deposit: { fill: 'FFE0E7FF', text: 'FF3730A3' },
  Operasional: { fill: 'FFF1F5F9', text: 'FF475569' },
  Listrik: { fill: 'FFFEF3C7', text: 'FFB45309' },
  Air: { fill: 'FFE0F2FE', text: 'FF0369A1' },
  Bahan: { fill: 'FFF1F5F9', text: 'FF334155' },
  Tagihan: { fill: 'FFFFE4E6', text: 'FFBE123C' },
  Lainnya: { fill: 'FFEDE9FE', text: 'FF6D28D9' },
};

const getLabelChipColors = (label: string) =>
  LABEL_CHIP_COLORS[label] ?? null;

const autoFitColumns = (
  sheet: ExcelJS.Worksheet,
  columnCount: number,
  options?: {
    minWidths?: Record<number, number>;
    maxWidth?: number;
  }
) => {
  const maxWidth = options?.maxWidth ?? 44;
  const minWidths = options?.minWidths ?? {};
  const computedWidths: number[] = [];

  for (let colIdx = 1; colIdx <= columnCount; colIdx++) {
    let widest = minWidths[colIdx] ?? 7;

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cell = row.getCell(colIdx);
      // Merged cells span multiple columns, so skip them when sizing individual columns
      if (cell.isMerged) return;
      const len = estimateCellVisualLength(cell);
      if (len > widest) widest = len;
    });

    const width = Math.min(maxWidth, Math.max(minWidths[colIdx] ?? 7, widest + 4));
    computedWidths[colIdx] = width;
    sheet.getColumn(colIdx).width = width;
  }

  // Auto-expand row height for wrapped cells that exceed their column width
  sheet.eachRow({ includeEmpty: false }, (row) => {
    let maxLines = 1;
    for (let colIdx = 1; colIdx <= columnCount; colIdx++) {
      const cell = row.getCell(colIdx);
      if (cell.isMerged || typeof cell.value !== 'string') continue;
      const colWidth = Math.max(10, (computedWidths[colIdx] ?? 16) - 2);
      const lines = Math.ceil(cell.value.length / colWidth);
      if (lines > maxLines) maxLines = lines;
    }
    if (maxLines > 1) {
      row.height = Math.max(row.height ?? 21, maxLines * 15 + 6);
    }
  });
};

const styleSectionTitleRow = (
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  title: string,
  colSpan: number,
  accentHex = 'FF0F766E'
) => {
  sheet.mergeCells(rowNumber, 1, rowNumber, colSpan);
  const row = sheet.getRow(rowNumber);
  row.height = 24;
  const cell = row.getCell(1);
  cell.value = title;
  cell.font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: accentHex },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
};

const styleTableHeaderRow = (
  row: ExcelJS.Row,
  headers: string[],
  alignments: ('left' | 'center' | 'right')[],
  fillHex = 'FF0F766E'
) => {
  row.height = 26;
  headers.forEach((label, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = label;
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillHex },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: alignments[idx] ?? 'left',
      wrapText: true,
    };
    cell.border = HEADER_BORDER;
  });
};

export const exportFinanceExcelReport = async ({
  selectedMonth,
  settings,
  rooms,
  payments,
  incomes = [],
  expenses,
  categoryTotals,
  monthIncome,
  totalExpense,
  netProfit,
}: FinanceExcelExportParams): Promise<void> => {
  const periodLabel = formatMonthYear(selectedMonth);
  const roomByNumber = new Map(rooms.map((r) => [r.number, r]));

  const monthPaidPayments = payments
    .filter((p) => p.month === selectedMonth && p.status === 'Lunas')
    .sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));

  const monthExtraIncomes = [...incomes]
    .filter((i) => i.month === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  const rentIncomeTotal = monthPaidPayments.reduce(
    (acc, p) => acc + p.amount + (p.lateFee ?? 0),
    0
  );
  const extraIncomeTotal = monthExtraIncomes.reduce((acc, i) => acc + i.amount, 0);

  const monthPendingPayments = payments.filter(
    (p) => p.month === selectedMonth && p.status === 'Belum Bayar'
  );
  const totalPendingAmount = monthPendingPayments.reduce(
    (acc, p) => acc + p.amount + (p.lateFee ?? 0),
    0
  );

  const sortedExpenses = [...expenses]
    .filter((e) => e.month === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.adminName || settings.name;
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  // =========================================================================
  // SHEET 1: LAPORAN KEUANGAN (4 TABEL TERPISAH & TERTATA RAPI)
  // =========================================================================
  const reportSheet = workbook.addWorksheet('Laporan Keuangan', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Banner Header (Auto Merge & Center)
  reportSheet.mergeCells(1, 1, 1, 9);
  const titleRow = reportSheet.getRow(1);
  titleRow.height = 30;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `LAPORAN KEUANGAN - ${(settings.name || 'KOST PUTRA AGAN').toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A49' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  reportSheet.mergeCells(2, 1, 2, 9);
  const subRow = reportSheet.getRow(2);
  subRow.height = 22;
  const subCell = subRow.getCell(1);
  subCell.value = `Periode: ${periodLabel}  |  Alamat: ${settings.address || '-'}  |  Pengelola: ${settings.adminName || 'Admin'}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.border = { bottom: { style: 'thin', color: { argb: 'FF99F6E4' } } };

  let cursorRow = 4;

  // -------------------------------------------------------------------------
  // TABEL 1: RINGKASAN KEUANGAN PERIODE
  // -------------------------------------------------------------------------
  styleSectionTitleRow(reportSheet, cursorRow++, '1. RINGKASAN KEUANGAN PERIODE', 4);
  styleTableHeaderRow(
    reportSheet.getRow(cursorRow++),
    ['No', 'Komponen Keuangan', 'Jumlah Transaksi / Keterangan', 'Nominal (Rp)'],
    ['center', 'left', 'left', 'right']
  );

  const summaryData: [number, string, string, number, string][] = [
    [
      1,
      'Pemasukan Uang Kost (Sewa Lunas)',
      `${monthPaidPayments.length} pembayaran sewa kamar`,
      rentIncomeTotal,
      'FF047857',
    ],
    [
      2,
      'Pemasukan Tambahan Kost',
      `${monthExtraIncomes.length} catatan pemasukan lainnya`,
      extraIncomeTotal,
      'FF0F766E',
    ],
    [
      3,
      'Total Pemasukan Periode',
      `${monthPaidPayments.length + monthExtraIncomes.length} transaksi masuk`,
      monthIncome,
      'FF047857',
    ],
    [
      4,
      'Total Pengeluaran Keperluan Kost',
      `${sortedExpenses.length} pos pengeluaran`,
      totalExpense,
      'FFB45309',
    ],
    [
      5,
      'Laba / Arus Kas Bersih',
      netProfit >= 0 ? 'Surplus periode berjalan' : 'Defisit periode berjalan',
      netProfit,
      netProfit >= 0 ? 'FF0F766E' : 'FFBE123C',
    ],
    [
      6,
      'Piutang / Tagihan Belum Bayar',
      `${monthPendingPayments.length} tagihan menunggu pelunasan`,
      totalPendingAmount,
      'FF64748B',
    ],
  ];

  summaryData.forEach((item, idx) => {
    const row = reportSheet.getRow(cursorRow++);
    row.height = 22;
    const isNetRow = item[0] === 5;
    const rowFill = isNetRow
      ? 'FFF0FDFA'
      : idx % 2 === 1
      ? 'FFF8FAFC'
      : 'FFFFFFFF';

    const c1 = row.getCell(1);
    const c2 = row.getCell(2);
    const c3 = row.getCell(3);
    const c4 = row.getCell(4);

    c1.value = item[0];
    c2.value = item[1];
    c3.value = item[2];
    c4.value = item[3];
    c4.numFmt = CURRENCY_FORMAT;

    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c2.alignment = { vertical: 'middle', horizontal: 'left' };
    c3.alignment = { vertical: 'middle', horizontal: 'left' };
    c4.alignment = { vertical: 'middle', horizontal: 'right' };

    [c1, c2, c3, c4].forEach((c, colI) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
      c.border = isNetRow ? TOTAL_BORDER : CELL_BORDER;
      c.font = {
        name: 'Calibri',
        size: 10,
        bold: isNetRow || colI === 3 || item[0] === 3,
        color: { argb: colI === 3 ? item[4] : 'FF0F172A' },
      };
    });
  });

  cursorRow += 1;

  // -------------------------------------------------------------------------
  // TABEL 2: RINCIAN PEMASUKAN (UANG KOST & PEMASUKAN LAINNYA)
  // -------------------------------------------------------------------------
  styleSectionTitleRow(reportSheet, cursorRow++, '2. TABEL PEMASUKAN (UANG KOST & TAMBAHAN)', 9);
  styleTableHeaderRow(
    reportSheet.getRow(cursorRow++),
    [
      'No',
      'Tanggal',
      'No. Invoice / Ref',
      'Unit / Kategori',
      'Penyewa / Keterangan',
      'Metode Bayar',
      'Pokok / Nominal (Rp)',
      'Denda (Rp)',
      'Total Diterima (Rp)',
    ],
    ['center', 'center', 'left', 'left', 'left', 'left', 'right', 'right', 'right']
  );

  const combinedIncomeRows = [
    ...monthPaidPayments.map((p) => {
      const room = roomByNumber.get(p.roomNumber);
      const unitLabel = room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`;
      return {
        dateStr: p.paidDate || `${selectedMonth}-01`,
        refNo: p.invoiceNo || '-',
        unitOrCat: unitLabel,
        desc: `Uang Kost · ${p.tenantName}`,
        method: p.method || '-',
        base: p.amount,
        lateFee: p.lateFee ?? 0,
      };
    }),
    ...monthExtraIncomes.map((inc, idx) => ({
      dateStr: inc.date || `${selectedMonth}-01`,
      refNo: `INC-${selectedMonth.replace('-', '')}-${String(idx + 1).padStart(3, '0')}`,
      unitOrCat: inc.category,
      desc: inc.title,
      method: inc.method || '-',
      base: inc.amount,
      lateFee: 0,
    })),
  ].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const incomeStartRow = cursorRow;
  if (combinedIncomeRows.length === 0) {
    reportSheet.mergeCells(cursorRow, 1, cursorRow, 9);
    const emptyRow = reportSheet.getRow(cursorRow++);
    emptyRow.height = 22;
    const cell = emptyRow.getCell(1);
    cell.value = `Belum ada pemasukan tercatat pada periode ${periodLabel}.`;
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    for (let c = 1; c <= 9; c++) {
      emptyRow.getCell(c).border = CELL_BORDER;
    }
  } else {
    combinedIncomeRows.forEach((item, idx) => {
      const row = reportSheet.getRow(cursorRow++);
      row.height = 21;
      const rowFill = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

      const values: (string | number | Date | ExcelJS.CellFormulaValue)[] = [
        idx + 1,
        parseIsoDate(item.dateStr),
        item.refNo,
        item.unitOrCat,
        item.desc,
        item.method,
        item.base,
        item.lateFee,
        {
          formula: `G${row.number}+H${row.number}`,
          result: item.base + item.lateFee,
        },
      ];

      values.forEach((v, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = v;
        const labelChip = colIdx === 5 && typeof v === 'string' ? getLabelChipColors(v) : null;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: labelChip ? labelChip.fill : rowFill },
        };
        cell.border = CELL_BORDER;
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: colIdx === 8 || Boolean(labelChip),
          color: { argb: labelChip ? labelChip.text : 'FF0F172A' },
        };

        if (colIdx === 0 || colIdx === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colIdx === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (v instanceof Date) cell.numFmt = DATE_FORMAT;
        } else if (colIdx >= 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = CURRENCY_FORMAT;
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });
    });

    const incomeEndRow = cursorRow - 1;
    const totalIncomeRow = reportSheet.getRow(cursorRow++);
    totalIncomeRow.height = 24;
    reportSheet.mergeCells(totalIncomeRow.number, 1, totalIncomeRow.number, 6);
    totalIncomeRow.getCell(1).value = `TOTAL PEMASUKAN (${combinedIncomeRows.length} Transaksi)`;
    totalIncomeRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };

    const sumBase = combinedIncomeRows.reduce((s, r) => s + r.base, 0);
    const sumFee = combinedIncomeRows.reduce((s, r) => s + r.lateFee, 0);

    totalIncomeRow.getCell(7).value = {
      formula: `SUM(G${incomeStartRow}:G${incomeEndRow})`,
      result: sumBase,
    };
    totalIncomeRow.getCell(8).value = {
      formula: `SUM(H${incomeStartRow}:H${incomeEndRow})`,
      result: sumFee,
    };
    totalIncomeRow.getCell(9).value = {
      formula: `SUM(I${incomeStartRow}:I${incomeEndRow})`,
      result: sumBase + sumFee,
    };

    for (let c = 1; c <= 9; c++) {
      const cell = totalIncomeRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      cell.border = TOTAL_BORDER;
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FF065F46' },
      };
      if (c >= 7) {
        cell.numFmt = CURRENCY_FORMAT;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    }
  }

  cursorRow += 1;

  // -------------------------------------------------------------------------
  // TABEL 3: RINCIAN PENGELUARAN OPERASIONAL
  // -------------------------------------------------------------------------
  styleSectionTitleRow(
    reportSheet,
    cursorRow++,
    '3. TABEL PENGELUARAN OPERASIONAL',
    6,
    'FFB45309'
  );
  styleTableHeaderRow(
    reportSheet.getRow(cursorRow++),
    ['No', 'Tanggal', 'Kategori', 'Keterangan Pengeluaran', 'Catatan', 'Nominal (Rp)'],
    ['center', 'center', 'left', 'left', 'left', 'right'],
    'FFB45309'
  );

  const expenseStartRow = cursorRow;
  if (sortedExpenses.length === 0) {
    reportSheet.mergeCells(cursorRow, 1, cursorRow, 6);
    const emptyRow = reportSheet.getRow(cursorRow++);
    emptyRow.height = 22;
    const cell = emptyRow.getCell(1);
    cell.value = `Belum ada pengeluaran operasional tercatat pada periode ${periodLabel}.`;
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    for (let c = 1; c <= 6; c++) {
      emptyRow.getCell(c).border = CELL_BORDER;
    }
  } else {
    sortedExpenses.forEach((exp, idx) => {
      const row = reportSheet.getRow(cursorRow++);
      row.height = 21;
      const rowFill = idx % 2 === 1 ? 'FFFFFBEB' : 'FFFFFFFF';

      const values: (string | number | Date)[] = [
        idx + 1,
        parseIsoDate(exp.date),
        exp.category,
        exp.title,
        exp.notes?.trim() || '-',
        exp.amount,
      ];

      values.forEach((v, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = v;
        const labelChip = colIdx === 2 && typeof v === 'string' ? getLabelChipColors(v) : null;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: labelChip ? labelChip.fill : rowFill },
        };
        cell.border = CELL_BORDER;
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: colIdx === 5 || Boolean(labelChip),
          color: { argb: labelChip ? labelChip.text : 'FF0F172A' },
        };
        if (colIdx === 0 || colIdx === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colIdx === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (v instanceof Date) cell.numFmt = DATE_FORMAT;
        } else if (colIdx === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = CURRENCY_FORMAT;
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });
    });

    const expenseEndRow = cursorRow - 1;
    const totalExpenseRow = reportSheet.getRow(cursorRow++);
    totalExpenseRow.height = 24;
    reportSheet.mergeCells(totalExpenseRow.number, 1, totalExpenseRow.number, 5);
    totalExpenseRow.getCell(1).value = `TOTAL PENGELUARAN (${sortedExpenses.length} Item)`;
    totalExpenseRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    totalExpenseRow.getCell(6).value = {
      formula: `SUM(F${expenseStartRow}:F${expenseEndRow})`,
      result: totalExpense,
    };

    for (let c = 1; c <= 6; c++) {
      const cell = totalExpenseRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.border = TOTAL_BORDER;
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FF92400E' },
      };
      if (c === 6) {
        cell.numFmt = CURRENCY_FORMAT;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    }
  }

  cursorRow += 1;

  // -------------------------------------------------------------------------
  // TABEL 4: REKAP PENGELUARAN PER KATEGORI
  // -------------------------------------------------------------------------
  styleSectionTitleRow(reportSheet, cursorRow++, '4. REKAP PENGELUARAN PER KATEGORI', 4);
  styleTableHeaderRow(
    reportSheet.getRow(cursorRow++),
    ['No', 'Kategori Biaya', 'Porsi (%)', 'Total Kategori (Rp)'],
    ['center', 'left', 'right', 'right'],
    'FF334155'
  );

  const catStartRow = cursorRow;
  categoryTotals.forEach((cat, idx) => {
    const row = reportSheet.getRow(cursorRow++);
    row.height = 21;
    const rowFill = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

    const c1 = row.getCell(1);
    const c2 = row.getCell(2);
    const c3 = row.getCell(3);
    const c4 = row.getCell(4);

    c1.value = idx + 1;
    c2.value = cat.category;
    c3.value = totalExpense > 0 ? cat.amount / totalExpense : 0;
    c3.numFmt = '0.0%';
    c4.value = cat.amount;
    c4.numFmt = CURRENCY_FORMAT;

    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c2.alignment = { vertical: 'middle', horizontal: 'left' };
    c3.alignment = { vertical: 'middle', horizontal: 'right' };
    c4.alignment = { vertical: 'middle', horizontal: 'right' };

    const catChip = getLabelChipColors(cat.category);
    [c1, c2, c3, c4].forEach((c, idxCell) => {
      const useChip = idxCell === 1 && catChip;
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: useChip ? catChip.fill : rowFill },
      };
      c.border = CELL_BORDER;
      c.font = {
        name: 'Calibri',
        size: 10,
        bold: Boolean(useChip),
        color: { argb: useChip ? catChip.text : 'FF0F172A' },
      };
    });
  });

  const catEndRow = cursorRow - 1;
  const catTotalRow = reportSheet.getRow(cursorRow++);
  catTotalRow.height = 24;
  reportSheet.mergeCells(catTotalRow.number, 1, catTotalRow.number, 2);
  catTotalRow.getCell(1).value = 'TOTAL KATEGORI';
  catTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
  catTotalRow.getCell(3).value = {
    formula: `SUM(C${catStartRow}:C${catEndRow})`,
    result: totalExpense > 0 ? 1 : 0,
  };
  catTotalRow.getCell(3).numFmt = '0.0%';
  catTotalRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  catTotalRow.getCell(4).value = {
    formula: `SUM(D${catStartRow}:D${catEndRow})`,
    result: totalExpense,
  };
  catTotalRow.getCell(4).numFmt = CURRENCY_FORMAT;
  catTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 4; c++) {
    const cell = catTotalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  }

  autoFitColumns(reportSheet, 9, {
    minWidths: {
      1: 6,
      2: 15,
      3: 18,
      4: 22,
      5: 22,
      6: 18,
      7: 18,
      8: 15,
      9: 21,
    },
    maxWidth: 44,
  });

  // =========================================================================
  // SHEET 2: ARUS KAS KRONOLOGIS (SIAP FILTER & SORT DI EXCEL)
  // =========================================================================
  const cashflowSheet = workbook.addWorksheet('Arus Kas Kronologis', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  cashflowSheet.mergeCells(1, 1, 1, 11);
  const cfTitle = cashflowSheet.getRow(1);
  cfTitle.height = 28;
  cfTitle.getCell(1).value = `BUKU KAS KRONOLOGIS - ${(settings.name || 'KOST PUTRA AGAN').toUpperCase()} (${periodLabel})`;
  cfTitle.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cfTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A49' } };
  cfTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  cashflowSheet.mergeCells(2, 1, 2, 11);
  const cfSub = cashflowSheet.getRow(2);
  cfSub.height = 21;
  cfSub.getCell(1).value = 'Urutan transaksi berdasarkan tanggal untuk keperluan filter & audit bulanan';
  cfSub.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  cfSub.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
  cfSub.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  const cfHeaders = [
    'No',
    'Tanggal',
    'Jenis Transaksi',
    'Kategori / Unit',
    'No. Invoice / Ref',
    'Keterangan',
    'Metode',
    'Pemasukan (Rp)',
    'Pengeluaran (Rp)',
    'Saldo Berjalan (Rp)',
    'Catatan',
  ];
  styleTableHeaderRow(
    cashflowSheet.getRow(4),
    cfHeaders,
    ['center', 'center', 'center', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'left']
  );

  type LedgerEntry = {
    dateStr: string;
    type: 'Pemasukan' | 'Pengeluaran';
    unitOrCategory: string;
    refNo: string;
    description: string;
    method: string;
    income: number;
    expense: number;
    notes: string;
  };

  const ledgerEntries: LedgerEntry[] = [
    ...monthPaidPayments.map((p) => {
      const room = roomByNumber.get(p.roomNumber);
      const unitLabel = room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`;
      const extra = [
        p.lateFee && p.lateFee > 0 ? `Termasuk denda Rp ${p.lateFee.toLocaleString('id-ID')}` : '',
        p.notes ?? '',
      ]
        .filter(Boolean)
        .join(' - ');
      return {
        dateStr: p.paidDate || `${selectedMonth}-01`,
        type: 'Pemasukan' as const,
        unitOrCategory: unitLabel,
        refNo: p.invoiceNo || '-',
        description: `Uang Kost ${unitLabel} (${p.tenantName})`,
        method: p.method || '-',
        income: p.amount + (p.lateFee ?? 0),
        expense: 0,
        notes: extra || '-',
      };
    }),
    ...monthExtraIncomes.map((inc, idx) => ({
      dateStr: inc.date || `${selectedMonth}-01`,
      type: 'Pemasukan' as const,
      unitOrCategory: inc.category,
      refNo: `INC-${selectedMonth.replace('-', '')}-${String(idx + 1).padStart(3, '0')}`,
      description: inc.title,
      method: inc.method || '-',
      income: inc.amount,
      expense: 0,
      notes: inc.notes?.trim() || '-',
    })),
    ...sortedExpenses.map((e, idx) => ({
      dateStr: e.date || `${selectedMonth}-01`,
      type: 'Pengeluaran' as const,
      unitOrCategory: e.category,
      refNo: `EXP-${selectedMonth.replace('-', '')}-${String(idx + 1).padStart(3, '0')}`,
      description: e.title,
      method: 'Operasional',
      income: 0,
      expense: e.amount,
      notes: e.notes?.trim() || '-',
    })),
  ].sort((a, b) => {
    const cmp = a.dateStr.localeCompare(b.dateStr);
    if (cmp !== 0) return cmp;
    if (a.type !== b.type) return a.type === 'Pemasukan' ? -1 : 1;
    return a.refNo.localeCompare(b.refNo);
  });

  let cfRowIdx = 5;
  let running = 0;

  if (ledgerEntries.length === 0) {
    cashflowSheet.mergeCells(cfRowIdx, 1, cfRowIdx, 11);
    const emptyCf = cashflowSheet.getRow(cfRowIdx++);
    emptyCf.height = 22;
    emptyCf.getCell(1).value = `Belum ada transaksi pada periode ${periodLabel}.`;
    emptyCf.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCf.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    for (let c = 1; c <= 11; c++) {
      emptyCf.getCell(c).border = CELL_BORDER;
    }
  } else {
    ledgerEntries.forEach((entry, idx) => {
      const row = cashflowSheet.getRow(cfRowIdx++);
      row.height = 21;
      running += entry.income - entry.expense;
      const rowFill = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

      const vals: (string | number | Date | ExcelJS.CellFormulaValue)[] = [
        idx + 1,
        parseIsoDate(entry.dateStr),
        entry.type,
        entry.unitOrCategory,
        entry.refNo,
        entry.description,
        entry.method,
        entry.income,
        entry.expense,
        idx === 0
          ? { formula: `H${row.number}-I${row.number}`, result: running }
          : { formula: `J${row.number - 1}+H${row.number}-I${row.number}`, result: running },
        entry.notes,
      ];

      vals.forEach((v, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = v;
        const labelChip =
          (colIdx === 2 || colIdx === 6) && typeof v === 'string'
            ? getLabelChipColors(v)
            : null;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: labelChip ? labelChip.fill : rowFill },
        };
        cell.border = CELL_BORDER;
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: colIdx === 9 || colIdx === 2 || Boolean(labelChip),
          color: { argb: labelChip ? labelChip.text : 'FF0F172A' },
        };

        if (colIdx === 0 || colIdx === 2 || colIdx === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colIdx === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (v instanceof Date) cell.numFmt = DATE_FORMAT;
        } else if (colIdx >= 7 && colIdx <= 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = CURRENCY_FORMAT;
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });
    });

    const cfEndRow = cfRowIdx - 1;
    cashflowSheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: cfEndRow, column: 11 },
    };

    const cfTotal = cashflowSheet.getRow(cfRowIdx++);
    cfTotal.height = 24;
    cashflowSheet.mergeCells(cfTotal.number, 1, cfTotal.number, 7);
    cfTotal.getCell(1).value = `TOTAL ARUS KAS (${ledgerEntries.length} Transaksi)`;
    cfTotal.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    cfTotal.getCell(8).value = {
      formula: `SUM(H5:H${cfEndRow})`,
      result: monthIncome,
    };
    cfTotal.getCell(9).value = {
      formula: `SUM(I5:I${cfEndRow})`,
      result: totalExpense,
    };
    cfTotal.getCell(10).value = {
      formula: `H${cfTotal.number}-I${cfTotal.number}`,
      result: netProfit,
    };
    cfTotal.getCell(11).value = netProfit >= 0 ? 'Surplus' : 'Defisit';

    for (let c = 1; c <= 11; c++) {
      const cell = cfTotal.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
      cell.border = TOTAL_BORDER;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F766E' } };
      if (c >= 8 && c <= 10) {
        cell.numFmt = CURRENCY_FORMAT;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (c === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
  }

  autoFitColumns(cashflowSheet, 11, {
    minWidths: {
      1: 6,
      2: 14,
      3: 16,
      4: 18,
      5: 18,
      6: 26,
      7: 16,
      8: 18,
      9: 18,
      10: 20,
      11: 22,
    },
    maxWidth: 44,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `laporan-keuangan-kost-putra-agan-${selectedMonth}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface AnnualMonthRow {
  month: string;
  label: string;
  paidCount: number;
  income: number;
  expense: number;
  net: number;
}

export interface AnnualFinanceExcelExportParams {
  selectedYear: string;
  settings: PropertySettings;
  rooms: Room[];
  payments: PaymentRecord[];
  incomes?: IncomeRecord[];
  expenses: ExpenseRecord[];
  monthlyRows: AnnualMonthRow[];
  categoryTotals: {
    category: ExpenseCategory;
    amount: number;
    pct: number;
  }[];
  annualIncome: number;
  annualExpense: number;
  annualNetProfit: number;
}

export const exportAnnualFinanceExcelReport = async ({
  selectedYear,
  settings,
  rooms,
  payments,
  incomes = [],
  expenses,
  monthlyRows,
  categoryTotals,
  annualIncome,
  annualExpense,
  annualNetProfit,
}: AnnualFinanceExcelExportParams): Promise<void> => {
  const roomByNumber = new Map(rooms.map((r) => [r.number, r]));
  const yearPaidPayments = payments
    .filter((p) => p.month.startsWith(`${selectedYear}-`) && p.status === 'Lunas')
    .sort((a, b) => (a.paidDate || a.month).localeCompare(b.paidDate || b.month));
  const yearExtraIncomes = [...incomes]
    .filter((i) => i.month.startsWith(`${selectedYear}-`))
    .sort((a, b) => a.date.localeCompare(b.date));
  const yearPendingPayments = payments.filter(
    (p) => p.month.startsWith(`${selectedYear}-`) && p.status === 'Belum Bayar'
  );
  const yearExpenses = expenses
    .filter((e) => e.month.startsWith(`${selectedYear}-`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.adminName || 'Admin Kost Putra Agan';
  workbook.created = new Date();

  const propName = (settings.name || 'Kost Putra Agan').toUpperCase();

  // Sheet 1: Ringkasan & Rekap 12 Bulan
  const summarySheet = workbook.addWorksheet(`Rekap ${selectedYear}`, {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  summarySheet.mergeCells('A1:F1');
  const titleRow = summarySheet.getRow(1);
  titleRow.height = 28;
  titleRow.getCell(1).value = `REKAP KEUANGAN TAHUNAN ${selectedYear} - ${propName}`;
  titleRow.getCell(1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F766E' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  summarySheet.mergeCells('A2:F2');
  const subRow = summarySheet.getRow(2);
  subRow.height = 20;
  subRow.getCell(1).value = `Periode: Januari - Desember ${selectedYear} | Pengelola: ${
    settings.adminName || 'Admin'
  } | Dicetak: ${new Date().toLocaleDateString('id-ID')}`;
  subRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  styleSectionTitleRow(summarySheet, 4, `1. RINGKASAN KEUANGAN TAHUN ${selectedYear}`, 6);
  styleTableHeaderRow(
    summarySheet.getRow(5),
    ['No', 'Komponen Keuangan', 'Keterangan', 'Nominal (Rp)', 'Status', 'Catatan'],
    ['center', 'left', 'left', 'right', 'center', 'left']
  );

  const kpiRows: [number, string, string, number, string, string][] = [
    [1, 'Total Pemasukan Kost (Uang Kost & Tambahan)', `${yearPaidPayments.length} sewa + ${yearExtraIncomes.length} lainnya`, annualIncome, 'Terealisasi', 'Termasuk denda & pemasukan lain'],
    [2, 'Total Pengeluaran Keperluan Kost', `${yearExpenses.length} transaksi`, annualExpense, 'Tercatat', 'Listrik, air, bahan, tagihan, lainnya'],
    [3, `Laba Bersih Tahun ${selectedYear}`, annualNetProfit >= 0 ? 'Surplus Tahunan' : 'Defisit Tahunan', annualNetProfit, annualNetProfit >= 0 ? 'Surplus' : 'Defisit', `${yearPendingPayments.length} tagihan belum bayar di ${selectedYear}`],
  ];

  kpiRows.forEach((vals, idx) => {
    const row = summarySheet.getRow(6 + idx);
    row.height = 22;
    const fillHex = idx === 2 ? 'FFF0FDFA' : idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
    vals.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillHex } };
      cell.border = idx === 2 ? TOTAL_BORDER : CELL_BORDER;
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: idx === 2 || cIdx === 3,
        color: { argb: idx === 2 ? 'FF0F766E' : 'FF0F172A' },
      };
      if (cIdx === 0 || cIdx === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (cIdx === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = CURRENCY_FORMAT;
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  styleSectionTitleRow(summarySheet, 10, `2. REKAPITULASI PER BULAN (${selectedYear})`, 6);
  styleTableHeaderRow(
    summarySheet.getRow(11),
    ['No', 'Bulan', 'Transaksi Lunas', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Laba Bersih (Rp)'],
    ['center', 'left', 'center', 'right', 'right', 'right']
  );

  monthlyRows.forEach((mRow, idx) => {
    const row = summarySheet.getRow(12 + idx);
    row.height = 21;
    const fillHex = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
    const vals: (string | number | ExcelJS.CellFormulaValue)[] = [
      idx + 1,
      formatMonthYear(mRow.month),
      mRow.paidCount,
      mRow.income,
      mRow.expense,
      { formula: `D${row.number}-E${row.number}`, result: mRow.net },
    ];
    vals.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillHex } };
      cell.border = CELL_BORDER;
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: cIdx === 5,
        color: { argb: cIdx === 5 && mRow.net < 0 ? 'FFBE123C' : 'FF0F172A' },
      };
      if (cIdx === 0 || cIdx === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (cIdx >= 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = CURRENCY_FORMAT;
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  const mTotalRow = summarySheet.getRow(24);
  mTotalRow.height = 24;
  summarySheet.mergeCells(24, 1, 24, 2);
  mTotalRow.getCell(1).value = `TOTAL TAHUN ${selectedYear}`;
  mTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
  mTotalRow.getCell(3).value = { formula: 'SUM(C12:C23)', result: yearPaidPayments.length };
  mTotalRow.getCell(4).value = { formula: 'SUM(D12:D23)', result: annualIncome };
  mTotalRow.getCell(5).value = { formula: 'SUM(E12:E23)', result: annualExpense };
  mTotalRow.getCell(6).value = { formula: 'D24-E24', result: annualNetProfit };
  for (let c = 1; c <= 6; c++) {
    const cell = mTotalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F766E' } };
    if (c === 3) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (c >= 4) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = CURRENCY_FORMAT;
    }
  }

  styleSectionTitleRow(summarySheet, 26, `3. REKAP PENGELUARAN PER KATEGORI (${selectedYear})`, 6);
  styleTableHeaderRow(
    summarySheet.getRow(27),
    ['No', 'Kategori Biaya', 'Porsi (%)', 'Total Kategori (Rp)', 'Keterangan', 'Tahun'],
    ['center', 'left', 'center', 'right', 'left', 'center']
  );

  categoryTotals.forEach((cat, idx) => {
    const row = summarySheet.getRow(28 + idx);
    row.height = 21;
    const fillHex = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
    const vals: (string | number)[] = [
      idx + 1,
      cat.category,
      `${cat.pct}%`,
      cat.amount,
      cat.amount > 0 ? 'Tercatat di buku kas tahunan' : 'Belum ada pengeluaran',
      selectedYear,
    ];
    vals.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillHex } };
      cell.border = CELL_BORDER;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      if (cIdx === 0 || cIdx === 2 || cIdx === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (cIdx === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = CURRENCY_FORMAT;
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  autoFitColumns(summarySheet, 6, {
    minWidths: { 1: 6, 2: 24, 3: 18, 4: 20, 5: 20, 6: 24 },
    maxWidth: 40,
  });

  // Sheet 2: Rincian Pemasukan Tahunan
  const incomeSheet = workbook.addWorksheet('Pemasukan Tahunan', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });
  incomeSheet.mergeCells('A1:J1');
  incomeSheet.getRow(1).height = 26;
  incomeSheet.getRow(1).getCell(1).value = `RINCIAN PEMASUKAN KOST TAHUN ${selectedYear} - ${propName}`;
  incomeSheet.getRow(1).getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F766E' } };
  styleTableHeaderRow(
    incomeSheet.getRow(4),
    ['No', 'Periode', 'Tgl Bayar', 'No. Invoice / Ref', 'Unit / Kategori', 'Penyewa / Keterangan', 'Metode', 'Nominal (Rp)', 'Denda (Rp)', 'Total (Rp)'],
    ['center', 'center', 'center', 'left', 'left', 'left', 'center', 'right', 'right', 'right']
  );

  const combinedYearIncomeRows = [
    ...yearPaidPayments.map((p) => {
      const room = roomByNumber.get(p.roomNumber);
      const unitLabel = room ? getRoomDisplayName(room) : `Kamar ${p.roomNumber}`;
      return {
        month: p.month,
        dateStr: p.paidDate || `${p.month}-01`,
        refNo: p.invoiceNo || '-',
        unitOrCat: unitLabel,
        desc: `Uang Kost · ${p.tenantName}`,
        method: p.method || '-',
        base: p.amount,
        lateFee: p.lateFee ?? 0,
      };
    }),
    ...yearExtraIncomes.map((inc, idx) => ({
      month: inc.month,
      dateStr: inc.date || `${inc.month}-01`,
      refNo: `INC-${inc.month.replace('-', '')}-${String(idx + 1).padStart(3, '0')}`,
      unitOrCat: inc.category,
      desc: inc.title,
      method: inc.method || '-',
      base: inc.amount,
      lateFee: 0,
    })),
  ].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  let incRowIdx = 5;
  if (combinedYearIncomeRows.length === 0) {
    incomeSheet.mergeCells(5, 1, 5, 10);
    const emptyR = incomeSheet.getRow(5);
    emptyR.height = 22;
    emptyR.getCell(1).value = `Belum ada pemasukan tercatat di tahun ${selectedYear}.`;
    emptyR.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  } else {
    combinedYearIncomeRows.forEach((item, idx) => {
      const row = incomeSheet.getRow(incRowIdx++);
      row.height = 21;
      const vals: (string | number | Date | ExcelJS.CellFormulaValue)[] = [
        idx + 1,
        formatMonthYear(item.month),
        parseIsoDate(item.dateStr),
        item.refNo,
        item.unitOrCat,
        item.desc,
        item.method,
        item.base,
        item.lateFee,
        { formula: `H${row.number}+I${row.number}`, result: item.base + item.lateFee },
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.border = CELL_BORDER;
        cell.font = { name: 'Calibri', size: 10, bold: cIdx === 9, color: { argb: 'FF0F172A' } };
        if (cIdx <= 1 || cIdx === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (cIdx === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (v instanceof Date) cell.numFmt = DATE_FORMAT;
        } else if (cIdx >= 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = CURRENCY_FORMAT;
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });
  }
  autoFitColumns(incomeSheet, 10, {
    minWidths: { 1: 6, 2: 16, 3: 14, 4: 20, 5: 16, 6: 22, 7: 16, 8: 16, 9: 15, 10: 18 },
    maxWidth: 38,
  });

  // Sheet 3: Rincian Pengeluaran Tahunan
  const expSheet = workbook.addWorksheet('Pengeluaran Tahunan', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });
  expSheet.mergeCells('A1:G1');
  expSheet.getRow(1).height = 26;
  expSheet.getRow(1).getCell(1).value = `BUKU KAS PENGELUARAN TAHUN ${selectedYear} - ${propName}`;
  expSheet.getRow(1).getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F766E' } };
  styleTableHeaderRow(
    expSheet.getRow(4),
    ['No', 'Bulan', 'Tanggal', 'Kategori', 'Keperluan', 'Catatan', 'Nominal (Rp)'],
    ['center', 'center', 'center', 'center', 'left', 'left', 'right']
  );

  let expRowIdx = 5;
  if (yearExpenses.length === 0) {
    expSheet.mergeCells(5, 1, 5, 7);
    const emptyR = expSheet.getRow(5);
    emptyR.height = 22;
    emptyR.getCell(1).value = `Belum ada pengeluaran tercatat di tahun ${selectedYear}.`;
    emptyR.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  } else {
    yearExpenses.forEach((e, idx) => {
      const row = expSheet.getRow(expRowIdx++);
      row.height = 21;
      const vals: (string | number | Date)[] = [
        idx + 1,
        formatMonthYear(e.month),
        parseIsoDate(e.date),
        e.category,
        e.title,
        e.notes?.trim() || '-',
        e.amount,
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.border = CELL_BORDER;
        cell.font = { name: 'Calibri', size: 10, bold: cIdx === 6, color: { argb: 'FF0F172A' } };
        if (cIdx <= 1 || cIdx === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (cIdx === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (v instanceof Date) cell.numFmt = DATE_FORMAT;
        } else if (cIdx === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = CURRENCY_FORMAT;
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });
    });
  }
  autoFitColumns(expSheet, 7, {
    minWidths: { 1: 6, 2: 16, 3: 14, 4: 14, 5: 30, 6: 24, 7: 18 },
    maxWidth: 44,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `rekap-tahunan-kost-putra-agan-${selectedYear}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
