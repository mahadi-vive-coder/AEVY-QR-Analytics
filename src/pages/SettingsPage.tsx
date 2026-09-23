import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AppSettings, StorageHealth } from '../types';
import {
  Shield,
  Key,
  RefreshCw,
  Check,
  Globe,
  Database,
  CheckCircle,
  AlertTriangle,
  HardDrive,
  Download,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form fields
  const [businessName, setBusinessName] = useState('AEVY');
  const [tagline, setTagline] = useState('Essence of Fresh Elegance');
  const [timezone, setTimezone] = useState('Asia/Dhaka');
  const [defaultDestination, setDefaultDestination] = useState('https://aevy-fragrance.vercel.app/');
  const [appUrl, setAppUrl] = useState('https://qr.aevyfragrance.com');
  const [defaultForeground, setDefaultForeground] = useState('#111111');
  const [defaultBackground, setDefaultBackground] = useState('#FFFFFF');
  const [dataRetentionDays, setDataRetentionDays] = useState(0);

  // Verification state
  const [verifyingStorage, setVerifyingStorage] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Salt state
  const [rotatingSalt, setRotatingSalt] = useState(false);
  const [saltSuccess, setSaltSuccess] = useState<string | null>(null);

  const loadSettingsAndHealth = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res);
      setBusinessName(res.business_name || 'AEVY');
      setTagline(res.tagline || 'Essence of Fresh Elegance');
      setTimezone(res.timezone || 'Asia/Dhaka');
      setDefaultDestination(res.default_destination || 'https://aevy-fragrance.vercel.app/');
      setAppUrl(res.app_url || 'https://qr.aevyfragrance.com');
      setDefaultForeground(res.default_foreground || '#111111');
      setDefaultBackground(res.default_background || '#FFFFFF');
      setDataRetentionDays(res.data_retention_days || 0);

      if (res.storageHealth) {
        setStorageHealth(res.storageHealth);
      } else {
        const health = await api.getStorageHealth();
        setStorageHealth(health);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndHealth();
  }, []);

  const isDevUrl = (url: string) => {
    const l = url.toLowerCase();
    return (
      l.includes('ais-dev-') ||
      l.includes('localhost') ||
      l.includes('127.0.0.1') ||
      (l.includes('.run.app') && l.includes('-dev-'))
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    if (isDevUrl(appUrl)) {
      setSaveError(
        'Cannot use development URL (ais-dev-*.run.app, localhost, 127.0.0.1) as production QR APP_URL. Please set your production custom domain (e.g. https://qr.aevyfragrance.com).'
      );
      setSaving(false);
      return;
    }

    try {
      const res = await api.updateSettings({
        business_name: businessName,
        tagline,
        timezone,
        default_destination: defaultDestination,
        app_url: appUrl.trim().replace(/\/+$/, ''),
        default_foreground: defaultForeground,
        default_background: defaultBackground,
        data_retention_days: Number(dataRetentionDays),
      });
      setSettings(res.settings);
      if (res.settings.storageHealth) {
        setStorageHealth(res.settings.storageHealth);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyStorage = async () => {
    setVerifyingStorage(true);
    setVerifyMessage(null);
    try {
      const res = await api.verifyStorage();
      setVerifyMessage(`Verified! Atomic read/write took ${res.result.latencyMs}ms. Status: OK.`);
      if (res.storageHealth) {
        setStorageHealth(res.storageHealth);
      }
      setTimeout(() => setVerifyMessage(null), 4000);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingStorage(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setUpdatingPassword(true);

    try {
      const res = await api.updatePassword(currentPassword, newPassword);
      setPasswordMsg(res.message || 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleRotateSalt = async () => {
    if (!confirm('Rotate IP Hashing Salt? Future scan IP hashes will use the new salt for enhanced privacy.')) {
      return;
    }

    setRotatingSalt(true);
    try {
      const res = await api.rotateSalt();
      setSettings(res.settings);
      setSaltSuccess('IP salt successfully rotated.');
      setTimeout(() => setSaltSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to rotate IP salt');
    } finally {
      setRotatingSalt(false);
    }
  };

  const timezones = [
    { label: 'Asia/Dhaka (GMT+6)', value: 'Asia/Dhaka' },
    { label: 'Asia/Dubai (GMT+4)', value: 'Asia/Dubai' },
    { label: 'Asia/Singapore (GMT+8)', value: 'Asia/Singapore' },
    { label: 'Asia/Tokyo (GMT+9)', value: 'Asia/Tokyo' },
    { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
    { label: 'Europe/Paris (CET)', value: 'Europe/Paris' },
    { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
    { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
    { label: 'UTC', value: 'UTC' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
          System Settings & Storage Health
        </h1>
        <p className="text-xs text-[#666666] mt-1">
          Configure production APP_URL, dynamic tracking rules, storage persistence, and security.
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E8E4DC] p-16 text-center text-xs text-[#888888]">
          <div className="w-5 h-5 border-2 border-[#111111] border-t-transparent animate-spin mx-auto mb-2" />
          Loading settings and storage diagnostics...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* General & QR Defaults Form */}
            <div className="bg-white border border-[#E8E4DC] p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
                  Business Profile & Production QR URL
                </h2>
                {saveSuccess && (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                  {saveError}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
                {/* APP_URL Configuration Card (Requirement 1 & 2) */}
                <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#C6A46A]" />
                      <label className="text-[11px] uppercase tracking-wider text-[#111111] font-bold">
                        Production QR Tracking URL (APP_URL)
                      </label>
                    </div>
                    {isDevUrl(appUrl) ? (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Dev URL Detected
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Production Domain
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#666666] leading-relaxed">
                    All printed dynamic QR codes resolve through <code className="font-mono bg-white px-1 border border-[#E8E4DC]">${'{APP_URL}'}/q/$qrId</code>.
                    Never use ephemeral <code className="font-mono text-red-600">ais-dev-*.run.app</code> or localhost in production.
                  </p>

                  <div className="space-y-1.5">
                    <input
                      type="url"
                      required
                      value={appUrl}
                      onChange={(e) => setAppUrl(e.target.value)}
                      placeholder="https://qr.aevyfragrance.com"
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white text-[#111111]"
                    />
                    <div className="text-[11px] text-[#888888] font-mono-tabular">
                      Sample Generated QR Link:{' '}
                      <span className="text-[#111111] font-semibold">
                        {appUrl.trim().replace(/\/+$/, '')}/q/AEVY-QR-000004
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Brand Tagline
                    </label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Operational Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                    >
                      {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Default Destination Target
                    </label>
                    <input
                      type="url"
                      value={defaultDestination}
                      onChange={(e) => setDefaultDestination(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Default QR Foreground
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={defaultForeground}
                        onChange={(e) => setDefaultForeground(e.target.value)}
                        className="w-8 h-8 p-0 border border-[#D5D0C7] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={defaultForeground}
                        onChange={(e) => setDefaultForeground(e.target.value)}
                        className="w-full px-3 py-2 border border-[#D5D0C7] font-mono-tabular uppercase focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                      Default QR Background
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={defaultBackground}
                        onChange={(e) => setDefaultBackground(e.target.value)}
                        className="w-8 h-8 p-0 border border-[#D5D0C7] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={defaultBackground}
                        onChange={(e) => setDefaultBackground(e.target.value)}
                        className="w-full px-3 py-2 border border-[#D5D0C7] font-mono-tabular uppercase focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 text-xs font-semibold text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save System Settings'}
                  </button>
                </div>
              </form>
            </div>

            {/* Data Health Section (Requirement 17) */}
            <div className="bg-white border border-[#E8E4DC] p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#C6A46A]" />
                  <h2 className="text-xs uppercase tracking-wider text-[#111111] font-bold">
                    Data Health & Persistent Storage
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      storageHealth?.storage_status === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-[#111111]">
                    {storageHealth?.storage_status === 'Connected' ? 'Connected' : 'Error'}
                  </span>
                </div>
              </div>

              {verifyMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{verifyMessage}</span>
                </div>
              )}

              {/* Data Health Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC]">
                  <span className="text-[10px] uppercase text-[#888888] font-bold block mb-1">
                    Storage status
                  </span>
                  <span
                    className={`text-sm font-bold block ${
                      storageHealth?.storage_status === 'Connected' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {storageHealth?.storage_status || 'Connected'}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC]">
                  <span className="text-[10px] uppercase text-[#888888] font-bold block mb-1">
                    QR records
                  </span>
                  <span className="text-sm font-mono-tabular font-bold text-[#111111] block">
                    {storageHealth?.qr_records_count ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC]">
                  <span className="text-[10px] uppercase text-[#888888] font-bold block mb-1">
                    Scan records
                  </span>
                  <span className="text-sm font-mono-tabular font-bold text-[#111111] block">
                    {storageHealth?.scan_records_count ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC]">
                  <span className="text-[10px] uppercase text-[#888888] font-bold block mb-1">
                    Last successful write
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#111111] truncate block" title={storageHealth?.last_successful_write || 'None'}>
                    {storageHealth?.last_successful_write
                      ? new Date(storageHealth.last_successful_write).toLocaleTimeString()
                      : 'Active'}
                  </span>
                </div>
              </div>

              {/* Storage Diagnostic Details */}
              <div className="bg-[#FAF8F5] p-3.5 border border-[#E8E4DC] space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#555555]">
                  <span>Storage Mode:</span>
                  <span className="font-medium text-[#111111]">{storageHealth?.storage_mode}</span>
                </div>
                <div className="flex items-center justify-between text-[#555555]">
                  <span>Storage Directory:</span>
                  <span className="font-mono-tabular text-[#111111]">{storageHealth?.storage_directory}</span>
                </div>
                <div className="flex items-center justify-between text-[#555555]">
                  <span>Write Lock Queue:</span>
                  <span className="font-medium text-emerald-700">{storageHealth?.write_lock_status || 'Idle'}</span>
                </div>
                <div className="flex items-center justify-between text-[#555555]">
                  <span>Database Format:</span>
                  <span className="font-medium text-[#111111]">Atomic JSON Files (Atomic Rename Journal)</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyStorage}
                  disabled={verifyingStorage}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-medium text-[#111111] border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifyingStorage ? 'animate-spin' : ''}`} />
                  <span>{verifyingStorage ? 'Verifying...' : 'Verify Persistence (Write & Read Cycle)'}</span>
                </button>

                <a
                  href={api.getExportUrl('all', 'json')}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-medium text-[#111111] bg-[#FAF8F5] border border-[#E8E4DC] hover:border-[#111111] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Full JSON Backup</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Security & Privacy */}
          <div className="lg:col-span-4 space-y-6">
            {/* IP Privacy Card */}
            <div className="bg-white border border-[#E8E4DC] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#C6A46A]" />
                <h3 className="text-xs uppercase tracking-wider text-[#111111] font-semibold">
                  IP Privacy Protection
                </h3>
              </div>
              <p className="text-xs text-[#666666] leading-relaxed">
                In strict compliance with modern privacy standards, raw visitor IP addresses are <strong>never written to disk</strong>. Each IP is resolved in-memory for approximate geolocation and immediately converted into an irreversible one-way SHA-256 hash combined with a secret cryptographic salt.
              </p>

              <div className="bg-[#FAF8F5] p-3 border border-[#E8E4DC] text-xs">
                <span className="text-[10px] uppercase text-[#888888] block">Salt Status</span>
                <span className="font-mono-tabular text-[#111111] font-medium">
                  {settings?.ip_salt_preview || 'Configured'}
                </span>
              </div>

              {saltSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-800 text-xs">
                  {saltSuccess}
                </div>
              )}

              <button
                onClick={handleRotateSalt}
                disabled={rotatingSalt}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${rotatingSalt ? 'animate-spin' : ''}`} />
                <span>Rotate IP Salt</span>
              </button>
            </div>

            {/* Admin Password Change */}
            <div className="bg-white border border-[#E8E4DC] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#C6A46A]" />
                <h3 className="text-xs uppercase tracking-wider text-[#111111] font-semibold">
                  Change Admin Password
                </h3>
              </div>

              {passwordMsg && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  {passwordMsg}
                </div>
              )}

              {passwordError && (
                <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs">
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] uppercase text-[#666666] mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#666666] mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#666666] mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full py-2 px-3 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50"
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
