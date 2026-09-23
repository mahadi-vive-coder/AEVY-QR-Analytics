import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Download,
  Eye,
  BarChart2,
  Edit2,
  Copy,
  Trash2,
  Pause,
  Play,
  ExternalLink,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { QRCodeItem, CampaignItem } from '../types';

interface QrCodesPageProps {
  onOpenCreateQr: () => void;
  onEditQr: (qr: QRCodeItem) => void;
  onViewPreview: (qr: QRCodeItem) => void;
  onViewAnalytics: (qrId: string) => void;
  campaigns: CampaignItem[];
}

export const QrCodesPage: React.FC<QrCodesPageProps> = ({
  onOpenCreateQr,
  onEditQr,
  onViewPreview,
  onViewAnalytics,
  campaigns,
}) => {
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<QRCodeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadQrs = async () => {
    setLoading(true);
    try {
      const res = await api.getQRCodes({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        campaign: campaignFilter !== 'all' ? campaignFilter : undefined,
        search: search.trim() || undefined,
      });
      setQrCodes(res.qrCodes);
    } catch (err) {
      console.error('Failed to load QR codes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQrs();
  }, [statusFilter, campaignFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQrs();
  };

  const handleToggleStatus = async (qr: QRCodeItem) => {
    const newStatus = qr.status === 'active' ? 'paused' : 'active';
    try {
      const res = await api.toggleStatus(qr.id, newStatus);
      setQrCodes((prev) => prev.map((q) => (q.id === qr.id ? res.qrCode : q)));
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDuplicate = async (qr: QRCodeItem) => {
    try {
      const res = await api.duplicateQRCode(qr.id);
      setQrCodes((prev) => [res.qrCode, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate QR Code');
    }
  };

  const handleConfirmDelete = async (permanent: boolean) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteQRCode(deleteTarget.id, permanent);
      if (permanent) {
        setQrCodes((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      } else {
        setQrCodes((prev) =>
          prev.map((q) => (q.id === deleteTarget.id ? { ...q, status: 'archived' } : q))
        );
      }
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete QR code');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyTrackingLink = (qr: QRCodeItem) => {
    const url = qr.tracking_url || `https://qr.aevyfragrance.com/q/${qr.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(qr.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const campMap = new Map(campaigns.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6 pb-12">
      {/* Header & New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
            QR Codes Directory
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Manage your dynamic packaging QR codes, redirects, and custom designs.
          </p>
        </div>

        <button
          onClick={onOpenCreateQr}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New QR</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E8E4DC] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by QR name, ID, product or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
          />
          <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-2.5" />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#888888]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 border border-[#D5D0C7] bg-white text-[#111111]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#888888]">Campaign:</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="px-2 py-1 border border-[#D5D0C7] bg-white text-[#111111] max-w-[160px] truncate"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      {loading ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center text-xs text-[#888888]">
          <div className="w-5 h-5 border-2 border-[#111111] border-t-transparent animate-spin mx-auto mb-2" />
          Loading QR inventory...
        </div>
      ) : qrCodes.length === 0 ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center space-y-3">
          <h3 className="font-serif-luxury text-lg text-[#111111]">No QR Codes Found</h3>
          <p className="text-xs text-[#888888] max-w-sm mx-auto">
            {search || statusFilter !== 'all' || campaignFilter !== 'all'
              ? 'No QR codes match the current filter criteria.'
              : 'You have not created any QR codes yet. Create your first dynamic packaging QR code to start tracking.'}
          </p>
          <button
            onClick={onOpenCreateQr}
            className="px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors"
          >
            + Create QR Code
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E4DC] overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#888888]">
                <th className="py-3 px-4 font-medium">QR Name & ID</th>
                <th className="py-3 px-4 font-medium">Product / Placement</th>
                <th className="py-3 px-4 font-medium">Campaign</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Scans</th>
                <th className="py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium">Last Scan</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0ECE4]">
              {qrCodes.map((qr) => {
                const trackingUrl = qr.tracking_url || `https://qr.aevyfragrance.com/q/${qr.id}`;
                return (
                  <tr key={qr.id} className="hover:bg-[#FAF8F5] transition-colors group">
                    {/* Name & ID */}
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="font-medium text-[#111111] truncate">{qr.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#888888] font-mono-tabular mt-0.5">
                        <span>{qr.id}</span>
                        <button
                          onClick={() => copyTrackingLink(qr)}
                          className="hover:text-[#111111]"
                          title="Copy dynamic link"
                        >
                          {copiedId === qr.id ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Product & Placement */}
                    <td className="py-3 px-4 text-[#555555]">
                      <div>{qr.product || 'OCEANIS'}</div>
                      <div className="text-[11px] text-[#888888]">{qr.placement || 'Packaging'}</div>
                    </td>

                    {/* Campaign */}
                    <td className="py-3 px-4 text-[#555555]">
                      {campMap.get(qr.campaign_id) || qr.campaign_id || (
                        <span className="text-[#999999] italic">Direct</span>
                      )}
                    </td>

                    {/* Status (Unboxed text with subtle dot) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            qr.status === 'active'
                              ? 'bg-emerald-500'
                              : qr.status === 'paused'
                              ? 'bg-amber-500'
                              : 'bg-[#999999]'
                          }`}
                        />
                        <span className="capitalize font-medium text-[#111111] text-xs">
                          {qr.status}
                        </span>
                      </div>
                    </td>

                    {/* Scans Count */}
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#111111] text-right">
                      {qr.scan_count.toLocaleString()}
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 font-mono-tabular text-[#888888]">
                      {new Date(qr.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Last Scan */}
                    <td className="py-3 px-4 font-mono-tabular text-[#888888]">
                      {qr.last_scanned_at ? (
                        new Date(qr.last_scanned_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      ) : (
                        <span className="text-[#CCCCCC]">—</span>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewPreview(qr)}
                          title="View QR Code & Download"
                          className="p-1.5 text-[#555555] hover:text-[#111111] hover:bg-[#F0ECE4]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onViewAnalytics(qr.id)}
                          title="QR Analytics"
                          className="p-1.5 text-[#555555] hover:text-[#C6A46A] hover:bg-[#F0ECE4]"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onEditQr(qr)}
                          title="Edit QR"
                          className="p-1.5 text-[#555555] hover:text-[#111111] hover:bg-[#F0ECE4]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(qr)}
                          title={qr.status === 'active' ? 'Pause QR Redirect' : 'Activate QR Redirect'}
                          className="p-1.5 text-[#555555] hover:text-[#111111] hover:bg-[#F0ECE4]"
                        >
                          {qr.status === 'active' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDuplicate(qr)}
                          title="Duplicate QR"
                          className="p-1.5 text-[#555555] hover:text-[#111111] hover:bg-[#F0ECE4]"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteTarget(qr)}
                          title="Delete or Archive"
                          className="p-1.5 text-[#888888] hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#E8E4DC] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif-luxury text-lg font-bold text-[#111111]">
              Manage QR Removal: {deleteTarget.id}
            </h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              We recommend <strong>Archiving</strong> rather than permanently deleting. Archiving safely deactivates the dynamic link while preserving historical scan analytics and visitor data for AEVY records.
            </p>

            <div className="bg-[#FAF8F5] p-3 border border-[#E8E4DC] text-xs">
              <span className="font-semibold text-[#111111] block">{deleteTarget.name}</span>
              <span className="text-[#888888] font-mono-tabular">
                Total Scans Recorded: {deleteTarget.scan_count}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-full sm:w-auto px-3 py-1.5 text-xs text-[#666666] hover:text-[#111111]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleConfirmDelete(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-[#111111] border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
              >
                Archive QR (Recommended)
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleConfirmDelete(true)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Permanent Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
