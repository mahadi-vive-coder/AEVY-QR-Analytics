export interface QRCodeItem {
  id: string;
  name: string;
  campaign_id: string;
  product: string;
  placement: string;
  description: string;
  destination_url: string;
  tracking_url?: string;
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
  qr_name?: string;
  campaign_id: string;
  campaign_name?: string;
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
  referrer: string;
  ip_hash: string;
  location?: string;
}

export interface CampaignItem {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: 'active' | 'completed' | 'archived';
  qr_count?: number;
  total_scans?: number;
  estimated_unique_visitors?: number;
}

export interface VisitorLeadItem {
  lead_id: string;
  qr_id: string;
  qr_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  scan_id?: string;
  visitor_id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  consent: boolean;
}

export interface StorageHealth {
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

export interface AppSettings {
  business_name: string;
  tagline: string;
  timezone: string;
  default_foreground: string;
  default_background: string;
  default_accent: string;
  default_destination: string;
  app_url?: string;
  ip_salt?: string;
  ip_salt_preview?: string;
  data_retention_days: number;
  anonymize_ip: boolean;
  enable_lead_capture: boolean;
  storageHealth?: StorageHealth;
}

export interface AnalyticsData {
  overview: {
    total_qrcodes: number;
    total_scans: number;
    today_scans: number;
    this_week_scans: number;
    this_month_scans: number;
    estimated_unique_visitors: number;
  };
  scan_trend: Array<{ date: string; count: number }>;
  locations: {
    countries: Array<{ name: string; count: number; percentage: number }>;
    cities: Array<{ name: string; count: number; percentage: number }>;
  };
  devices: {
    types: Array<{ name: string; count: number; percentage: number }>;
    platforms: Array<{ name: string; count: number; percentage: number }>;
  };
  browsers: Array<{ name: string; count: number; percentage: number }>;
  time_analytics: {
    hourly: Array<{ hour: string; hourNumber: number; count: number }>;
    days_of_week: Array<{ day: string; count: number }>;
  };
  recent_scans?: ScanItem[];
}

export interface UserSession {
  id: string;
  username: string;
  email: string;
  last_login?: string;
}
