import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { JsonDatabase } from '../services/jsonDatabase.js';
import { requireAuth } from '../middleware.js';
import { isDevOrLocalUrl, normalizeBaseUrl } from '../services/urlService.js';

export const settingsRouter = Router();
const db = JsonDatabase.getInstance();

// Get settings + storage health preview
settingsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await db.getSettings();
    const storageHealth = await db.getStorageHealth();

    res.json({
      ...settings,
      ip_salt_preview: `${settings.ip_salt ? settings.ip_salt.substring(0, 6) : 'default'}••••••`,
      storageHealth,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
settingsRouter.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      business_name,
      tagline,
      timezone,
      default_foreground,
      default_background,
      default_accent,
      default_destination,
      app_url,
      data_retention_days,
      anonymize_ip,
      enable_lead_capture,
    } = req.body;

    const updates: Record<string, any> = {};

    if (business_name !== undefined) updates.business_name = String(business_name).trim();
    if (tagline !== undefined) updates.tagline = String(tagline).trim();
    if (timezone !== undefined) updates.timezone = String(timezone).trim();
    if (default_foreground !== undefined) updates.default_foreground = String(default_foreground).trim();
    if (default_background !== undefined) updates.default_background = String(default_background).trim();
    if (default_accent !== undefined) updates.default_accent = String(default_accent).trim();
    if (default_destination !== undefined) updates.default_destination = String(default_destination).trim();

    // Validation for APP_URL: Must NOT be a dev URL
    if (app_url !== undefined) {
      const cleanUrl = normalizeBaseUrl(String(app_url));
      if (!cleanUrl) {
        res.status(400).json({ error: 'Production APP_URL cannot be empty' });
        return;
      }
      try {
        const parsed = new URL(cleanUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          res.status(400).json({ error: 'APP_URL must use http:// or https://' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Invalid APP_URL format' });
        return;
      }

      if (isDevOrLocalUrl(cleanUrl)) {
        res.status(400).json({
          error:
            'Cannot use a development URL (ais-dev-*.run.app, localhost, 127.0.0.1) as the production QR tracking URL. Please configure a custom domain (e.g. https://qr.aevyfragrance.com).',
        });
        return;
      }

      updates.app_url = cleanUrl;
    }

    if (data_retention_days !== undefined) updates.data_retention_days = Number(data_retention_days);
    if (anonymize_ip !== undefined) updates.anonymize_ip = Boolean(anonymize_ip);
    if (enable_lead_capture !== undefined) updates.enable_lead_capture = Boolean(enable_lead_capture);

    const updated = await db.updateSettings(updates);
    const health = await db.getStorageHealth();

    res.json({
      settings: updated,
      storageHealth: health,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Storage Health Endpoint (Requirement 17)
settingsRouter.get('/storage-health', requireAuth, async (req: Request, res: Response) => {
  try {
    const health = await db.getStorageHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Storage Write & Read Persistence
settingsRouter.post('/verify-storage', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.verifyStorageWriteRead();
    const health = await db.getStorageHealth();
    res.json({
      success: true,
      message: 'Storage persistence verified successfully: Atomic write & read cycle completed.',
      result,
      storageHealth: health,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Storage verification failed: ${err.message}` });
  }
});

// Rotate IP salt
settingsRouter.post('/rotate-salt', requireAuth, async (req: Request, res: Response) => {
  try {
    const newSalt = crypto.randomBytes(16).toString('hex');
    const updated = await db.updateSettings({ ip_salt: newSalt });
    res.json({ success: true, message: 'IP salt rotated successfully', settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
