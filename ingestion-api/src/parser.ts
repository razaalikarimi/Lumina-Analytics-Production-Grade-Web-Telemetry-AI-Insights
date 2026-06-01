import geoip from 'geoip-lite';

export interface ClientDetails {
  browser: string;
  os: string;
  device: string;
  country: string;
}

export function parseUserAgent(uaString: string | undefined): { browser: string; os: string; device: string } {
  if (!uaString) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
  }

  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  const ua = uaString.toLowerCase();

  // Browser Detection
  if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
  } else if (ua.includes('edge') || ua.includes('edg/')) {
    browser = 'Edge';
  } else if (ua.includes('chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
  } else if (ua.includes('msie') || ua.includes('trident/')) {
    browser = 'IE';
  }

  // OS Detection
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    os = 'macOS';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Device Detection
  if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'Tablet';
  }

  return { browser, os, device };
}

export function resolveCountry(ip: string): string {
  // Handle local development IPs
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.')
  ) {
    return 'Localhost';
  }

  try {
    const geo = geoip.lookup(ip);
    return geo ? geo.country : 'Unknown';
  } catch (error) {
    console.error('GeoIP lookup failed:', error);
    return 'Unknown';
  }
}

export function parseClientDetails(uaString: string | undefined, ip: string): ClientDetails {
  const { browser, os, device } = parseUserAgent(uaString);
  const country = resolveCountry(ip);
  return { browser, os, device, country };
}
