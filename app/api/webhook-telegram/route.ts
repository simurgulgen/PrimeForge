import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { publishJobToPrimeStore } from '@/lib/store-publish';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8901088416:AAG3u11MrrgUZrjWoXHwL1IhnX5cfVx-BZM';
const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // 1. Handle Inline Button Callback
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const parts = data.split(':');

      if (parts[0] === 'forge' && parts.length >= 3) {
        const action = parts[1];
        const jobId = parts[2];

        if (action === 'publish') {
          const res = await publishJobToPrimeStore(jobId);
          if (res.success) {
            await answerCallbackQuery(cb.id, '🎉 PrimeStore\'da Yayınlandı!');
          } else {
            await answerCallbackQuery(cb.id, `Hata: ${res.error || 'Yayınlanamadı'}`);
            if (chatId) {
              await sendTelegramMessage(chatId, `⚠️ <b>Yayınlama Hatası:</b> ${res.error || 'İş kaydı veya APK bulunamadı'}`);
            }
          }
          return NextResponse.json({ ok: true, ...res });
        }

        if (action === 'cancel') {
          await supabase
            .from('forge_jobs')
            .update({ status: 'cancelled', decision: 'rejected' })
            .eq('id', jobId);

          await answerCallbackQuery(cb.id, 'İptal edildi');
          await sendTelegramMessage(chatId, `❌ İşlem iptal edildi: #${jobId.substring(0, 8)}`);
          return NextResponse.json({ ok: true });
        }

        if (action === 'full_mod' || action === 'sanitize_only') {
          const { data: job } = await supabase.from('forge_jobs').select('*').eq('id', jobId).single();
          if (job && GITHUB_TOKEN) {
            await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                event_type: 'patch-apk',
                client_payload: {
                  apk_url: job.apk_url,
                  action,
                  job_id: jobId,
                },
              }),
            });

            // Update job state in Supabase so frontend immediately reflects active execution
            await supabase
              .from('forge_jobs')
              .update({
                status: 'pending',
                action,
                error_message: null,
                github_run_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', jobId);

            await answerCallbackQuery(cb.id, 'İşlem tetiklendi!');
            await sendTelegramMessage(chatId, `⚡ GitHub Actions başlatıldı: <b>${action}</b>`);
          }
          return NextResponse.json({ ok: true });
        }
      }

      await answerCallbackQuery(cb.id);
      return NextResponse.json({ ok: true });
    }

    // 2. Handle Text Command
    if (update.message && update.message.text) {
      const msg = update.message;
      const text = msg.text.trim();
      const chatId = msg.chat.id;
      const parts = text.split(' ');
      const cmd = parts[0].toLowerCase();

      if (cmd === '/start' || cmd === '/help') {
        const help = `🔧 <b>PrimeForge Telegram Bot</b>\n\n` +
          `• <code>/mod &lt;APK_URL&gt;</code> — Tam modlama başlat\n` +
          `• <code>/analyze &lt;APK_URL&gt;</code> — Statik analiz yap\n` +
          `• <code>/sanitize &lt;APK_URL&gt;</code> — Sadece izin temizle\n` +
          `• <code>/status</code> — Son durumlar\n\n` +
          `Web Dashboard: <a href="https://prime-forge-8iec.vercel.app">Vercel Dashboard</a>`;
        await sendTelegramMessage(chatId, help);
        return NextResponse.json({ ok: true });
      }

      if (['/mod', '/analyze', '/sanitize'].includes(cmd)) {
        if (parts.length < 2) {
          await sendTelegramMessage(chatId, `⚠️ Lütfen APK indirme bağlantısı girin.\nÖrnek: <code>${cmd} https://example.com/app.apk</code>`);
          return NextResponse.json({ ok: true });
        }
        const apkUrl = parts[1];
        const actionMap: Record<string, string> = {
          '/mod': 'full_mod',
          '/analyze': 'analyze_only',
          '/sanitize': 'sanitize_only',
        };
        const action = actionMap[cmd];

        const { data: job } = await supabase
          .from('forge_jobs')
          .insert({
            apk_url: apkUrl,
            action,
            status: 'pending',
          })
          .select()
          .single();

        const jobId = job?.id || `bot-${Date.now()}`;

        if (GITHUB_TOKEN) {
          await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event_type: 'patch-apk',
              client_payload: {
                apk_url: apkUrl,
                action,
                job_id: jobId,
              },
            }),
          });
        }

        await sendTelegramMessage(
          chatId,
          `📥 <b>İş Kuyruğa Alındı</b>\n\n` +
          `🎯 İşlem: <code>${action}</code>\n` +
          `🔗 APK: ${apkUrl}\n` +
          `🆔 Job: <code>#${jobId.substring(0, 8)}</code>\n\n` +
          `⚡ Pipeline çalıştırılıyor...`
        );
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
