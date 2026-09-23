import { JsonDatabase, QRCodeItem, CampaignItem, ScanItem, VisitorLeadItem } from './jsonDatabase.js';
import crypto from 'crypto';

export async function seedInitialDataIfEmpty(): Promise<void> {
  const db = JsonDatabase.getInstance();
  const qrs = await db.getQRCodes();

  // If already seeded or has user data, don't overwrite
  if (qrs.length > 0) {
    return;
  }

  console.log('[AEVY] Initializing realistic demonstration dataset...');

  // 1. Initial Campaign
  const campaign: CampaignItem = {
    id: 'CAMP-000001',
    name: 'September Packaging 2026',
    description: 'First commercial bottling run of OCEANIS extrait de parfum with custom tactile packaging and luxury inserts.',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    status: 'active',
  };
  await db.createCampaign(campaign);

  const vipCampaign: CampaignItem = {
    id: 'CAMP-000002',
    name: 'VIP Autumn Allocation',
    description: 'Private olfactory tasting invitations and discovery vial distribution.',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    status: 'active',
  };
  await db.createCampaign(vipCampaign);

  // 2. Initial QR Codes
  const qrThankYou: QRCodeItem = {
    id: 'AEVY-QR-000001',
    name: 'AEVY Thank You Card',
    campaign_id: 'CAMP-000001',
    product: 'OCEANIS',
    placement: 'Thank You Card',
    description: 'Embossed heavy linen card inserted inside packaging with care rituals.',
    destination_url: 'https://aevy-fragrance.vercel.app/',
    status: 'active',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    scan_count: 0,
    enable_lead_capture: false,
    settings: {
      foreground: '#111111',
      background: '#FFFFFF',
      accent: '#C6A46A',
      error_correction: 'H',
      margin: 2,
      size: 400,
      logo: null,
    },
  };

  const qrBox: QRCodeItem = {
    id: 'AEVY-QR-000002',
    name: 'OCEANIS Flacon Box',
    campaign_id: 'CAMP-000001',
    product: 'OCEANIS',
    placement: 'Packaging Box',
    description: 'Underneath flacon base box with olfactory pyramid details.',
    destination_url: 'https://aevy-fragrance.vercel.app/',
    status: 'active',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    scan_count: 0,
    enable_lead_capture: false,
    settings: {
      foreground: '#111111',
      background: '#FAF8F5',
      accent: '#C6A46A',
      error_correction: 'H',
      margin: 2,
      size: 400,
      logo: null,
    },
  };

  const qrVip: QRCodeItem = {
    id: 'AEVY-QR-000003',
    name: 'VIP Fragrance Club Invitation',
    campaign_id: 'CAMP-000002',
    product: 'Signature Collection',
    placement: 'Envelope Wax Seal',
    description: 'Exclusive private allocation invitation card sealed with wax.',
    destination_url: 'https://aevy-fragrance.vercel.app/',
    status: 'active',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    scan_count: 0,
    enable_lead_capture: true,
    settings: {
      foreground: '#C6A46A',
      background: '#111111',
      accent: '#C6A46A',
      error_correction: 'H',
      margin: 2,
      size: 400,
      logo: null,
    },
  };

  await db.createQRCode(qrThankYou);
  await db.createQRCode(qrBox);
  await db.createQRCode(qrVip);

  // 3. Seed Realistic Scans (54 realistic scans spread over the past 14 days)
  const locations = [
    { country: 'Bangladesh', country_code: 'BD', city: 'Dhaka', region: 'Dhaka Division' },
    { country: 'Bangladesh', country_code: 'BD', city: 'Chittagong', region: 'Chittagong Division' },
    { country: 'Bangladesh', country_code: 'BD', city: 'Sylhet', region: 'Sylhet Division' },
    { country: 'United Kingdom', country_code: 'GB', city: 'London', region: 'England' },
    { country: 'United Arab Emirates', country_code: 'AE', city: 'Dubai', region: 'Dubai' },
    { country: 'United States', country_code: 'US', city: 'New York', region: 'New York' },
  ];

  const devices = [
    { device_type: 'Mobile', platform: 'iPhone', browser: 'Safari', browser_version: '17.4' },
    { device_type: 'Mobile', platform: 'Android', browser: 'Chrome', browser_version: '124.0' },
    { device_type: 'Mobile', platform: 'Android', browser: 'Samsung Internet', browser_version: '24.0' },
    { device_type: 'Desktop', platform: 'macOS', browser: 'Safari', browser_version: '17.3' },
    { device_type: 'Desktop', platform: 'Windows', browser: 'Chrome', browser_version: '124.0' },
    { device_type: 'Tablet', platform: 'iPad', browser: 'Safari', browser_version: '17.4' },
  ];

  const visitors = [
    'visitor_7f8a91b2c3d4e5f6',
    'visitor_2a4b6c8d0e1f3a5b',
    'visitor_9e8d7c6b5a4f3e2d',
    'visitor_1c3e5a7b9d0f2e4a',
    'visitor_8b6d4f2a0c9e7a5c',
    'visitor_5f4e3d2c1b0a9f8e',
    'visitor_3d2c1b0a9f8e7d6c',
  ];

  const now = Date.now();
  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let i = 0; i < 54; i++) {
    // Spread across past 14 days
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.5) * 13);
    const hour = Math.floor(10 + Math.random() * 12); // mostly afternoon/evening
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);

    const scanDate = new Date(now - daysAgo * 86400000);
    scanDate.setHours(hour, minute, second);

    const dateStr = scanDate.toISOString().split('T')[0];
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    const dayOfWeek = dayOfWeekNames[scanDate.getDay()];

    const loc = locations[i % locations.length];
    const dev = devices[i % devices.length];
    const vis = visitors[i % visitors.length];
    const qrTarget = i % 3 === 0 ? qrThankYou : i % 3 === 1 ? qrBox : qrVip;

    const ipHash = crypto.createHash('sha256').update(`seed_ip_${i % 18}`).digest('hex');

    const scan: ScanItem = {
      scan_id: `SCAN-${String(i + 1).padStart(6, '0')}`,
      qr_id: qrTarget.id,
      campaign_id: qrTarget.campaign_id,
      visitor_id: vis,
      timestamp: scanDate.toISOString(),
      date: dateStr,
      time: timeStr,
      timezone: 'Asia/Dhaka',
      day_of_week: dayOfWeek,
      hour,
      country: loc.country,
      country_code: loc.country_code,
      region: loc.region,
      city: loc.city,
      device_type: dev.device_type,
      platform: dev.platform,
      platform_version: '17',
      browser: dev.browser,
      browser_version: dev.browser_version,
      language: 'en-US',
      referrer: i % 4 === 0 ? 'https://instagram.com' : 'Direct Scan',
      ip_hash: ipHash,
    };

    await db.recordScan(scan);
  }

  // 4. Seed Realistic Voluntary Leads (4 leads in visitors.json)
  const leads: VisitorLeadItem[] = [
    {
      lead_id: 'LEAD-000001',
      qr_id: 'AEVY-QR-000003',
      campaign_id: 'CAMP-000002',
      visitor_id: visitors[0],
      name: 'Julian Montgomery',
      email: 'j.montgomery@alumni.harvard.edu',
      phone: '+880 1711-209841',
      notes: 'Interested in private 100ml flacon batch reserve.',
      created_at: new Date(now - 7 * 86400000).toISOString(),
      consent: true,
    },
    {
      lead_id: 'LEAD-000002',
      qr_id: 'AEVY-QR-000003',
      campaign_id: 'CAMP-000002',
      visitor_id: visitors[1],
      name: 'Sabrina Al-Hassan',
      email: 'sabrina.hassan@dubaiholdings.ae',
      phone: '+971 50 892 4110',
      notes: 'Requested sample discovery kit for boutique in DIFC.',
      created_at: new Date(now - 5 * 86400000).toISOString(),
      consent: true,
    },
    {
      lead_id: 'LEAD-000003',
      qr_id: 'AEVY-QR-000003',
      campaign_id: 'CAMP-000002',
      visitor_id: visitors[2],
      name: 'Tanvir Rahman',
      email: 'tanvir.rahman@nordicvillas.com',
      phone: '+880 1819-338219',
      notes: 'Wedding reception gifting consultation.',
      created_at: new Date(now - 2 * 86400000).toISOString(),
      consent: true,
    },
    {
      lead_id: 'LEAD-000004',
      qr_id: 'AEVY-QR-000001',
      campaign_id: 'CAMP-000001',
      visitor_id: visitors[3],
      name: 'Eleanor Vance',
      email: 'e.vance@chelseaarts.co.uk',
      phone: '+44 7700 900142',
      notes: 'Complementary note on the oceanic bergamot sillage.',
      created_at: new Date(now - 1 * 86400000).toISOString(),
      consent: true,
    },
  ];

  for (const lead of leads) {
    await db.recordVisitorLead(lead);
  }

  console.log('[AEVY] Initial dataset seeded successfully.');
}
