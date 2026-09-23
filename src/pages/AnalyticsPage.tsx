import React, { useState, useEffect } from 'react';
import { TrendChart } from '../components/TrendChart';
import { BreakdownBar } from '../components/BreakdownBar';
import { api } from '../api/client';
import { AnalyticsData, QRCodeItem, CampaignItem } from '../types';
import { Filter, RefreshCw, Calendar, MapPin, Smartphone, Globe, Clock } from 'lucide-react';

interface AnalyticsPageProps {
  qrCodes: QRCodeItem[];
  campaigns: CampaignItem[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  qrCodes,
  campaigns,
}) => {
  const [range, setRange] = useState('30days');
  const [selectedQr, setSelectedQr] = useState('');
  const [selectedCamp, setSelectedCamp] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { range };
      if (selectedQr) params.qr_id = selectedQr;
      if (selectedCamp) params.campaign_id = selectedCamp;
      if (selectedDevice) params.device_type = selectedDevice;

      const res = await api.getAnalytics(params);
      setData(res);
    } catch (err) {
      console.error('Failed to load deep analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [range, selectedQr, selectedCamp, selectedDevice]);

  const overview = data?.overview || {
    total_qrcodes: qrCodes.length,
    total_scans: 0,
    today_scans: 0,
    this_week_scans: 0,
    this_month_scans: 0,
    estimated_unique_visitors: 0,
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
          Scan Analytics Studio
        </h1>
        <p className="text-xs text-[#666666] mt-1">
          Detailed telemetry, geographical distribution, devices, and peak interaction windows.
        </p>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white border border-[#E8E4DC] p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-[#888888]">
          <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium text-[10px]">
            <Filter className="w-3 h-3 text-[#C6A46A]" /> Dimensional Filtering
          </span>
          <button
            onClick={() => {
              setRange('30days');
              setSelectedQr('');
              setSelectedCamp('');
              setSelectedDevice('');
            }}
            className="text-[11px] text-[#888888] hover:text-[#111111] underline"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Time Range */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#888888] font-medium mb-1">
              Time Range
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#D5D0C7] bg-white text-[#111111]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* QR Code Filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#888888] font-medium mb-1">
              QR Code
            </label>
            <select
              value={selectedQr}
              onChange={(e) => setSelectedQr(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#D5D0C7] bg-white text-[#111111] truncate"
            >
              <option value="">All QR Codes</option>
              {qrCodes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.id})
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#888888] font-medium mb-1">
              Campaign
            </label>
            <select
              value={selectedCamp}
              onChange={(e) => setSelectedCamp(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#D5D0C7] bg-white text-[#111111] truncate"
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Device Type Filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#888888] font-medium mb-1">
              Device Type
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#D5D0C7] bg-white text-[#111111]"
            >
              <option value="">All Devices</option>
              <option value="Mobile">Mobile Only</option>
              <option value="Tablet">Tablet Only</option>
              <option value="Desktop">Desktop Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8E4DC] p-4">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-1">
            Total Scans in Filter
          </span>
          <span className="font-mono-tabular text-3xl font-bold text-[#111111]">
            {overview.total_scans.toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-[#E8E4DC] p-4">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-1">
            Estimated Unique Visitors
          </span>
          <span className="font-mono-tabular text-3xl font-bold text-[#C6A46A]">
            {overview.estimated_unique_visitors.toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-[#E8E4DC] p-4">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-1">
            Today's Activity
          </span>
          <span className="font-mono-tabular text-3xl font-bold text-[#111111]">
            {overview.today_scans.toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-[#E8E4DC] p-4">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-1">
            Active QR Codes
          </span>
          <span className="font-mono-tabular text-3xl font-bold text-[#111111]">
            {qrCodes.filter((q) => q.status === 'active').length}
          </span>
        </div>
      </div>

      {/* Main Scan Trend Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            Scan Trajectory
          </h2>
          <span className="text-xs text-[#888888]">
            Interactive daily scan counts
          </span>
        </div>
        <TrendChart data={data?.scan_trend || []} height={260} label="Scans" />
      </div>

      {/* Hourly Heatmap Histogram & Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hourly Distribution (00:00 to 23:00) */}
        <div className="lg:col-span-8 bg-white border border-[#E8E4DC] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C6A46A]" />
              Customer Engagement by Hour (00:00 – 23:00)
            </h3>
            <span className="text-[11px] text-[#888888]">
              Peak hours identification
            </span>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-24 gap-1 text-center font-mono-tabular">
            {(data?.time_analytics.hourly || []).map((h) => {
              const maxH = Math.max(...(data?.time_analytics.hourly || []).map((x) => x.count), 1);
              const heightPct = Math.round((h.count / maxH) * 100);
              return (
                <div key={h.hour} className="flex flex-col items-center justify-end h-32 group">
                  <span className="text-[8px] text-[#888888] mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {h.count}
                  </span>
                  <div className="w-full bg-[#F7F5F0] h-20 flex items-end">
                    <div
                      className="w-full bg-[#111111] group-hover:bg-[#C6A46A] transition-all"
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-[#888888] mt-1">
                    {h.hourNumber}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day of Week */}
        <div className="lg:col-span-4 bg-white border border-[#E8E4DC] p-5">
          <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium mb-4 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C6A46A]" />
            Scans by Day of Week
          </h3>

          <div className="space-y-2.5">
            {(data?.time_analytics.days_of_week || []).map((d) => {
              const maxD = Math.max(...(data?.time_analytics.days_of_week || []).map((x) => x.count), 1);
              const pct = Math.round((d.count / maxD) * 100);
              return (
                <div key={d.day}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#111111] font-medium">{d.day}</span>
                    <span className="font-mono-tabular text-[#888888]">{d.count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#F7F5F0]">
                    <div
                      className="h-full bg-[#C6A46A]"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dimensional Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BreakdownBar
          title="Top Countries"
          items={data?.locations.countries.slice(0, 6) || []}
        />
        <BreakdownBar
          title="Top Cities"
          items={data?.locations.cities.slice(0, 6) || []}
        />
        <BreakdownBar
          title="Device Types"
          items={data?.devices.types || []}
        />
        <BreakdownBar
          title="Operating Systems"
          items={data?.devices.platforms.slice(0, 6) || []}
        />
      </div>

      {/* Full Scan Telemetry Log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            Recent Scan Telemetry Records
          </h2>
          <span className="text-[11px] text-[#888888]">
            Filtered scan stream (raw IPs privacy hashed)
          </span>
        </div>

        {(!data?.recent_scans || data.recent_scans.length === 0) ? (
          <div className="bg-white border border-[#E8E4DC] p-12 text-center text-xs text-[#888888]">
            No scans match the current filter parameters.
          </div>
        ) : (
          <div className="bg-white border border-[#E8E4DC] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#888888]">
                  <th className="py-2.5 px-3 font-medium">Scan ID</th>
                  <th className="py-2.5 px-3 font-medium">Timestamp</th>
                  <th className="py-2.5 px-3 font-medium">QR Code</th>
                  <th className="py-2.5 px-3 font-medium">Campaign</th>
                  <th className="py-2.5 px-3 font-medium">Approx. Location</th>
                  <th className="py-2.5 px-3 font-medium">Device & OS</th>
                  <th className="py-2.5 px-3 font-medium">Browser</th>
                  <th className="py-2.5 px-3 font-medium">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE4]">
                {data.recent_scans.map((scan) => (
                  <tr key={scan.scan_id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-2.5 px-3 font-mono-tabular text-[#888888] text-[11px]">
                      {scan.scan_id}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#555555]">
                      {scan.date} {scan.time}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#111111]">
                      {scan.qr_name || scan.qr_id}
                    </td>
                    <td className="py-2.5 px-3 text-[#555555]">
                      {scan.campaign_name || 'Direct'}
                    </td>
                    <td className="py-2.5 px-3 text-[#555555]">
                      {scan.location || 'Unknown'}
                    </td>
                    <td className="py-2.5 px-3 text-[#555555]">
                      {scan.platform} ({scan.device_type})
                    </td>
                    <td className="py-2.5 px-3 text-[#555555]">
                      {scan.browser} {scan.browser_version ? `v${scan.browser_version}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-[#888888] font-mono-tabular text-[11px] max-w-[120px] truncate">
                      {scan.referrer || 'Direct'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
