import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { JsonDatabase, ScanItem } from '../services/jsonDatabase.js';
import { parseUserAgent } from '../services/deviceService.js';
import { extractClientIp, hashIp, lookupIpLocation } from '../services/geoService.js';
import { rateLimitScans } from '../middleware.js';

export const trackingRouter = Router();
const db = JsonDatabase.getInstance();

// Format date and time in configured timezone
function getFormattedDateTime(dateObj: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long',
    });

    const parts = formatter.formatToParts(dateObj);
    const map: Record<string, string> = {};
    parts.forEach((p) => {
      map[p.type] = p.value;
    });

    const dateStr = `${map.year}-${map.month}-${map.day}`;
    const timeStr = `${map.hour}:${map.minute}:${map.second}`;
    const hourNum = parseInt(map.hour, 10) || 0;
    const dayOfWeek = map.weekday || 'Wednesday';

    return {
      date: dateStr,
      time: timeStr,
      hour: hourNum,
      day_of_week: dayOfWeek,
      timestamp: dateObj.toISOString(),
    };
  } catch {
    // Fallback if timezone string is invalid
    const iso = dateObj.toISOString();
    return {
      date: iso.split('T')[0],
      time: iso.split('T')[1].split('.')[0],
      hour: dateObj.getUTCHours(),
      day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getUTCDay()],
      timestamp: iso,
    };
  }
}

// Generate luxury branded fallback/notice page HTML
function renderAevyNoticePage(title: string, message: string, detail?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | AEVY</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F7F5F0;
      color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #FFFFFF;
      max-width: 460px;
      width: 100%;
      padding: 48px 36px;
      border: 1px solid rgba(0,0,0,0.06);
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.02);
    }
    .brand {
      font-family: Georgia, serif;
      font-size: 26px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-weight: 500;
      margin-bottom: 6px;
      color: #111111;
    }
    .tagline {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #888888;
      margin-bottom: 32px;
    }
    .divider {
      width: 36px;
      height: 1px;
      background: #C6A46A;
      margin: 0 auto 32px auto;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: -0.01em;
    }
    .message {
      font-size: 14px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 32px;
    }
    .detail {
      font-size: 12px;
      color: #999999;
      margin-top: 16px;
    }
    .btn {
      display: inline-block;
      background: #111111;
      color: #FFFFFF;
      text-decoration: none;
      padding: 12px 28px;
      font-size: 13px;
      letter-spacing: 0.05em;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">AEVY</div>
    <div class="tagline">Essence of Fresh Elegance</div>
    <div class="divider"></div>
    <div class="title">${title}</div>
    <div class="message">${message}</div>
    <a href="https://aevy-fragrance.vercel.app/" class="btn">Visit Official Store</a>
    ${detail ? `<div class="detail">${detail}</div>` : ''}
  </div>
</body>
</html>`;
}

// GET /q/:qrId - Fast dynamic tracking & redirect
trackingRouter.get('/q/:qrId', rateLimitScans, async (req: Request, res: Response) => {
  const qrId = req.params.qrId;

  try {
    const qr = await db.getQRCodeById(qrId);

    if (!qr) {
      res.status(404).send(
        renderAevyNoticePage(
          'QR Code Not Found',
          'The fragrance experience or product QR code you scanned could not be found or has been moved.',
          `Reference ID: ${qrId}`
        )
      );
      return;
    }

    // Check status
    if (qr.status === 'paused') {
      res.status(403).send(
        renderAevyNoticePage(
          'Campaign Paused',
          'This QR code campaign is currently paused. Please check back soon or explore our main boutique.',
          `Campaign ID: ${qr.campaign_id || 'Direct'}`
        )
      );
      return;
    }

    if (qr.status === 'archived') {
      res.status(410).send(
        renderAevyNoticePage(
          'Experience Concluded',
          'This product QR code campaign has concluded. Thank you for your interest in AEVY fragrances.',
          `Reference: ${qr.id}`
        )
      );
      return;
    }

    // Check expiry
    const now = new Date();
    if (qr.expiry_date && new Date(qr.expiry_date) < now) {
      res.status(410).send(
        renderAevyNoticePage(
          'Campaign Expired',
          'This packaging QR code offer has expired. Discover our latest creations on our boutique site.',
          `Expired on: ${qr.expiry_date.split('T')[0]}`
        )
      );
      return;
    }

    // Anonymous Visitor Identification: Check or set first-party cookie
    let visitorId = req.cookies?.aevy_vid;
    if (!visitorId || typeof visitorId !== 'string' || !visitorId.startsWith('visitor_')) {
      visitorId = `visitor_${crypto.randomBytes(8).toString('hex')}`;
      res.cookie('aevy_vid', visitorId, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    const settings = await db.getSettings();
    const clientIp = extractClientIp(req.headers, req.socket.remoteAddress);
    const ipHash = hashIp(clientIp, settings.ip_salt);

    const ua = req.headers['user-agent'] || '';
    const device = parseUserAgent(ua);
    const referrer = (req.headers.referer || req.headers.referrer || '') as string;
    const language = (req.headers['accept-language'] || '').split(',')[0] || 'en';

    const formattedTime = getFormattedDateTime(now, settings.timezone || 'Asia/Dhaka');

    // Record analytics before redirecting so the scan is guaranteed to be saved immediately
    try {
      const scanId = await db.generateNextScanId();
      // Quick location lookup with fast fallback
      const location = await Promise.race([
        lookupIpLocation(clientIp, process.env.GEOLOCATION_API_KEY),
        new Promise<any>((resolve) =>
          setTimeout(
            () =>
              resolve({
                country: 'Bangladesh',
                country_code: 'BD',
                region: 'Dhaka Division',
                city: 'Dhaka',
              }),
            400
          )
        ),
      ]);

      const scanRecord: ScanItem = {
        scan_id: scanId,
        qr_id: qr.id,
        campaign_id: qr.campaign_id || '',
        visitor_id: visitorId,
        timestamp: formattedTime.timestamp,
        date: formattedTime.date,
        time: formattedTime.time,
        timezone: settings.timezone || 'Asia/Dhaka',
        day_of_week: formattedTime.day_of_week,
        hour: formattedTime.hour,
        country: location.country,
        country_code: location.country_code,
        region: location.region,
        city: location.city,
        device_type: device.device_type,
        platform: device.platform,
        platform_version: device.platform_version,
        browser: device.browser,
        browser_version: device.browser_version,
        language,
        referrer,
        ip_hash: ipHash,
      };

      await db.recordScan(scanRecord);
    } catch (analyticsErr) {
      console.error('Error logging scan analytics:', analyticsErr);
    }

    // Check if lead capture is enabled on this QR code
    if (qr.enable_lead_capture) {
      // If lead capture is enabled, visitor can be offered optional VIP fragrance lead signup
      // or directly proceed to destination with lead capture parameter
      const leadUrl = `/lead-capture?qr=${encodeURIComponent(qr.id)}&dest=${encodeURIComponent(qr.destination_url)}&camp=${encodeURIComponent(qr.campaign_id || '')}`;
      res.redirect(302, leadUrl);
      return;
    }

    // Direct fast redirect
    res.redirect(302, qr.destination_url);
  } catch (err: any) {
    console.error('Error in QR redirect:', err);
    res.status(500).send(
      renderAevyNoticePage(
        'Temporary Service Interruption',
        'We encountered a momentary issue processing your request. Please try again or visit our homepage.'
      )
    );
  }
});

// Voluntary Lead Capture Submission
trackingRouter.post('/api/leads', async (req: Request, res: Response) => {
  try {
    const { qr_id, campaign_id, scan_id, name, email, phone, notes, consent } = req.body;

    if (!consent) {
      res.status(400).json({ error: 'Consent is required to submit your information' });
      return;
    }

    if (!name || (!email && !phone)) {
      res.status(400).json({ error: 'Name and either email or phone number are required' });
      return;
    }

    const visitorId = req.cookies?.aevy_vid || `visitor_${crypto.randomBytes(8).toString('hex')}`;
    const leadId = await db.generateNextLeadId();

    const leadItem = {
      lead_id: leadId,
      qr_id: qr_id || 'UNKNOWN',
      campaign_id: campaign_id || '',
      scan_id: scan_id || '',
      visitor_id: visitorId,
      name: String(name).trim(),
      email: email ? String(email).trim().toLowerCase() : '',
      phone: phone ? String(phone).trim() : '',
      notes: notes ? String(notes).trim() : '',
      created_at: new Date().toISOString(),
      consent: Boolean(consent),
    };

    const saved = await db.recordVisitorLead(leadItem);
    res.status(201).json({ success: true, lead: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
