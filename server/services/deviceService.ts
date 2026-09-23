export interface DeviceInfo {
  device_type: 'Mobile' | 'Tablet' | 'Desktop';
  platform: 'Android' | 'iPhone' | 'iPad' | 'Windows' | 'macOS' | 'Linux' | 'Other';
  platform_version: string;
  browser: 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Opera' | 'Samsung Internet' | 'Other';
  browser_version: string;
}

export function parseUserAgent(uaString: string = ''): DeviceInfo {
  const ua = uaString.trim();

  // 1. Device Type & Platform
  let device_type: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';
  let platform: 'Android' | 'iPhone' | 'iPad' | 'Windows' | 'macOS' | 'Linux' | 'Other' = 'Other';
  let platform_version = '';

  const isIpad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && 'maxTouchPoints' in (globalThis as any) && (globalThis as any).maxTouchPoints > 1);
  const isIphone = /iphone|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isWindows = /windows nt/i.test(ua);
  const isMac = /macintosh|mac os x/i.test(ua);
  const isLinux = /linux/i.test(ua) && !isAndroid;

  if (isIpad) {
    device_type = 'Tablet';
    platform = 'iPad';
    const match = ua.match(/OS (\d+[_\d]*)/i);
    if (match) platform_version = match[1].replace(/_/g, '.');
  } else if (isIphone) {
    device_type = 'Mobile';
    platform = 'iPhone';
    const match = ua.match(/OS (\d+[_\d]*)/i);
    if (match) platform_version = match[1].replace(/_/g, '.');
  } else if (isAndroid) {
    if (/tablet|mobile/i.test(ua)) {
      device_type = /tablet/i.test(ua) || !/mobile/i.test(ua) ? 'Tablet' : 'Mobile';
    } else {
      device_type = 'Mobile';
    }
    platform = 'Android';
    const match = ua.match(/Android (\d+(\.\d+)*)/i);
    if (match) platform_version = match[1];
  } else if (isWindows) {
    device_type = 'Desktop';
    platform = 'Windows';
    const match = ua.match(/Windows NT (\d+(\.\d+)*)/i);
    if (match) {
      const v = match[1];
      if (v === '10.0') platform_version = '10/11';
      else if (v === '6.3') platform_version = '8.1';
      else if (v === '6.1') platform_version = '7';
      else platform_version = v;
    }
  } else if (isMac) {
    device_type = 'Desktop';
    platform = 'macOS';
    const match = ua.match(/Mac OS X (\d+[_\d]*)/i);
    if (match) platform_version = match[1].replace(/_/g, '.');
  } else if (isLinux) {
    device_type = 'Desktop';
    platform = 'Linux';
  } else if (/mobile|phone|arm/i.test(ua)) {
    device_type = 'Mobile';
  }

  // 2. Browser Detection
  let browser: 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Opera' | 'Samsung Internet' | 'Other' = 'Other';
  let browser_version = '';

  if (/SamsungBrowser\/(\d+(\.\d+)*)/i.test(ua)) {
    browser = 'Samsung Internet';
    const m = ua.match(/SamsungBrowser\/(\d+)/i);
    if (m) browser_version = m[1];
  } else if (/OPR\/(\d+(\.\d+)*)/i.test(ua) || /Opera\/(\d+(\.\d+)*)/i.test(ua)) {
    browser = 'Opera';
    const m = ua.match(/(?:OPR|Opera)\/(\d+)/i);
    if (m) browser_version = m[1];
  } else if (/Edg\/(\d+(\.\d+)*)/i.test(ua)) {
    browser = 'Edge';
    const m = ua.match(/Edg\/(\d+)/i);
    if (m) browser_version = m[1];
  } else if (/Firefox\/(\d+(\.\d+)*)/i.test(ua) || /FxiOS\/(\d+(\.\d+)*)/i.test(ua)) {
    browser = 'Firefox';
    const m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/i);
    if (m) browser_version = m[1];
  } else if (/Chrome\/(\d+(\.\d+)*)/i.test(ua) || /CriOS\/(\d+(\.\d+)*)/i.test(ua)) {
    browser = 'Chrome';
    const m = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
    if (m) browser_version = m[1];
  } else if (/Safari\/(\d+(\.\d+)*)/i.test(ua) && !/Chrome|CriOS|Android/i.test(ua)) {
    browser = 'Safari';
    const m = ua.match(/Version\/(\d+)/i);
    if (m) browser_version = m[1];
    else {
      const m2 = ua.match(/Safari\/(\d+)/i);
      if (m2) browser_version = m2[1];
    }
  }

  return {
    device_type,
    platform,
    platform_version,
    browser,
    browser_version,
  };
}
