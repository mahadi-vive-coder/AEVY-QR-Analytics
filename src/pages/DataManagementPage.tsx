import React, { useState, useRef } from 'react';
import { Download, Upload, Shield, RefreshCw, AlertTriangle, CheckCircle, FileText, Database } from 'lucide-react';
import { api } from '../api/client';

export const DataManagementPage: React.FC = () => {
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreJson, setRestoreJson] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    window.location.href = api.getExportUrl('all', 'json');
  };

  const handleExport = (type: 'all' | 'qr' | 'scans' | 'visitors', format: 'json' | 'csv') => {
    window.location.href = api.getExportUrl(type, format);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError(null);
    setRestoreSuccess(null);
    setValidating(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setRestoreJson(parsed);

      const res = await api.previewBackup(parsed);
      setPreview(res.preview);
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to parse JSON backup file');
      setPreview(null);
      setRestoreJson(null);
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreJson) return;

    const confirmMsg =
      'WARNING: Restoring will overwrite existing data. The system will create an automatic pre-restore backup before proceeding. Are you sure you wish to continue?';
    if (!confirm(confirmMsg)) return;

    setRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);

    try {
      const res = await api.restoreBackup(restoreJson);
      setRestoreSuccess(
        `Database successfully restored! (Restored: ${res.summary.qr_codes} QRs, ${res.summary.scans} Scans, ${res.summary.campaigns} Campaigns, ${res.summary.visitors} Leads). Auto-backup saved.`
      );
      setRestoreFile(null);
      setRestoreJson(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  };

  const handleTriggerRetention = async () => {
    if (!confirm('Run data retention cleanup now? This removes scan records older than your configured retention window in Settings.')) {
      return;
    }

    setCleaning(true);
    setCleanResult(null);

    try {
      const res = await api.triggerRetentionCleanup();
      setCleanResult(`Retention cleanup complete: ${res.removedScans} expired scan records purged.`);
    } catch (err: any) {
      alert(err.message || 'Retention cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
          Data Management & Backups
        </h1>
        <p className="text-xs text-[#666666] mt-1">
          Export your datasets, download complete JSON snapshots, and restore database archives.
        </p>
      </div>

      {/* Storage Architecture Overview */}
      <div className="bg-white border border-[#E8E4DC] p-5">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-[#C6A46A] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs uppercase tracking-wider text-[#111111] font-semibold">
              Zero-External Database Architecture
            </h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              AEVY operates on self-contained, atomic JSON file storage under <code className="font-mono-tabular bg-[#FAF8F5] px-1 py-0.5 text-[#111111]">/data/*.json</code>. Every write operation is sequenced through a thread-safe atomic lock queue with write-then-rename protection to guarantee zero file corruption.
            </p>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white border border-[#E8E4DC] p-6 space-y-6">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            Export Datasets
          </h2>
          <p className="text-xs text-[#666666] mt-0.5">
            Download your raw records for offline spreadsheets, financial reporting, or archiving.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* All Data */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-4 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-[#111111] block">Complete Database</span>
              <span className="text-[11px] text-[#888888]">All QRs, scans, campaigns & settings</span>
            </div>
            <button
              onClick={() => handleExport('all', 'json')}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Full JSON
            </button>
          </div>

          {/* QR Codes */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-4 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-[#111111] block">QR Code Catalog</span>
              <span className="text-[11px] text-[#888888]">URLs, designs, products & placements</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExport('qr', 'csv')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('qr', 'json')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium border border-[#E8E4DC] bg-white hover:border-[#111111] transition-colors"
              >
                JSON
              </button>
            </div>
          </div>

          {/* Scans */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-4 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-[#111111] block">Scan Telemetry</span>
              <span className="text-[11px] text-[#888888]">Timestamps, locations, devices & browsers</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExport('scans', 'csv')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('scans', 'json')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium border border-[#E8E4DC] bg-white hover:border-[#111111] transition-colors"
              >
                JSON
              </button>
            </div>
          </div>

          {/* Visitors / Leads */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] p-4 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-[#111111] block">Voluntary Leads</span>
              <span className="text-[11px] text-[#888888]">Names, emails & phone registrations</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExport('visitors', 'csv')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('visitors', 'json')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium border border-[#E8E4DC] bg-white hover:border-[#111111] transition-colors"
              >
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Database Snapshot Section */}
      <div className="bg-white border border-[#E8E4DC] p-6 space-y-6">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            Restore Database Snapshot
          </h2>
          <p className="text-xs text-[#666666] mt-0.5">
            Import a previously exported AEVY JSON backup file. The system validates content and displays a safe preview prior to applying.
          </p>
        </div>

        {restoreError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{restoreError}</span>
          </div>
        )}

        {restoreSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        <div className="border-2 border-dashed border-[#D5D0C7] p-8 text-center bg-[#FAF8F5] space-y-3">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            id="backupFileInput"
          />
          <label
            htmlFor="backupFileInput"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#111111] border border-[#111111] bg-white hover:bg-[#111111] hover:text-white transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Select Backup JSON File
          </label>
          <p className="text-[11px] text-[#888888]">
            {restoreFile ? restoreFile.name : 'Accepts .json backup files exported from AEVY'}
          </p>
        </div>

        {/* Restore Preview Card */}
        {preview && (
          <div className="bg-white border border-[#111111] p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[#111111]">
                Backup Contents Preview
              </h3>
              <span className="text-[11px] text-[#888888] font-mono-tabular">
                Exported: {preview.exported_at ? new Date(preview.exported_at).toLocaleString() : 'N/A'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-[#FAF8F5] p-3">
                <span className="text-[10px] uppercase text-[#888888] block">QR Codes</span>
                <span className="font-mono-tabular font-bold text-base text-[#111111]">
                  {preview.qr_codes_count}
                </span>
              </div>
              <div className="bg-[#FAF8F5] p-3">
                <span className="text-[10px] uppercase text-[#888888] block">Scan Records</span>
                <span className="font-mono-tabular font-bold text-base text-[#111111]">
                  {preview.scans_count}
                </span>
              </div>
              <div className="bg-[#FAF8F5] p-3">
                <span className="text-[10px] uppercase text-[#888888] block">Campaigns</span>
                <span className="font-mono-tabular font-bold text-base text-[#111111]">
                  {preview.campaigns_count}
                </span>
              </div>
              <div className="bg-[#FAF8F5] p-3">
                <span className="text-[10px] uppercase text-[#888888] block">Visitor Leads</span>
                <span className="font-mono-tabular font-bold text-base text-[#111111]">
                  {preview.visitors_count}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <strong>Notice:</strong> Restoring this backup will replace current database tables. An automatic snapshot of your existing data will be stored before applying.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setRestoreJson(null);
                  setRestoreFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-3 py-1.5 text-xs text-[#666666] hover:text-[#111111]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleExecuteRestore}
                className="px-4 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50"
              >
                {restoring ? 'Restoring Database...' : 'Confirm and Restore Database'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Retention Runner */}
      <div className="bg-white border border-[#E8E4DC] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
              Data Retention Cleanup
            </h2>
            <p className="text-xs text-[#666666] mt-0.5">
              Purge historical scan records older than the retention threshold set in Settings.
            </p>
          </div>

          <button
            onClick={handleTriggerRetention}
            disabled={cleaning}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#111111] border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
            <span>{cleaning ? 'Cleaning...' : 'Run Cleanup Now'}</span>
          </button>
        </div>

        {cleanResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            {cleanResult}
          </div>
        )}
      </div>
    </div>
  );
};
