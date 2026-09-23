import React, { useState, useEffect } from 'react';
import { TrendChart } from '../components/TrendChart';
import { BreakdownBar } from '../components/BreakdownBar';
import { AnalyticsData, QRCodeItem } from '../types';
import { api } from '../api/client';
import { Plus, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';

interface DashboardPageProps {
  onOpenCreateQr: () => void;
  onNavigateToQrCodes: () => void;
  onNavigateToAnalytics: () => void;
  onViewQrDetails: (id: string) => void;
  onViewQrPreview: (qr: QRCodeItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenCreateQr,
  onNavigateToQrCodes,
  onNavigateToAnalytics,
  onViewQrDetails,
  onViewQrPreview,
}) => {
  const [range, setRange] = useState<string>('30days');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [analyticsRes, qrsRes] = await Promise.all([
        api.getAnalytics({ range }),
        api.getQRCodes(),
      ]);
      setAnalytics(analyticsRes);
      setQrCodes(qrsRes.qrCodes);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [range]);

  const ranges = [
    { id: 'today', label: 'Today' },
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: '90days', label: '90 Days' },
    { id: 'all', label: 'All Time' },
  ];

  if (loading && !analytics) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-xs text-[#888888]">
        <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent animate-spin mb-3" />
        <span>Loading analytics studio...</span>
      </div>
    );
  }

  const overview = analytics?.overview || {
    total_qrcodes: qrCodes.length,
    total_scans: 0,
    today_scans: 0,
    this_week_scans: 0,
    this_month_scans: 0,
    estimated_unique_visitors: 0,
  };

  const statCards = [
    { label: 'TOTAL QR CODES', value: overview.total_qrcodes },
    { label: 'TOTAL SCANS', value: overview.total_scans },
    { label: 'TODAY', value: overview.today_scans },
    { label: 'THIS WEEK', value: overview.this_week_scans },
    { label: 'THIS MONTH', value: overview.this_month_scans },
    { label: 'ESTIMATED UNIQUE VISITORS', value: overview.estimated_unique_visitors, isHighlight: true },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
            Executive Overview
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Dynamic QR tracking telemetry and engagement for AEVY packaging.
          </p>
        </div>

        {/* Date Filter Segmented Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-[#EAE6DD] rounded-sm self-start sm:self-auto">
          {ranges.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#111111] shadow-xs'
                    : 'text-[#666666] hover:text-[#111111]'
                }`}
              >
                {r.label}
              </button>
            );
          })}
          <button
            onClick={() => loadData(true)}
            title="Refresh"
            className="p-1.5 text-[#666666] hover:text-[#111111] ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#E8E4DC] p-4 flex flex-col justify-between"
          >
            <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-2 leading-tight">
              {card.label}
            </span>
            <span
              className={`font-mono-tabular text-2xl sm:text-3xl font-bold tracking-tight ${
                card.isHighlight ? 'text-[#C6A46A]' : 'text-[#111111]'
              }`}
            >
              {card.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Primary Scan Trend */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            Scan Activity Over Time
          </h2>
          <span className="text-xs text-[#888888]">
            Range: <span className="text-[#111111] font-medium capitalize">{range}</span>
          </span>
        </div>
        <TrendChart data={analytics?.scan_trend || []} height={260} label="Scans" />
      </div>

      {/* Secondary Dimensional Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BreakdownBar
          title="Locations (Top Cities)"
          items={analytics?.locations.cities.slice(0, 5) || []}
          emptyMessage="No location records yet"
        />

        <BreakdownBar
          title="Device Platforms"
          items={analytics?.devices.platforms.slice(0, 5) || []}
          emptyMessage="No device records yet"
        />

        <BreakdownBar
          title="Web Browsers"
          items={analytics?.browsers.slice(0, 5) || []}
          emptyMessage="No browser records yet"
        />
      </div>

      {/* QR Codes Snippet + Recent Scans */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 border-t border-[#E8E4DC]">
        {/* Active QR Codes Overview */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
              AEVY Active QR Codes
            </h2>
            <button
              onClick={onNavigateToQrCodes}
              className="text-xs text-[#111111] hover:text-[#C6A46A] flex items-center gap-1 font-medium transition-colors"
            >
              View All ({qrCodes.length}) <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {qrCodes.length === 0 ? (
            <div className="bg-white border border-[#E8E4DC] p-8 text-center">
              <span className="font-serif-luxury text-base text-[#111111] block mb-1">
                No QR Codes Created
              </span>
              <p className="text-xs text-[#888888] mb-4">
                Generate your first dynamic packaging QR code to start tracking.
              </p>
              <button
                onClick={onOpenCreateQr}
                className="px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors"
              >
                + Create First QR
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E4DC] divide-y divide-[#F0ECE4]">
              {qrCodes.slice(0, 5).map((qr) => (
                <div
                  key={qr.id}
                  className="p-3.5 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors"
                >
                  <div className="truncate max-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#111111] truncate">
                        {qr.name}
                      </span>
                      <span className="text-[10px] text-[#888888] font-mono-tabular">
                        {qr.id}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#888888]">
                      {qr.product} · {qr.placement}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono-tabular font-bold text-[#111111]">
                      {qr.scan_count} <span className="text-[10px] font-normal text-[#888888]">scans</span>
                    </span>
                    <button
                      onClick={() => onViewQrPreview(qr)}
                      className="text-xs text-[#C6A46A] hover:text-[#111111] font-medium"
                    >
                      QR
                    </button>
                    <button
                      onClick={() => onViewQrDetails(qr.id)}
                      className="text-xs text-[#111111] hover:text-[#C6A46A] font-medium"
                    >
                      Stats
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Recent Scans Table */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
              Live Recent Scans
            </h2>
            <button
              onClick={onNavigateToAnalytics}
              className="text-xs text-[#111111] hover:text-[#C6A46A] flex items-center gap-1 font-medium transition-colors"
            >
              Full Scan Log <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {(!analytics?.recent_scans || analytics.recent_scans.length === 0) ? (
            <div className="bg-white border border-[#E8E4DC] p-8 text-center">
              <span className="font-serif-luxury text-base text-[#111111] block mb-1">
                No Scans Yet
              </span>
              <p className="text-xs text-[#888888]">
                When someone scans your physical QR packaging, their scan appears here in real-time.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E4DC] overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#888888]">
                    <th className="py-2.5 px-3 font-medium">Time</th>
                    <th className="py-2.5 px-3 font-medium">QR Code</th>
                    <th className="py-2.5 px-3 font-medium">Approx. Location</th>
                    <th className="py-2.5 px-3 font-medium">Device</th>
                    <th className="py-2.5 px-3 font-medium">Browser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE4]">
                  {analytics.recent_scans.slice(0, 6).map((scan) => (
                    <tr key={scan.scan_id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-2.5 px-3 font-mono-tabular text-[#555555]">
                        {scan.time.substring(0, 5)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#111111] max-w-[140px] truncate">
                        {scan.qr_name || scan.qr_id}
                      </td>
                      <td className="py-2.5 px-3 text-[#555555] max-w-[130px] truncate">
                        {scan.location || 'Unknown'}
                      </td>
                      <td className="py-2.5 px-3 text-[#555555]">
                        {scan.platform} ({scan.device_type})
                      </td>
                      <td className="py-2.5 px-3 text-[#555555]">
                        {scan.browser}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
