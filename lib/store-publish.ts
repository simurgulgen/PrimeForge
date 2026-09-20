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
    .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName", variants')
    .eq('packageName', pkg);

  if (!existingListings || existingListings.length === 0) {
    const { data: titleListings } = await supabase
      .from('listings')
      .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName", variants')
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
            fileSize: job.modded_apk_size ? Number(job.modded_apk_size) : v.fileSize,
            fileHash: job.modded_apk_hash || v.fileHash,
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
          fileSize: job.modded_apk_size ? Number(job.modded_apk_size) : undefined,
          fileHash: job.modded_apk_hash || undefined,
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
      if (job.modded_apk_hash) updatePayload.fileHash = job.modded_apk_hash;
    }

    const { error: listErr } = await supabase
      .from('listings')
      .update(updatePayload)
      .eq('id', target.id);

    if (!listErr) listingUpdated = true;
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
      logoUrl: job.analysis_report?.logo_url || 'https://raw.githubusercontent.com/simurgulgen/PrimeStore/main/public/icon.png',
      screenshots: job.analysis_report?.screenshots || [],
      fileHost: moddedUrl.includes('catbox') ? 'CUSTOM_URL' : 'GITHUB',
      fileUrl: moddedUrl,
      status: 'PUBLISHED',
      version: versionString,
      packageName: pkg,
      file_size: job.modded_apk_size ? String(job.modded_apk_size) : null,
      fileHash: job.modded_apk_hash || null,
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
        fileSize: job.modded_apk_size ? Number(job.modded_apk_size) : undefined,
        fileHash: job.modded_apk_hash || undefined,
        updatedAt: Date.now(),
      }],
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('listings')
      .insert(newListing)
      .select('id')
      .single();

    if (!insertErr && inserted) {
      listingCreated = true;
      listingId = inserted.id;
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
