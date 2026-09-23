import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, ExternalLink, Play } from 'lucide-react';
import QRCode from 'qrcode';
import { QRCodeItem } from '../types';
import { api } from '../api/client';

interface QrPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: QRCodeItem | null;
  onScanTested?: () => void;
}

export const QrPreviewModal: React.FC<QrPreviewModalProps> = ({
  isOpen,
  onClose,
  qrCode,
  onScanTested,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dynamic tracking URL from server response or brand domain
  const trackingUrl = qrCode?.tracking_url || (qrCode ? `https://qr.aevyfragrance.com/q/${qrCode.id}` : '');
  // Test scan URL hitting the active server redirect endpoint
  const testScanUrl = qrCode ? `/q/${qrCode.id}` : '';

  useEffect(() => {
    if (!isOpen || !qrCode) return;
    setLoading(true);

    QRCode.toDataURL(trackingUrl, {
      width: 600,
      margin: qrCode.settings.margin ?? 2,
      errorCorrectionLevel: qrCode.settings.error_correction ?? 'H',
      color: {
        dark: qrCode.settings.foreground || '#111111',
        light: qrCode.settings.background || '#FFFFFF',
      },
    })
      .then((url) => {
        setDataUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to generate high-res QR preview:', err);
        setLoading(false);
      });
  }, [isOpen, qrCode, trackingUrl]);

  if (!isOpen || !qrCode) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    window.location.href = api.getDownloadUrl(qrCode.id, 'png');
  };

  const handleDownloadSvg = () => {
    window.location.href = api.getDownloadUrl(qrCode.id, 'svg');
  };

  const handleTestScan = () => {
    window.open(testScanUrl, '_blank');
    if (onScanTested) {
      setTimeout(onScanTested, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white border border-[#E8E4DC] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4DC] bg-[#FAF8F5]">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#888888] font-mono-tabular block">
              {qrCode.id}
            </span>
            <h3 className="font-serif-luxury text-lg font-bold text-[#111111] truncate max-w-[320px]">
              {qrCode.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#888888] hover:text-[#111111] hover:bg-[#F0ECE1] transition-colors rounded-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Image Box */}
        <div className="p-6 flex flex-col items-center justify-center bg-[#FAF8F5]/50 border-b border-[#E8E4DC]">
          <div className="p-4 bg-white border border-[#E8E4DC] shadow-sm">
            {loading ? (
              <div className="w-52 h-52 flex items-center justify-center text-xs text-[#888888]">
                Rendering QR...
              </div>
            ) : (
              <img
                src={dataUrl}
                alt={qrCode.name}
                className="w-52 h-52 object-contain"
              />
            )}
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs text-[#555555] block font-medium">
              Product: <span className="text-[#111111] font-semibold">{qrCode.product || 'AEVY Signature'}</span> · Placement:{' '}
              <span className="text-[#111111] font-semibold">{qrCode.placement || 'Packaging'}</span>
            </span>
            <span className="text-[11px] text-[#888888] mt-0.5 block font-mono-tabular">
              Total Scans: <span className="font-bold text-[#111111]">{qrCode.scan_count}</span>
            </span>
          </div>
        </div>

        {/* URL Breakdown per Requirements */}
        <div className="px-6 py-5 bg-white space-y-4">
          {/* Dynamic Tracking Link */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#666666] font-bold">
                DYNAMIC TRACKING LINK
              </label>
              <span className="text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 font-medium border border-emerald-200">
                Production Safe
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8E4DC] text-[#111111] font-mono-tabular select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="p-2 border border-[#E8E4DC] hover:border-[#111111] bg-white text-[#111111] transition-colors shrink-0 flex items-center gap-1 text-xs"
                title="Copy Dynamic Tracking Link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="sr-only sm:not-sr-only text-[11px] font-medium">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Destination Target */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[#666666] font-bold block mb-1.5">
              DESTINATION TARGET
            </label>
            <div className="flex items-center justify-between text-xs text-[#555555] bg-[#FAF8F5] px-3 py-2 border border-[#E8E4DC]">
              <span className="truncate max-w-[280px] font-mono-tabular text-[#111111]">{qrCode.destination_url}</span>
              <a
                href={qrCode.destination_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#888888] hover:text-[#111111] flex items-center gap-1 shrink-0 ml-2"
                title="View target destination directly"
              >
                Target <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Test Scan Button */}
          <div className="pt-1">
            <button
              onClick={handleTestScan}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#C6A46A] hover:bg-[#B39358] transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Test Scan (Call Tracking Link, Record Scan & Redirect)
            </button>
            <p className="text-[10px] text-[#888888] text-center mt-1.5">
              Simulates a live scan: triggers <code className="font-mono bg-[#FAF8F5] px-1">GET /q/{qrCode.id}</code>, increments analytics in JSON storage, and forwards to destination.
            </p>
          </div>

          {/* Download Buttons */}
          <div className="pt-2 flex items-center gap-3 border-t border-[#E8E4DC]">
            <button
              onClick={handleDownloadPng}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-white bg-[#111111] hover:bg-[#333333] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PNG
            </button>
            <button
              onClick={handleDownloadSvg}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-[#111111] border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
