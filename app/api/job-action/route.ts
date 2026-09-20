import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { publishJobToPrimeStore, publishAllVariantsForPackage } from '@/lib/store-publish';

const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8901088416:AAG3u11MrrgUZrjWoXHwL1IhnX5cfVx-BZM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '761864148';

async function sendTelegramAlert(text: string, replyMarkup?: any) {
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
    console.error('Failed to send Telegram alert:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, jobId } = body;

    // Clear old failed/cancelled jobs
    if (action === 'clear_failed') {
      const { error: delErr } = await supabase
        .from('forge_jobs')
        .delete()
        .in('status', ['failed', 'cancelled']);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Eski hatalı görev kayıtları temizlendi.',
      });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'jobId parametresi zorunludur.' }, { status: 400 });
    }

    // 1. Fetch current job
    const { data: job, error: jobErr } = await supabase
      .from('forge_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'İş kaydı bulunamadı.' }, { status: 404 });
    }

    const pkg = job.package_name || 'Bilinmiyor';
    const appTitle = job.app_name || job.analysis_report?.app_label || pkg;
    const shortId = jobId.substring(0, 8);

    // ==========================================
    // ACTION 1: CANCEL JOB
    // ==========================================
    if (action === 'cancel') {
      // 1a. Update database status
      const { error: updateErr } = await supabase
        .from('forge_jobs')
        .update({
          status: 'cancelled',
          decision: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // 1b. Attempt to cancel active GitHub Actions workflow run if token is present
      let ghCancelled = false;
      if (GITHUB_TOKEN) {
        try {
          if (job.github_run_id) {
            await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${job.github_run_id}/cancel`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'PrimeForge-Cancel',
              },
            });
            ghCancelled = true;
          }

          // Also check any active in_progress runs
          const runsRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?status=in_progress&per_page=10`, {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'PrimeForge-Cancel',
            },
          });
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            const activeRuns = runsData.workflow_runs || [];
            for (const run of activeRuns) {
              await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${run.id}/cancel`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${GITHUB_TOKEN}`,
                  Accept: 'application/vnd.github.v3+json',
                  'User-Agent': 'PrimeForge-Cancel',
                },
              });
              ghCancelled = true;
            }
          }
        } catch (e) {
          console.error('GitHub Actions cancellation error:', e);
        }
      }

      // 1c. Notify Telegram
      await sendTelegramAlert(
        `🛑 <b>Görev İptal Edildi!</b>\n\n` +
        `📱 <b>Uygulama:</b> ${appTitle}\n` +
        `📦 <b>Paket:</b> <code>${pkg}</code>\n` +
        `🆔 <b>Job ID:</b> <code>#${shortId}</code>\n` +
        `⚡ <b>Durum:</b> Kullanıcı arayüzünden durduruldu.`
      );

      return NextResponse.json({
        success: true,
        message: 'Görev başarıyla iptal edildi.',
        job_id: jobId,
        status: 'cancelled',
        github_cancelled: ghCancelled,
      });
    }

    // ==========================================
    // ACTION 2: PUBLISH TO PRIMESTORE (MANUAL APPROVAL)
    // ==========================================
    if (action === 'publish') {
      const res = await publishJobToPrimeStore(jobId);
      if (!res.success) {
        return NextResponse.json({ error: res.error || 'Yayınlama başarısız oldu.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Modlu APK PrimeStore kataloğunda başarıyla yayına alındı.',
        job_id: res.job_id,
        status: 'published',
        listing_updated: res.listing_status === 'updated',
        listing_created: res.listing_status === 'created',
        listing_id: res.listing_id,
      });
    }

    // ==========================================
    // ACTION 3: BATCH PUBLISH ALL READY VARIANTS
    // ==========================================
    if (action === 'publish_all') {
      const targetPkg = (job as any)?.package_name;
      if (!targetPkg) {
        return NextResponse.json({ error: 'Paket adı belirlenemedi.' }, { status: 400 });
      }

      const res = await publishAllVariantsForPackage(targetPkg);
      if (!res.success) {
        return NextResponse.json({ error: res.error || 'Toplu yayınlama başarısız oldu.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `${res.total_published} varyant başarıyla PrimeStore kataloğunda yayına alındı.`,
        total_published: res.total_published,
        results: res.results,
      });
    }

    return NextResponse.json({ error: `Desteklenmeyen işlem türü: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Job action error:', err);
    return NextResponse.json({ error: err.message || 'Sunucu hatası' }, { status: 500 });
  }
}
