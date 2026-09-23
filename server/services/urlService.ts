import { Request } from 'express';
import { JsonDatabase } from './jsonDatabase.js';

/**
 * Checks if a URL string is an ephemeral Cloud Run development preview or local URL
 * per requirements: Never use ais-dev-*.run.app, localhost, or 127.0.0.1 as a production QR URL.
 */
export function isDevOrLocalUrl(urlStr: string | undefined | null): boolean {
  if (!urlStr) return false;
  const lower = urlStr.trim().toLowerCase();
  return (
    lower.includes('ais-dev-') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    (lower.includes('.run.app') && lower.includes('-dev-')) ||
    lower.includes('.aistudio-preview.')
  );
}

/**
 * Clean and normalize a base URL (strip trailing slashes, remove whitespace)
 */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export interface AppUrlResolution {
  baseUrl: string;
  source: 'env' | 'settings' | 'default';
  isDevWarning: boolean;
  errorMessage?: string;
}

/**
 * Resolves the production APP_URL for dynamic QR tracking.
 *
 * Rules:
 * 1. The application must NEVER hardcode or generate QR codes using ais-dev-*.run.app, localhost, or 127.0.0.1.
 * 2. If APP_URL is configured in process.env and is a valid production domain, use it.
 * 3. Otherwise, check settings.app_url in settings.json (which defaults to https://qr.aevyfragrance.com).
 * 4. If in production and APP_URL is missing or a dev URL, return a clear configuration error.
 */
export async function getResolvedAppUrl(req?: Request): Promise<AppUrlResolution> {
  const envUrl = process.env.APP_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Check process.env.APP_URL if valid production domain
  if (envUrl && !isDevOrLocalUrl(envUrl)) {
    return {
      baseUrl: normalizeBaseUrl(envUrl),
      source: 'env',
      isDevWarning: false,
    };
  }

  // 2. Check settings.app_url stored in JSON database
  try {
    const db = JsonDatabase.getInstance();
    const settings = await db.getSettings();
    if (settings.app_url && !isDevOrLocalUrl(settings.app_url)) {
      return {
        baseUrl: normalizeBaseUrl(settings.app_url),
        source: 'settings',
        isDevWarning: false,
      };
    }
  } catch (err) {
    console.error('[urlService] Error reading settings for app_url:', err);
  }

  // 3. Fallback default brand domain
  const fallbackDomain = 'https://qr.aevyfragrance.com';

  if (isProduction && (!envUrl || isDevOrLocalUrl(envUrl))) {
    return {
      baseUrl: fallbackDomain,
      source: 'default',
      isDevWarning: true,
      errorMessage:
        'SERVER CONFIGURATION ERROR: APP_URL is missing or using a development URL in production. Never use ais-dev-*.run.app, localhost, or 127.0.0.1. Configure APP_URL=https://qr.aevyfragrance.com.',
    };
  }

  return {
    baseUrl: fallbackDomain,
    source: 'default',
    isDevWarning: false,
  };
}

/**
 * Generate a dynamic QR URL using ${APP_URL}/q/${qrId}
 * Example: https://qr.aevyfragrance.com/q/AEVY-QR-000004
 */
export async function buildDynamicTrackingUrl(qrId: string, customBaseUrl?: string): Promise<string> {
  if (customBaseUrl && !isDevOrLocalUrl(customBaseUrl)) {
    return `${normalizeBaseUrl(customBaseUrl)}/q/${qrId}`;
  }
  const resolved = await getResolvedAppUrl();
  return `${resolved.baseUrl}/q/${qrId}`;
}
