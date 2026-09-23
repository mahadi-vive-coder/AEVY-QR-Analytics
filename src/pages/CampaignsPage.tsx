import React, { useState, useEffect } from 'react';
import { Plus, Folder, ArrowRight, Trash2, Edit2, X, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { CampaignItem, QRCodeItem } from '../types';

interface CampaignsPageProps {
  onSelectQr: (qrId: string) => void;
  onOpenCreateQr: () => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  onSelectQr,
  onOpenCreateQr,
}) => {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [campaignQrs, setCampaignQrs] = useState<QRCodeItem[]>([]);

  // Create/Edit Campaign Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamp, setEditingCamp] = useState<CampaignItem | null>(null);
  const [campName, setCampName] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campStatus, setCampStatus] = useState<'active' | 'completed' | 'archived'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.getCampaigns();
      setCampaigns(res.campaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleSelectCampaign = async (camp: CampaignItem) => {
    setSelectedCampaign(camp);
    try {
      const res = await api.getCampaign(camp.id);
      setCampaignQrs(res.qr_codes || []);
    } catch (err) {
      console.error('Failed to load campaign QRs:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingCamp(null);
    setCampName('');
    setCampDesc('');
    setCampStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (camp: CampaignItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCamp(camp);
    setCampName(camp.name);
    setCampDesc(camp.description || '');
    setCampStatus(camp.status || 'active');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign? QRs linked to this campaign will be preserved.')) {
      return;
    }
    try {
      await api.deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      if (selectedCampaign?.id === id) {
        setSelectedCampaign(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete campaign');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingCamp) {
        const res = await api.updateCampaign(editingCamp.id, {
          name: campName.trim(),
          description: campDesc.trim(),
          status: campStatus,
        });
        setCampaigns((prev) =>
          prev.map((c) => (c.id === editingCamp.id ? { ...c, ...res.campaign } : c))
        );
        if (selectedCampaign?.id === editingCamp.id) {
          setSelectedCampaign({ ...selectedCampaign, ...res.campaign });
        }
      } else {
        const res = await api.createCampaign({
          name: campName.trim(),
          description: campDesc.trim(),
          status: campStatus,
        });
        setCampaigns((prev) => [res.campaign, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
            Campaign Management
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Organize packaging releases and analyze cross-placement QR telemetry.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Campaign</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center text-xs text-[#888888]">
          <div className="w-5 h-5 border-2 border-[#111111] border-t-transparent animate-spin mx-auto mb-2" />
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center space-y-3">
          <h3 className="font-serif-luxury text-lg text-[#111111]">No Campaigns Created</h3>
          <p className="text-xs text-[#888888] max-w-sm mx-auto">
            Group your packaging QR codes (e.g. September Packaging 2026, Holiday Gift Boxes) to see campaign-level performance.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors"
          >
            + Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Campaign List Cards */}
          <div className="lg:col-span-6 space-y-3">
            {campaigns.map((camp) => {
              const isSelected = selectedCampaign?.id === camp.id;
              return (
                <div
                  key={camp.id}
                  onClick={() => handleSelectCampaign(camp)}
                  className={`p-5 bg-white border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#111111] ring-1 ring-[#111111]'
                      : 'border-[#E8E4DC] hover:border-[#CCCCCC]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#888888] font-mono-tabular">
                        {camp.id}
                      </span>
                      <h3 className="font-serif-luxury text-lg font-bold text-[#111111] mt-0.5">
                        {camp.name}
                      </h3>
                      <p className="text-xs text-[#666666] mt-1 line-clamp-2">
                        {camp.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      <button
                        onClick={(e) => handleOpenEdit(camp, e)}
                        className="p-1.5 text-[#888888] hover:text-[#111111]"
                        title="Edit Campaign"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(camp.id, e)}
                        className="p-1.5 text-[#888888] hover:text-red-600"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Campaign stats row */}
                  <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-[#F0ECE4] text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#888888] block">
                        QR Codes
                      </span>
                      <span className="font-mono-tabular font-bold text-[#111111]">
                        {camp.qr_count || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#888888] block">
                        Total Scans
                      </span>
                      <span className="font-mono-tabular font-bold text-[#111111]">
                        {(camp.total_scans || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#888888] block">
                        Est. Visitors
                      </span>
                      <span className="font-mono-tabular font-bold text-[#C6A46A]">
                        {(camp.estimated_unique_visitors || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Campaign Breakdown */}
          <div className="lg:col-span-6">
            {selectedCampaign ? (
              <div className="bg-white border border-[#E8E4DC] p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-[#888888] font-mono-tabular">
                      {selectedCampaign.id}
                    </span>
                    <span className="text-xs capitalize font-medium text-[#111111]">
                      {selectedCampaign.status}
                    </span>
                  </div>
                  <h2 className="font-serif-luxury text-xl font-bold text-[#111111] mt-1">
                    {selectedCampaign.name}
                  </h2>
                  <p className="text-xs text-[#666666] mt-1">
                    {selectedCampaign.description || 'Packaging campaign overview.'}
                  </p>
                </div>

                {/* QR Codes linked to this campaign */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
                      Included QR Codes ({campaignQrs.length})
                    </h3>
                    <button
                      onClick={onOpenCreateQr}
                      className="text-xs text-[#C6A46A] hover:underline"
                    >
                      + Add QR to Campaign
                    </button>
                  </div>

                  {campaignQrs.length === 0 ? (
                    <div className="p-6 bg-[#FAF8F5] border border-[#E8E4DC] text-center text-xs text-[#888888]">
                      No QR codes currently assigned to this campaign.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0ECE4] border border-[#E8E4DC]">
                      {campaignQrs.map((qr) => (
                        <div
                          key={qr.id}
                          className="p-3.5 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors"
                        >
                          <div className="truncate max-w-[220px]">
                            <span className="text-xs font-semibold text-[#111111] block truncate">
                              {qr.name}
                            </span>
                            <span className="text-[10px] text-[#888888] font-mono-tabular">
                              {qr.id} · {qr.placement}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono-tabular text-xs font-bold text-[#111111]">
                              {qr.scan_count} scans
                            </span>
                            <button
                              onClick={() => onSelectQr(qr.id)}
                              className="text-xs text-[#111111] hover:text-[#C6A46A] font-medium"
                            >
                              Analytics →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-12 text-center text-xs text-[#888888]">
                Select a campaign from the left to inspect linked QR codes and aggregated performance.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#E8E4DC] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-luxury text-lg font-bold text-[#111111]">
                {editingCamp ? 'Edit Campaign' : 'Create Packaging Campaign'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[#888888] hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. September Packaging 2026"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. OCEANIS launch thank-you cards and product box QR rollout"
                  value={campDesc}
                  onChange={(e) => setCampDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                  Status
                </label>
                <select
                  value={campStatus}
                  onChange={(e) => setCampStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#666666] hover:text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCamp ? 'Update Campaign' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
