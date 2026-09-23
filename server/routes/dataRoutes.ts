import { Router, Request, Response } from 'express';
import { JsonDatabase } from '../services/jsonDatabase.js';
import { requireAuth } from '../middleware.js';

export const dataRouter = Router();
const db = JsonDatabase.getInstance();

// Helper to convert array of objects to CSV
function convertToCsv(items: Record<string, any>[]): string {
  if (items.length === 0) return '';
  const headers = Object.keys(items[0]);
  const csvRows: string[] = [];

  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  for (const item of items) {
    const row = headers.map((header) => {
      let val = item[header];
      if (val === null || val === undefined) val = '';
      else if (typeof val === 'object') val = JSON.stringify(val);
      else val = String(val);
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  }

  return csvRows.join('\r\n');
}

// Export JSON
dataRouter.get('/export/json', requireAuth, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (type === 'qr') {
      const qrs = await db.getQRCodes();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_qr_codes_${timestamp}.json"`);
      res.json(qrs);
    } else if (type === 'scans') {
      const scans = await db.getScans();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_scans_${timestamp}.json"`);
      res.json(scans);
    } else if (type === 'visitors') {
      const visitors = await db.getVisitors();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_visitors_${timestamp}.json"`);
      res.json(visitors);
    } else {
      // Export all
      const backup = await db.getFullBackup();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_full_export_${timestamp}.json"`);
      res.json(backup);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export CSV
dataRouter.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (type === 'qr') {
      const qrs = await db.getQRCodes();
      const flat = qrs.map((q) => ({
        id: q.id,
        name: q.name,
        campaign_id: q.campaign_id,
        product: q.product,
        placement: q.placement,
        destination_url: q.destination_url,
        status: q.status,
        scan_count: q.scan_count,
        created_at: q.created_at,
        last_scanned_at: q.last_scanned_at || '',
      }));
      const csv = convertToCsv(flat);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_qr_codes_${timestamp}.csv"`);
      res.send(csv);
    } else if (type === 'visitors') {
      const visitors = await db.getVisitors();
      const csv = convertToCsv(visitors);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_visitors_${timestamp}.csv"`);
      res.send(csv);
    } else {
      // Default: export scans as CSV
      const scans = await db.getScans();
      const flatScans = scans.map((s) => ({
        scan_id: s.scan_id,
        qr_id: s.qr_id,
        campaign_id: s.campaign_id,
        date: s.date,
        time: s.time,
        timestamp: s.timestamp,
        timezone: s.timezone,
        country: s.country,
        city: s.city,
        region: s.region,
        device_type: s.device_type,
        platform: s.platform,
        browser: s.browser,
        browser_version: s.browser_version,
        referrer: s.referrer,
        visitor_id: s.visitor_id,
      }));
      const csv = convertToCsv(flatScans);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="aevy_scans_${timestamp}.csv"`);
      res.send(csv);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full Backup download
dataRouter.get('/backup/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const backup = await db.getFullBackup();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="aevy_backup_${timestamp}.json"`);
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backup Validate / Preview before restore
dataRouter.post('/backup/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { backupData } = req.body;
    let parsed: any;

    if (typeof backupData === 'string') {
      try {
        parsed = JSON.parse(backupData);
      } catch {
        res.status(400).json({ error: 'Invalid JSON format in backup file' });
        return;
      }
    } else {
      parsed = backupData;
    }

    if (!parsed || typeof parsed !== 'object') {
      res.status(400).json({ error: 'Uploaded file is not a valid JSON object' });
      return;
    }

    const preview = {
      version: parsed.version || 'unknown',
      exported_at: parsed.exported_at || 'unknown',
      qr_codes_count: Array.isArray(parsed.qr_codes) ? parsed.qr_codes.length : 0,
      scans_count: Array.isArray(parsed.scans) ? parsed.scans.length : 0,
      campaigns_count: Array.isArray(parsed.campaigns) ? parsed.campaigns.length : 0,
      visitors_count: Array.isArray(parsed.visitors) ? parsed.visitors.length : 0,
      has_settings: Boolean(parsed.settings),
    };

    res.json({ valid: true, preview });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restore from Backup
dataRouter.post('/backup/restore', requireAuth, async (req: Request, res: Response) => {
  try {
    const { backupData, confirm } = req.body;
    if (!confirm) {
      res.status(400).json({ error: 'Restore confirmation required' });
      return;
    }

    let parsed: any;
    if (typeof backupData === 'string') {
      parsed = JSON.parse(backupData);
    } else {
      parsed = backupData;
    }

    const result = await db.restoreBackup(parsed);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run Data Retention Cleanup
dataRouter.post('/retention/cleanup', requireAuth, async (req: Request, res: Response) => {
  try {
    const removed = await db.cleanOldData();
    res.json({ success: true, removedScans: removed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
