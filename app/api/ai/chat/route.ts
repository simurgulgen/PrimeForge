import { NextResponse } from 'next/server';
import { sendAIChatRequest, AIMessage, AISettings, DEFAULT_AI_SETTINGS, MANDATORY_TURKISH_INSTRUCTION } from '@/lib/ai-service';
import { restartAIServer, getAIServerState } from '@/lib/ai-server-manager';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isRestartCommand(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const triggers = [
    'yapay zeka serverini yeniden baslat',
    'yapay zeka serverını yeniden başlat',
    'yapay zeka sunucusunu yeniden baslat',
    'yapay zeka sunucusunu yeniden başlat',
    'serveri yeniden baslat',
    'serverı yeniden başlat',
    'sunucuyu yeniden baslat',
    'sunucuyu yeniden başlat',
    'serveri restart et',
    'serverı restart et',
    'restart server',
    'ai server restart',
    'fcc server restart',
    'fcc sunucusunu yeniden baslat',
    'fcc sunucusunu yeniden başlat',
    'yapay zekayi yeniden baslat',
    'yapay zekayı yeniden başlat',
    'restart',
  ];

  return triggers.some((t) => normalized === t || normalized.startsWith(t) || normalized.includes('serverını yeniden başlat') || normalized.includes('sunucuyu yeniden başlat'));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages = [], job_id } = body;

    // Fetch persistent settings from Supabase forge_settings
    let resolvedSettings: AISettings = DEFAULT_AI_SETTINGS;
    try {
      const { data: dbSettings } = await supabase
        .from('forge_settings')
        .select('value')
        .eq('key', 'ai_studio_settings')
        .maybeSingle();

      if (dbSettings?.value) {
        resolvedSettings = { ...DEFAULT_AI_SETTINGS, ...dbSettings.value };
      }
    } catch (dbErr) {
      console.warn('Failed to load persistent AI settings from db:', dbErr);
    }

    // Merge client-provided settings if any
    if (body.settings && typeof body.settings === 'object') {
      resolvedSettings = {
        ...resolvedSettings,
        ...body.settings,
        keys: {
          ...(resolvedSettings.keys || {}),
          ...(body.settings.keys || {}),
        },
      };
      if (body.settings.apiKey) resolvedSettings.apiKey = body.settings.apiKey;
    }

    const settings = resolvedSettings;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mesaj listesi boş olamaz.' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const userPrompt = lastMessage?.role === 'user' ? lastMessage.content : '';

    // Check if user is saying "yapay zeka serverını yeniden başlat"
    if (userPrompt && isRestartCommand(userPrompt)) {
      const restartResult = await restartAIServer('chat_command');
      const serverState = await getAIServerState();

      const responseMarkdown = `🔄 **AI Sunucusu Başarıyla Yeniden Başlatıldı!**\n\n` +
        `Yapay zeka motoru, model bağlantıları ve önbellek oturumu başarıyla tazelendi.\n\n` +
        `| Parametre | Değer |\n` +
        `|---|---|\n` +
        `| **Sunucu Durumu** | 🟢 **Çevrimiçi & Sağlıklı** |\n` +
        `| **Aktif Sağlayıcı** | \`${restartResult.activeProvider.toUpperCase()}\` |\n` +
        `| **Aktif Model** | \`${restartResult.activeModel}\` |\n` +
        `| **Yedek (FCC Fallback)** | \`${serverState.fallbackModel}\` |\n` +
        `| **Tepki Süresi (Ping)** | **${restartResult.latencyMs} ms** |\n` +
        `| **Yeniden Başlatma Zamanı** | \`${new Date(restartResult.restartedAt).toLocaleTimeString('tr-TR')} (UTC+3)\` |\n` +
        `| **Motor Türü** | \`${serverState.serverType}\` |\n\n` +
        `> [!TIP]\n` +
        `> Yapay zeka çekirdeği sıfırlandı. APK analizlerine veya sorularınıza devam edebilirsiniz.`;

      return NextResponse.json({
        success: true,
        text: responseMarkdown,
        modelUsed: restartResult.activeModel,
        restarted: true,
        serverState,
      });
    }

    let finalSystemPrompt = settings.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt;

    // If job_id is provided, attach APK context to the prompt
    if (job_id) {
      try {
        const { data: job } = await supabase
          .from('forge_jobs')
          .select('id, app_name, package_name, version_name, action, status, analysis_report')
          .eq('id', job_id)
          .maybeSingle();

        if (job) {
          const report = job.analysis_report || {};
          const perms = report.permissions || {};
          const dangerous = perms.dangerous || [];
          const adRelated = perms.ad_related || [];
          const allPerms = perms.all || [];
          const ads = report.ad_networks || [];
          const drm = report.drm_systems || [];

          finalSystemPrompt += `\n\n--- ŞU ANDA İNCELENEN AKTİF APK BAĞLAMI ---\n` +
            `Uygulama Adı: ${job.app_name || 'Bilinmiyor'}\n` +
            `Paket Adı: ${job.package_name || 'Bilinmiyor'}\n` +
            `Sürüm: ${job.version_name || '?'}\n` +
            `İşlem Türü: ${job.action}\n` +
            `Tehlikeli İzinler (${dangerous.length}): ${dangerous.join(', ') || 'Yok'}\n` +
            `Reklam İzinleri: ${adRelated.join(', ') || 'Yok'}\n` +
            `Tüm İzinler (${allPerms.length}): ${allPerms.slice(0, 25).join(', ')}\n` +
            `Tespit Edilen Reklam Ağları: ${ads.map((a: any) => a.name).join(', ') || 'Yok'}\n` +
            `DRM / Lisans Sistemleri: ${drm.map((d: any) => d.name).join(', ') || 'Yok'}\n` +
            `-------------------------------------------`;
        }
      } catch (dbErr) {
        console.error('APK context load warning:', dbErr);
      }
    }

    // Always enforce 100% Turkish response instruction as final override
    if (!finalSystemPrompt.endsWith(MANDATORY_TURKISH_INSTRUCTION)) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n${MANDATORY_TURKISH_INSTRUCTION}`;
    }

    const mergedSettings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      ...settings,
      systemPrompt: finalSystemPrompt,
    };

    const response = await sendAIChatRequest(messages, mergedSettings);

    return NextResponse.json({
      success: true,
      text: response.text,
      modelUsed: response.modelUsed,
    });
  } catch (err: any) {
    console.error('AI Chat Error:', err);
    return NextResponse.json(
      { error: err.message || 'Yapay zeka yanıt oluşturamadı.' },
      { status: 500 }
    );
  }
}
