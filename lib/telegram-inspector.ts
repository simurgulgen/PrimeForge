// lib/telegram-inspector.ts
// Analyzes incoming APK, APKS, and forwarded Telegram files with AI purpose extraction and interactive options

import { sendAIChatRequest, DEFAULT_AI_SETTINGS } from '@/lib/ai-service';
import { supabase } from '@/lib/supabase';

export interface TelegramDocumentInfo {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface AppInspectionResult {
  jobId: string;
  fileName: string;
  fileSizeMb: number;
  isBundle: boolean;
  bundleType?: 'APKS' | 'XAPK' | 'ZIP' | 'APK';
  packageName: string;
  versionName: string;
  appTitle: string;
  purposeSummary: string;
  moddingAdvice: string;
  detectedArchitectures: string[];
}

export function parsePackageAndVersionFromFilename(filename: string): {
  packageName: string;
  versionName: string;
  titleGuess: string;
} {
  const clean = filename.replace(/\.(apk|apks|xapk|zip)$/i, '');

  // 1. Try to find standard dotted package name (e.g. com.foobnix.pro.pdf.reader)
  const pkgMatch = clean.match(/([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)/);
  let packageName = pkgMatch ? pkgMatch[1] : '';

  // 2. Extract version (e.g. 9.6.25 or v2.3.1)
  const verMatch = clean.match(/(?:v|version|ver)?([0-9]+(?:\.[0-9]+)+(?:-[a-zA-Z0-9.]+)?)/i);
  let versionName = verMatch ? verMatch[1] : '1.0';

  // 3. Title guess
  let titleGuess = clean;
  if (packageName) {
    const parts = packageName.split('.');
    titleGuess = parts[parts.length - 1] || parts[parts.length - 2] || clean;
    // Capitalize first letter
    titleGuess = titleGuess.charAt(0).toUpperCase() + titleGuess.slice(1);
  }

  return { packageName, versionName, titleGuess };
}

export async function inspectTelegramDocument(
  doc: TelegramDocumentInfo,
  caption?: string
): Promise<AppInspectionResult> {
  const fileName = doc.file_name || 'application.apk';
  const fileSizeMb = Number(((doc.file_size || 0) / (1024 * 1024)).toFixed(2));
  const ext = fileName.split('.').pop()?.toLowerCase() || 'apk';

  const isBundle = ['apks', 'xapk', 'zip'].includes(ext);
  const bundleType = isBundle ? (ext.toUpperCase() as 'APKS' | 'XAPK' | 'ZIP') : 'APK';

  const { packageName, versionName, titleGuess } = parsePackageAndVersionFromFilename(fileName);

  // Default detected architectures
  const detectedArchitectures = isBundle
    ? ['arm64-v8a', 'armeabi-v7a', 'x86_64']
    : ['arm64-v8a'];

  // Query Gemini AI for app purpose and modding recipe
  let purposeSummary = 'Android uygulama paketi.';
  let moddingAdvice = 'Reklam bileşenlerinin temizlenmesi, gereksiz izinlerin kaldırılması ve keystore ile imzalanması önerilir.';
  let appTitle = titleGuess || 'Android Uygulaması';

  try {
    const prompt = `Sen PrimeForge Android Güvenlik ve Tersine Mühendislik Asistanısın.
Kullanıcı Telegram botuna şu dosyayı gönderdi/iletti:
- Dosya Adı: "${fileName}"
- Boyut: ${fileSizeMb} MB
- Tür: ${bundleType} (${isBundle ? 'Çoklu Mimari Paket/Bundle' : 'Tekil APK'})
- Olası Paket Adı: "${packageName || 'Bilinmiyor'}"
- Olası Sürüm: "${versionName}"
${caption ? `- Kullanıcı Notu/Mesaj: "${caption}"` : ''}

Lütfen şu 3 soruyu maddeler halinde çok kısa ve profesyonel Türkçe ile açıkla:
1. UYGULAMA AMACI: Bu uygulama ne işe yarar ve içeriği nedir? (2-3 cümle)
2. MODLAMA TAVSİYESİ: Bu uygulamada hangi modlama (reklam engelleme, DRM/lisans baypası, TV kumanda uyarlaması, izin budama) yapılmalı?
3. UYGULAMA ADI: Uygulamanın düzgün görünen Türkçe/Orijinal adı nedir?`;

    const aiRes = await sendAIChatRequest(
      [
        { role: 'user', content: prompt }
      ],
      {
        ...DEFAULT_AI_SETTINGS,
        maxTokens: 500,
        temperature: 0.3,
      }
    );

    if (aiRes && aiRes.text) {
      const text = aiRes.text;
      purposeSummary = text;
      // Extract title if present
      const titleMatch = text.match(/(?:UYGULAMA ADI|Adı)[:\s*]+([^\n\r]+)/i);
      if (titleMatch && titleMatch[1]) {
        appTitle = titleMatch[1].replace(/[*_#]/g, '').trim();
      }
    }
  } catch (err: any) {
    console.warn('[TelegramInspector] AI summary failed, using fallback:', err.message);
  }

  // Generate a job record in Supabase so callback queries can reference it
  const { data: job } = await supabase
    .from('forge_jobs')
    .insert({
      app_name: appTitle,
      package_name: packageName || 'com.primeforge.app',
      version_name: versionName,
      status: 'waiting_decision',
      apk_url: `telegram:${doc.file_id}`,
      analysis_report: {
        file_name: fileName,
        file_size_mb: fileSizeMb,
        is_bundle: isBundle,
        bundle_type: bundleType,
        detected_architectures: detectedArchitectures,
        ai_summary: purposeSummary,
      },
    })
    .select('id')
    .single();

  const jobId = job?.id || `tg-${Date.now()}`;

  return {
    jobId,
    fileName,
    fileSizeMb,
    isBundle,
    bundleType,
    packageName: packageName || 'com.primeforge.app',
    versionName,
    appTitle,
    purposeSummary,
    moddingAdvice,
    detectedArchitectures,
  };
}

export function formatTelegramInspectionMessage(info: AppInspectionResult): {
  text: string;
  replyMarkup: any;
} {
  const archText = info.isBundle
    ? `📐 <b>Mimariler:</b> ${info.detectedArchitectures.join(', ')} <i>(📦 Çoklu Mimari Bundle)</i>`
    : `📐 <b>Mimari:</b> arm64-v8a`;

  const text =
    `🔍 <b>PrimeForge APK İnceleme Raporu</b>\n\n` +
    `📱 <b>Uygulama:</b> <b>${info.appTitle}</b>\n` +
    `📦 <b>Paket:</b> <code>${info.packageName}</code>\n` +
    `🏷️ <b>Sürüm:</b> <code>${info.versionName}</code>\n` +
    `📁 <b>Dosya:</b> <code>${info.fileName}</code> (${info.fileSizeMb} MB)\n` +
    `${archText}\n\n` +
    `📝 <b>İçerik & Amacı (AI Özeti):</b>\n${info.purposeSummary}\n\n` +
    `⚡ <b>Lütfen uygulamak istediğiniz işlemi seçin:</b>`;

  const inline_keyboard = [
    [
      { text: '⚡ Tam Modlama (Önerilen)', callback_data: `forge:full_mod:${info.jobId}` },
      { text: '🧹 İzin Temizle', callback_data: `forge:sanitize_only:${info.jobId}` },
    ],
    [
      { text: '📺 Android TV / DPAD Uyarla', callback_data: `forge:tv_mod:${info.jobId}` },
      { text: '🔍 Sadece Güvenlik Analizi', callback_data: `forge:analyze_only:${info.jobId}` },
    ],
    [
      { text: '❌ İptal', callback_data: `forge:cancel:${info.jobId}` },
    ],
  ];

  return {
    text,
    replyMarkup: { inline_keyboard },
  };
}
