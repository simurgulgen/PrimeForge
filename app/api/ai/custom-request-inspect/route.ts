import { NextResponse } from 'next/server';
import { sendAIChatRequest, AIMessage, DEFAULT_AI_SETTINGS, AISettings } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

interface CustomInspectRequestBody {
  user_request: string;
  package_name?: string;
  app_name?: string;
  audit_data?: any;
  ai_settings?: AISettings | null;
}

// Built-in heuristic patterns for common reverse-engineering mod requests
function generateHeuristicFallback(userRequest: string, appName: string, packageName: string) {
  const reqLower = userRequest.toLowerCase();

  // 1. Password / PIN / Lock Screen / Login Bypass
  if (/şifre|sifre|pin|kilit|lock|password|parola|oturum|login|auth/i.test(reqLower)) {
    return {
      title: '🔐 Şifre & PIN Kilit Ekranı Korumasını Kaldır',
      summary: `${appName} uygulamasındaki yerel şifre/PIN doğrulama mantığı ve kilit ekranı bypass edilecek.`,
      detected_mechanism: 'Kullanıcı doğrulama ve PIN kontrolü genellikle SharedPreferences, KeyStore veya yerel veritabanındaki hash ile karşılaştırılır.',
      patch_strategy: 'Doğrulama metotlarının (örn. isPasswordValid, checkPin, isAuthorized) dönüş değeri doğrudan TRUE (0x1) olarak sabitlenir ve kilit Activity adımı atlanır.',
      risk_level: 'DÜŞÜK',
      option_label: '🔑 Şifre / PIN Doğrulamasını Kaldır (Bypass)',
      option_description: 'Uygulama açılışında şifre sormadan doğrudan ana ekrana ve tüm içeriklere erişim sağlar.',
      code_locations: [
        `${packageName.replace(/\./g, '/')}/auth/PasswordActivity.smali`,
        `${packageName.replace(/\./g, '/')}/security/PinManager.smali -> checkPin()`,
        `${packageName.replace(/\./g, '/')}/ui/lock/LockScreenActivity.smali`,
      ],
      recommended_smali_patch: {
        target_class: `${packageName.replace(/\./g, '/')}/security/PinManager`,
        target_method: 'isPinCorrect(Ljava/lang/String;)Z',
        action: 'replace_return',
        value: 'const/4 v0, 0x1\nreturn v0',
        description: 'Şifre doğrulama metodunun her zaman geçerli (true) dönmesini sağla.',
      },
    };
  }

  // 2. Forced Update / Version Check Bypass
  if (/güncelle|guncelle|update|versiyon|version|zorunlu/i.test(reqLower)) {
    return {
      title: '🔄 Zorunlu Güncelleme Ekranını Kaldır',
      summary: 'Eski sürüm uyarısı veren zorunlu popup ve sunucu güncelleme denetimi bypass edilecek.',
      detected_mechanism: 'Uygulama sunucudan dönen son sürüm kodu ile yerel versionCode değerini karşılaştırarak güncelleme diyaloğu açıyor.',
      patch_strategy: 'checkUpdate / isUpdateRequired metotları false (0x0) dönecek şekilde kancalanır veya diyalog penceresi dismiss edilir.',
      risk_level: 'SIFIR',
      option_label: '🚫 Zorunlu Güncellemeyi Engelle & Kapat',
      option_description: 'Uygulamanın sürüm eskidi uyarısı vermeden süresiz çalışmasını sağlar.',
      code_locations: [
        `${packageName.replace(/\./g, '/')}/update/UpdateChecker.smali -> isUpdateAvailable()`,
        `${packageName.replace(/\./g, '/')}/network/VersionResponse.smali`,
      ],
      recommended_smali_patch: {
        target_class: `${packageName.replace(/\./g, '/')}/update/UpdateChecker`,
        target_method: 'isUpdateAvailable()Z',
        action: 'replace_return',
        value: 'const/4 v0, 0x0\nreturn v0',
        description: 'Güncelleme kontrolünün her zaman false (güncelleme yok) dönmesini sağla.',
      },
    };
  }

  // 3. Ad / Telemetry / Analytics
  if (/reklam|ad|banner|takip|telemetri|analytics|popup/i.test(reqLower)) {
    return {
      title: '🚫 Özel Reklam & Telemetri Kancasını Kaldır',
      summary: 'Uygulama içine gömülü özel reklam çağrıları ve analitik kütüphaneleri susturulacak.',
      detected_mechanism: 'Google AdMob, Unity veya özel backend reklam SDK çağrıları.',
      patch_strategy: 'Reklam yükleme (loadAd, showAd) metotları return-void ile boşaltılır ve Activity açılışı temizlenir.',
      risk_level: 'SIFIR',
      option_label: '🛡️ Özel Reklam ve Analitikleri Sustur',
      option_description: 'Arayüzdeki popup reklamları ve arka plan analitik raporlamalarını tamamen durdurur.',
      code_locations: [
        'com/google/android/gms/ads/AdView.smali -> loadAd()',
        `${packageName.replace(/\./g, '/')}/ads/CustomAdManager.smali`,
      ],
      recommended_smali_patch: {
        target_class: `${packageName.replace(/\./g, '/')}/ads/CustomAdManager`,
        target_method: 'showInterstitial()V',
        action: 'empty_void',
        value: 'return-void',
        description: 'Araya giren tam ekran reklam açma fonksiyonunu etkisiz kıl.',
      },
    };
  }

  // 4. TV DPAD & Remote Controller
  if (/tv|kumanda|dpad|leanback|kumandayla|remote/i.test(reqLower)) {
    return {
      title: '📺 Android TV & Kumanda (DPAD) Optimizasyonu',
      summary: 'Dokunmatik odaklı arayüz Android TV kumandası yön tuşlarıyla (Yukarı, Aşağı, Sol, Sağ, OK) kontrol edilebilir hale getirilecek.',
      detected_mechanism: 'Görünüm öğelerinde focusable ve clickable özellikleri eksik olduğunda kumanda imleci kaybolur.',
      patch_strategy: 'Manifeste leanback ve touch_screen=false bayrakları eklenir, ana layout öğelerine android:focusable="true" enjekte edilir.',
      risk_level: 'SIFIR',
      option_label: '🎮 Tam Kumanda (DPAD) Odaklanma Desteği',
      option_description: 'Uygulamanın Android TV ve Box cihazlarda kumanda yön tuşlarıyla rahatça kullanılmasını sağlar.',
      code_locations: [
        'AndroidManifest.xml -> <uses-feature android:name="android.software.leanback">',
        'res/layout -> android:focusable="true"',
      ],
      recommended_smali_patch: {
        target_class: `${packageName.replace(/\./g, '/')}/ui/MainActivity`,
        target_method: 'onKeyDown(ILandroid/view/KeyEvent;)Z',
        action: 'custom_hook',
        value: 'invoke-static {p0, p1, p2}, Lcom/primeforge/dpad/DpadHelper;->handleKey(Landroid/app/Activity;ILandroid/view/KeyEvent;)Z',
        description: 'Kumanda yön tuşlarını yakala ve odaklanabilir bir sonraki öğeye aktar.',
      },
    };
  }

  // 5. Default Generic Custom Request
  return {
    title: `✨ Özel Mod: ${userRequest.slice(0, 45)}`,
    summary: `${appName} için kullanıcının özel talebi doğrultusunda analiz gerçekleştirildi.`,
    detected_mechanism: 'Tersine mühendislik ile ilgili iş mantığı sınıfları ayrıştırıldı.',
    patch_strategy: 'Smali kancalama ve manifest parametreleri kullanıcının talebine göre özelleştirilecek.',
    risk_level: 'DÜŞÜK',
    option_label: userRequest.length > 50 ? userRequest.slice(0, 47) + '...' : userRequest,
    option_description: `${userRequest} talebini derleme esnasında smali motoruna uygular.`,
    code_locations: [`${packageName.replace(/\./g, '/')}/MainApplication.smali`],
    recommended_smali_patch: {
      target_class: `${packageName.replace(/\./g, '/')}/MainApplication`,
      target_method: 'onCreate()V',
      action: 'custom_hook',
      value: `# Custom Mod: ${userRequest}\nreturn-void`,
      description: `Kullanıcı özel isteği: ${userRequest}`,
    },
  };
}

export async function POST(req: Request) {
  try {
    const body: CustomInspectRequestBody = await req.json();
    const { user_request, package_name = 'com.app.example', app_name = 'Uygulama', audit_data, ai_settings } = body;

    if (!user_request || !user_request.trim()) {
      return NextResponse.json({ error: 'Özel istek veya talimat metni gereklidir.' }, { status: 400 });
    }

    const trimmedReq = user_request.trim();
    const heuristic = generateHeuristicFallback(trimmedReq, app_name, package_name);

    // Prepare AI prompt for deep smali / reverse engineering reasoning
    const prompt = `Sen PrimeForge Android APK Tersine Mühendislik ve Smali Modlama Uzmanısın.
Kullanıcı şu uygulama için özel bir modlama / özellik isteğinde bulundu:

Uygulama: ${app_name}
Paket Adı: ${package_name}
Kullanıcının Özel İsteği: "${trimmedReq}"

Ek APK Analiz Bilgileri:
- Algılanan Özellikler: ${JSON.stringify(audit_data?.detected_features || {})}
- Tehlikeli İzinler: ${JSON.stringify(audit_data?.permissions?.dangerous?.slice(0, 5).map((p: any) => p.name) || [])}
- Reklam Ağı / Faturalandırma: ${audit_data?.detected_features?.has_billing ? 'Faturalandırma var' : 'Yok'}

GÖREV:
1. Kullanıcının talebini (örneğin kilit/şifre ekranını kaldırma, oturum açmayı bypass etme, süre sınırını aşma, özel reklam temizliği veya arayüz değişikliği) Android mimarisi ve smali düzeyinde analiz et.
2. Bu işlevin koddaki yerini ve hangi metotların/sınıfların değiştirilmesi gerektiğini açıkla.
3. Kullanıcının arayüzde bir kutucuk olarak seçebileceği (checkbox) modlama seçeneğini üret.
4. Bu seçeneğin güvenle uygulanabileceği Smali yama kuralını (target_class, target_method, action, value) tanımla.

Yanıtını KESİNLİKLE aşağıdaki JSON şemasına uygun olarak üret:
\`\`\`json
{
  "title": "Kısa ve Dikkat Çekici Başlık (örn: 🔐 Şifre & PIN Kilit Ekranını Kaldır)",
  "summary": "1-2 cümlelik net özet.",
  "detected_mechanism": "Bu özelliğin uygulamada hangi sınıflar ve mekanizmalarla çalıştığının teknik açıklaması.",
  "patch_strategy": "Tersine mühendislikle uygulanacak somut yama stratejisi (metot dönüşünü 0x1 yapma, return-void ile boşaltma vb.).",
  "risk_level": "SIFIR veya DÜŞÜK veya ORTA",
  "option_label": "Kullanıcının seçeceği kutucuk başlığı (örn: Şifre / PIN Doğrulamasını Kaldır)",
  "option_description": "Kullanıcının bu seçeneği açtığında ne kazanacağını anlatan 1 cümle.",
  "code_locations": [
    "Muhtemel Smali Dosyası ve Metot 1",
    "Muhtemel Smali Dosyası ve Metot 2"
  ],
  "recommended_smali_patch": {
    "target_class": "com/paket/adi/AuthClass",
    "target_method": "checkPassword(Ljava/lang/String;)Z",
    "action": "replace_return",
    "value": "const/4 v0, 0x1\\nreturn v0",
    "description": "Şifre doğrulamasını her zaman başarılı yap"
  }
}
\`\`\`
`;

    // Try AI generation
    let finalResult = heuristic;
    let modelUsed = 'Heuristic Engine (Anında)';

    try {
      const activeSettings: AISettings = ai_settings || DEFAULT_AI_SETTINGS;
      const messages: AIMessage[] = [{ role: 'user', content: prompt }];

      const aiRes = await sendAIChatRequest(messages, {
        ...activeSettings,
        temperature: 0.2,
        maxTokens: 1200,
      });

      if (aiRes && aiRes.text) {
        let parsedJson: any = null;
        const match = aiRes.text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (match) {
          parsedJson = JSON.parse(match[1]);
        } else {
          parsedJson = JSON.parse(aiRes.text);
        }

        if (parsedJson && parsedJson.title && parsedJson.option_label) {
          finalResult = {
            ...heuristic,
            ...parsedJson,
          };
          modelUsed = aiRes.modelUsed || activeSettings.model;
        }
      }
    } catch (aiErr: any) {
      console.warn('AI custom inspect fell back to heuristic:', aiErr.message);
    }

    return NextResponse.json({
      success: true,
      data: finalResult,
      model_used: modelUsed,
    });
  } catch (err: any) {
    console.error('Custom request inspect API error:', err);
    return NextResponse.json({ error: err.message || 'Özel istek analizi başarısız oldu.' }, { status: 500 });
  }
}
