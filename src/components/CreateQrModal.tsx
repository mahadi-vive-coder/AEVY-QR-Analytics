import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Check, ArrowRight, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { QRCodeItem, CampaignItem } from '../types';

interface CreateQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newQr: QRCodeItem) => void;
  editItem?: QRCodeItem | null;
  campaigns: CampaignItem[];
}

export const CreateQrModal: React.FC<CreateQrModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editItem,
  campaigns,
}) => {
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [isCreatingNewCamp, setIsCreatingNewCamp] = useState(false);
  const [product, setProduct] = useState('OCEANIS');
  const [placement, setPlacement] = useState('Thank You Card');
  const [description, setDescription] = useState('Packaging QR');
  const [destinationUrl, setDestinationUrl] = useState('https://aevy-fragrance.vercel.app/');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [enableLeadCapture, setEnableLeadCapture] = useState(false);

  // Customization
  const [foreground, setForeground] = useState('#111111');
  const [background, setBackground] = useState('#FFFFFF');
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [margin, setMargin] = useState(2);
  const [size, setSize] = useState(400);

  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with editItem or defaults
  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setCampaignId(editItem.campaign_id || '');
      setProduct(editItem.product || 'OCEANIS');
      setPlacement(editItem.placement || 'Thank You Card');
      setDescription(editItem.description || '');
      setDestinationUrl(editItem.destination_url);
      setStatus(editItem.status === 'paused' ? 'paused' : 'active');
      setStartDate(editItem.start_date ? editItem.start_date.split('T')[0] : '');
      setExpiryDate(editItem.expiry_date ? editItem.expiry_date.split('T')[0] : '');
      setEnableLeadCapture(Boolean(editItem.enable_lead_capture));
      setForeground(editItem.settings.foreground || '#111111');
      setBackground(editItem.settings.background || '#FFFFFF');
      setErrorCorrection(editItem.settings.error_correction || 'H');
      setMargin(editItem.settings.margin !== undefined ? editItem.settings.margin : 2);
      setSize(editItem.settings.size || 400);
    } else {
      setName('');
      setCampaignId(campaigns.length > 0 ? campaigns[0].id : '');
      setProduct('OCEANIS');
      setPlacement('Thank You Card');
      setDescription('Packaging QR');
      setDestinationUrl('https://aevy-fragrance.vercel.app/');
      setStatus('active');
      setStartDate('');
      setExpiryDate('');
      setEnableLeadCapture(false);
      setForeground('#111111');
      setBackground('#FFFFFF');
      setErrorCorrection('H');
      setMargin(2);
      setSize(400);
    }
    setError(null);
  }, [editItem, isOpen, campaigns]);

  // Live QR preview generation
  useEffect(() => {
    if (!isOpen) return;

    // We simulate previewing the dynamic tracking URL
    const trackingBaseUrl = editItem?.tracking_url
      ? editItem.tracking_url.split('/q/')[0]
      : 'https://qr.aevyfragrance.com';
    const previewUrl = editItem
      ? `${trackingBaseUrl}/q/${editItem.id}`
      : `${trackingBaseUrl}/q/AEVY-QR-SAMPLE`;

    QRCode.toDataURL(previewUrl, {
      errorCorrectionLevel: errorCorrection,
      margin,
      width: size,
      color: {
        dark: foreground,
        light: background,
      },
    })
      .then((url) => setPreviewDataUrl(url))
      .catch((err) => console.error('Failed to generate preview QR:', err));
  }, [foreground, background, errorCorrection, margin, size, isOpen, editItem]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a QR name');
      return;
    }

    if (!destinationUrl.trim()) {
      setError('Please enter a destination URL');
      return;
    }

    try {
      const parsed = new URL(destinationUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Destination URL must start with http:// or https://');
        return;
      }
    } catch {
      setError('Please enter a valid destination URL (e.g. https://aevy-fragrance.vercel.app/)');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalCampId = campaignId;

      // Create new campaign if chosen
      if (isCreatingNewCamp && newCampaignName.trim()) {
        const campRes = await api.createCampaign({
          name: newCampaignName.trim(),
          description: `Campaign for ${name}`,
        });
        finalCampId = campRes.campaign.id;
      }

      const payload = {
        name: name.trim(),
        campaign_id: finalCampId,
        product: product.trim(),
        placement: placement.trim(),
        description: description.trim(),
        destination_url: destinationUrl.trim(),
        status,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
        enable_lead_capture: enableLeadCapture,
        settings: {
          foreground,
          background,
          accent: '#C6A46A',
          error_correction: errorCorrection,
          margin,
          size,
        },
      };

      if (editItem) {
        const res = await api.updateQRCode(editItem.id, payload);
        onSuccess(res.qrCode);
      } else {
        const res = await api.createQRCode(payload);
        onSuccess(res.qrCode);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save QR Code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorPresets = [
    { name: 'Obsidian Black', hex: '#111111' },
    { name: 'Champagne Gold', hex: '#C6A46A' },
    { name: 'Deep Bronze', hex: '#3D312A' },
    { name: 'Night Emerald', hex: '#183028' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFFFF] border border-[#E8E4DC] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4DC]">
          <div>
            <h2 className="font-serif-luxury text-xl font-bold tracking-wide text-[#111111]">
              {editItem ? `Edit QR Code: ${editItem.id}` : 'Create Dynamic QR Code'}
            </h2>
            <p className="text-xs text-[#888888] mt-0.5">
              Generates a dynamic tracking URL for physical packaging and captures real analytics.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#888888] hover:text-[#111111] hover:bg-[#F7F5F0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Input Fields */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                  QR Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AEVY Thank You Card"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                  Destination URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://aevy-fragrance.vercel.app/"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white font-mono-tabular"
                />
                <span className="text-[11px] text-[#888888] mt-1 block">
                  The final destination where the visitor will be smoothly redirected after analytics are logged.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                    Product
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OCEANIS"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                    Placement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thank You Card, Flacon Box"
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Campaign Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs uppercase tracking-wider text-[#666666] font-medium">
                    Campaign
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCamp(!isCreatingNewCamp)}
                    className="text-[11px] text-[#C6A46A] hover:text-[#111111] underline"
                  >
                    {isCreatingNewCamp ? 'Select Existing' : '+ New Campaign'}
                  </button>
                </div>

                {isCreatingNewCamp ? (
                  <input
                    type="text"
                    placeholder="New Campaign Name (e.g. September Packaging 2026)"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  />
                ) : (
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  >
                    <option value="">No Campaign (Direct)</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Packaging details, print batch notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  >
                    <option value="active">Active (Redirecting)</option>
                    <option value="paused">Paused (Holds redirect)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#666666] font-medium mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white font-mono-tabular"
                  />
                </div>
              </div>

              {/* Lead capture option */}
              <div className="pt-2 border-t border-[#F0ECE4]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableLeadCapture}
                    onChange={(e) => setEnableLeadCapture(e.target.checked)}
                    className="mt-0.5 accent-[#111111]"
                  />
                  <div>
                    <span className="text-xs font-medium text-[#111111] block">
                      Enable Voluntary VIP Lead Signup
                    </span>
                    <span className="text-[11px] text-[#888888] block">
                      Offers visitors an optional, voluntary invitation to join the AEVY fragrance allocation club before reaching the destination.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Right: Customizer & Live Preview */}
            <div className="lg:col-span-5 bg-[#FAF8F5] p-5 border border-[#E8E4DC] flex flex-col items-center justify-between">
              <div className="w-full">
                <h3 className="text-xs uppercase tracking-wider text-[#888888] font-medium mb-4 text-center">
                  Live QR Customization Preview
                </h3>

                {/* Live Preview Container */}
                <div className="flex flex-col items-center justify-center p-5 bg-white border border-[#E8E4DC] shadow-sm mb-5">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="AEVY Dynamic QR Preview"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-[#F7F5F0] flex items-center justify-center text-xs text-[#888888]">
                      Rendering...
                    </div>
                  )}
                  <div className="mt-3 text-center">
                    <span className="font-serif-luxury text-sm font-semibold tracking-wider text-[#111111] block">
                      {name || 'AEVY Dynamic QR'}
                    </span>
                    <span className="text-[10px] text-[#888888] font-mono-tabular">
                      {editItem ? `/q/${editItem.id}` : '/q/AEVY-QR-XXXXXX'}
                    </span>
                  </div>
                </div>

                {/* Customization Options */}
                <div className="space-y-3.5 text-xs">
                  {/* Foreground Presets */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Foreground Color
                    </label>
                    <div className="flex items-center gap-2">
                      {colorPresets.map((preset) => (
                        <button
                          type="button"
                          key={preset.hex}
                          onClick={() => setForeground(preset.hex)}
                          className={`w-6 h-6 border transition-transform ${
                            foreground === preset.hex ? 'ring-2 ring-[#C6A46A] scale-110' : 'border-[#CCCCCC]'
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.name}
                        />
                      ))}
                      <input
                        type="color"
                        value={foreground}
                        onChange={(e) => setForeground(e.target.value)}
                        className="w-6 h-6 p-0 border-0 cursor-pointer ml-1"
                        title="Custom Foreground"
                      />
                      <span className="font-mono-tabular text-[11px] text-[#888888] ml-auto">
                        {foreground}
                      </span>
                    </div>
                  </div>

                  {/* Background */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBackground('#FFFFFF')}
                        className={`px-2 py-1 text-[11px] border ${
                          background === '#FFFFFF' ? 'border-[#111111] bg-white font-medium' : 'border-[#D5D0C7] text-[#666666]'
                        }`}
                      >
                        Pure White
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackground('#F7F5F0')}
                        className={`px-2 py-1 text-[11px] border ${
                          background === '#F7F5F0' ? 'border-[#111111] bg-[#F7F5F0] font-medium' : 'border-[#D5D0C7] text-[#666666]'
                        }`}
                      >
                        Soft Ivory
                      </button>
                      <span className="font-mono-tabular text-[11px] text-[#888888] ml-auto">
                        {background}
                      </span>
                    </div>
                  </div>

                  {/* Error Correction & Margin */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                        Correction Level
                      </label>
                      <select
                        value={errorCorrection}
                        onChange={(e) => setErrorCorrection(e.target.value as any)}
                        className="w-full px-2 py-1 text-xs border border-[#D5D0C7] bg-white"
                      >
                        <option value="L">L (7% low)</option>
                        <option value="M">M (15% med)</option>
                        <option value="Q">Q (25% high)</option>
                        <option value="H">H (30% best)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                        Quiet Margin
                      </label>
                      <select
                        value={margin}
                        onChange={(e) => setMargin(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-[#D5D0C7] bg-white"
                      >
                        <option value={1}>1 module</option>
                        <option value={2}>2 modules (std)</option>
                        <option value={4}>4 modules (safe)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full pt-4 border-t border-[#E8E4DC] text-center text-[11px] text-[#888888]">
                Optimized for luxury print & packaging scanners.
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#666666] hover:text-[#111111] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editItem ? 'Update QR Code' : 'Generate Dynamic QR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
