import { Router, Request, Response } from 'express';
import { JsonDatabase, CampaignItem } from '../services/jsonDatabase.js';
import { requireAuth } from '../middleware.js';

export const campaignRouter = Router();
const db = JsonDatabase.getInstance();

// List all campaigns with stats
campaignRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaigns = await db.getCampaigns();
    const qrCodes = await db.getQRCodes();
    const scans = await db.getScans();

    const enriched = campaigns.map((camp) => {
      const campQrs = qrCodes.filter((q) => q.campaign_id === camp.id);
      const campQrIds = new Set(campQrs.map((q) => q.id.toLowerCase()));
      const campScans = scans.filter((s) => s.campaign_id === camp.id || campQrIds.has(s.qr_id.toLowerCase()));

      const uniqueVisitors = new Set(campScans.map((s) => s.visitor_id || s.ip_hash)).size;

      return {
        ...camp,
        qr_count: campQrs.length,
        total_scans: campScans.length,
        estimated_unique_visitors: uniqueVisitors,
      };
    });

    res.json({ campaigns: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single campaign
campaignRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaigns = await db.getCampaigns();
    const camp = campaigns.find((c) => c.id === req.params.id);

    if (!camp) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const qrCodes = await db.getQRCodes();
    const campQrs = qrCodes.filter((q) => q.campaign_id === camp.id);
    const campQrIds = new Set(campQrs.map((q) => q.id.toLowerCase()));

    const scans = await db.getScans();
    const campScans = scans.filter((s) => s.campaign_id === camp.id || campQrIds.has(s.qr_id.toLowerCase()));

    res.json({
      campaign: camp,
      qr_codes: campQrs,
      total_scans: campScans.length,
      estimated_unique_visitors: new Set(campScans.map((s) => s.visitor_id || s.ip_hash)).size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create campaign
campaignRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, status } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Campaign Name is required' });
      return;
    }

    const nextId = await db.generateNextCampaignId();
    const campaign: CampaignItem = {
      id: nextId,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      created_at: new Date().toISOString(),
      status: status === 'completed' || status === 'archived' ? status : 'active',
    };

    const created = await db.createCampaign(campaign);
    res.status(201).json({ campaign: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update campaign
campaignRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const updates: Partial<CampaignItem> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (status !== undefined && ['active', 'completed', 'archived'].includes(status)) {
      updates.status = status;
    }

    const updated = await db.updateCampaign(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({ campaign: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete campaign
campaignRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteCampaign(id);
    if (!deleted) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
