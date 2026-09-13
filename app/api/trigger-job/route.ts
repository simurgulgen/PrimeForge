import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8209993669:AAHAF0HMUMKbfKNV2EdOnSvFUeroxIY1aU4';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '761864148';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apk_url, action = 'full_mod', package_name, profile } = body;

    if (!apk_url) {
      return NextResponse.json({ error: 'apk_url is required' }, { status: 400 });
    }

    // 1. Insert into forge_jobs
    const { data: job, error: dbError } = await supabase
      .from('forge_jobs')
      .insert({
        apk_url,
        action,
        package_name: package_name || null,
        profile_used: profile || null,
        status: 'pending',
      })
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
              profile,
              job_id: jobId,
            },
          }),
        });
        dispatchSuccess = ghRes.status === 200 || ghRes.status === 204;
      } catch (err) {
        console.error('GitHub dispatch error:', err);
      }
    }

    // 3. Send Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const msg = `🌐 <b>Web Dashboard'dan İş Başlatıldı</b>\n\n` +
        `📦 APK: <code>${apk_url}</code>\n` +
        `🎯 İşlem: <code>${action}</code>\n` +
        `🆔 Job ID: <code>${jobId}</code>\n` +
        `⚡ GitHub Dispatch: ${dispatchSuccess ? '✅ Başarılı' : '⚠️ Token gerekli'}`;

      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: msg,
          parse_mode: 'HTML',
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
