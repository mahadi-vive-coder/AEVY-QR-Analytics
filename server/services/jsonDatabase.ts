import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { isDevOrLocalUrl } from './urlService.js';

// Types
export interface QRCodeItem {
  id: string;
  name: string;
  campaign_id: string;
  product: string;
  placement: string;
  description: string;
  destination_url: string;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
  start_date?: string | null;
  expiry_date?: string | null;
  scan_count: number;
  last_scanned_at?: string | null;
  enable_lead_capture?: boolean;
  settings: {
    foreground: string;
    background: string;
    accent?: string;
    error_correction: 'L' | 'M' | 'Q' | 'H';
    margin: number;
    size: number;
    logo?: string | null;
  };
}

export interface ScanItem {
  scan_id: string;
  qr_id: string;
  campaign_id: string;
  visitor_id: string;
  timestamp: string;
  date: string;
  time: string;
  timezone: string;
  day_of_week: string;
  hour: number;
  country: string;
  country_code: string;
  region: string;
  city: string;
  device_type: string;
  platform: string;
  platform_version?: string;
  browser: string;
  browser_version: string;
  language: string;
  screen_width?: number;
  screen_height?: number;
  referrer: string;
  ip_hash: string;
}

export interface CampaignItem {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: 'active' | 'completed' | 'archived';
}

export interface VisitorLeadItem {
  lead_id: string;
  qr_id: string;
  campaign_id?: string;
  scan_id?: string;
  visitor_id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  consent: boolean;
}

export interface AppSettings {
  business_name: string;
  tagline: string;
  timezone: string;
  default_foreground: string;
  default_background: string;
  default_accent: string;
  default_destination: string;
  app_url: string; // The production dynamic QR base URL (e.g. https://qr.aevyfragrance.com)
  ip_salt: string;
  data_retention_days: number; // 0 = never
  anonymize_ip: boolean;
  enable_lead_capture: boolean;
}

export interface AdminAccount {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  last_login?: string;
}

export interface StorageHealthReport {
  storage_status: 'Connected' | 'Error';
  storage_mode: string;
  storage_directory: string;
  qr_records_count: number;
  scan_records_count: number;
  campaigns_count: number;
  visitors_count: number;
  last_successful_write: string | null;
  write_lock_status: 'Idle' | 'Active';
  persistence_verified: boolean;
  app_url: string;
  app_url_status: 'configured' | 'missing' | 'dev_warning';
  gcs_sync_enabled: boolean;
  gcs_bucket: string | null;
}

// In-memory write lock queue to guarantee atomic sequential writes without file race conditions
class WriteLockQueue {
  private queue: Promise<void> = Promise.resolve();
  private pendingTasks = 0;

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.pendingTasks++;
    const result = this.queue.then(task);
    this.queue = result.then(
      () => {
        this.pendingTasks = Math.max(0, this.pendingTasks - 1);
      },
      () => {
        this.pendingTasks = Math.max(0, this.pendingTasks - 1);
      }
    );
    return result;
  }

  isBusy(): boolean {
    return this.pendingTasks > 0;
  }
}

const writeLock = new WriteLockQueue();

// Resolve persistent data directory (supports Cloud Run volume mounts like /mnt/data or custom DATA_DIR)
function resolveDataDirectory(): string {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim());
  }
  if (fs.existsSync('/mnt/data')) {
    return '/mnt/data';
  }
  return path.resolve(process.cwd(), 'data');
}

export class JsonDatabase {
  private static instance: JsonDatabase;
  private dataDir: string;
  private lastSuccessfulWrite: string | null = null;
  private storageStatus: 'Connected' | 'Error' = 'Connected';
  private gcsBucketName: string | null = null;
  private gcsBucket: any = null;

  private constructor() {
    this.dataDir = resolveDataDirectory();
    this.gcsBucketName = process.env.GCS_BUCKET || process.env.STORAGE_BUCKET || process.env.GCS_DATA_BUCKET || null;

    this.ensureDataDir();
    this.initDefaultFiles();
    this.initGcsSync();
    this.migrateExistingQRCodes().catch((err) => {
      console.error('[JsonDatabase] Migration error on startup:', err);
    });
  }

  public static getInstance(): JsonDatabase {
    if (!JsonDatabase.instance) {
      JsonDatabase.instance = new JsonDatabase();
    }
    return JsonDatabase.instance;
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      this.storageStatus = 'Connected';
    } catch (err) {
      console.error(`[JsonDatabase] Failed to ensure data dir at ${this.dataDir}:`, err);
      this.storageStatus = 'Error';
    }
  }

  private async initGcsSync() {
    if (!this.gcsBucketName) return;
    try {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage();
      this.gcsBucket = storage.bucket(this.gcsBucketName);
      console.log(`[JsonDatabase] Persistent GCS Bucket configured: ${this.gcsBucketName}`);

      // Attempt to pull persistent JSON from bucket if local directory has missing files
      const filesToCheck = ['qr_codes.json', 'scans.json', 'campaigns.json', 'visitors.json', 'settings.json'];
      for (const fname of filesToCheck) {
        const localPath = this.getFilePath(fname);
        if (!fs.existsSync(localPath)) {
          try {
            const file = this.gcsBucket.file(fname);
            const [exists] = await file.exists();
            if (exists) {
              console.log(`[JsonDatabase] Restoring ${fname} from Cloud Storage bucket...`);
              await file.download({ destination: localPath });
            }
          } catch (dlErr) {
            console.warn(`[JsonDatabase] Cloud Storage check for ${fname} note:`, dlErr);
          }
        }
      }
    } catch (err) {
      console.warn('[JsonDatabase] Optional GCS sync initialization skipped:', err);
    }
  }

  private getFilePath(filename: string): string {
    return path.join(this.dataDir, filename);
  }

  private initDefaultFiles() {
    // 1. qr_codes.json
    if (!fs.existsSync(this.getFilePath('qr_codes.json'))) {
      this.writeSync('qr_codes.json', []);
    }

    // 2. scans.json
    if (!fs.existsSync(this.getFilePath('scans.json'))) {
      this.writeSync('scans.json', []);
    }

    // 3. campaigns.json
    if (!fs.existsSync(this.getFilePath('campaigns.json'))) {
      this.writeSync('campaigns.json', []);
    }

    // 4. visitors.json
    if (!fs.existsSync(this.getFilePath('visitors.json'))) {
      this.writeSync('visitors.json', []);
    }

    // 5. settings.json
    if (!fs.existsSync(this.getFilePath('settings.json'))) {
      const defaultSettings: AppSettings = {
        business_name: 'AEVY',
        tagline: 'Essence of Fresh Elegance',
        timezone: process.env.TIMEZONE || 'Asia/Dhaka',
        default_foreground: '#111111',
        default_background: '#FFFFFF',
        default_accent: '#C6A46A',
        default_destination: 'https://aevy-fragrance.vercel.app/',
        app_url: 'https://qr.aevyfragrance.com',
        ip_salt: crypto.randomBytes(16).toString('hex'),
        data_retention_days: 0,
        anonymize_ip: true,
        enable_lead_capture: true,
      };
      this.writeSync('settings.json', defaultSettings);
    }

    // 6. admin.json
    if (!fs.existsSync(this.getFilePath('admin.json'))) {
      const defaultEmail = process.env.ADMIN_EMAIL || 'aevy.brand@gmail.com';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'aevy2026!';
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(defaultPassword, salt);

      const defaultAdmin: AdminAccount[] = [
        {
          id: 'admin_1',
          username: 'admin',
          email: defaultEmail,
          password_hash: hash,
          created_at: new Date().toISOString(),
        },
      ];
      this.writeSync('admin.json', defaultAdmin);
    }
  }

  // Atomic file write using a temporary file and atomic rename
  private writeSync(filename: string, data: any) {
    const targetPath = this.getFilePath(filename);
    const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, jsonString, 'utf-8');
    fs.renameSync(tempPath, targetPath);
    this.lastSuccessfulWrite = new Date().toISOString();
    this.storageStatus = 'Connected';
  }

  private async writeAtomic<T>(filename: string, data: T): Promise<void> {
    return writeLock.enqueue(async () => {
      try {
        const targetPath = this.getFilePath(filename);
        const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
        const jsonString = JSON.stringify(data, null, 2);
        await fs.promises.writeFile(tempPath, jsonString, 'utf-8');
        await fs.promises.rename(tempPath, targetPath);
        this.lastSuccessfulWrite = new Date().toISOString();
        this.storageStatus = 'Connected';

        // Secondary asynchronous persistent GCS sync if bucket is enabled
        if (this.gcsBucket) {
          this.gcsBucket
            .upload(targetPath, { destination: filename })
            .catch((gcsErr: any) => {
              console.warn(`[JsonDatabase] GCS background sync note for ${filename}:`, gcsErr?.message);
            });
        }
      } catch (err) {
        this.storageStatus = 'Error';
        console.error(`[JsonDatabase] Error in writeAtomic for ${filename}:`, err);
        throw err;
      }
    });
  }

  private async read<T>(filename: string, fallback: T): Promise<T> {
    try {
      const filePath = this.getFilePath(filename);
      if (!fs.existsSync(filePath)) {
        return fallback;
      }
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[JsonDatabase] Error reading ${filename}:`, err);
      return fallback;
    }
  }

  /**
   * Migration / Compatibility Mechanism for existing QR codes:
   * 1. Strips any hardcoded 'tracking_url' or 'url' properties from QR database records
   * 2. Enforces clean schema: stores ONLY the QR ID and QR configuration
   * 3. Preserves all existing QR IDs (e.g. AEVY-QR-000004) and historical scan records
   */
  public async migrateExistingQRCodes(): Promise<{ migratedCount: number; cleanedFields: string[] }> {
    const qrs = await this.getQRCodes();
    let changed = false;
    let count = 0;
    const cleanedFields: Set<string> = new Set();

    const migrated = qrs.map((item) => {
      let itemChanged = false;
      const cleaned: any = { ...item };

      // Requirement 3: Do NOT store a permanently hardcoded tracking URL inside the QR database record.
      if (cleaned.tracking_url !== undefined) {
        delete cleaned.tracking_url;
        cleanedFields.add('tracking_url');
        itemChanged = true;
      }
      if (cleaned.url !== undefined) {
        delete cleaned.url;
        cleanedFields.add('url');
        itemChanged = true;
      }
      if (cleaned.trackingUrl !== undefined) {
        delete cleaned.trackingUrl;
        cleanedFields.add('trackingUrl');
        itemChanged = true;
      }

      if (itemChanged) {
        changed = true;
        count++;
      }
      return cleaned as QRCodeItem;
    });

    if (changed) {
      await this.saveQRCodes(migrated);
      console.log(`[JsonDatabase] Migration complete: Cleaned ${count} existing QR records.`);
    }

    return { migratedCount: count, cleanedFields: Array.from(cleanedFields) };
  }

  // --- QR Codes ---
  public async getQRCodes(): Promise<QRCodeItem[]> {
    return this.read<QRCodeItem[]>('qr_codes.json', []);
  }

  public async getQRCodeById(id: string): Promise<QRCodeItem | null> {
    const list = await this.getQRCodes();
    return list.find((q) => q.id.toLowerCase() === id.toLowerCase()) || null;
  }

  public async saveQRCodes(items: QRCodeItem[]): Promise<void> {
    await this.writeAtomic('qr_codes.json', items);
  }

  public async generateNextQRId(): Promise<string> {
    const list = await this.getQRCodes();
    let maxNum = 0;
    for (const item of list) {
      const match = item.id.match(/^AEVY-QR-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = maxNum + 1;
    return `AEVY-QR-${String(nextNum).padStart(6, '0')}`;
  }

  public async createQRCode(item: QRCodeItem): Promise<QRCodeItem> {
    // Ensure no hardcoded tracking_url is stored in the database record
    const recordToSave: any = { ...item };
    delete recordToSave.tracking_url;
    delete recordToSave.trackingUrl;
    delete recordToSave.url;

    const list = await this.getQRCodes();
    list.unshift(recordToSave as QRCodeItem);
    await this.saveQRCodes(list);
    return recordToSave as QRCodeItem;
  }

  public async updateQRCode(id: string, updates: Partial<QRCodeItem>): Promise<QRCodeItem | null> {
    const list = await this.getQRCodes();
    const index = list.findIndex((q) => q.id.toLowerCase() === id.toLowerCase());
    if (index === -1) return null;

    const cleanUpdates: any = { ...updates };
    delete cleanUpdates.tracking_url;
    delete cleanUpdates.trackingUrl;
    delete cleanUpdates.url;

    list[index] = {
      ...list[index],
      ...cleanUpdates,
      updated_at: new Date().toISOString(),
    };
    await this.saveQRCodes(list);
    return list[index];
  }

  public async incrementScanCount(id: string, scannedAt: string): Promise<void> {
    const list = await this.getQRCodes();
    const index = list.findIndex((q) => q.id.toLowerCase() === id.toLowerCase());
    if (index !== -1) {
      list[index].scan_count = (list[index].scan_count || 0) + 1;
      list[index].last_scanned_at = scannedAt;
      await this.saveQRCodes(list);
    }
  }

  public async deleteQRCode(id: string): Promise<boolean> {
    const list = await this.getQRCodes();
    const filtered = list.filter((q) => q.id.toLowerCase() !== id.toLowerCase());
    if (filtered.length === list.length) return false;
    await this.saveQRCodes(filtered);
    return true;
  }

  // --- Scans ---
  public async getScans(): Promise<ScanItem[]> {
    return this.read<ScanItem[]>('scans.json', []);
  }

  public async recordScan(scan: ScanItem): Promise<void> {
    const scans = await this.getScans();
    scans.push(scan);
    await this.writeAtomic('scans.json', scans);
    await this.incrementScanCount(scan.qr_id, scan.timestamp);
  }

  public async generateNextScanId(): Promise<string> {
    const scans = await this.getScans();
    const nextNum = scans.length + 1;
    return `SCAN-${String(nextNum).padStart(6, '0')}`;
  }

  // --- Campaigns ---
  public async getCampaigns(): Promise<CampaignItem[]> {
    return this.read<CampaignItem[]>('campaigns.json', []);
  }

  public async saveCampaigns(items: CampaignItem[]): Promise<void> {
    await this.writeAtomic('campaigns.json', items);
  }

  public async generateNextCampaignId(): Promise<string> {
    const list = await this.getCampaigns();
    let maxNum = 0;
    for (const item of list) {
      const match = item.id.match(/^CAMP-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = maxNum + 1;
    return `CAMP-${String(nextNum).padStart(6, '0')}`;
  }

  public async createCampaign(campaign: CampaignItem): Promise<CampaignItem> {
    const list = await this.getCampaigns();
    list.unshift(campaign);
    await this.saveCampaigns(list);
    return campaign;
  }

  public async updateCampaign(id: string, updates: Partial<CampaignItem>): Promise<CampaignItem | null> {
    const list = await this.getCampaigns();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...updates };
    await this.saveCampaigns(list);
    return list[index];
  }

  public async deleteCampaign(id: string): Promise<boolean> {
    const list = await this.getCampaigns();
    const filtered = list.filter((c) => c.id !== id);
    if (filtered.length === list.length) return false;
    await this.saveCampaigns(filtered);
    return true;
  }

  // --- Visitors / Leads ---
  public async getVisitors(): Promise<VisitorLeadItem[]> {
    return this.read<VisitorLeadItem[]>('visitors.json', []);
  }

  public async recordVisitorLead(lead: VisitorLeadItem): Promise<VisitorLeadItem> {
    const list = await this.getVisitors();
    list.unshift(lead);
    await this.writeAtomic('visitors.json', list);
    return lead;
  }

  public async generateNextLeadId(): Promise<string> {
    const list = await this.getVisitors();
    return `LEAD-${String(list.length + 1).padStart(6, '0')}`;
  }

  // --- Settings ---
  public async getSettings(): Promise<AppSettings> {
    const raw = await this.read<AppSettings>('settings.json', {
      business_name: 'AEVY',
      tagline: 'Essence of Fresh Elegance',
      timezone: 'Asia/Dhaka',
      default_foreground: '#111111',
      default_background: '#FFFFFF',
      default_accent: '#C6A46A',
      default_destination: 'https://aevy-fragrance.vercel.app/',
      app_url: 'https://qr.aevyfragrance.com',
      ip_salt: 'aevy_fixed_salt',
      data_retention_days: 0,
      anonymize_ip: true,
      enable_lead_capture: true,
    });

    if (!raw.app_url) {
      raw.app_url = 'https://qr.aevyfragrance.com';
    }

    return raw;
  }

  public async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...updates };
    await this.writeAtomic('settings.json', updated);
    return updated;
  }

  // --- Admin Accounts ---
  public async getAdmins(): Promise<AdminAccount[]> {
    return this.read<AdminAccount[]>('admin.json', []);
  }

  public async saveAdmins(admins: AdminAccount[]): Promise<void> {
    await this.writeAtomic('admin.json', admins);
  }

  // --- Storage Health & Diagnostics ---
  public async getStorageHealth(): Promise<StorageHealthReport> {
    const qrs = await this.getQRCodes();
    const scans = await this.getScans();
    const campaigns = await this.getCampaigns();
    const visitors = await this.getVisitors();
    const settings = await this.getSettings();

    const envUrl = process.env.APP_URL?.trim();
    const isDev = envUrl ? isDevOrLocalUrl(envUrl) : false;

    let appUrlStatus: 'configured' | 'missing' | 'dev_warning' = 'configured';
    if (isDev) {
      appUrlStatus = 'dev_warning';
    } else if (!envUrl && !settings.app_url) {
      appUrlStatus = 'missing';
    }

    let modeDescription = 'Local Persistent JSON Database';
    if (this.gcsBucketName) {
      modeDescription = `Google Cloud Storage Synchronized (${this.gcsBucketName})`;
    } else if (this.dataDir.startsWith('/mnt')) {
      modeDescription = 'Google Cloud Run Volume Mount';
    }

    return {
      storage_status: this.storageStatus,
      storage_mode: modeDescription,
      storage_directory: this.dataDir,
      qr_records_count: qrs.length,
      scan_records_count: scans.length,
      campaigns_count: campaigns.length,
      visitors_count: visitors.length,
      last_successful_write: this.lastSuccessfulWrite,
      write_lock_status: writeLock.isBusy() ? 'Active' : 'Idle',
      persistence_verified: this.storageStatus === 'Connected',
      app_url: settings.app_url || 'https://qr.aevyfragrance.com',
      app_url_status: appUrlStatus,
      gcs_sync_enabled: Boolean(this.gcsBucketName),
      gcs_bucket: this.gcsBucketName,
    };
  }

  public async verifyStorageWriteRead(): Promise<{ success: boolean; testTimestamp: string; latencyMs: number }> {
    const testFile = this.getFilePath('.persistence_verify.tmp');
    const start = Date.now();
    const testPayload = {
      verified_at: new Date().toISOString(),
      nonce: Math.random().toString(36),
    };

    await fs.promises.writeFile(testFile, JSON.stringify(testPayload), 'utf-8');
    const readBack = await fs.promises.readFile(testFile, 'utf-8');
    const parsed = JSON.parse(readBack);
    if (parsed.nonce !== testPayload.nonce) {
      throw new Error('Persistence verification mismatch during readback');
    }
    await fs.promises.unlink(testFile);

    const latencyMs = Date.now() - start;
    this.lastSuccessfulWrite = new Date().toISOString();
    this.storageStatus = 'Connected';

    return {
      success: true,
      testTimestamp: testPayload.verified_at,
      latencyMs,
    };
  }

  // --- Backup & Restore ---
  public async getFullBackup() {
    return {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      qr_codes: await this.getQRCodes(),
      scans: await this.getScans(),
      campaigns: await this.getCampaigns(),
      visitors: await this.getVisitors(),
      settings: await this.getSettings(),
    };
  }

  public async restoreBackup(data: any): Promise<{ success: boolean; summary: any }> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup file: Not a valid JSON object');
    }

    // Auto-backup current state first
    const autoBackup = await this.getFullBackup();
    const backupDir = path.join(this.dataDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const autoBackupPath = path.join(backupDir, `pre_restore_${Date.now()}.json`);
    fs.writeFileSync(autoBackupPath, JSON.stringify(autoBackup, null, 2), 'utf-8');

    if (Array.isArray(data.qr_codes)) {
      await this.saveQRCodes(data.qr_codes);
      await this.migrateExistingQRCodes();
    }
    if (Array.isArray(data.scans)) {
      await this.writeAtomic('scans.json', data.scans);
    }
    if (Array.isArray(data.campaigns)) {
      await this.saveCampaigns(data.campaigns);
    }
    if (Array.isArray(data.visitors)) {
      await this.writeAtomic('visitors.json', data.visitors);
    }
    if (data.settings && typeof data.settings === 'object') {
      await this.updateSettings(data.settings);
    }

    return {
      success: true,
      summary: {
        qr_codes_restored: Array.isArray(data.qr_codes) ? data.qr_codes.length : 0,
        scans_restored: Array.isArray(data.scans) ? data.scans.length : 0,
        campaigns_restored: Array.isArray(data.campaigns) ? data.campaigns.length : 0,
        visitors_restored: Array.isArray(data.visitors) ? data.visitors.length : 0,
      },
    };
  }

  // Retention cleanup
  public async cleanOldData(): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.data_retention_days || settings.data_retention_days <= 0) {
      return 0;
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.data_retention_days);
    const cutoffIso = cutoffDate.toISOString();

    const scans = await this.getScans();
    const keptScans = scans.filter((s) => s.timestamp >= cutoffIso);
    const removedCount = scans.length - keptScans.length;

    if (removedCount > 0) {
      await this.writeAtomic('scans.json', keptScans);
    }
    return removedCount;
  }
}
