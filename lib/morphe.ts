// lib/morphe.ts
// Morphe open-source patch ecosystem management for PrimeForge

export interface MorphePatch {
  id: string;
  name: string;
  description: string;
  targetApp: string;
  targetPackage: string;
  isUniversal?: boolean;
  options?: string[];
  sourceRepo: string;
}

export interface PatchSource {
  id: string;
  name: string;
  repo: string;
  description: string;
  isOfficial: boolean;
  latestVersion?: string;
  mppAssetUrl?: string;
  patchCount?: number;
  lastSyncedAt?: string;
}

// Built-in curated catalog of Morphe official patches
export const OFFICIAL_MORPHE_PATCHES: MorphePatch[] = [
  // === UNIVERSAL PATCHES ===
  {
    id: 'clone-app',
    name: 'Clone app',
    description: 'Changes the app package name to allow installing the same app multiple times alongside the original.',
    targetApp: 'Universal',
    targetPackage: '*',
    isUniversal: true,
    options: ['Package name', 'Update permissions', 'Update providers'],
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'override-certificate-pinning',
    name: 'Override certificate pinning',
    description: 'Overrides SSL/TLS certificate pinning, allowing traffic inspection and proxy routing.',
    targetApp: 'Universal',
    targetPackage: '*',
    isUniversal: true,
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'disable-play-store-updates',
    name: 'Disable Play Store updates',
    description: 'Disables Google Play Store forced updates by setting the version code to the maximum allowed (2147483647).',
    targetApp: 'Universal',
    targetPackage: '*',
    isUniversal: true,
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'change-installer-source',
    name: 'Change installer source',
    description: 'Spoofs the installer source package so the app believes it was installed directly from Google Play Store.',
    targetApp: 'Universal',
    targetPackage: '*',
    isUniversal: true,
    options: ['Spoofed package installer name'],
    sourceRepo: 'MorpheApp/morphe-patches',
  },

  // === YOUTUBE PATCHES ===
  {
    id: 'hide-ads',
    name: 'Hide ads',
    description: 'Hides general ads, Premium promotions, home feed banners, and in-video overlay ads.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'sponsorblock',
    name: 'SponsorBlock',
    description: 'Automatically detects and skips sponsored segments, intros, outros, and subscribe reminders.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'return-youtube-dislike',
    name: 'Return YouTube Dislike',
    description: 'Restores the public dislike count on videos using the Return YouTube Dislike API.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'remove-background-playback-restrictions',
    name: 'Background playback',
    description: 'Removes restrictions on background playback and screen-off listening for all video types.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'gmscore-support',
    name: 'GmsCore / MicroG support',
    description: 'Enables rootless Google login using MicroG / GmsCore by redirecting Google Play Services calls.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'spoof-video-streams',
    name: 'Spoof video streams',
    description: 'Spoofs client video streams to resolve playback buffering issues and infinite loading.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'downloads',
    name: 'Downloads',
    description: 'Adds an external downloader hook to download videos in 1080p/4K directly from the player.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'swipe-controls',
    name: 'Swipe controls',
    description: 'Adds gesture swipe controls on video sides to adjust brightness and audio volume smoothly.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'ambient-mode',
    name: 'Ambient mode options',
    description: 'Bypasses power-saving restrictions for ambient mode and allows disabling in fullscreen.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'change-form-factor',
    name: 'Change form factor (TV / Tablet / Phone)',
    description: 'Adjusts user interface appearance and responsive layouts between TV, tablet, and phone.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    options: ['Form factor type'],
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'custom-branding',
    name: 'Custom branding',
    description: 'Allows changing the app name and launcher icon to a custom title and branding.',
    targetApp: 'YouTube',
    targetPackage: 'com.google.android.youtube',
    options: ['App name', 'Custom icon'],
    sourceRepo: 'MorpheApp/morphe-patches',
  },

  // === YOUTUBE MUSIC PATCHES ===
  {
    id: 'ym-hide-ads',
    name: 'Hide ads (YT Music)',
    description: 'Hides fullscreen ads, Premium promotions, and audio ad interruptions in YouTube Music.',
    targetApp: 'YouTube Music',
    targetPackage: 'com.google.android.apps.youtube.music',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'enable-exclusive-audio-playback',
    name: 'Exclusive audio playback',
    description: 'Enables playing audio streams without fetching video feed to save bandwidth and battery.',
    targetApp: 'YouTube Music',
    targetPackage: 'com.google.android.apps.youtube.music',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'ym-background-playback',
    name: 'Background playback (YT Music)',
    description: 'Enables background playback and screen-off listening for YouTube Music.',
    targetApp: 'YouTube Music',
    targetPackage: 'com.google.android.apps.youtube.music',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'crossfade',
    name: 'True dual-player crossfade',
    description: 'Adds true seamless dual-player crossfade between consecutive music tracks.',
    targetApp: 'YouTube Music',
    targetPackage: 'com.google.android.apps.youtube.music',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'third-party-lyrics',
    name: 'Third-party lyrics',
    description: 'Displays synchronized, karaoke-style lyrics from LRCLIB and KuGou inside the player.',
    targetApp: 'YouTube Music',
    targetPackage: 'com.google.android.apps.youtube.music',
    sourceRepo: 'MorpheApp/morphe-patches',
  },

  // === REDDIT PATCHES ===
  {
    id: 'reddit-hide-ads',
    name: 'Hide ads (Reddit)',
    description: 'Hides promoted posts, sponsored ads, and promoted comments across Reddit feeds.',
    targetApp: 'Reddit',
    targetPackage: 'com.reddit.frontpage',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'sanitize-sharing-links',
    name: 'Sanitize sharing links',
    description: 'Strips tracking query parameters and UTM referrers from shared post links.',
    targetApp: 'Reddit',
    targetPackage: 'com.reddit.frontpage',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'spoof-signature',
    name: 'Spoof signature',
    description: 'Spoofs the original app signature to maintain push notifications on modified builds.',
    targetApp: 'Reddit',
    targetPackage: 'com.reddit.frontpage',
    sourceRepo: 'MorpheApp/morphe-patches',
  },
  {
    id: 'open-links-externally',
    name: 'Open links externally',
    description: 'Always opens external URLs in your default web browser instead of the in-app browser.',
    targetApp: 'Reddit',
    targetPackage: 'com.reddit.frontpage',
    sourceRepo: 'MorpheApp/morphe-patches',
  },

  // === TWITTER / X PATCHES (via crimera/piko) ===
  {
    id: 'twitter-hide-ads',
    name: 'Hide Promoted Tweets & Ads',
    description: 'Hides promoted tweets, banner ads, and who-to-follow carousels in Twitter/X.',
    targetApp: 'Twitter / X',
    targetPackage: 'com.twitter.android',
    sourceRepo: 'crimera/piko',
  },
  {
    id: 'twitter-download-media',
    name: 'Media Downloader',
    description: 'Adds a direct download button to videos and GIFs directly on tweets.',
    targetApp: 'Twitter / X',
    targetPackage: 'com.twitter.android',
    sourceRepo: 'crimera/piko',
  },
  {
    id: 'twitter-disable-view-count',
    name: 'Disable View Count & Analytics',
    description: 'Hides tweet view counts and telemetry tracking from the timeline.',
    targetApp: 'Twitter / X',
    targetPackage: 'com.twitter.android',
    sourceRepo: 'crimera/piko',
  },
];

// Initial patch sources registry
export const DEFAULT_PATCH_SOURCES: PatchSource[] = [
  {
    id: 'morphe-official',
    name: 'Morphe Official Patches',
    repo: 'MorpheApp/morphe-patches',
    description: 'Official Morphe patch bundle for YouTube, YouTube Music, Reddit, and Universal Android apps.',
    isOfficial: true,
    latestVersion: 'v1.42.0',
    mppAssetUrl: 'https://github.com/MorpheApp/morphe-patches/releases/download/v1.42.0/patches-1.42.0.mpp',
    patchCount: 146,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'crimera-piko',
    name: 'Piko (Twitter & Instagram)',
    repo: 'crimera/piko',
    description: 'Community Morphe patches tailored for Twitter / X and Instagram ad-blocking and enhancements.',
    isOfficial: false,
    latestVersion: 'latest',
    patchCount: 24,
    lastSyncedAt: new Date().toISOString(),
  },
];

// In-memory or persisted custom sources
let customSources: PatchSource[] = [...DEFAULT_PATCH_SOURCES];

export async function fetchMorpheReleaseInfo(): Promise<{
  patchesVersion: string;
  patchesUrl: string;
  desktopVersion: string;
  desktopUrl: string;
}> {
  try {
    const patchesRes = await fetch('https://api.github.com/repos/MorpheApp/morphe-patches/releases/latest', {
      headers: { 'User-Agent': 'PrimeForge-Engine' },
      next: { revalidate: 3600 },
    });
    const patchesData = await patchesRes.json();

    const desktopRes = await fetch('https://api.github.com/repos/MorpheApp/morphe-desktop/releases/latest', {
      headers: { 'User-Agent': 'PrimeForge-Engine' },
      next: { revalidate: 3600 },
    });
    const desktopData = await desktopRes.json();

    const mppAsset = patchesData.assets?.find((a: any) => a.name.endsWith('.mpp'));
    const desktopAsset = desktopData.assets?.find((a: any) => a.name.endsWith('-all.jar'));

    return {
      patchesVersion: patchesData.tag_name || 'v1.42.0',
      patchesUrl: mppAsset?.browser_download_url || '',
      desktopVersion: desktopData.tag_name || 'v1.15.1',
      desktopUrl: desktopAsset?.browser_download_url || '',
    };
  } catch (e) {
    console.error('Failed to fetch Morphe releases from GitHub:', e);
    return {
      patchesVersion: 'v1.42.0',
      patchesUrl: 'https://github.com/MorpheApp/morphe-patches/releases/download/v1.42.0/patches-1.42.0.mpp',
      desktopVersion: 'v1.15.1',
      desktopUrl: 'https://github.com/MorpheApp/morphe-desktop/releases/download/v1.15.1/morphe-desktop-1.15.1-all.jar',
    };
  }
}

export function getAllPatches(packageName?: string): MorphePatch[] {
  if (!packageName) return OFFICIAL_MORPHE_PATCHES;
  return OFFICIAL_MORPHE_PATCHES.filter(
    (p) => p.isUniversal || p.targetPackage === packageName || p.targetPackage === '*'
  );
}

export function getPatchSources(): PatchSource[] {
  return customSources;
}

export function addPatchSource(source: PatchSource): void {
  const existing = customSources.findIndex((s) => s.repo.toLowerCase() === source.repo.toLowerCase());
  if (existing >= 0) {
    customSources[existing] = { ...customSources[existing], ...source };
  } else {
    customSources.push(source);
  }
}
