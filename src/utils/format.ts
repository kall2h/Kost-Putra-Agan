export function formatIDR(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `Rp ${formatted}`;
}

export function formatShortIDR(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return `Rp ${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1).replace('.', ',')} jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)} rb`;
  }
  return formatIDR(amount);
}

const MONTH_NAMES_ID: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

const SHORT_MONTHS_ID: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'Mei',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Agu',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Des',
};

export function formatMonthYear(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES_ID[month] ?? month} ${year}`;
}

export function formatShortMonth(monthStr: string): string {
  const [, month] = monthStr.split('-');
  return SHORT_MONTHS_ID[month] ?? month;
}

export function formatDateID(dateStr: string | null): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${parseInt(day, 10)} ${SHORT_MONTHS_ID[month] ?? month} ${year}`;
}

export function buildInvoiceNumber(monthStr: string, roomNumber: string): string {
  const [year, month] = monthStr.split('-');
  return `INV/KPA/${year}/${month}/${roomNumber}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getNextMonthISO(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || 1;
  if (m >= 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(text);
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export interface DueStatusInfo {
  label: string;
  tone: 'overdue' | 'due_soon' | 'normal';
  daysDiff: number;
}

export function getDueStatusInfo(monthStr: string, dueDay: number, referenceDate?: Date): DueStatusInfo {
  const [yStr, mStr] = monthStr.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  if (!year || Number.isNaN(monthIdx)) {
    return { label: `Tgl ${dueDay}`, tone: 'normal', daysDiff: 0 };
  }
  const ref = referenceDate ?? new Date();
  const todayMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dueDate = new Date(year, monthIdx, Math.min(Math.max(1, dueDay), 28));
  const diffDays = Math.round((dueDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Terlambat ${Math.abs(diffDays)} hari`,
      tone: 'overdue',
      daysDiff: diffDays,
    };
  }
  if (diffDays === 0) {
    return {
      label: 'Jatuh Tempo Hari Ini',
      tone: 'due_soon',
      daysDiff: 0,
    };
  }
  if (diffDays <= 3) {
    return {
      label: `H-${diffDays} Jatuh Tempo`,
      tone: 'due_soon',
      daysDiff: diffDays,
    };
  }
  return {
    label: `Jatuh tempo tgl ${dueDay}`,
    tone: 'normal',
    daysDiff: diffDays,
  };
}
