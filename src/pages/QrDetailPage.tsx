import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Download, Copy, Check } from 'lucide-react';
import { TrendChart } from '../components/TrendChart';
import { BreakdownBar } from '../components/BreakdownBar';
import { api } from '../api/client';
import { QRCodeItem } from '../types';

interface QrDetailPageProps {
  qrId: string;
  onBack: () => void;
  onOpenPreview: (qr: QRCodeItem) => void;
}

export const QrDetailPage: React.FC<QrDetailPageProps> = ({
  qrId,
  onBack,
  onOpenPreview,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getQrAnalytics(qrId)
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load QR analytics:', err))
      .finally(() => setLoading(false));
  }, [qrId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-xs text-[#888888]">
        <div className="w-5 h-5 border-2 border-[#111111] border-t-transparent animate-spin mb-2" />
        <span>Loading QR telemetry...</span>
      </div>
    );
  }

  if (!data || !data.qrCode) {
    return (
      <div className="bg-white border border-[#E8E4DC] p-12 text-center">
        <h3 className="font-serif-luxury text-lg text-[#111111] mb-2">QR Code Not Found</h3>
        <button
          onClick={onBack}
          className="text-xs text-[#C6A46A] hover:underline"
        >
          Return to QR list
        </button>
      </div>
    );
  }

  const qr: QRCodeItem = data.qrCode;
  const trackingUrl = qr.tracking_url || `https://qr.aevyfragrance.com/q/${qr.id}`;
  const testScanUrl = `/q/${qr.id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overview = data.overview || {};

  return (
    <div className="space-y-8 pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[#666666] hover:text-[#111111] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to QR Codes</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenPreview(qr)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
          >
            <span>View & Download QR</span>
          </button>
          <a
            href={testScanUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#C6A46A] text-white hover:bg-[#B39358] transition-colors"
          >
            <span>Test Scan (Redirect)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* QR Banner Info */}
      <div className="bg-white border border-[#E8E4DC] p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#888888] font-mono-tabular">
              <span>{qr.id}</span>
              <span>·</span>
              <span className="capitalize">{qr.status}</span>
              <span>·</span>
              <span>{qr.product}</span>
              <span>·</span>
              <span>{qr.placement}</span>
            </div>
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] mt-1">
              {qr.name}
            </h1>
            <p className="text-xs text-[#666666] mt-1 max-w-2xl">
              {qr.description || 'No custom description provided.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={copyLink}
              className="px-3 py-1.5 text-xs border border-[#E8E4DC] bg-white text-[#111111] hover:border-[#111111] flex items-center gap-1.5"
              title="Copy Dynamic Tracking Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Tracking Link'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Tracking Link & Destination Target per Requirement 6 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#E8E4DC]">
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-3">
            <span className="text-[10px] uppercase tracking-widest text-[#888888] font-bold block mb-1">
              DYNAMIC TRACKING LINK
            </span>
            <span className="text-xs font-mono-tabular text-[#111111] break-all select-all">
              {trackingUrl}
            </span>
          </div>
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-3 flex items-center justify-between">
            <div className="overflow-hidden mr-2">
              <span className="text-[10px] uppercase tracking-widest text-[#888888] font-bold block mb-1">
                DESTINATION TARGET
              </span>
              <span className="text-xs font-mono-tabular text-[#111111] truncate block">
                {qr.destination_url}
              </span>
            </div>
            <a
              href={qr.destination_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#888888] hover:text-[#111111] shrink-0 flex items-center gap-1"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 4 Big Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8E4DC] p-5">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-2">
            Total Scans
          </span>
          <span className="font-mono-tabular text-3xl font-bold text-[#111111]">
            {qr.scan_count.toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-[#E8E4DC] p-5">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-2">
            Estimated Unique Visitors
          </span>
          <span className="font-mono-tabular text-3xl font-bold text-[#C6A46A]">
            {(overview.estimated_unique_visitors || 0).toLocaleString()}
          </span>
        </div>

        <div className="bg-white border border-[#E8E4DC] p-5">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-2">
            First Scan
          </span>
          <span className="font-mono-tabular text-sm font-semibold text-[#111111]">
            {data.first_scan
              ? new Date(data.first_scan).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </span>
        </div>

        <div className="bg-white border border-[#E8E4DC] p-5">
          <span className="text-[10px] uppercase tracking-wider text-[#888888] font-medium block mb-2">
            Last Scan
          </span>
          <span className="font-mono-tabular text-sm font-semibold text-[#111111]">
            {data.last_scan
              ? new Date(data.last_scan).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </span>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
          Scan Trend
        </h2>
        <TrendChart data={data.scan_trend || []} height={240} label="Scans" />
      </div>

      {/* Hourly Histogram & Dimensions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8E4DC] p-5">
          <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium mb-4">
            Hourly Scan Frequency (Peak Interaction Times)
          </h3>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-center font-mono-tabular">
            {(data.time_analytics?.hourly || []).map((h: any) => {
              const maxH = Math.max(...(data.time_analytics?.hourly || []).map((x: any) => x.count), 1);
              const heightPct = Math.round((h.count / maxH) * 100);
              return (
                <div key={h.hour} className="flex flex-col items-center justify-end h-32 group">
                  <span className="text-[9px] text-[#888888] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {h.count}
                  </span>
                  <div className="w-full bg-[#F5F2EA] h-24 flex items-end">
                    <div
                      className="w-full bg-[#111111] group-hover:bg-[#C6A46A] transition-all"
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#999999] mt-1 truncate">
                    {h.hour.substring(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <BreakdownBar
            title="Top Locations"
            items={data.locations?.cities?.slice(0, 5) || []}
            emptyMessage="No location records yet"
          />
          <BreakdownBar
            title="Device Platforms"
            items={data.devices?.platforms?.slice(0, 5) || []}
            emptyMessage="No device records yet"
          />
        </div>
      </div>

      {/* Voluntary Leads for this QR */}
      {data.leads && data.leads.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            Captured Voluntary Leads ({data.leads.length})
          </h2>
          <div className="bg-white border border-[#E8E4DC] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#888888]">
                  <th className="py-2.5 px-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Email</th>
                  <th className="py-2.5 px-3 font-medium">Phone</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE4]">
                {data.leads.map((l: any) => (
                  <tr key={l.lead_id} className="hover:bg-[#FAF8F5]">
                    <td className="py-2.5 px-3 font-medium text-[#111111]">{l.name}</td>
                    <td className="py-2.5 px-3 text-[#555555] font-mono-tabular">{l.email || '—'}</td>
                    <td className="py-2.5 px-3 text-[#555555] font-mono-tabular">{l.phone || '—'}</td>
                    <td className="py-2.5 px-3 text-[#888888] font-mono-tabular">
                      {new Date(l.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
