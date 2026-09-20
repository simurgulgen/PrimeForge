// lib/store-publish.ts
// Unified publishing helper for PrimeStore & Telegram Bot callbacks

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
  try {
    // 1. Primary path: atomic RPC (SECURITY DEFINER in Postgres, completely immune to RLS)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('publish_forge_job_to_listings', {
      p_job_id: jobIdOrPkg,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      await sendTelegramPublishAlert(
        `🚀 <b>PrimeStore'da Başarıyla Yayınlandı!</b>\n\n` +
        `📱 <b>Uygulama:</b> <b>${rpcRes.app_name}</b>\n` +
        `📦 <b>Paket:</b> <code>${rpcRes.package_name}</code>\n` +
        `🏷️ <b>Sürüm:</b> <code>${rpcRes.version}</code>\n` +
        `🔗 <b>APK İndir:</b> <a href="${rpcRes.modded_url}">Doğrudan İndirme Bağlantısı</a>\n` +
        `🏪 <b>Mağaza Durumu:</b> ${rpcRes.is_new ? '✨ Yeni Uygulama PrimeStore Kataloğuna Eklendi' : '✅ PrimeStore Kataloğu Güncellendi'}\n` +
        `🆔 <b>Job ID:</b> <code>#${rpcRes.job_id.substring(0, 8)}</code>`
      );

      return {
        success: true,
        message: 'Modlu APK PrimeStore kataloğunda başarıyla yayına alındı.',
        job_id: rpcRes.job_id,
        package_name: rpcRes.package_name,
        app_name: rpcRes.app_name,
        version: rpcRes.version,
        modded_url: rpcRes.modded_url,
        listing_id: rpcRes.listing_id,
        listing_status: rpcRes.is_new ? 'created' : 'updated',
      };
    }
  } catch (rpcEx) {
    console.warn('publish_forge_job_to_listings RPC fallback:', rpcEx);
  }

  // 2. Fallback: Fetch job by ID or package_name
  let job: any = null;
  const { data: jobById } = await supabase
    .from('forge_jobs')
    .select('*')
    .eq('id', jobIdOrPkg)
    .maybeSingle();

  if (jobById) {
    job = jobById;
  } else {
    // Try by package name
    const { data: jobByPkg } = await supabase
      .from('forge_jobs')
      .select('*')
      .eq('package_name', jobIdOrPkg)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobByPkg) {
      job = jobByPkg;
    } else {
      // Fallback: look for latest waiting_approval or modded job
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

  // 2. Check or create listing in 'listings' table (PrimeStore Catalog)
  let listingUpdated = false;
  let listingCreated = false;
  let listingId: string | null = null;

  if (pkg) {
    // A. Search by exact package name
    let { data: existingListings } = await supabase
      .from('listings')
      .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName"')
      .eq('packageName', pkg);

    // B. Search by normalized package name (e.g. com.foobnix.pro.pdf.reader vs com.foobnix.pdf.reader)
    if (!existingListings || existingListings.length === 0) {
      const normalizedPkg = pkg.replace('.pro.', '.').replace('.lite.', '.').replace('.plus.', '.').replace('.free.', '.');
      const { data: normalizedListings } = await supabase
        .from('listings')
        .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName"')
        .ilike('packageName', `%${normalizedPkg.split('.').slice(1).join('.')}%`);
      if (normalizedListings && normalizedListings.length > 0) {
        existingListings = normalizedListings;
      }
    }

    // C. Search by title match if still not found
    if (!existingListings || existingListings.length === 0) {
      const firstWord = appTitle.split(' ')[0];
      if (firstWord && firstWord.length > 3) {
        const { data: titleListings } = await supabase
          .from('listings')
          .select('id, title, version, "packageName", "logoUrl", "categoryId", "categoryName"')
          .ilike('title', `%${firstWord}%`);
        if (titleListings && titleListings.length > 0) {
          existingListings = titleListings;
        }
      }
    }

    if (existingListings && existingListings.length > 0) {
      const target = existingListings[0];
      listingId = target.id;
      const { error: listErr } = await supabase
        .from('listings')
        .update({
          fileUrl: moddedUrl,
          version: versionString,
          status: 'PUBLISHED',
          updatedAt: Date.now(),
        })
        .eq('id', target.id);

      if (!listErr) listingUpdated = true;
    } else {
      // Create a brand new listing in listings
      const newListing = {
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

  // 4. Send Telegram celebration announcement
  await sendTelegramPublishAlert(
    `🚀 <b>PrimeStore'da Başarıyla Yayınlandı!</b>\n\n` +
    `📱 <b>Uygulama:</b> <b>${appTitle}</b>\n` +
    `📦 <b>Paket:</b> <code>${pkg}</code>\n` +
    `🏷️ <b>Sürüm:</b> <code>${versionString}</code>\n` +
    `🔗 <b>APK İndir:</b> <a href="${moddedUrl}">Doğrudan İndirme Bağlantısı</a>\n` +
    `🏪 <b>Mağaza Durumu:</b> ${listingCreated ? '✨ Yeni Uygulama PrimeStore Kataloğuna Eklendi' : '✅ PrimeStore Kataloğu Güncellendi'}\n` +
    `🆔 <b>Job ID:</b> <code>#${job.id.substring(0, 8)}</code>`
  );

  return {
    success: true,
    message: 'Modlu APK PrimeStore kataloğunda başarıyla yayına alındı.',
    job_id: job.id,
    package_name: pkg,
    app_name: appTitle,
    version: versionString,
    modded_url: moddedUrl,
    listing_id: listingId,
    listing_status: listingCreated ? 'created' : listingUpdated ? 'updated' : 'unlinked',
  };
}
