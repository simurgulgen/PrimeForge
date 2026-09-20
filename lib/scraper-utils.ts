export function sanitizeRegex(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\(\?[imsuy]+\)/gi, '').trim();
}

export function cleanSemver(v: string | null | undefined): string {
  if (!v) return '0.0.0';
  let s = String(v).trim().replace(/^[vV]/, '');
  const m = s.match(/([0-9]+(?:\.[0-9]+)+)/);
  return m ? m[1] : s;
}

export function parseVersion(v: string): number[] {
  const cleaned = cleanSemver(v);
  return cleaned.split(/[.\-_]/).map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
}

export function isNewerVersion(current: string, latest: string): boolean {
  if (!latest || !current) return false;
  const cur = parseVersion(current);
  const lat = parseVersion(latest);
  const maxLen = Math.max(cur.length, lat.length);
  for (let i = 0; i < maxLen; i++) {
    const c = cur[i] || 0;
    const l = lat[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Accurately extracts version from APK URL or filename, supporting:
 * - standard dotted: app-v1.2.3.apk, 9.6.25
 * - hyphen/underscore separated: FOX_TV_v5-3.apk -> 5.3, app_v2_1.apk -> 2.1
 * - single major version tags: Fx_PlayerV8.apk -> 8, dominotv-v13.apk -> 13
 */
export function extractVersionFromUrlOrFilename(urlOrFilename: string | null | undefined): string | null {
  if (!urlOrFilename) return null;
  const fn = urlOrFilename.split('?')[0].split('/').pop() || urlOrFilename;

  // 1. Standard dotted semver e.g. 5.3.1, v1.0.2
  const dottedMatch = fn.match(/(?:^|[vV_-])([0-9]+(?:\.[0-9]+)+)/);
  if (dottedMatch) return dottedMatch[1];

  // 2. Dash/underscore separated version in filename e.g. FOX_TV_v5-3.apk or app_v2_1.apk
  const sepMatch = fn.match(/(?:^|[vV_])([0-9]+(?:[-_][0-9]+)+)/);
  if (sepMatch) {
    return sepMatch[1].replace(/[-_]/g, '.');
  }

  // 3. Single major version tag with 'v' prefix in filename e.g. Fx_PlayerV8.apk, dominotv-v13.apk
  const singleMajorMatch = fn.match(/(?:^|[a-zA-Z_-])[vV]([0-9]+)(?:[._-][a-zA-Z0-9]+|\.apk|$)/);
  if (singleMajorMatch) {
    return singleMajorMatch[1];
  }

  // 4. Any dotted number fallback
  const anyDotted = fn.match(/([0-9]+(?:\.[0-9]+)+)/);
  if (anyDotted) return anyDotted[1];

  return null;
}

/**
 * Strict Security Guard against Fake / Adware / Virus Download Buttons
 * Validates that download links from LiteAPKs and third-party web scrapers
 * point to legitimate APK storage and not malicious advertising redirects.
 */
export function validateDownloadUrlSafety(downloadUrl: string): { safe: boolean; reason?: string } {
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    return { safe: false, reason: 'İndirme URL adresi boş veya geçersiz.' };
  }

  let u: URL;
  try {
    u = new URL(downloadUrl);
  } catch (_) {
    return { safe: false, reason: 'URL ayrıştırılamadı (Geçersiz format).' };
  }

  const host = u.hostname.toLowerCase();

  // Known malware, aggressive redirect, and fake download networks
  const suspiciousKeywords = [
    'adsterra', 'monetag', 'propeller', 'clicknupload', 'shortener', 'ouo.io',
    'shrink', 'track', 'affiliate', 'traffic', 'bonus', 'bet', 'casino',
    'install-app', 'fast-download', 'down-fast', 'cleaner-pro', 'virus',
    'popads', 'yllix', 'syndication', 'exoclick', 'juicyads'
  ];

  for (const kw of suspiciousKeywords) {
    if (host.includes(kw) || u.pathname.includes(kw)) {
      return {
        safe: false,
        reason: `Güvenlik Engeli: Şüpheli reklam/virüs yönlendirme ağı tespit edildi (${kw}). İndirme engellendi.`,
      };
    }
  }

  // If URL claims to be LiteAPKs, enforce official storage hosts ONLY
  if (downloadUrl.includes('liteapks')) {
    const allowedLiteApksHosts = ['download.liteapks.dev', 'download-old.liteapks.dev', 'liteapks.com', 'dl.liteapks.com'];
    if (!allowedLiteApksHosts.some((h) => host === h || host.endsWith('.' + h))) {
      return {
        safe: false,
        reason: `Güvenlik Engeli: LiteAPKs sahte indirme yönlendirmesi engellendi. Gerçek olmayan alan adı: ${host}`,
      };
    }

    // Must be .apk file
    const pathLower = u.pathname.toLowerCase();
    if (!pathLower.endsWith('.apk') && !u.search.toLowerCase().includes('.apk')) {
      return {
        safe: false,
        reason: 'Güvenlik Engeli: LiteAPKs bağlantısı doğrudan bir APK dosyası ile bitmiyor.',
      };
    }
  }

  return { safe: true };
}

/**
 * Fetches HTML from a target URL with automatic Cloudflare/403 resilient proxy fallback
 */
export async function fetchResilientHtml(
  targetUrl: string,
  timeoutMs: number = 10000
): Promise<{ ok: boolean; status: number; html: string; proxied: boolean; error?: string }> {
  const reqHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr,en-US;q=0.9,en;q=0.8',
  };
  if (targetUrl.includes('liteapks')) {
    reqHeaders['Referer'] = 'https://liteapks.com/';
  }

  try {
    const res = await fetch(targetUrl, {
      headers: reqHeaders,
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) {
      const html = await res.text();
      return { ok: true, status: res.status, html, proxied: false };
    }

    // If Cloudflare blocks with 403, 401 or 503, fallback to resilient HTML proxy
    if (res.status === 403 || res.status === 401 || res.status === 503) {
      console.warn(`[ResilientScraper] Direct fetch returned ${res.status}. Trying resilient reader proxy for ${targetUrl}`);
      const proxyUrl = `https://r.jina.ai/${targetUrl}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-Return-Format': 'html',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs + 4000),
      });

      if (proxyRes.ok) {
        const proxyHtml = await proxyRes.text();
        return { ok: true, status: 200, html: proxyHtml, proxied: true };
      }
    }

    return {
      ok: false,
      status: res.status,
      html: '',
      proxied: false,
      error: `Hedef web sitesi HTTP ${res.status} hatası döndürdü.`,
    };
  } catch (err: any) {
    // If timeout or network error, attempt proxy once
    try {
      console.warn(`[ResilientScraper] Direct fetch failed (${err.message}). Trying resilient reader proxy for ${targetUrl}`);
      const proxyUrl = `https://r.jina.ai/${targetUrl}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'X-Return-Format': 'html',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (proxyRes.ok) {
        const proxyHtml = await proxyRes.text();
        return { ok: true, status: 200, html: proxyHtml, proxied: true };
      }
    } catch (_) {}

    return {
      ok: false,
      status: 500,
      html: '',
      proxied: false,
      error: err.message || 'Hedef web sitesine erişilemedi.',
    };
  }
}

/**
 * Parses LiteAPKs app page HTML to extract official version, technical specs, and download link
 */
export function parseLiteApksPage(html: string): {
  version: string | null;
  updatedDate: string | null;
  downloadPath: string | null;
} {
  // 1. Version from header (e.g. <h1>App Title v2.222.1548</h1>)
  let version: string | null = null;
  const h1Match = html.match(/<h1[^>]*>.*?v([0-9]+(?:\.[0-9]+)+(?:-[a-zA-Z0-9.]+)?)/i);
  if (h1Match) {
    version = h1Match[1];
  }

  // 2. Version from specs table (<th>VERSION</th> <td>2.222.1548</td>)
  if (!version) {
    const specMatch = html.match(/<th[^>]*>\s*VERSION\s*<\/th>\s*<td[^>]*>\s*([0-9]+(?:\.[0-9]+)+(?:-[a-zA-Z0-9.]+)?)/i);
    if (specMatch) {
      version = specMatch[1];
    }
  }

  // 3. Updated Date (<th>UPDATED</th> <td>Sep 18 2026</td>)
  let updatedDate: string | null = null;
  const dateMatch = html.match(/<th[^>]*>\s*UPDATED\s*<\/th>\s*<td[^>]*>\s*([^<]+)<\/td>/i);
  if (dateMatch) {
    updatedDate = dateMatch[1].trim();
  }

  // 4. Download button path (a.btn-install href="/download/app-slug" or full URL)
  let downloadPath: string | null = null;
  const dlMatch = html.match(/href=["'](\/download\/[^"']+)["']/i) || html.match(/href=["'](https?:\/\/liteapks\.com\/download\/[^"']+)["']/i);
  if (dlMatch) {
    downloadPath = dlMatch[1];
  }

  return { version, updatedDate, downloadPath };
}
