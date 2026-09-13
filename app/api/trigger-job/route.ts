import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8209993669:AAHAF0HMUMKbfKNV2EdOnSvFUeroxIY1aU4';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '761864148';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { apk_url, action = 'full_mod', package_name, profile, app_name, version_name, mod_options, custom_notes, publish_mode = 'manual_review' } = body;

    // Auto-fill package_name if not provided but profile looks like a package
    if (!package_name && profile && profile.includes('.')) {
      package_name = profile;
    }

    // Try resolving app_name and version from catalog if missing
    if (!app_name && package_name) {
      try {
        const { data: appData } = await supabase
          .from('prime_apps')
          .select('title, version_name')
          .eq('package_name', package_name)
          .maybeSingle();
        if (appData) {
          app_name = appData.title;
          if (!version_name) version_name = appData.version_name;
        }
      } catch (_) {}
    }

    // 1. Insert into forge_jobs
    const insertPayload: any = {
      apk_url,
      action,
      package_name: package_name || null,
      app_name: app_name || null,
      version_name: version_name || null,
      profile_used: profile || null,
      status: 'pending',
      analysis_report: {
        requested_mod_options: mod_options || {},
        custom_notes: custom_notes || '',
        publish_mode: publish_mode || 'manual_review',
      },
    };

    const { data: job, error: dbError } = await supabase
      .from('forge_jobs')
      .insert(insertPayload)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    const jobId = job?.id || `web-${Date.now()}`;

    // 2. Dispatch GitHub Actions workflow
    let dispatchSuccess = false;
    if (GITHUB_TOKEN) {
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'PrimeForge-Web',
          },
          body: JSON.stringify({
            event_type: 'patch-apk',
            client_payload: {
              apk_url,
              action,
              package_name,
              app_name,
              version_name,
              profile,
              job_id: jobId,
              mod_options: mod_options || {},
              custom_notes: custom_notes || '',
            },
          }),
        });
        dispatchSuccess = ghRes.status === 200 || ghRes.status === 204;
      } catch (err) {
        console.error('GitHub dispatch error:', err);
      }
    }

    // 3. Send Rich Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const actionLabels: Record<string, string> = {
        full_mod: '🛠️ Tam Modlama & Emülatör Testi',
        custom_mod: '🎯 İnteraktif Özelleştirilmiş Mod',
        sanitize_only: '🧹 İzin & Manifest Temizliği',
        analyze_only: '🔍 Yalnızca Güvenlik & Statik Analiz',
        rebuild_only: '⚡ Yeniden Derleme & İmzala',
      };
      const actionLabel = actionLabels[action] || action;

      const appTitle = app_name ? `<b>${app_name}</b>` : (package_name ? `<code>${package_name}</code>` : 'Bilinmeyen APK');
      const pkgLabel = package_name ? `<code>${package_name}</code>` : '<i>Analizde çıkarılacak</i>';
      const verLabel = version_name ? `v${version_name}` : '<i>Analizde çıkarılacak</i>';
      const shortId = jobId.substring(0, 8);

      let optionsListText = '';
      if (mod_options && typeof mod_options === 'object') {
        const optNames: string[] = [];
        if (mod_options.unlock_premium) optNames.push('🔓 Premium Kilidi Aç');
        if (mod_options.remove_ads) optNames.push('🚫 Reklam & Takipçi Temizle');
        if (mod_options.strip_permissions) optNames.push('🧹 İzin Temizliği');
        if (mod_options.bypass_update) optNames.push('🔄 Zorunlu Güncelleme Bypass');
        if (mod_options.enable_tv_compat) optNames.push('📺 Android TV Optimizasyonu');
        if (optNames.length > 0) {
          optionsListText = `\n⚙️ <b>Seçilen Modlar:</b>\n• ${optNames.join('\n• ')}\n`;
        }
      }

      const msg = `🚀 <b>PrimeForge — Yeni İş Kuyruğa Alındı</b>\n\n` +
        `📱 <b>Uygulama:</b> ${appTitle}\n` +
        `📦 <b>Paket:</b> ${pkgLabel}\n` +
        `🏷️ <b>Sürüm:</b> ${verLabel}\n` +
        `🎯 <b>İşlem Modu:</b> ${actionLabel}\n` +
        `🛡️ <b>Yayınlama:</b> ${publish_mode === 'manual_review' ? '🔒 Manuel İnceleme (PrimeStore Onayı Beklenecek)' : '⚡ Otomatik Yayınla'}\n` +
        optionsListText +
        `🆔 <b>Job ID:</b> <code>#${shortId}</code>\n` +
        `⚡ <b>GitHub Runner:</b> ${dispatchSuccess ? '✅ Tetiklendi (İşleniyor)' : '⏳ Kuyrukta Bekliyor'}\n\n` +
        `🔗 <a href="https://prime-forge-8iec.vercel.app/jobs">Canlı Takip & Emülatör Raporu ↗</a>`;

      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: msg,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📊 Dashboard', url: 'https://prime-forge-8iec.vercel.app/jobs' },
                { text: '⚡ Durum', callback_data: `forge:status:${jobId}` },
                { text: '🛑 İptal Et', callback_data: `forge:cancel:${jobId}` },
              ],
            ],
          },
        }),
      }).catch((e) => console.error('Telegram error:', e));
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      dispatched: dispatchSuccess,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
