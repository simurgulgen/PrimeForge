// lib/store-publish.ts
// Unified publishing helper for PrimeStore & Telegram Bot callbacks with multi-variant support

import { supabase } from '@/lib/supabase';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8901088416:AAG3u11MrrgUZrjWoXHwL1IhnX5cfVx-BZM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '761864148';

export async function sendTelegramPublishAlert(text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const payload: any = {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Failed to send Telegram publish alert:', err);
  }
}

/**
 * Extracts high-res in-app screenshot URLs from a job's analysis/emulator reports.
 * Excludes icons and small logos from the screenshot showcase.
 */
function extractJobScreenshots(job: any): string[] {
  const shots: string[] = [];
  const raw = job?.analysis_report?.screenshots;
  const emu = job?.analysis_report?.emulator_test_report?.screenshots;

  const tryAdd = (url: any) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      const lower = url.toLowerCase();
      // Exclude icon and small logo files from gallery
      if (!lower.includes('icon.png') && !lower.includes('icon-') && !shots.includes(url)) {
        shots.push(url);
      }
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(tryAdd);
  } else if (raw && typeof raw === 'object') {
    // TV content first (guaranteed clean & inside app UI), then mobile, tablet, and fallback tv
    const preferredOrder = [
      'tv_content', 'tv_content_screenshot',
      'mobile', 'mobile_content', 'mobile_screenshot', 'mobile_content_screenshot',
      'tablet', 'tablet_screenshot',
      'tv', 'tv_screenshot', 'emulator'
    ];
    for (const key of preferredOrder) {
      if (raw[key]) tryAdd(raw[key]);
    }
    for (const [k, val] of Object.entries(raw)) {
      if (!preferredOrder.includes(k) && k !== 'icon' && k !== 'banner') {
        tryAdd(val);
      }
    }
  }

  if (emu && typeof emu === 'object') {
    for (const [k, val] of Object.entries(emu)) {
      if (k !== 'icon') tryAdd(val);
    }
  }

  if (shots.length === 0 && job?.screenshot_url) {
    const sUrl = job.screenshot_url;
    if (typeof sUrl === 'string' && sUrl.startsWith('http') && !sUrl.toLowerCase().includes('icon.png')) {
      shots.push(sUrl);
    }
  }

  return shots;
}

/**
 * Extracts the clean app icon/logo URL from a job.
 */
function extractJobLogo(job: any): string | null {
  const iconCandidate = job?.analysis_report?.screenshots?.icon ||
                        job?.analysis_report?.emulator_test_report?.screenshots?.icon ||
                        job?.analysis_report?.logo_url;
  if (typeof iconCandidate === 'string' && iconCandidate.startsWith('http')) {
    return iconCandidate;
  }
  if (job?.screenshot_url && job.screenshot_url.toLowerCase().includes('icon.png')) {
    return job.screenshot_url;
  }
  return null;
}

export async function publishJobToPrimeStore(jobIdOrPkg: string) {
  // 1. Fetch job from forge_jobs
  let job: any = null;
  const { data: jobById } = await supabase
    .from('forge_jobs')
    .select('*')
    .eq('id', jobIdOrPkg)
    .maybeSingle();

  if (jobById) {
    job = jobById;
  } else {
    // Try by package name (latest with ready modded APK)
    const { data: jobByPkg } = await supabase
      .from('forge_jobs')
      .select('*')
      .eq('package_name', jobIdOrPkg)
      .not('modded_apk_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobByPkg) {
      job = jobByPkg;
    } else {
      const { data: latest } = await supabase
        .from('forge_jobs')
        .select('*')
        .not('modded_apk_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) job = latest;
    }
  }

  if (!job) {
    return { success: false, error: 'Yayınlanacak görev kaydı bulunamadı.' };
  }

  const pkg = job.package_name;
  const moddedUrl = job.modded_apk_url;
  if (!moddedUrl) {
    return { success: false, error: 'Bu göreve ait hazır modlanmış APK indirme bağlantısı bulunamadı.' };
  }

  const appTitle = job.app_name || job.analysis_report?.app_label || pkg || 'Uygulama';
  const rawVer = job.version_name || '1.0';
  const cleanVerMatch = rawVer.match(/([0-9]+(?:\.[0-9]+)+)/);
  const cleanVer = cleanVerMatch ? cleanVerMatch[1] : rawVer.replace(/^v/i, '').trim();
  const versionString = `v${cleanVer} (Prime Mod)`;

  // Extract screenshots and logos
  const jobScreenshots = extractJobScreenshots(job);
  const stableLogoCandidate = extractJobLogo(job);

  // Extract VirusTotal & Multi-engine security score
  const vtEngine = job.analysis_report?.security?.engines?.virustotal ||
                   job.analysis_report?.security_scan?.engines?.virustotal ||
                   job.analysis_report?.security?.virustotal ||
                   job.analysis_report?.security_scan?.virustotal;
  const vtScore: string | null = vtEngine?.detection_ratio ||
                  (vtEngine?.total_engines ? `${vtEngine.malicious || 0}/${vtEngine.total_engines}` : null);
  const vtStatus: string | null = vtEngine?.status ||
                   (vtEngine?.malicious === 0 ? 'clean' : (vtEngine?.malicious > 0 ? 'malicious' : null));

  // Extract resolved APK SHA256 (modded or analyzed)
  const resolvedNewHash: string | null = job.modded_apk_hash ||
                                         job.apk_hash ||
                                         job.analysis_report?.sha256 ||
                                         job.analysis_report?.security?.engines?.virustotal?.sha256 ||
                                         job.analysis_report?.security_scan?.engines?.virustotal?.sha256 ||
                                         null;

  // Detect variant architecture and channel
  const rawVariant = (job.analysis_report?.variant || '').toUpperCase().replace('-', '_');
  const rawArchs: string[] = job.analysis_report?.architectures || [];
  const isBeta = (job.version_name || '').toLowerCase().includes('beta') ||
                 (job.app_name || '').toLowerCase().includes('beta') ||
                 (job.analysis_report?.target_channel || '').toLowerCase().includes('beta');
  const targetChannel = isBeta ? 'Beta' : 'Stable';

  let detectedArch = rawVariant;
  if (!detectedArch) {
    if (rawArchs.length > 1) detectedArch = 'UNIVERSAL';
    else if (rawArchs.includes('arm64-v8a')) detectedArch = 'ARM64_V8A';
    else if (rawArchs.includes('armeabi-v7a')) detectedArch = 'ARMEABI_V7A';
    else if (rawArchs.includes('x86')) detectedArch = 'X86';
    else detectedArch = 'UNIVERSAL';
  }

  // 2. Fetch existing listing from PrimeStore catalog
  let listingId: string | null = null;
  let listingUpdated = false;
  let listingCreated = false;

  let { data: existingListings } = await supabase
    .from('listings')
    .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName", variants, screenshots')
    .eq('packageName', pkg);

  if (!existingListings || existingListings.length === 0) {
    const { data: titleListings } = await supabase
      .from('listings')
      .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName", variants, screenshots')
      .ilike('title', `%${appTitle.split(' ')[0]}%`);
    if (titleListings && titleListings.length > 0) {
      existingListings = titleListings;
    }
  }

  if (existingListings && existingListings.length > 0) {
    const target = existingListings[0];
    listingId = target.id;

    let updatedVariants = Array.isArray(target.variants) ? [...target.variants] : [];
    let variantMatched = false;

    if (updatedVariants.length > 0) {
      updatedVariants = updatedVariants.map((v: any) => {
        const vArch = (v.architecture || '').toUpperCase().replace('-', '_');
        const vChan = (v.releaseChannel || 'Stable').toLowerCase();
        const archMatch = vArch === detectedArch || (detectedArch === 'UNIVERSAL' && vArch.includes('UNIVERSAL'));
        const chanMatch = isBeta ? vChan.includes('beta') : !vChan.includes('beta');

        if (archMatch && chanMatch) {
          variantMatched = true;
          return {
            ...v,
            fileUrl: moddedUrl,
            version: cleanVer,
            screenshots: jobScreenshots.length > 0 ? jobScreenshots : (v.screenshots || []),
            fileSize: job.modded_apk_size ? Number(job.modded_apk_size) : v.fileSize,
            fileHash: resolvedNewHash || job.modded_apk_hash || v.fileHash,
            ...(vtScore ? { virusTotalScore: vtScore } : {}),
            ...(vtStatus ? { virusTotalStatus: vtStatus } : {}),
            updatedAt: Date.now(),
          };
        }
        return v;
      });

      if (!variantMatched) {
        updatedVariants.push({
          platform: 'TV',
          architecture: detectedArch,
          releaseChannel: targetChannel,
          version: cleanVer,
          fileUrl: moddedUrl,
          fileHost: moddedUrl.includes('catbox') ? 'CUSTOM_URL' : 'GITHUB',
          screenshots: jobScreenshots.length > 0 ? jobScreenshots : [],
          fileSize: job.modded_apk_size ? Number(job.modded_apk_size) : undefined,
          fileHash: resolvedNewHash || job.modded_apk_hash || undefined,
          ...(vtScore ? { virusTotalScore: vtScore } : {}),
          ...(vtStatus ? { virusTotalStatus: vtStatus } : {}),
          updatedAt: Date.now(),
        });
      }
    }

    // Only update root listing fileUrl if this is Stable Universal, Stable ARM64, or if there are no variants
    const isPrimaryArch = ['UNIVERSAL', 'ARM64_V8A'].includes(detectedArch);
    const shouldUpdateRoot = (!isBeta && isPrimaryArch) || updatedVariants.length === 0;

    const updatePayload: any = {
      status: 'PUBLISHED',
      updatedAt: Date.now(),
    };

    if (updatedVariants.length > 0) {
      updatePayload.variants = updatedVariants;
    }

    if (shouldUpdateRoot) {
      updatePayload.fileUrl = moddedUrl;
      updatePayload.version = versionString;
      if (job.modded_apk_size) updatePayload.file_size = String(job.modded_apk_size);
      if (resolvedNewHash || job.modded_apk_hash) updatePayload.fileHash = resolvedNewHash || job.modded_apk_hash;
      if (vtScore) updatePayload.virusTotalScore = vtScore;
      if (vtStatus) updatePayload.virusTotalStatus = vtStatus;
    }

    // 1. High-Quality In-App Screenshots:
    // Update listing showcase if it's the primary build, or if current screenshots are empty or generic placeholders
    if (jobScreenshots.length > 0) {
      const existingShots = Array.isArray(target.screenshots) ? target.screenshots : [];
      const hasOnlyPlaceholders = existingShots.length === 0 || existingShots.every((s: string) => s.includes('ss-png.jpg') || s.includes('placeholder'));
      if (shouldUpdateRoot || hasOnlyPlaceholders) {
        updatePayload.screenshots = jobScreenshots;
      }
    }

    // 2. Logo Refresh (Safe & Official):
    // Refresh the store's main logo ONLY if this is a STABLE variant and we have an extracted high-res icon!
    // Beta builds NEVER overwrite the clean store logo.
    if (!isBeta && stableLogoCandidate) {
      updatePayload.logoUrl = stableLogoCandidate;
    }

    // Update via security definer RPC first (bypasses RLS safely), fallback to direct update
    const { error: rpcErr } = await supabase.rpc('primeforge_update_listing_full', {
      p_listing_id: target.id,
      p_payload: updatePayload,
    });

    if (!rpcErr) {
      listingUpdated = true;
    } else {
      console.warn('primeforge_update_listing_full RPC error, trying direct update:', rpcErr);
      const { error: listErr } = await supabase
        .from('listings')
        .update(updatePayload)
        .eq('id', target.id);
      if (!listErr) listingUpdated = true;
    }
  } else {
    // Create new listing
    const newListing: any = {
      ownerId: '23bda8cb-0b46-4090-9d8a-10fa3f7b36b9',
      ownerName: 'PrimeForge AI',
      categoryId: 'apk_cat_2',
      categoryName: 'Araçlar & Üretkenlik',
      type: 'APK',
      title: appTitle,
      description: `${appTitle} - PrimeForge tarafından otomatik optimize edilmiş ve temizlenmiş sürüm.\n\n### ✨ Özellikler:\n- Reklam ve gereksiz izinler temizlendi\n- Keystore ile imzalandı\n- Android TV & Mobil uyumlu`,
      logoUrl: (!isBeta ? stableLogoCandidate : null) || job.analysis_report?.logo_url || 'https://raw.githubusercontent.com/simurgulgen/PrimeStore/main/public/icon.png',
      screenshots: jobScreenshots,
      fileHost: moddedUrl.includes('catbox') ? 'CUSTOM_URL' : 'GITHUB',
      fileUrl: moddedUrl,
      status: 'PUBLISHED',
      version: versionString,
      packageName: pkg,
      file_size: job.modded_apk_size ? String(job.modded_apk_size) : null,
      fileHash: job.modded_apk_hash || null,
      virusTotalScore: vtScore || null,
      virusTotalStatus: vtStatus || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      downloadCount: 0,
      rating: 5,
      publisherMode: 'sharer',
      variants: [{
        platform: 'TV',
        architecture: detectedArch || 'UNIVERSAL',
        releaseChannel: targetChannel,
        version: cleanVer,
        fileUrl: moddedUrl,
        fileHost: moddedUrl.includes('catbox') ? 'CUSTOM_URL' : 'GITHUB',
        screenshots: jobScreenshots,
        fileSize: job.modded_apk_size ? Number(job.modded_apk_size) : undefined,
        fileHash: job.modded_apk_hash || undefined,
        virusTotalScore: vtScore || undefined,
        virusTotalStatus: vtStatus || undefined,
        updatedAt: Date.now(),
      }],
    };

    const { data: inserted, error: insertErr } = await supabase.rpc('primeforge_insert_listing', {
      p_listing: newListing,
    });

    if (!insertErr && inserted) {
      listingCreated = true;
      listingId = inserted.id;
    } else {
      const { data: directInsert, error: directErr } = await supabase
        .from('listings')
        .insert(newListing)
        .select('id')
        .single();

      if (!directErr && directInsert) {
        listingCreated = true;
        listingId = directInsert.id;
      }
    }
  }

  // 3. Update forge_jobs table
  await supabase
    .from('forge_jobs')
    .update({
      status: 'published',
      decision: 'approved',
      listing_id: listingId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  // 4. Send Telegram celebration announcement with variant badge!
  await sendTelegramPublishAlert(
    `🚀 <b>PrimeStore'da Başarıyla Yayınlandı!</b>\n\n` +
    `📱 <b>Uygulama:</b> <b>${appTitle}</b>\n` +
    `📦 <b>Paket:</b> <code>${pkg}</code>\n` +
    `🏷️ <b>Sürüm:</b> <code>${versionString}</code>\n` +
    `📐 <b>Varyant:</b> <code>[${detectedArch || 'UNIVERSAL'}] (${targetChannel})</code>\n` +
    `🔗 <b>APK İndir:</b> <a href="${moddedUrl}">Doğrudan İndirme Bağlantısı</a>\n` +
    `🏪 <b>Mağaza Durumu:</b> ${listingCreated ? '✨ Yeni Uygulama PrimeStore Kataloğuna Eklendi' : '✅ PrimeStore Kataloğunda Varyant Güncellendi'}\n` +
    `🆔 <b>Job ID:</b> <code>#${job.id.substring(0, 8)}</code>`
  );

  return {
    success: true,
    message: `Modlu APK (${detectedArch} - ${targetChannel}) PrimeStore kataloğunda başarıyla yayına alındı.`,
    job_id: job.id,
    package_name: pkg,
    app_name: appTitle,
    version: versionString,
    variant: detectedArch,
    channel: targetChannel,
    modded_url: moddedUrl,
    listing_id: listingId,
    listing_status: listingCreated ? 'created' : listingUpdated ? 'updated' : 'unlinked',
  };
}

export async function publishAllVariantsForPackage(packageName: string) {
  const { data: waitingJobs } = await supabase
    .from('forge_jobs')
    .select('id, app_name, version_name, modded_apk_url, status')
    .eq('package_name', packageName)
    .in('status', ['waiting_approval', 'completed'])
    .not('modded_apk_url', 'is', null);

  if (!waitingJobs || waitingJobs.length === 0) {
    return { success: false, error: 'Yayınlanmaya hazır modlu varyant bulunamadı.' };
  }

  const results = [];
  for (const j of waitingJobs) {
    const res = await publishJobToPrimeStore(j.id);
    results.push(res);
  }

  return {
    success: results.some((r) => r.success),
    total_published: results.filter((r) => r.success).length,
    results,
  };
}
