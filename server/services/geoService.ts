import crypto from 'crypto';

export interface GeoLocationResult {
  country: string;
  country_code: string;
  region: string;
  city: string;
}

// In-memory cache for resolved IP locations to avoid redundant API queries
const geoCache = new Map<string, GeoLocationResult>();

export function extractClientIp(headers: Record<string, any>, remoteAddress?: string): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const list = String(forwarded).split(',');
    if (list.length > 0 && list[0].trim()) {
      return list[0].trim();
    }
  }
  const realIp = headers['x-real-ip'];
  if (realIp) return String(realIp).trim();
  const cfIp = headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();
  return remoteAddress || '127.0.0.1';
}

export function hashIp(ip: string, salt: string): string {
  return crypto
    .createHmac('sha256', salt || 'aevy_fixed_salt_default')
    .update(ip)
    .digest('hex')
    .substring(0, 16);
}

export function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '');
  if (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean) ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  return false;
}

export async function lookupIpLocation(
  ip: string,
  apiKey?: string
): Promise<GeoLocationResult> {
  const unknownResult: GeoLocationResult = {
    country: 'Unknown',
    country_code: 'XX',
    region: 'Unknown',
    city: 'Unknown',
  };

  if (!ip || isPrivateOrLocalIp(ip)) {
    // For local testing in development, mark as local approximate
    return {
      country: 'Local Network',
      country_code: 'LO',
      region: 'Development',
      city: 'Localhost',
    };
  }

  const cleanIp = ip.replace(/^::ffff:/, '');

  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200); // 1.2s max to never stall

    let url = `https://ipapi.co/${cleanIp}/json/`;
    if (apiKey) {
      url += `?key=${encodeURIComponent(apiKey)}`;
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AEVY-QR-Analytics/1.0' },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (!data.error) {
        const result: GeoLocationResult = {
          country: data.country_name || 'Unknown',
          country_code: data.country_code || 'XX',
          region: data.region || data.region_code || 'Unknown',
          city: data.city || 'Unknown',
        };
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch {
    // Fallback quietly on network error/timeout
  }

  return unknownResult;
}
