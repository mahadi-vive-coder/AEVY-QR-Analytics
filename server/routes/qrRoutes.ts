import { Router, Request, Response } from 'express';
import { JsonDatabase, QRCodeItem } from '../services/jsonDatabase.js';
import { requireAuth } from '../middleware.js';
import {
  generateQrDataUrl,
  generateQrPngBuffer,
  generateQrSvgString,
} from '../services/qrService.js';
import {
  getResolvedAppUrl,
  buildDynamicTrackingUrl,
} from '../services/urlService.js';

export const qrRouter = Router();
const db = JsonDatabase.getInstance();

// All QR Codes (Admin only)
qrRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await db.getQRCodes();
    const { campaign, status, search } = req.query;
    const { baseUrl, isDevWarning, errorMessage } = await getResolvedAppUrl(req);

    let filtered = [...list];

    if (campaign) {
      filtered = filtered.filter((q) => q.campaign_id === campaign);
    }
    if (status) {
      filtered = filtered.filter((q) => q.status === status);
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.product.toLowerCase().includes(q) ||
          item.placement.toLowerCase().includes(q) ||
          item.destination_url.toLowerCase().includes(q)
      );
    }

    // Attach dynamic tracking_url to response without storing in DB
    const enriched = filtered.map((item) => ({
      ...item,
      tracking_url: `${baseUrl}/q/${item.id}`,
    }));

    res.json({
      qrCodes: enriched,
      total: enriched.length,
      app_url: baseUrl,
      isDevWarning,
      configError: errorMessage || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single QR Code
qrRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const item = await db.getQRCodeById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'QR Code not found' });
      return;
    }
    const { baseUrl } = await getResolvedAppUrl(req);
    const trackingUrl = `${baseUrl}/q/${item.id}`;

    res.json({
      qrCode: {
        ...item,
        tracking_url: trackingUrl,
      },
      trackingUrl,
      appUrl: baseUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create QR Code
qrRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      campaign_id,
      product,
      placement,
      description,
      destination_url,
      status,
      start_date,
      expiry_date,
      enable_lead_capture,
      settings,
    } = req.body;

    if (!name || !destination_url) {
      res.status(400).json({ error: 'QR Name and Destination URL are required' });
      return;
    }

    // Basic URL validation
    try {
      const parsed = new URL(destination_url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).json({ error: 'Destination URL must use http:// or https://' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Invalid destination URL format' });
      return;
    }

    const appSettings = await db.getSettings();
    const nextId = await db.generateNextQRId();

    // Store ONLY the QR ID and QR configuration (Requirement 3: Never store hardcoded tracking URL in DB)
    const newQR: QRCodeItem = {
      id: nextId,
      name: String(name).trim(),
      campaign_id: campaign_id || '',
      product: product ? String(product).trim() : 'AEVY Signature',
      placement: placement ? String(placement).trim() : 'Packaging',
      description: description ? String(description).trim() : '',
      destination_url: String(destination_url).trim(),
      status: status === 'paused' ? 'paused' : 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      start_date: start_date || null,
      expiry_date: expiry_date || null,
      scan_count: 0,
      enable_lead_capture: Boolean(enable_lead_capture),
      settings: {
        foreground: settings?.foreground || appSettings.default_foreground || '#111111',
        background: settings?.background || appSettings.default_background || '#FFFFFF',
        accent: settings?.accent || appSettings.default_accent || '#C6A46A',
        error_correction: settings?.error_correction || 'H',
        margin: settings?.margin !== undefined ? Number(settings.margin) : 2,
        size: settings?.size ? Number(settings.size) : 400,
        logo: settings?.logo || null,
      },
    };

    const created = await db.createQRCode(newQR);
    const trackingUrl = await buildDynamicTrackingUrl(created.id);

    res.status(201).json({
      qrCode: {
        ...created,
        tracking_url: trackingUrl,
      },
      trackingUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update QR Code (Admin can change destination URL anytime without breaking existing printed QR codes)
qrRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.getQRCodeById(id);
    if (!existing) {
      res.status(404).json({ error: 'QR Code not found' });
      return;
    }

    const {
      name,
      campaign_id,
      product,
      placement,
      description,
      destination_url,
      status,
      start_date,
      expiry_date,
      enable_lead_capture,
      settings,
    } = req.body;

    if (destination_url) {
      try {
        const parsed = new URL(destination_url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          res.status(400).json({ error: 'Destination URL must use http:// or https://' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Invalid destination URL format' });
        return;
      }
    }

    const updates: Partial<QRCodeItem> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (campaign_id !== undefined) updates.campaign_id = String(campaign_id);
    if (product !== undefined) updates.product = String(product).trim();
    if (placement !== undefined) updates.placement = String(placement).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (destination_url !== undefined) updates.destination_url = String(destination_url).trim();
    if (status !== undefined && ['active', 'paused', 'archived'].includes(status)) {
      updates.status = status;
    }
    if (start_date !== undefined) updates.start_date = start_date || null;
    if (expiry_date !== undefined) updates.expiry_date = expiry_date || null;
    if (enable_lead_capture !== undefined) updates.enable_lead_capture = Boolean(enable_lead_capture);

    if (settings) {
      updates.settings = {
        ...existing.settings,
        ...settings,
      };
    }

    const updated = await db.updateQRCode(id, updates);
    const trackingUrl = await buildDynamicTrackingUrl(id);

    res.json({
      qrCode: {
        ...updated,
        tracking_url: trackingUrl,
      },
      trackingUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Status
qrRouter.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'paused', 'archived'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be active, paused, or archived.' });
      return;
    }
    const updated = await db.updateQRCode(id, { status });
    if (!updated) {
      res.status(404).json({ error: 'QR Code not found' });
      return;
    }
    const trackingUrl = await buildDynamicTrackingUrl(id);
    res.json({
      qrCode: {
        ...updated,
        tracking_url: trackingUrl,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate QR Code
qrRouter.post('/:id/duplicate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const original = await db.getQRCodeById(id);
    if (!original) {
      res.status(404).json({ error: 'Source QR Code not found' });
      return;
    }

    const nextId = await db.generateNextQRId();
    const duplicated: QRCodeItem = {
      ...original,
      id: nextId,
      name: `${original.name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scan_count: 0,
      last_scanned_at: null,
    };

    const created = await db.createQRCode(duplicated);
    const trackingUrl = await buildDynamicTrackingUrl(created.id);
    res.status(201).json({
      qrCode: {
        ...created,
        tracking_url: trackingUrl,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete QR Code
qrRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      const deleted = await db.deleteQRCode(id);
      if (!deleted) {
        res.status(404).json({ error: 'QR Code not found' });
        return;
      }
      res.json({ success: true, message: 'QR Code permanently deleted' });
    } else {
      // Soft-delete / archive by default to preserve scan history
      const updated = await db.updateQRCode(id, { status: 'archived' });
      if (!updated) {
        res.status(404).json({ error: 'QR Code not found' });
        return;
      }
      res.json({ success: true, message: 'QR Code archived to preserve historical scans' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Preview render (Data URL) - Uses dynamic tracking URL
qrRouter.get('/:id/render', async (req: Request, res: Response) => {
  try {
    const item = await db.getQRCodeById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'QR Code not found' });
      return;
    }

    const trackingUrl = await buildDynamicTrackingUrl(item.id);

    const dataUrl = await generateQrDataUrl(trackingUrl, {
      foreground: item.settings.foreground,
      background: item.settings.background,
      errorCorrectionLevel: item.settings.error_correction,
      margin: item.settings.margin,
      width: item.settings.size,
    });

    res.json({ dataUrl, trackingUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download QR Code (PNG or SVG) - Uses dynamic tracking URL
qrRouter.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
    const item = await db.getQRCodeById(id);

    if (!item) {
      res.status(404).send('QR Code not found');
      return;
    }

    const trackingUrl = await buildDynamicTrackingUrl(item.id);
    const filename = `${item.id.toLowerCase()}_${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;

    if (format === 'svg') {
      const svg = await generateQrSvgString(trackingUrl, {
        foreground: item.settings.foreground,
        background: item.settings.background,
        errorCorrectionLevel: item.settings.error_correction,
        margin: item.settings.margin,
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(svg);
    } else {
      const pngBuffer = await generateQrPngBuffer(trackingUrl, {
        foreground: item.settings.foreground,
        background: item.settings.background,
        errorCorrectionLevel: item.settings.error_correction,
        margin: item.settings.margin,
        width: 1200, // High quality for print/packaging
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pngBuffer);
    }
  } catch (err: any) {
    res.status(500).send('Error generating QR download');
  }
});
