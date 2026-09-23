import React from 'react';

interface BreakdownItem {
  name: string;
  count: number;
  percentage: number;
}

interface BreakdownBarProps {
  title: string;
  items: BreakdownItem[];
  emptyMessage?: string;
}

export const BreakdownBar: React.FC<BreakdownBarProps> = ({
  title,
  items,
  emptyMessage = 'No data recorded yet',
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-[#E8E4DC] p-5">
        <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium mb-3">
          {title}
        </h3>
        <p className="text-xs text-[#999999] italic">{emptyMessage}</p>
      </div>
    );
  }

  const maxCount = Math.max(...items.map((it) => it.count), 1);

  return (
    <div className="bg-white border border-[#E8E4DC] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium mb-4">
        {title}
      </h3>
      <div className="space-y-3.5">
        {items.map((item, idx) => {
          const barWidth = Math.max(2, Math.round((item.count / maxCount) * 100));
          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[#111111] truncate max-w-[180px]">
                  {item.name}
                </span>
                <div className="flex items-center gap-2 text-[#888888] font-mono-tabular">
                  <span>{item.count}</span>
                  <span className="text-[#C6A46A] font-semibold">{item.percentage}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-[#F5F2EA] overflow-hidden">
                <div
                  className="h-full bg-[#111111] transition-all duration-300 group-hover:bg-[#C6A46A]"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
