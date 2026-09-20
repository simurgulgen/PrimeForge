import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchResilientHtml, parseLiteApksPage, extractVersionFromUrlOrFilename } from '@/lib/scraper-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient time for scraping & GitHub checks

interface VariantInfo {
  platform: string;
  architecture: string;
  version: string;
  fileUrl: string;
  githubSourceRepo?: string | null;
  releaseChannel?: string;
}

interface UpdateCheckResult {
  listing_id: string;
  title: string;
  logoUrl: string;
  packageName: string | null;
  current_version: string;
  latest_version: string;
  latest_tag: string;
  source_type: 'GITHUB_RELEASE' | 'GITHUB_REPO_APK' | 'WEB_SCRAPER' | 'APK_MANIFEST' | 'DIRECT';
  source_name: string;
  download_url: string;
  release_url?: string;
  release_notes?: string | null;
  has_guide?: boolean;
  guide_name?: string;
  auto_apply?: boolean;
  assets?: Array<{ name: string; browser_download_url: string; size: number }>;
  channel_summary?: {
    stable?: string;
    beta?: string;
  };
  variants_needing_update: Array<{
    platform: string;
    architecture: string;
    releaseChannel?: string;
    current_version: string;
    new_version: string;
    suggested_url: string;
    asset_name?: string;
  }>;
}

function cleanSemver(v: string | null | undefined): string {
  if (!v) return '0.0.0';
  let s = String(v).trim().replace(/^[vV]/, '');
  const m = s.match(/([0-9]+(?:\.[0-9]+)+)/);
  return m ? m[1] : s;
}

function parseVersion(v: string): number[] {
  const cleaned = cleanSemver(v);
  return cleaned.split(/[.\-_]/).map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
}

function isNewerVersion(current: string, latest: string): boolean {
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

function parseOwnerAndRepo(url: string): [string, string] | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (match) {
    let repo = match[2].replace(/\.git$/, '');
    return [match[1], repo];
  }
  const parts = url.trim().split('/');
  if (parts.length === 2 && !url.includes('://')) {
    return [parts[0], parts[1]];
  }
  return null;
}

function matchAssetToVariant(assets: any[], variant: { architecture?: string; platform?: string }): any | null {
  if (!assets || assets.length === 0) return null;
  const apkAssets = assets.filter((a: any) => a && a.name && a.name.toLowerCase().endsWith('.apk'));
  if (apkAssets.length === 0) return null;

  const arch = (variant.architecture || '').toUpperCase();

  if (arch.includes('ARM64') || arch.includes('V8A') || arch.includes('AARCH64')) {
    const found = apkAssets.find((a: any) => {
      const n = a.name.toLowerCase();
      return n.includes('arm64') || n.includes('v8a') || n.includes('aarch64');
    });
    if (found) return found;
  }

  if (arch.includes('ARMEABI') || arch.includes('V7A') || arch === 'ARM') {
    const found = apkAssets.find((a: any) => {
      const n = a.name.toLowerCase();
      return (n.includes('armeabi') || n.includes('v7a') || n.includes('arm-v7a')) && !n.includes('arm64') && !n.includes('v8a');
    });
    if (found) return found;
  }

  if (arch === 'X86') {
    const found = apkAssets.find((a: any) => {
      const n = a.name.toLowerCase();
      return n.includes('x86') && !n.includes('x86_64') && !n.includes('x86-64') && !n.includes('64');
    });
    if (found) return found;
  }

  if (arch.includes('X86_64') || arch.includes('X64')) {
    const found = apkAssets.find((a: any) => {
      const n = a.name.toLowerCase();
      return n.includes('x86_64') || n.includes('x86-64') || n.includes('x64');
    });
    if (found) return found;
  }

  if (arch.includes('UNIVERSAL')) {
    const found = apkAssets.find((a: any) => {
      const n = a.name.toLowerCase();
      return n.includes('universal') || n.includes('all') || (!n.includes('arm') && !n.includes('v7') && !n.includes('v8') && !n.includes('x86'));
    });
    if (found) return found;
  }

  // Fallback: search for universal or return first asset
  const universal = apkAssets.find((a: any) => a.name.toLowerCase().includes('universal'));
  return universal || apkAssets[0];
}

function sanitizeRegex(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\(\?[imsuy]+\)/gi, '').trim();
}

// Scrape dynamic web rules (from scraper_rules table)
async function checkWithScraperRule(rule: any): Promise<{ new_version: string; download_url: string } | null> {
  const targetUrl = rule.target_url;
  if (!targetUrl) return null;

  try {
    const isLiteApks = targetUrl.includes('liteapks');

    const fetchResult = await fetchResilientHtml(targetUrl, 10000);
    if (!fetchResult.ok || !fetchResult.html) {
      console.warn(`[UpdateCheck] Scraper rule fetch failed for ${targetUrl}: ${fetchResult.error}`);
      return null;
    }
    const html = fetchResult.html;

    let newVersion: string | null = null;
    let downloadUrl: string | null = null;

    if (isLiteApks) {
      const parsedLite = parseLiteApksPage(html);
      if (parsedLite.version) {
        newVersion = parsedLite.version;
      }
    }

    const linkRegexStr = sanitizeRegex(rule.link_regex) || 'href=["\']([^"\']+\\.apk[^"\']*)["\']';
    let linkMatch: RegExpMatchArray | null = null;
    try {
      const linkRegex = new RegExp(linkRegexStr, 'i');
      linkMatch = html.match(linkRegex);
    } catch (_) {}

    if (linkMatch) {
      let rawUrl = linkMatch[1] || linkMatch[0];
      if (rawUrl.startsWith('//')) {
        downloadUrl = 'https:' + rawUrl;
      } else if (rawUrl.startsWith('/')) {
        const u = new URL(targetUrl);
        downloadUrl = `${u.protocol}//${u.host}${rawUrl}`;
      } else if (!rawUrl.startsWith('http')) {
        downloadUrl = new URL(rawUrl, targetUrl).toString();
      } else {
        downloadUrl = rawUrl;
      }
    }

    if (!downloadUrl) return null;

    // Security check: reject adware redirects or fake buttons
    const suspiciousKeywords = ['adsterra', 'monetag', 'propeller', 'clicknupload', 'ouo.io', 'track', 'affiliate', 'traffic', 'bonus', 'virus'];
    const dlLower = downloadUrl.toLowerCase();
    if (suspiciousKeywords.some((k) => dlLower.includes(k))) {
      console.warn(`Blocked suspicious download URL for ${rule.name}:`, downloadUrl);
      return null;
    }

    // Version match: APK filename / URL first (most reliable)
    if (!newVersion) {
      newVersion = extractVersionFromUrlOrFilename(downloadUrl);
    }

    // Version regex fallback on HTML
    if (!newVersion) {
      const versionRegexStr = sanitizeRegex(rule.version_regex) || '(?:v|sürüm|version)?\\s*([0-9]+(?:\\.[0-9]+)+)';
      try {
        const cleanHtml = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        const versionRegex = new RegExp(versionRegexStr, 'i');
        const verMatch = cleanHtml.match(versionRegex);
        if (verMatch) {
          newVersion = verMatch[1] || verMatch[0];
        }
      } catch (_) {}
    }

    if (newVersion) {
      return { new_version: newVersion, download_url: downloadUrl };
    }
  } catch (e) {
    console.error(`Scraper error for ${rule.name}:`, e);
  }
  return null;
}

// Check GitHub repo contents directly for .apk files (e.g. kadanadam/dominotv/dominotv-v13.apk)
async function checkGitHubRepoContents(owner: string, repo: string, token?: string): Promise<{ new_version: string; download_url: string; filename: string } | null> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'PrimeForge-Update-Checker',
      Accept: 'application/vnd.github+json',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const items = await res.json();
    if (!Array.isArray(items)) return null;

    const apkFiles = items.filter((it: any) => it.name && it.name.toLowerCase().endsWith('.apk'));
    if (apkFiles.length === 0) return null;

    // Pick APK with the highest version number in its filename
    let bestMatch: { version: string; url: string; filename: string } | null = null;

    for (const f of apkFiles) {
      const name = f.name;
      // Match patterns like v13, v1.0.2, dominotv-v13.apk
      const vMatch = name.match(/v?([0-9]+(?:\.[0-9]+)*)/i);
      if (vMatch) {
        let vStr = vMatch[1];
        if (!vStr.includes('.')) {
          vStr = `${vStr}.0`; // v13 -> 13.0
        }
        if (!bestMatch || isNewerVersion(bestMatch.version, vStr)) {
          bestMatch = {
            version: vStr,
            url: f.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/main/${name}`,
            filename: name,
          };
        }
      }
    }

    if (bestMatch) {
      return {
        new_version: bestMatch.version,
        download_url: bestMatch.url,
        filename: bestMatch.filename,
      };
    }
  } catch (e) {
    console.error(`GitHub contents check failed for ${owner}/${repo}:`, e);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filterListingId = searchParams.get('listing_id');
    const githubToken = process.env.GITHUB_DATA_PAT || process.env.GITHUB_PAT || '';

    // 1. Fetch active scraper rules & saved profiles (guides)
    const { data: rules } = await supabase
      .from('scraper_rules')
      .select('*')
      .eq('is_active', true);

    const scraperRules = rules || [];

    const { data: savedProfiles } = await supabase
      .from('forge_profiles')
      .select('package_name, profile_name, auto_apply, modding_guide');

    const profileMap = new Map<string, any>();
    for (const p of savedProfiles || []) {
      if (p.package_name) {
        profileMap.set(p.package_name.toLowerCase(), p);
      }
    }

    // 2. Fetch listings
    let query = supabase
      .from('listings')
      .select('id, title, packageName, version, logoUrl, fileUrl, variants, versionHistory, updatedAt, type, status, githubSourceRepo')
      .in('type', ['APK', 'APP', 'apk', 'app']);

    if (filterListingId) {
      query = query.eq('id', filterListingId);
    }

    const { data: listings, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updates_available: UpdateCheckResult[] = [];
    const up_to_date: any[] = [];
    const untracked: any[] = [];
    const check_failed: any[] = [];

    // Helper map of checked github repos to avoid duplicate rate-limit burn
    const ghReleasesCache = new Map<string, any>();

    for (const listing of listings || []) {
      const currentVer = cleanSemver(listing.version);
      const pkg = listing.packageName || '';
      const fileUrl = listing.fileUrl || '';
      const ghRepoRaw = listing.githubSourceRepo || '';
      const variants: any[] = Array.isArray(listing.variants) ? listing.variants : [];
      const savedGuide = pkg ? profileMap.get(pkg.toLowerCase()) : null;

      let handled = false;

      // -------------------------------------------------------------
      // STRATEGY 1: Check dynamic scraper rules (Web scraper)
      // -------------------------------------------------------------
      const matchedRule = scraperRules.find((r) => {
        if (pkg && r.package_name && r.package_name.toLowerCase() === pkg.toLowerCase()) return true;
        if (r.domain_pattern && (fileUrl.toLowerCase().includes(r.domain_pattern.toLowerCase()) || ghRepoRaw.toLowerCase().includes(r.domain_pattern.toLowerCase()))) return true;
        if (r.target_url) {
          try {
            const host = new URL(r.target_url).hostname.replace(/^www\./, '').toLowerCase();
            if (host && (fileUrl.toLowerCase().includes(host) || ghRepoRaw.toLowerCase().includes(host))) return true;
          } catch (_) {}
        }
        return false;
      });

      if (matchedRule) {
        const scrapeRes = await checkWithScraperRule(matchedRule);
        if (scrapeRes) {
          handled = true;
          const isNewer = isNewerVersion(currentVer, scrapeRes.new_version);
          if (isNewer) {
            updates_available.push({
              listing_id: listing.id,
              title: listing.title,
              logoUrl: listing.logoUrl,
              packageName: listing.packageName,
              current_version: listing.version || '1.0',
              latest_version: scrapeRes.new_version,
              latest_tag: scrapeRes.new_version,
              source_type: 'WEB_SCRAPER',
              source_name: matchedRule.name,
              download_url: scrapeRes.download_url,
              has_guide: Boolean(savedGuide),
              guide_name: savedGuide?.profile_name,
              auto_apply: savedGuide?.auto_apply ?? false,
              variants_needing_update: variants.map((v) => ({
                platform: v.platform || 'UNIVERSAL',
                architecture: v.architecture || 'UNIVERSAL',
                current_version: v.version || currentVer,
                new_version: scrapeRes.new_version,
                suggested_url: scrapeRes.download_url,
              })),
            });
          } else {
            up_to_date.push({
              listing_id: listing.id,
              title: listing.title,
              current_version: listing.version,
              source: `Web: ${matchedRule.name}`,
            });
          }
          continue;
        }
      }

      // -------------------------------------------------------------
      // STRATEGY 2: Check GitHub (Releases or Direct Repo APK)
      // -------------------------------------------------------------
      const ghCandidates = [ghRepoRaw, fileUrl, ...(variants.map((v) => v.githubSourceRepo || v.fileUrl || ''))];
      let ownerRepo: [string, string] | null = null;
      for (const cand of ghCandidates) {
        const parsed = parseOwnerAndRepo(cand);
        if (parsed) {
          ownerRepo = parsed;
          break;
        }
      }

      if (ownerRepo) {
        const [owner, repo] = ownerRepo;
        const cacheKey = `${owner}/${repo}`.toLowerCase();

        try {
          let releasesList = ghReleasesCache.get(cacheKey);

          if (releasesList === undefined) {
            const headers: Record<string, string> = {
              'User-Agent': 'PrimeForge-Update-Checker',
              Accept: 'application/vnd.github+json',
            };
            if (githubToken) headers['Authorization'] = `token ${githubToken}`;

            const listRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/releases?per_page=15`,
              { headers, cache: 'no-store' }
            );

            if (listRes.ok) {
              const list = await listRes.json();
              releasesList = Array.isArray(list) ? list : [];
            } else {
              // Try single latest
              const singleRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
                { headers, cache: 'no-store' }
              );
              releasesList = singleRes.ok ? [await singleRes.json()] : [];
            }
            ghReleasesCache.set(cacheKey, releasesList);
          }

          // Case 2A: Releases found with APK assets
          const validReleases = (releasesList || []).filter((r: any) => {
            if (!r || !r.tag_name) return false;
            const apkAssets = (r.assets || []).filter((a: any) =>
              a.name && a.name.toLowerCase().endsWith('.apk')
            );
            return apkAssets.length > 0;
          });

          if (validReleases.length > 0) {
            const isBetaRel = (r: any) =>
              Boolean(r.prerelease) ||
              /beta|alpha|rc|nightly|preview/i.test(`${r.tag_name} ${r.name || ''}`);

            const stableReleases = validReleases.filter((r: any) => !isBetaRel(r));
            const betaReleases = validReleases.filter((r: any) => isBetaRel(r));

            const latestStable = stableReleases[0] || null;
            const latestBeta = betaReleases[0] || null;
            const latestAny = validReleases[0];

            const primaryRelease = latestStable || latestAny;
            const primaryTag = primaryRelease.tag_name;
            const primaryVer = cleanSemver(primaryTag);

            // Detailed variant evaluation
            let hasAnyVariantUpdate = false;
            const variantsNeedingUpdate: any[] = [];

            if (variants.length > 0) {
              for (const v of variants) {
                const vChan = (v.releaseChannel || (listing as any).release_channel || 'Stable').toLowerCase();
                const isBetaChannel = vChan.includes('beta') || vChan.includes('alpha');
                const targetRel = (isBetaChannel && latestBeta) ? latestBeta : (latestStable || latestAny);

                if (!targetRel) continue;

                const targetTag = targetRel.tag_name;
                const targetVer = cleanSemver(targetTag);
                const vCurVer = cleanSemver(v.version || currentVer);
                const isNewer = isNewerVersion(vCurVer, targetVer);

                const matchedAsset = matchAssetToVariant(targetRel.assets || [], v);
                const suggestedUrl = matchedAsset?.browser_download_url || targetRel.assets?.[0]?.browser_download_url || fileUrl;

                if (isNewer) {
                  hasAnyVariantUpdate = true;
                  variantsNeedingUpdate.push({
                    platform: v.platform || 'TV',
                    architecture: v.architecture || 'UNIVERSAL',
                    releaseChannel: v.releaseChannel || (isBetaRel(targetRel) ? 'Beta' : 'Stable'),
                    current_version: v.version || currentVer,
                    new_version: targetVer,
                    suggested_url: suggestedUrl,
                    asset_name: matchedAsset?.name,
                  });
                }
              }
            }

            const isTopNewer = isNewerVersion(currentVer, primaryVer);

            if (isTopNewer || hasAnyVariantUpdate) {
              const matchedPrimaryAsset = matchAssetToVariant(primaryRelease.assets || [], { architecture: 'UNIVERSAL' });
              const defaultAsset = matchedPrimaryAsset?.browser_download_url || primaryRelease.assets?.[0]?.browser_download_url || fileUrl;

              updates_available.push({
                listing_id: listing.id,
                title: listing.title,
                logoUrl: listing.logoUrl,
                packageName: listing.packageName,
                current_version: listing.version || '1.0',
                latest_version: primaryVer,
                latest_tag: primaryTag,
                source_type: 'GITHUB_RELEASE',
                source_name: `GitHub: ${owner}/${repo}`,
                download_url: defaultAsset,
                release_url: primaryRelease.html_url,
                release_notes: primaryRelease.body,
                has_guide: Boolean(savedGuide),
                guide_name: savedGuide?.profile_name,
                auto_apply: savedGuide?.auto_apply ?? false,
                channel_summary: {
                  stable: latestStable ? cleanSemver(latestStable.tag_name) : undefined,
                  beta: latestBeta ? cleanSemver(latestBeta.tag_name) : undefined,
                },
                assets: (primaryRelease.assets || []).map((a: any) => ({
                  name: a.name,
                  browser_download_url: a.browser_download_url,
                  size: a.size,
                })),
                variants_needing_update:
                  variantsNeedingUpdate.length > 0
                    ? variantsNeedingUpdate
                    : variants.map((v) => ({
                        platform: v.platform || 'UNIVERSAL',
                        architecture: v.architecture || 'UNIVERSAL',
                        releaseChannel: v.releaseChannel || 'Stable',
                        current_version: v.version || currentVer,
                        new_version: primaryVer,
                        suggested_url: defaultAsset,
                      })),
              });
            } else {
              up_to_date.push({
                listing_id: listing.id,
                title: listing.title,
                current_version: listing.version,
                source: `GitHub: ${owner}/${repo}`,
              });
            }
            handled = true;
            continue;
          }

          // Case 2B: No Releases found ➔ Check GitHub repo contents directly (e.g. Domino TV)
          const directApk = await checkGitHubRepoContents(owner, repo, githubToken);
          if (directApk) {
            handled = true;
            const isNewer = isNewerVersion(currentVer, directApk.new_version);
            if (isNewer) {
              updates_available.push({
                listing_id: listing.id,
                title: listing.title,
                logoUrl: listing.logoUrl,
                packageName: listing.packageName,
                current_version: listing.version || '1.0',
                latest_version: directApk.new_version,
                latest_tag: directApk.filename,
                source_type: 'GITHUB_REPO_APK',
                source_name: `GitHub Raw Repo (${directApk.filename})`,
                download_url: directApk.download_url,
                has_guide: Boolean(savedGuide),
                guide_name: savedGuide?.profile_name,
                auto_apply: savedGuide?.auto_apply ?? false,
                variants_needing_update: variants.map((v) => ({
                  platform: v.platform || 'UNIVERSAL',
                  architecture: v.architecture || 'UNIVERSAL',
                  current_version: v.version || currentVer,
                  new_version: directApk.new_version,
                  suggested_url: directApk.download_url,
                })),
              });
            } else {
              up_to_date.push({
                listing_id: listing.id,
                title: listing.title,
                current_version: listing.version,
                source: `GitHub Raw (${directApk.filename})`,
              });
            }
            continue;
          }
        } catch (e: any) {
          check_failed.push({
            listing_id: listing.id,
            title: listing.title,
            error: e.message || 'GitHub kontrol hatası',
          });
          continue;
        }
      }

      // If no scraper rule and no GitHub repo
      if (!handled) {
        untracked.push({
          listing_id: listing.id,
          title: listing.title,
          packageName: listing.packageName,
          current_version: listing.version,
          fileUrl: listing.fileUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      updates_available,
      up_to_date,
      untracked,
      check_failed,
      total_checked: (listings || []).length,
      checked_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Update check master error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
