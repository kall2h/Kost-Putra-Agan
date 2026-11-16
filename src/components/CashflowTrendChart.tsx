import React, { useId, useRef, useState } from 'react';
import { MonthlyHistoricalSummary } from '../types/kost';
import { formatIDR, formatShortIDR } from '../utils/format';

interface CashflowTrendChartProps {
  data: MonthlyHistoricalSummary[];
  height?: number;
  activeMonth?: string;
}

export const CashflowTrendChart: React.FC<CashflowTrendChartProps> = ({
  data,
  height = 240,
  activeMonth,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useId();

  const width = 640;
  const padLeft = 60;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 34;
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

  const updateIndexFromClientX = (clientX: number) => {
    const svgEl = svgRef.current;
    if (!svgEl || data.length === 0) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0) return;

    const svgX = ((clientX - rect.left) / rect.width) * width;
    if (data.length === 1) {
      setHoveredIdx(0);
      return;
    }

    const ratio = (svgX - padLeft) / chartW;
    const clampedIdx = Math.max(
      0,
      Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))
    );
    setHoveredIdx((prev) => (prev === clampedIdx ? prev : clampedIdx));
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    updateIndexFromClientX(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      updateIndexFromClientX(e.touches[0].clientX);
    }
  };

  const activePoint = hoveredIdx !== null ? incomePoints[hoveredIdx] : null;
  const activeExpense = hoveredIdx !== null ? expensePoints[hoveredIdx] : null;
  const activeNet =
    activePoint && activeExpense ? activePoint.income - activeExpense.expense : 0;

  // Smart horizontal alignment so tooltip never clips left/right edges
  const tooltipXPercent = activePoint ? (activePoint.x / width) * 100 : 50;
  const tooltipTransform =
    hoveredIdx === 0
      ? 'translateX(-8%)'
      : hoveredIdx === data.length - 1
      ? 'translateX(-92%)'
      : 'translateX(-50%)';

  return (
    <div className="relative w-full">
      {/* Fixed-height Legend Bar (prevents vertical layout jump when hovering) */}
      <div className="min-h-[24px] flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-4 text-xs shrink-0">
          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
            <span className="w-3.5 h-1 rounded-full bg-teal-600" aria-hidden="true" />
            Pemasukan
          </span>
          <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="w-3.5 h-0.5 bg-amber-500 rounded-full" aria-hidden="true" />
            Pengeluaran
          </span>
        </div>

        <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate text-right">
          {activePoint
            ? `${activePoint.label} ${activePoint.month.slice(0, 4)} · Bersih ${formatShortIDR(activeNet)}`
            : 'Geser pada grafik untuk lihat rincian'}
        </span>
      </div>

      {/* SVG + Smooth Floating Tooltip Container */}
      <div className="relative w-full">
        {/* Smooth Floating Tooltip */}
        {activePoint && activeExpense && (
          <div
            aria-hidden="true"
            style={{
              left: `${tooltipXPercent}%`,
              transform: tooltipTransform,
            }}
            className="pointer-events-none absolute top-0 z-10 px-3 py-2 rounded-lg bg-slate-900/95 dark:bg-[#091316]/95 text-white border border-slate-700/80 dark:border-white/[0.14] shadow-md text-[11px] whitespace-nowrap transition-[left,transform,opacity] duration-150 ease-out"
          >
            <p className="font-semibold text-teal-300 mb-0.5">
              {activePoint.label} {activePoint.month.slice(0, 4)}
            </p>
            <div className="font-mono-num space-y-0.5">
              <p className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Masuk</span>
                <span className="font-medium text-white">
                  {formatIDR(activePoint.income)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Keluar</span>
                <span className="font-medium text-amber-300">
                  {formatIDR(activeExpense.expense)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-4 pt-0.5 border-t border-white/10">
                <span className="text-slate-300">Bersih</span>
                <span className="font-semibold text-emerald-300">
                  {formatIDR(activeNet)}
                </span>
              </p>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setHoveredIdx(null)}
          className="w-full h-auto overflow-visible select-none cursor-crosshair touch-pan-y"
          role="img"
          aria-label="Grafik tren pemasukan dan pengeluaran"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
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
                  className="stroke-slate-200 dark:stroke-white/[0.07]"
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

          {/* Income Area & Line (smooth draw animation) */}
          {incomeAreaPath && (
            <path
              d={incomeAreaPath}
              fill={`url(#${gradientId})`}
              className="animate-chart-fade"
            />
          )}
          {incomeLinePath && (
            <path
              d={incomeLinePath}
              pathLength={1}
              fill="none"
              stroke="#0D9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-chart-draw"
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
              className="animate-chart-fade"
            />
          )}

          {/* Smooth Sliding Crosshair */}
          {activePoint && (
            <line
              x1={0}
              y1={padTop}
              x2={0}
              y2={padTop + chartH}
              style={{
                transform: `translateX(${activePoint.x}px)`,
                transition: 'transform 150ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              className="stroke-teal-600/45 dark:stroke-teal-400/45 pointer-events-none"
              strokeWidth="1.25"
              strokeDasharray="3 3"
            />
          )}

          {/* Nodes & X Axis Labels */}
          {data.map((d, idx) => {
            const cx = getX(idx);
            const cyInc = getY(d.income);
            const cyExp = getY(d.expense);
            const isHovered = hoveredIdx === idx;
            const isSelectedPeriod = activeMonth === d.month && hoveredIdx === null;

            return (
              <g key={d.month} className="pointer-events-none">
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cyInc}
                    r={9}
                    className="fill-teal-500/15 dark:fill-teal-400/20 transition-all duration-150"
                  />
                )}

                {/* Expense Node */}
                <circle
                  cx={cx}
                  cy={cyExp}
                  r={isHovered ? 4.25 : 2.75}
                  className="fill-amber-500 stroke-white dark:stroke-[#0f1a1e] transition-all duration-150"
                  strokeWidth="1.5"
                />

                {/* Income Node */}
                <circle
                  cx={cx}
                  cy={cyInc}
                  r={isHovered ? 5.25 : isSelectedPeriod ? 4.5 : 3.5}
                  className="fill-teal-600 stroke-white dark:stroke-[#0f1a1e] transition-all duration-150"
                  strokeWidth="2"
                />

                {/* Month Label */}
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[11px] font-medium transition-colors duration-150 ${
                    isHovered || isSelectedPeriod
                      ? 'fill-teal-700 dark:fill-teal-300 font-semibold'
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
    </div>
  );
};
