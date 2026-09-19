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
