export type CsvCell = string | number | null | undefined;

const normalizeForExcelCsv = (text: string): string =>
  text
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00B7/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\r?\n/g, ' | ')
    .trim();

export const formatCsvCell = (value: CsvCell, delimiter = ';'): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }

  let str = normalizeForExcelCsv(String(value));
  if (!str) return '';

  // Prevent accidental formula evaluation in Excel for free-text fields
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const needsQuoting =
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuoting) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Menghasilkan konten CSV dengan direktif `sep=;` agar Microsoft Excel
 * (baik pengaturan regional Indonesia maupun Inggris) otomatis memisahkan
 * setiap kolom secara rapi saat file dibuka langsung.
 */
export const buildExcelCsv = (
  headers: string[],
  rows: CsvCell[][],
  delimiter = ';'
): string => {
  const headerLine = headers.map((h) => formatCsvCell(h, delimiter)).join(delimiter);
  const bodyLines = rows.map((row) =>
    row.map((cell) => formatCsvCell(cell, delimiter)).join(delimiter)
  );
  return [`sep=${delimiter}`, headerLine, ...bodyLines].join('\r\n');
};

export interface CsvTableSection {
  title: string;
  headers: string[];
  rows: CsvCell[][];
}

/**
 * Menghasilkan file CSV berisi beberapa tabel terpisah satu per satu
 * dengan direktif `sep=;` agar langsung terbuka rapi di Excel.
 */
export const buildMultiTableExcelCsv = (
  reportTitle: string,
  subtitle: string,
  sections: CsvTableSection[],
  delimiter = ';'
): string => {
  const lines: string[] = [
    `sep=${delimiter}`,
    formatCsvCell(reportTitle, delimiter),
    formatCsvCell(subtitle, delimiter),
    '',
  ];

  sections.forEach((section, idx) => {
    lines.push(formatCsvCell(section.title, delimiter));
    lines.push(section.headers.map((h) => formatCsvCell(h, delimiter)).join(delimiter));
    section.rows.forEach((row) => {
      lines.push(row.map((cell) => formatCsvCell(cell, delimiter)).join(delimiter));
    });
    if (idx < sections.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\r\n');
};

export const downloadCsvFile = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
