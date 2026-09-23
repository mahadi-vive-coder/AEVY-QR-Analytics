import React, { useState } from 'react';

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  label?: string;
  isHourly?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  height = 240,
  label = 'Scans',
  isHourly = false,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center border border-[#E8E4DC] bg-white text-[#888888] text-xs"
        style={{ height }}
      >
        <span className="font-serif-luxury text-base text-[#111111] mb-1">No Scan Activity Recorded</span>
        <span>Data will plot here automatically as visitors scan your AEVY QR codes.</span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 5);
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 28;
  const svgWidth = 800;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft + (i / (data.length - 1)) * plotWidth;
    const y = paddingTop + plotHeight - (d.count / maxVal) * plotHeight;
    return { x, y, ...d };
  });

  // Generate SVG path for line
  const linePath =
    points.length === 1
      ? `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`
      : points.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`, '');

  // Generate SVG path for gradient area
  const areaPath =
    points.length === 1
      ? ''
      : `${linePath} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

  // Y-axis grid values
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // X-axis label sample (show 4-6 labels)
  const step = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="relative w-full overflow-hidden select-none bg-white p-4 border border-[#E8E4DC]">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-[#888888] uppercase tracking-wider font-medium text-[10px]">
          {label} Trend
        </span>
        {hoverIndex !== null && points[hoverIndex] && (
          <div className="flex items-center gap-2 text-[#111111]">
            <span className="text-[#888888]">
              {isHourly ? points[hoverIndex].date : new Date(points[hoverIndex].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:
            </span>
            <span className="font-mono-tabular font-semibold text-[#C6A46A]">
              {points[hoverIndex].count} {points[hoverIndex].count === 1 ? 'scan' : 'scans'}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full overflow-visible"
        style={{ height }}
      >
        <defs>
          <linearGradient id="aevyGoldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C6A46A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#C6A46A" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines */}
        {yTicks.map((val, idx) => {
          const y = paddingTop + plotHeight - (val / maxVal) * plotHeight;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="#F0ECE4"
                strokeDasharray={val === 0 ? 'none' : '3 3'}
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                fill="#999999"
                fontSize="10"
                textAnchor="end"
                className="font-mono-tabular"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#aevyGoldGrad)" />}

        {/* Trend line */}
        <path
          d={linePath}
          fill="none"
          stroke="#C6A46A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points and hover hitboxes */}
        {points.map((pt, i) => {
          const isHovered = hoverIndex === i;
          return (
            <g key={i}>
              {/* Visible dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5 : 3}
                fill={isHovered ? '#111111' : '#C6A46A'}
                stroke="#FFFFFF"
                strokeWidth="2"
                className="transition-all duration-150"
              />

              {/* Interaction trigger rect */}
              <rect
                x={pt.x - 15}
                y={paddingTop}
                width="30"
                height={plotHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />

              {/* X-axis labels */}
              {(i % step === 0 || i === data.length - 1) && (
                <text
                  x={pt.x}
                  y={height - 6}
                  fill="#888888"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono-tabular"
                >
                  {isHourly
                    ? pt.date
                    : new Date(pt.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
