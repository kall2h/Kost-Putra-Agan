import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthYear, getCurrentMonthISO } from '../utils/format';

interface MonthCalendarPickerProps {
  mode?: 'month' | 'year';
  value: string; // 'YYYY-MM' in month mode, 'YYYY' in year mode
  onChange: (nextValue: string) => void;
  activePeriods?: Set<string>;
  ariaLabel?: string;
}

const MONTHS_GRID = [
  { code: '01', short: 'Jan', full: 'Januari' },
  { code: '02', short: 'Feb', full: 'Februari' },
  { code: '03', short: 'Mar', full: 'Maret' },
  { code: '04', short: 'Apr', full: 'April' },
  { code: '05', short: 'Mei', full: 'Mei' },
  { code: '06', short: 'Jun', full: 'Juni' },
  { code: '07', short: 'Jul', full: 'Juli' },
  { code: '08', short: 'Agu', full: 'Agustus' },
  { code: '09', short: 'Sep', full: 'September' },
  { code: '10', short: 'Okt', full: 'Oktober' },
  { code: '11', short: 'Nov', full: 'November' },
  { code: '12', short: 'Des', full: 'Desember' },
];

function parseYearMonth(val: string): { year: number; month: number } {
  const [yRaw, mRaw] = val.split('-');
  const now = new Date();
  const y = Number(yRaw);
  const m = Number(mRaw);
  return {
    year: Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear(),
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1,
  };
}

export const MonthCalendarPicker: React.FC<MonthCalendarPickerProps> = ({
  mode = 'month',
  value,
  onChange,
  activePeriods,
  ariaLabel = 'Pilih Periode Kalender',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const parsed = useMemo(() => parseYearMonth(value), [value]);
  const [browseYear, setBrowseYear] = useState<number>(parsed.year);
  const [yearPageStart, setYearPageStart] = useState<number>(
    Math.floor(parsed.year / 9) * 9
  );

  useEffect(() => {
    setBrowseYear(parsed.year);
    setYearPageStart(Math.floor(parsed.year / 9) * 9);
  }, [parsed.year, open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const currentMonthISO = getCurrentMonthISO();
  const currentYearStr = currentMonthISO.slice(0, 4);

  const stepValue = (delta: number) => {
    if (mode === 'year') {
      const nextY = Math.min(2100, Math.max(2000, parsed.year + delta));
      onChange(String(nextY));
      return;
    }
    const totalMonths = parsed.year * 12 + (parsed.month - 1) + delta;
    const nextYear = Math.floor(totalMonths / 12);
    const nextMonth = (totalMonths % 12) + 1;
    if (nextYear < 2000 || nextYear > 2100) return;
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  };

  const displayLabel =
    mode === 'year'
      ? `Tahun ${parsed.year}`
      : formatMonthYear(`${parsed.year}-${String(parsed.month).padStart(2, '0')}`);

  const yearGrid = useMemo(
    () => Array.from({ length: 9 }, (_, i) => yearPageStart + i),
    [yearPageStart]
  );

  const activeYearsSet = useMemo(() => {
    const set = new Set<string>();
    activePeriods?.forEach((p) => {
      if (p.length >= 4) set.add(p.slice(0, 4));
    });
    return set;
  }, [activePeriods]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Segmented Calendar Control */}
      <div className="inline-flex items-center rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.1] overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => stepValue(-1)}
          aria-label={mode === 'year' ? 'Tahun sebelumnya' : 'Bulan sebelumnya'}
          className="min-h-[38px] px-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.05] transition-colors border-r border-slate-200/80 dark:border-white/[0.08]"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={ariaLabel}
          className="min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap"
        >
          <Calendar
            className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0"
            aria-hidden="true"
          />
          <span>{displayLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={() => stepValue(1)}
          aria-label={mode === 'year' ? 'Tahun berikutnya' : 'Bulan berikutnya'}
          className="min-h-[38px] px-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.05] transition-colors border-l border-slate-200/80 dark:border-white/[0.08]"
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Popover Calendar */}
      {open && (
        <div
          role="dialog"
          aria-label={mode === 'year' ? 'Kalender Tahun' : 'Kalender Bulan dan Tahun'}
          className="animate-modal-in absolute left-0 top-full mt-2 z-40 w-[290px] sm:w-[310px] rounded-2xl surface-card border border-slate-200 dark:border-white/[0.12] shadow-xl p-3.5 space-y-3 bg-white dark:bg-[#101c20]"
        >
          {mode === 'month' ? (
            <>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setBrowseYear((y) => Math.max(2000, y - 1))}
                  aria-label="Tahun sebelumnya di kalender"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-600 dark:text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="font-display font-semibold text-sm text-slate-900 dark:text-white font-mono-num">
                  {browseYear}
                </span>
                <button
                  type="button"
                  onClick={() => setBrowseYear((y) => Math.min(2100, y + 1))}
                  aria-label="Tahun berikutnya di kalender"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-600 dark:text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS_GRID.map((m) => {
                  const candidate = `${browseYear}-${m.code}`;
                  const isSelected = candidate === value;
                  const isCurrent = candidate === currentMonthISO;
                  const hasData = activePeriods?.has(candidate);
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => {
                        onChange(candidate);
                        setOpen(false);
                      }}
                      title={m.full}
                      className={`relative min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-medium transition-colors flex flex-col items-center justify-center ${
                        isSelected
                          ? 'nav-active-gradient text-white shadow-xs'
                          : isCurrent
                          ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{m.short}</span>
                      {hasData && (
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-white/90' : 'bg-teal-500 dark:bg-teal-400'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2">
                <label className="sr-only" htmlFor="calendar-direct-month">
                  Pilih bulan dan tahun kustom
                </label>
                <input
                  id="calendar-direct-month"
                  type="month"
                  value={value}
                  onChange={(e) => {
                    if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                      onChange(e.target.value);
                      setOpen(false);
                    }
                  }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    onChange(currentMonthISO);
                    setOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg btn-secondary text-[11px] font-medium whitespace-nowrap"
                >
                  Bulan Ini
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setYearPageStart((s) => Math.max(2000, s - 9))}
                  aria-label="Rentang tahun sebelumnya"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-600 dark:text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="font-display font-semibold text-sm text-slate-900 dark:text-white font-mono-num">
                  {yearPageStart} - {yearPageStart + 8}
                </span>
                <button
                  type="button"
                  onClick={() => setYearPageStart((s) => Math.min(2091, s + 9))}
                  aria-label="Rentang tahun berikutnya"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-600 dark:text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {yearGrid.map((yr) => {
                  const yrStr = String(yr);
                  const isSelected = yrStr === String(parsed.year);
                  const isCurrent = yrStr === currentYearStr;
                  const hasData = activeYearsSet.has(yrStr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        onChange(yrStr);
                        setOpen(false);
                      }}
                      className={`relative min-h-[38px] px-2 py-1.5 rounded-xl font-mono-num text-xs font-medium transition-colors flex flex-col items-center justify-center ${
                        isSelected
                          ? 'nav-active-gradient text-white shadow-xs'
                          : isCurrent
                          ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{yr}</span>
                      {hasData && (
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-white/90' : 'bg-teal-500 dark:bg-teal-400'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Titik menandai tahun berdata
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange(currentYearStr);
                    setOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg btn-secondary text-[11px] font-medium whitespace-nowrap"
                >
                  Tahun Ini
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
