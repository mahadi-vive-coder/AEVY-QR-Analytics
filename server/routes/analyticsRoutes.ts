import { Router, Request, Response } from 'express';
import { JsonDatabase, ScanItem } from '../services/jsonDatabase.js';
import { requireAuth } from '../middleware.js';

export const analyticsRouter = Router();
const db = JsonDatabase.getInstance();

// Filter scans based on query parameters
function filterScans(scans: ScanItem[], query: Record<string, any>, timezone: string) {
  let list = [...scans];
  const {
    range,
    startDate,
    endDate,
    qr_id,
    campaign_id,
    device_type,
    browser,
    platform,
    country,
    city,
  } = query;

  if (qr_id) {
    list = list.filter((s) => s.qr_id.toLowerCase() === String(qr_id).toLowerCase());
  }

  if (campaign_id) {
    list = list.filter((s) => s.campaign_id === campaign_id);
  }

  if (device_type) {
    list = list.filter((s) => s.device_type.toLowerCase() === String(device_type).toLowerCase());
  }

  if (browser) {
    list = list.filter((s) => s.browser.toLowerCase() === String(browser).toLowerCase());
  }

  if (platform) {
    list = list.filter((s) => s.platform.toLowerCase() === String(platform).toLowerCase());
  }

  if (country) {
    list = list.filter((s) => s.country.toLowerCase() === String(country).toLowerCase());
  }

  if (city) {
    list = list.filter((s) => s.city.toLowerCase() === String(city).toLowerCase());
  }

  const now = new Date();

  if (range && range !== 'all') {
    const todayIso = now.toISOString().split('T')[0];

    if (range === 'today') {
      list = list.filter((s) => s.date === todayIso);
    } else if (range === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yIso = y.toISOString().split('T')[0];
      list = list.filter((s) => s.date === yIso);
    } else if (range === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      const cutoff = d.toISOString();
      list = list.filter((s) => s.timestamp >= cutoff);
    } else if (range === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      const cutoff = d.toISOString();
      list = list.filter((s) => s.timestamp >= cutoff);
    } else if (range === '90days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      const cutoff = d.toISOString();
      list = list.filter((s) => s.timestamp >= cutoff);
    } else if (range === 'this_month') {
      const currentMonth = todayIso.substring(0, 7);
      list = list.filter((s) => s.date.startsWith(currentMonth));
    } else if (range === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = d.toISOString().substring(0, 7);
      list = list.filter((s) => s.date.startsWith(lastMonthStr));
    }
  } else if (startDate || endDate) {
    if (startDate) {
      list = list.filter((s) => s.date >= String(startDate));
    }
    if (endDate) {
      list = list.filter((s) => s.date <= String(endDate));
    }
  }

  return list;
}

// Aggregation calculations
function aggregateAnalytics(scans: ScanItem[], allScans: ScanItem[], qrCodesCount: number) {
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];

  const weekCutoff = new Date(now);
  weekCutoff.setDate(weekCutoff.getDate() - 7);
  const weekIso = weekCutoff.toISOString();

  const monthStr = todayIso.substring(0, 7);

  // Overall metrics
  const totalScans = scans.length;
  const todayScans = allScans.filter((s) => s.date === todayIso).length;
  const thisWeekScans = allScans.filter((s) => s.timestamp >= weekIso).length;
  const thisMonthScans = allScans.filter((s) => s.date.startsWith(monthStr)).length;

  // Estimated unique visitors (distinct visitor_id)
  const uniqueVisitorIds = new Set<string>();
  scans.forEach((s) => {
    if (s.visitor_id) uniqueVisitorIds.add(s.visitor_id);
    else if (s.ip_hash) uniqueVisitorIds.add(s.ip_hash);
  });
  const estimatedUniqueVisitors = uniqueVisitorIds.size;

  // Scan trend by date
  const dateMap: Record<string, number> = {};
  scans.forEach((s) => {
    dateMap[s.date] = (dateMap[s.date] || 0) + 1;
  });

  const scanTrend = Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Location aggregations
  const countryMap: Record<string, number> = {};
  const cityMap: Record<string, number> = {};
  const regionMap: Record<string, number> = {};

  scans.forEach((s) => {
    const c = s.country || 'Unknown';
    const city = s.city && s.city !== 'Unknown' ? `${s.city}, ${s.country}` : 'Unknown';
    const reg = s.region || 'Unknown';

    countryMap[c] = (countryMap[c] || 0) + 1;
    cityMap[city] = (cityMap[city] || 0) + 1;
    regionMap[reg] = (regionMap[reg] || 0) + 1;
  });

  const topCountries = Object.entries(countryMap)
    .map(([name, count]) => ({ name, count, percentage: totalScans ? Math.round((count / totalScans) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const topCities = Object.entries(cityMap)
    .map(([name, count]) => ({ name, count, percentage: totalScans ? Math.round((count / totalScans) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // Device aggregations
  const deviceTypeMap: Record<string, number> = { Mobile: 0, Tablet: 0, Desktop: 0 };
  const platformMap: Record<string, number> = {};

  scans.forEach((s) => {
    const dType = s.device_type || 'Other';
    deviceTypeMap[dType] = (deviceTypeMap[dType] || 0) + 1;

    const plat = s.platform || 'Other';
    platformMap[plat] = (platformMap[plat] || 0) + 1;
  });

  const deviceTypes = Object.entries(deviceTypeMap).map(([name, count]) => ({
    name,
    count,
    percentage: totalScans ? Math.round((count / totalScans) * 100) : 0,
  }));

  const platforms = Object.entries(platformMap)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalScans ? Math.round((count / totalScans) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Browser aggregations
  const browserMap: Record<string, number> = {};
  scans.forEach((s) => {
    const b = s.browser || 'Other';
    browserMap[b] = (browserMap[b] || 0) + 1;
  });

  const browsers = Object.entries(browserMap)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalScans ? Math.round((count / totalScans) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Hourly distribution (00:00 to 23:00)
  const hourlyCounts = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    hourNumber: i,
    count: 0,
  }));

  scans.forEach((s) => {
    if (typeof s.hour === 'number' && s.hour >= 0 && s.hour < 24) {
      hourlyCounts[s.hour].count += 1;
    }
  });

  // Day of week distribution
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayMap: Record<string, number> = {};
  dayNames.forEach((d) => (dayMap[d] = 0));
  scans.forEach((s) => {
    if (s.day_of_week && dayMap[s.day_of_week] !== undefined) {
      dayMap[s.day_of_week] += 1;
    }
  });
  const daysOfWeek = dayNames.map((day) => ({ day, count: dayMap[day] || 0 }));

  return {
    overview: {
      total_qrcodes: qrCodesCount,
      total_scans: totalScans,
      today_scans: todayScans,
      this_week_scans: thisWeekScans,
      this_month_scans: thisMonthScans,
      estimated_unique_visitors: estimatedUniqueVisitors,
    },
    scan_trend: scanTrend,
    locations: {
      countries: topCountries,
      cities: topCities,
    },
    devices: {
      types: deviceTypes,
      platforms,
    },
    browsers,
    time_analytics: {
      hourly: hourlyCounts,
      days_of_week: daysOfWeek,
    },
  };
}

// GET /api/analytics - Dashboard overview and filtered analytics
analyticsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const scans = await db.getScans();
    const qrCodes = await db.getQRCodes();
    const campaigns = await db.getCampaigns();
    const settings = await db.getSettings();

    const filtered = filterScans(scans, req.query, settings.timezone || 'Asia/Dhaka');
    const analytics = aggregateAnalytics(filtered, scans, qrCodes.length);

    // Recent scans (last 25 from filtered or total)
    const qrNameMap = new Map(qrCodes.map((q) => [q.id.toLowerCase(), q.name]));
    const campaignNameMap = new Map(campaigns.map((c) => [c.id, c.name]));

    const recentScans = [...filtered]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 30)
      .map((s) => ({
        scan_id: s.scan_id,
        timestamp: s.timestamp,
        date: s.date,
        time: s.time,
        qr_id: s.qr_id,
        qr_name: qrNameMap.get(s.qr_id.toLowerCase()) || s.qr_id,
        campaign_name: campaignNameMap.get(s.campaign_id) || s.campaign_id || 'Direct',
        location: s.city && s.city !== 'Unknown' ? `${s.city}, ${s.country}` : s.country || 'Unknown',
        device_type: s.device_type,
        platform: s.platform,
        browser: s.browser,
        browser_version: s.browser_version,
        referrer: s.referrer || 'Direct Scan',
      }));

    res.json({
      ...analytics,
      recent_scans: recentScans,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/qr/:qrId - Detailed analytics for a specific QR code
analyticsRouter.get('/qr/:qrId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { qrId } = req.params;
    const qr = await db.getQRCodeById(qrId);

    if (!qr) {
      res.status(404).json({ error: 'QR Code not found' });
      return;
    }

    const allScans = await db.getScans();
    const qrScans = allScans.filter((s) => s.qr_id.toLowerCase() === qrId.toLowerCase());
    const settings = await db.getSettings();

    const filtered = filterScans(qrScans, req.query, settings.timezone || 'Asia/Dhaka');
    const analytics = aggregateAnalytics(filtered, qrScans, 1);

    // First scan & last scan
    let firstScan: string | null = null;
    let lastScan: string | null = null;
    if (qrScans.length > 0) {
      const sorted = [...qrScans].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      firstScan = sorted[0].timestamp;
      lastScan = sorted[sorted.length - 1].timestamp;
    }

    // Lead submissions for this QR code
    const visitors = await db.getVisitors();
    const qrLeads = visitors.filter((v) => v.qr_id.toLowerCase() === qrId.toLowerCase());

    res.json({
      qrCode: qr,
      first_scan: firstScan,
      last_scan: lastScan,
      ...analytics,
      leads: qrLeads,
      lead_count: qrLeads.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
