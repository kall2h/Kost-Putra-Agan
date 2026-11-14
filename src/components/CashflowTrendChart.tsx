import React, { useState } from 'react';
import { MonthlyHistoricalSummary } from '../types/kost';
import { formatIDR, formatShortIDR } from '../utils/format';

interface CashflowTrendChartProps {
  data: MonthlyHistoricalSummary[];
  height?: number;
}

export const CashflowTrendChart: React.FC<CashflowTrendChartProps> = ({
  data,
  height = 240,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 640;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 36;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    25_000_000
  );
  const ceiling = Math.ceil(maxVal / 5_000_000) * 5_000_000;

  const getX = (idx: number) =>
    data.length <= 1
      ? padLeft + chartW / 2
      : padLeft + (idx / (data.length - 1)) * chartW;

  const getY = (val: number) => padTop + chartH - (val / ceiling) * chartH;

  const incomePoints = data.map((d, i) => ({ x: getX(i), y: getY(d.income), ...d }));
  const expensePoints = data.map((d, i) => ({ x: getX(i), y: getY(d.expense), ...d }));

  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX.toFixed(1)} ${p0.y.toFixed(1)}, ${cpX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const incomeLinePath = buildSmoothPath(incomePoints);
  const incomeAreaPath =
    incomePoints.length > 0
      ? `${incomeLinePath} L ${incomePoints[incomePoints.length - 1].x.toFixed(1)} ${(
          padTop + chartH
        ).toFixed(1)} L ${incomePoints[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';

  const expenseLinePath = buildSmoothPath(expensePoints);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(ceiling * t));
  const activePoint = hoveredIdx !== null ? incomePoints[hoveredIdx] : null;
  const activeExpense = hoveredIdx !== null ? expensePoints[hoveredIdx] : null;

  return (
    <div className="relative w-full">
      {/* Legend & Interactive Readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-5 text-xs">
          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
            <span className="w-4 h-1 rounded-full bg-gradient-to-r from-[#0F766E] to-[#14B8A6]" aria-hidden="true" />
            Pemasukan
          </span>
          <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="w-4 h-0.5 bg-amber-500/90 rounded-full" aria-hidden="true" />
            Pengeluaran
          </span>
        </div>

        {activePoint && activeExpense ? (
          <div className="font-mono-num text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200">
            <span className="font-semibold text-teal-700 dark:text-teal-300">
              {activePoint.label} 2026:
            </span>
            <span>Masuk {formatIDR(activePoint.income)}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>Keluar {formatIDR(activeExpense.expense)}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Arahkan kursor ke titik bulan untuk detail
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="Grafik tren pemasukan dan pengeluaran 6 bulan terakhir"
      >
        <defs>
          <linearGradient id="kpaIncomeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.28" />
            <stop offset="65%" stopColor="#0D9488" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="kpaIncomeStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="50%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines + Y Labels */}
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                className="stroke-teal-900/[0.07] dark:stroke-teal-400/[0.08]"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
              >
                {tick === 0 ? '0' : formatShortIDR(tick)}
              </text>
            </g>
          );
        })}

        {/* Income Area & Gradient Line */}
        {incomeAreaPath && <path d={incomeAreaPath} fill="url(#kpaIncomeArea)" />}
        {incomeLinePath && (
          <path
            d={incomeLinePath}
            fill="none"
            stroke="url(#kpaIncomeStroke)"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Expense Line */}
        {expenseLinePath && (
          <path
            d={expenseLinePath}
            fill="none"
            stroke="#D97706"
            strokeWidth="1.75"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Crosshair Line */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padTop}
            x2={activePoint.x}
            y2={padTop + chartH}
            className="stroke-teal-500/40"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* X Axis Labels + Interactive Hit Targets */}
        {data.map((d, idx) => {
          const cx = getX(idx);
          const cyInc = getY(d.income);
          const cyExp = getY(d.expense);
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={d.month}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={cx - chartW / (data.length * 2)}
                y={padTop}
                width={chartW / data.length}
                height={chartH + padBottom}
                fill="transparent"
              />

              {/* Expense Node */}
              <circle
                cx={cx}
                cy={cyExp}
                r={isHovered ? 4 : 2.75}
                className="fill-amber-500 stroke-white dark:stroke-[#0A181C]"
                strokeWidth="1.5"
              />

              {/* Income Node */}
              <circle
                cx={cx}
                cy={cyInc}
                r={isHovered ? 5.5 : 3.75}
                className="fill-teal-500 stroke-white dark:stroke-[#0A181C]"
                strokeWidth="2"
              />

              {/* Month Label */}
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className={`text-[11px] font-medium ${
                  isHovered
                    ? 'fill-slate-900 dark:fill-white'
                    : 'fill-slate-500 dark:fill-slate-400'
                }`}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
