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

  // 4. Download button path (a.btn-install href="/download/app-slug")
  let downloadPath: string | null = null;
  const dlMatch = html.match(/href=["'](\/download\/[^"']+)["']/i) || html.match(/href=["'](https?:\/\/liteapks\.com\/download\/[^"']+)["']/i);
  if (dlMatch) {
    downloadPath = dlMatch[1];
  }

  return { version, updatedDate, downloadPath };
}
