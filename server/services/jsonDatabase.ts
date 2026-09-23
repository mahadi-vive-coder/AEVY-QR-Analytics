import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { put, get, list, del } from '@vercel/blob';
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
  app_url: string;
  ip_salt: string;
  data_retention_days: number;
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
  blob_storage_enabled?: boolean;
}

// In-memory write lock queue for atomic sequential writes (local file mode fallback)
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

// Check if Vercel Blob credentials are provided (either explicit token or automatic Vercel OIDC)
export function isBlobStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL_BLOB_STORE_ID ||
    (process.env.VERCEL && process.env.VERCEL_ENV)
  );
}

// Resolve persistent local data directory for fallback/development
function resolveDataDirectory(): string {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim());
  }
  return path.resolve(process.cwd(), 'data');
}

export class JsonDatabase {
  private static instance: JsonDatabase;
  private dataDir: string;
  private lastSuccessfulWrite: string | null = null;
  private storageStatus: 'Connected' | 'Error' = 'Connected';

  private constructor() {
    this.dataDir = resolveDataDirectory();

    // If Blob credentials are NOT configured, ensure local fallback data directory & files
    if (!isBlobStorageConfigured()) {
      this.ensureLocalDataDir();
      this.initDefaultLocalFiles();
    }

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

  // --- Local Filesystem Fallback Helpers ---

  private ensureLocalDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      this.storageStatus = 'Connected';
    } catch (err) {
      console.error(`[JsonDatabase] Failed to ensure local data dir at ${this.dataDir}:`, err);
      this.storageStatus = 'Error';
    }
  }

  private getLocalFilePath(filename: string): string {
    return path.join(this.dataDir, filename);
  }

  private initDefaultLocalFiles() {
    if (!fs.existsSync(this.getLocalFilePath('qr_codes.json'))) {
      this.writeLocalSync('qr_codes.json', []);
    }
    if (!fs.existsSync(this.getLocalFilePath('scans.json'))) {
      this.writeLocalSync('scans.json', []);
    }
    if (!fs.existsSync(this.getLocalFilePath('campaigns.json'))) {
      this.writeLocalSync('campaigns.json', []);
    }
    if (!fs.existsSync(this.getLocalFilePath('visitors.json'))) {
      this.writeLocalSync('visitors.json', []);
    }
    if (!fs.existsSync(this.getLocalFilePath('settings.json'))) {
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
      this.writeLocalSync('settings.json', defaultSettings);
    }
    if (!fs.existsSync(this.getLocalFilePath('admin.json'))) {
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
      this.writeLocalSync('admin.json', defaultAdmin);
    }
  }

  private writeLocalSync(filename: string, data: any) {
    const targetPath = this.getLocalFilePath(filename);
    const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, jsonString, 'utf-8');
    fs.renameSync(tempPath, targetPath);
    this.lastSuccessfulWrite = new Date().toISOString();
    this.storageStatus = 'Connected';
  }

  private async writeLocalAtomic<T>(filename: string, data: T): Promise<void> {
    return writeLock.enqueue(async () => {
      try {
        const targetPath = this.getLocalFilePath(filename);
        const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
        const jsonString = JSON.stringify(data, null, 2);
        await fs.promises.writeFile(tempPath, jsonString, 'utf-8');
        await fs.promises.rename(tempPath, targetPath);
        this.lastSuccessfulWrite = new Date().toISOString();
        this.storageStatus = 'Connected';
      } catch (err) {
        this.storageStatus = 'Error';
        console.error(`[JsonDatabase] Error in writeLocalAtomic for ${filename}:`, err);
        throw err;
      }
    });
  }

  private async readLocal<T>(filename: string, fallback: T): Promise<T> {
    try {
      const filePath = this.getLocalFilePath(filename);
      if (!fs.existsSync(filePath)) {
        return fallback;
      }
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[JsonDatabase] Error reading local ${filename}:`, err);
      return fallback;
    }
  }

  // --- Vercel Blob Read / Write Primitives ---

  /**
   * Reads a JSON object from private Vercel Blob with useCache: false.
   * If blob does not exist or credentials are unavailable, returns null.
   */
  private async readBlobJson<T>(blobPath: string): Promise<T | null> {
    if (!isBlobStorageConfigured()) {
      return null;
    }
    try {
      const result = await get(blobPath, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }

      // Read Web ReadableStream into string
      const reader = result.stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const buffer = Buffer.concat(chunks);
      const text = buffer.toString('utf-8');
      return JSON.parse(text) as T;
    } catch (err: any) {
      if (err.name === 'BlobNotFoundError' || err.message?.includes('not found') || err.message?.includes('404')) {
        return null;
      }
      console.warn(`[JsonDatabase] Note reading blob ${blobPath}:`, err.message);
      return null;
    }
  }

  /**
   * Writes a JSON object to private Vercel Blob.
   */
  private async writeBlobJson<T>(blobPath: string, data: T): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    await put(blobPath, jsonString, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    this.lastSuccessfulWrite = new Date().toISOString();
    this.storageStatus = 'Connected';
  }

  // Unified Read / Write routing: Blob when configured, fallback to Local JSON
  private async readData<T>(filename: string, fallback: T): Promise<T> {
    if (isBlobStorageConfigured()) {
      const blobPath = `data/${filename}`;
      const blobData = await this.readBlobJson<T>(blobPath);
      if (blobData !== null) {
        return blobData;
      }
      // If blob was not found yet, check local file (useful during local migration / transition)
      const localData = await this.readLocal<T>(filename, fallback);
      return localData;
    }
    return this.readLocal<T>(filename, fallback);
  }

  private async writeData<T>(filename: string, data: T): Promise<void> {
    if (isBlobStorageConfigured()) {
      const blobPath = `data/${filename}`;
      await this.writeBlobJson(blobPath, data);
      return;
    }
    await this.writeLocalAtomic(filename, data);
  }

  // --- Migration Existing QR Codes Clean-up ---
  public async migrateExistingQRCodes(): Promise<{ migratedCount: number; cleanedFields: string[] }> {
    const qrs = await this.getQRCodes();
    let changed = false;
    let count = 0;
    const cleanedFields: Set<string> = new Set();

    const migrated = qrs.map((item) => {
      let itemChanged = false;
      const cleaned: any = { ...item };

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
      console.log(`[JsonDatabase] Cleaned ${count} existing QR records.`);
    }

    return { migratedCount: count, cleanedFields: Array.from(cleanedFields) };
  }

  // --- QR Codes ---
  public async getQRCodes(): Promise<QRCodeItem[]> {
    return this.readData<QRCodeItem[]>('qr_codes.json', []);
  }

  public async getQRCodeById(id: string): Promise<QRCodeItem | null> {
    const list = await this.getQRCodes();
    return list.find((q) => q.id.toLowerCase() === id.toLowerCase()) || null;
  }

  public async saveQRCodes(items: QRCodeItem[]): Promise<void> {
    await this.writeData('qr_codes.json', items);
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
  /**
   * Retrieves all scan records.
   * In Vercel Blob mode:
   * 1. Lists all individual scan files under prefix `data/scans/` and fetches each scan JSON concurrently.
   * 2. If no individual scan objects exist, checks legacy/migrated `data/scans.json` blob.
   * In local fallback mode: Reads local `scans.json`.
   */
  public async getScans(): Promise<ScanItem[]> {
    if (isBlobStorageConfigured()) {
      try {
        // 1. List individual scans under data/scans/
        const blobList = await list({ prefix: 'data/scans/', limit: 1000 });
        const jsonBlobs = blobList.blobs.filter(
          (b) => b.pathname.endsWith('.json') && !b.pathname.endsWith('scans.json')
        );

        if (jsonBlobs.length > 0) {
          // Fetch immutable individual scans concurrently in batches
          const batchSize = 25;
          const scans: ScanItem[] = [];
          for (let i = 0; i < jsonBlobs.length; i += batchSize) {
            const batch = jsonBlobs.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map((b) => this.readBlobJson<ScanItem>(b.pathname))
            );
            for (const item of batchResults) {
              if (item && item.scan_id) {
                scans.push(item);
              }
            }
          }

          // Also check if there are legacy scans in data/scans.json not yet migrated to individual files
          const legacyScans = (await this.readBlobJson<ScanItem[]>('data/scans.json')) || [];
          const existingIds = new Set(scans.map((s) => s.scan_id));
          for (const s of legacyScans) {
            if (!existingIds.has(s.scan_id)) {
              scans.push(s);
            }
          }

          scans.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          return scans;
        }

        // 2. Fallback to monolithic blob `data/scans.json`
        const monolithic = await this.readBlobJson<ScanItem[]>('data/scans.json');
        if (monolithic && Array.isArray(monolithic)) {
          return monolithic;
        }
      } catch (err: any) {
        console.warn('[JsonDatabase] Note reading scans from Vercel Blob:', err.message);
      }
    }

    return this.readLocal<ScanItem[]>('scans.json', []);
  }

  /**
   * Records a new scan.
   * In Vercel Blob mode:
   * Writes the scan event to an immutable blob path: `data/scans/YYYY-MM-DD/<scan-id>.json`.
   * This completely avoids concurrency race conditions and read-modify-write conflicts in serverless functions.
   * In local fallback mode:
   * Appends to `scans.json` using the local write lock queue.
   */
  public async recordScan(scan: ScanItem): Promise<void> {
    if (isBlobStorageConfigured()) {
      const datePart = scan.date || new Date().toISOString().split('T')[0];
      const scanBlobPath = `data/scans/${datePart}/${scan.scan_id}.json`;
      await this.writeBlobJson(scanBlobPath, scan);
      // Increment scan count on the QR code
      await this.incrementScanCount(scan.qr_id, scan.timestamp);
      return;
    }

    const scans = await this.getScans();
    scans.push(scan);
    await this.writeLocalAtomic('scans.json', scans);
    await this.incrementScanCount(scan.qr_id, scan.timestamp);
  }

  public async generateNextScanId(): Promise<string> {
    const scans = await this.getScans();
    let maxNum = 0;
    for (const item of scans) {
      const match = item.scan_id?.match(/^SCAN-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = Math.max(scans.length + 1, maxNum + 1);
    return `SCAN-${String(nextNum).padStart(6, '0')}`;
  }

  // --- Campaigns ---
  public async getCampaigns(): Promise<CampaignItem[]> {
    return this.readData<CampaignItem[]>('campaigns.json', []);
  }

  public async saveCampaigns(items: CampaignItem[]): Promise<void> {
    await this.writeData('campaigns.json', items);
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
    return this.readData<VisitorLeadItem[]>('visitors.json', []);
  }

  public async recordVisitorLead(lead: VisitorLeadItem): Promise<VisitorLeadItem> {
    const list = await this.getVisitors();
    list.unshift(lead);
    await this.writeData('visitors.json', list);
    return lead;
  }

  public async generateNextLeadId(): Promise<string> {
    const list = await this.getVisitors();
    let maxNum = 0;
    for (const item of list) {
      const match = item.lead_id?.match(/^LEAD-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = Math.max(list.length + 1, maxNum + 1);
    return `LEAD-${String(nextNum).padStart(6, '0')}`;
  }

  // --- Settings ---
  public async getSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
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
    };

    const raw = await this.readData<AppSettings>('settings.json', defaultSettings);

    if (!raw.app_url) {
      raw.app_url = 'https://qr.aevyfragrance.com';
    }

    return raw;
  }

  public async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...updates };
    await this.writeData('settings.json', updated);
    return updated;
  }

  // --- Admin Accounts ---
  public async getAdmins(): Promise<AdminAccount[]> {
    return this.readData<AdminAccount[]>('admin.json', []);
  }

  public async saveAdmins(admins: AdminAccount[]): Promise<void> {
    await this.writeData('admin.json', admins);
  }

  // --- One-Time Migration Utility (Triggered when MIGRATION_MODE=true) ---
  public async migrateLocalJsonToBlob(): Promise<{
    migrated: boolean;
    message: string;
    filesMigrated: string[];
    counts: {
      qrCodes: number;
      scans: number;
      campaigns: number;
      visitors: number;
      settings: boolean;
      admin: boolean;
    };
  }> {
    if (!isBlobStorageConfigured()) {
      return {
        migrated: false,
        message: 'Vercel Blob credentials (BLOB_READ_WRITE_TOKEN or automatic Vercel OIDC) not configured.',
        filesMigrated: [],
        counts: { qrCodes: 0, scans: 0, campaigns: 0, visitors: 0, settings: false, admin: false },
      };
    }

    // Check if Blob already has existing data (idempotency check)
    const existingQrs = await this.readBlobJson<QRCodeItem[]>('data/qr_codes.json');
    if (existingQrs && existingQrs.length > 0) {
      return {
        migrated: false,
        message: 'Vercel Blob already contains production data (qr_codes.json exists). Migration skipped to prevent overwrite.',
        filesMigrated: [],
        counts: { qrCodes: existingQrs.length, scans: 0, campaigns: 0, visitors: 0, settings: true, admin: true },
      };
    }

    const filesMigrated: string[] = [];
    const counts = {
      qrCodes: 0,
      scans: 0,
      campaigns: 0,
      visitors: 0,
      settings: false,
      admin: false,
    };

    console.log('[Migration] Starting migration from local JSON files to Vercel Blob...');

    // 1. QR Codes
    const localQrs = await this.readLocal<QRCodeItem[]>('qr_codes.json', []);
    if (localQrs.length > 0) {
      await this.writeBlobJson('data/qr_codes.json', localQrs);
      filesMigrated.push('qr_codes.json');
      counts.qrCodes = localQrs.length;
    }

    // 2. Campaigns
    const localCampaigns = await this.readLocal<CampaignItem[]>('campaigns.json', []);
    if (localCampaigns.length > 0) {
      await this.writeBlobJson('data/campaigns.json', localCampaigns);
      filesMigrated.push('campaigns.json');
      counts.campaigns = localCampaigns.length;
    }

    // 3. Visitors
    const localVisitors = await this.readLocal<VisitorLeadItem[]>('visitors.json', []);
    if (localVisitors.length > 0) {
      await this.writeBlobJson('data/visitors.json', localVisitors);
      filesMigrated.push('visitors.json');
      counts.visitors = localVisitors.length;
    }

    // 4. Settings
    const localSettings = await this.readLocal<AppSettings | null>('settings.json', null);
    if (localSettings) {
      await this.writeBlobJson('data/settings.json', localSettings);
      filesMigrated.push('settings.json');
      counts.settings = true;
    }

    // 5. Admin
    const localAdmin = await this.readLocal<AdminAccount[]>('admin.json', []);
    if (localAdmin.length > 0) {
      await this.writeBlobJson('data/admin.json', localAdmin);
      filesMigrated.push('admin.json');
      counts.admin = true;
    }

    // 6. Scans (migrated as immutable per-scan event files under data/scans/YYYY-MM-DD/<scan-id>.json)
    const localScans = await this.readLocal<ScanItem[]>('scans.json', []);
    if (localScans.length > 0) {
      console.log(`[Migration] Migrating ${localScans.length} scans to immutable blob objects...`);
      for (const scan of localScans) {
        const datePart = scan.date || scan.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];
        const scanBlobPath = `data/scans/${datePart}/${scan.scan_id}.json`;
        await this.writeBlobJson(scanBlobPath, scan);
      }
      // Also save the monolithic backup copy for backward compatibility
      await this.writeBlobJson('data/scans.json', localScans);
      filesMigrated.push('scans.json');
      counts.scans = localScans.length;
    }

    console.log('[Migration] Migration to Vercel Blob completed successfully.');
    return {
      migrated: true,
      message: 'Migration from local JSON files to Vercel Blob completed successfully.',
      filesMigrated,
      counts,
    };
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

    const isBlob = isBlobStorageConfigured();
    const modeDescription = isBlob
      ? 'Vercel Blob Storage (Private Blob JSON Objects)'
      : 'Local Persistent JSON Database';

    const directoryDescription = isBlob ? 'Vercel Blob Store (data/*)' : this.dataDir;

    return {
      storage_status: this.storageStatus,
      storage_mode: modeDescription,
      storage_directory: directoryDescription,
      qr_records_count: qrs.length,
      scan_records_count: scans.length,
      campaigns_count: campaigns.length,
      visitors_count: visitors.length,
      last_successful_write: this.lastSuccessfulWrite,
      write_lock_status: writeLock.isBusy() ? 'Active' : 'Idle',
      persistence_verified: this.storageStatus === 'Connected',
      app_url: settings.app_url || 'https://qr.aevyfragrance.com',
      app_url_status: appUrlStatus,
      gcs_sync_enabled: false,
      gcs_bucket: null,
      blob_storage_enabled: isBlob,
    };
  }

  public async verifyStorageWriteRead(): Promise<{ success: boolean; testTimestamp: string; latencyMs: number }> {
    const start = Date.now();
    const testPayload = {
      verified_at: new Date().toISOString(),
      nonce: Math.random().toString(36),
    };

    if (isBlobStorageConfigured()) {
      const testPath = 'data/.persistence_verify.json';
      await this.writeBlobJson(testPath, testPayload);
      const readBack = await this.readBlobJson<typeof testPayload>(testPath);
      if (!readBack || readBack.nonce !== testPayload.nonce) {
        throw new Error('Persistence verification mismatch during Vercel Blob readback');
      }
      try {
        await del(testPath);
      } catch {
        // silent clean up
      }
    } else {
      const testFile = this.getLocalFilePath('.persistence_verify.tmp');
      await fs.promises.writeFile(testFile, JSON.stringify(testPayload), 'utf-8');
      const readBack = await fs.promises.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(readBack);
      if (parsed.nonce !== testPayload.nonce) {
        throw new Error('Persistence verification mismatch during readback');
      }
      await fs.promises.unlink(testFile);
    }

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
    const backupTimestamp = Date.now();

    if (isBlobStorageConfigured()) {
      await this.writeBlobJson(`data/backups/pre_restore_${backupTimestamp}.json`, autoBackup);
    } else {
      const backupDir = path.join(this.dataDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const autoBackupPath = path.join(backupDir, `pre_restore_${backupTimestamp}.json`);
      fs.writeFileSync(autoBackupPath, JSON.stringify(autoBackup, null, 2), 'utf-8');
    }

    if (Array.isArray(data.qr_codes)) {
      await this.saveQRCodes(data.qr_codes);
      await this.migrateExistingQRCodes();
    }
    if (Array.isArray(data.scans)) {
      if (isBlobStorageConfigured()) {
        for (const scan of data.scans) {
          const datePart = scan.date || scan.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];
          await this.writeBlobJson(`data/scans/${datePart}/${scan.scan_id}.json`, scan);
        }
        await this.writeBlobJson('data/scans.json', data.scans);
      } else {
        await this.writeLocalAtomic('scans.json', data.scans);
      }
    }
    if (Array.isArray(data.campaigns)) {
      await this.saveCampaigns(data.campaigns);
    }
    if (Array.isArray(data.visitors)) {
      await this.writeData('visitors.json', data.visitors);
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
    const oldScans = scans.filter((s) => s.timestamp < cutoffIso);
    const keptScans = scans.filter((s) => s.timestamp >= cutoffIso);
    const removedCount = oldScans.length;

    if (removedCount > 0) {
      if (isBlobStorageConfigured()) {
        for (const scan of oldScans) {
          const datePart = scan.date || scan.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];
          try {
            await del(`data/scans/${datePart}/${scan.scan_id}.json`);
          } catch {
            // ignore
          }
        }
        await this.writeBlobJson('data/scans.json', keptScans);
      } else {
        await this.writeLocalAtomic('scans.json', keptScans);
      }
    }
    return removedCount;
  }
}
