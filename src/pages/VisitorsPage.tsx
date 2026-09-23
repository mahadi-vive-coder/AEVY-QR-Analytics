import React, { useState, useEffect } from 'react';
import { Search, Download, Trash2, UserCheck, Mail, Phone, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { VisitorLeadItem, QRCodeItem, CampaignItem } from '../types';

interface VisitorsPageProps {
  qrCodes: QRCodeItem[];
  campaigns: CampaignItem[];
}

export const VisitorsPage: React.FC<VisitorsPageProps> = ({
  qrCodes,
  campaigns,
}) => {
  const [visitors, setVisitors] = useState<VisitorLeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQr, setSelectedQr] = useState('');
  const [selectedCamp, setSelectedCamp] = useState('');

  const loadVisitors = async () => {
    setLoading(true);
    try {
      const res = await api.getVisitors({
        search: search.trim() || undefined,
        qr_id: selectedQr || undefined,
        campaign_id: selectedCamp || undefined,
      });
      setVisitors(res.visitors);
    } catch (err) {
      console.error('Failed to load visitors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors();
  }, [selectedQr, selectedCamp]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadVisitors();
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this voluntary lead record?')) return;
    try {
      await api.deleteVisitor(leadId);
      setVisitors((prev) => prev.filter((v) => v.lead_id !== leadId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete lead');
    }
  };

  const exportCsv = () => {
    window.location.href = api.getExportUrl('visitors', 'csv');
  };

  const exportJson = () => {
    window.location.href = api.getExportUrl('visitors', 'json');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
            Voluntary Visitor Leads
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Fragrance enthusiast inquiries and VIP allocation registrations voluntarily submitted via packaging QR codes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111111] border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111111] border border-[#E8E4DC] hover:border-[#111111] transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E8E4DC] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name, email, phone or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
          />
          <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-2.5" />
        </form>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#888888]">QR Code:</span>
            <select
              value={selectedQr}
              onChange={(e) => setSelectedQr(e.target.value)}
              className="px-2 py-1 border border-[#D5D0C7] bg-white text-[#111111] max-w-[160px] truncate"
            >
              <option value="">All QR Codes</option>
              {qrCodes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#888888]">Campaign:</span>
            <select
              value={selectedCamp}
              onChange={(e) => setSelectedCamp(e.target.value)}
              className="px-2 py-1 border border-[#D5D0C7] bg-white text-[#111111] max-w-[160px] truncate"
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center text-xs text-[#888888]">
          <div className="w-5 h-5 border-2 border-[#111111] border-t-transparent animate-spin mx-auto mb-2" />
          Loading visitor leads...
        </div>
      ) : visitors.length === 0 ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center space-y-2">
          <h3 className="font-serif-luxury text-lg text-[#111111]">No Voluntary Leads Found</h3>
          <p className="text-xs text-[#888888] max-w-sm mx-auto">
            When visitors voluntarily submit their email or phone number via enabled packaging QR codes, they are captured here safely with timestamped consent.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E4DC] overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] uppercase tracking-wider text-[#888888]">
                <th className="py-3 px-4 font-medium">Lead ID</th>
                <th className="py-3 px-4 font-medium">Customer Name</th>
                <th className="py-3 px-4 font-medium">Contact Details</th>
                <th className="py-3 px-4 font-medium">Origin QR & Campaign</th>
                <th className="py-3 px-4 font-medium">Date & Time</th>
                <th className="py-3 px-4 font-medium">Consent</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0ECE4]">
              {visitors.map((v) => (
                <tr key={v.lead_id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3 px-4 font-mono-tabular text-[#888888] text-[11px]">
                    {v.lead_id}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#111111]">
                    {v.name}
                  </td>
                  <td className="py-3 px-4 space-y-0.5 font-mono-tabular">
                    {v.email && (
                      <div className="flex items-center gap-1.5 text-[#555555]">
                        <Mail className="w-3 h-3 text-[#888888]" />
                        <span>{v.email}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div className="flex items-center gap-1.5 text-[#555555]">
                        <Phone className="w-3 h-3 text-[#888888]" />
                        <span>{v.phone}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#111111] truncate max-w-[180px]">
                      {v.qr_name || v.qr_id}
                    </div>
                    <div className="text-[11px] text-[#888888]">
                      {v.campaign_name || 'Direct'}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-[#555555]">
                    {new Date(v.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Granted
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(v.lead_id)}
                      className="p-1.5 text-[#888888] hover:text-red-600 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
