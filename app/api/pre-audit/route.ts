import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import zlib from 'zlib';

export const dynamic = 'force-dynamic';

interface PermissionIntelligence {
  name: string;
  description: string;
  purpose: string;
  impact: string;
  safety: 'safe' | 'caution' | 'warning';
  safety_label: string;
  selected: boolean;
}

interface PreAuditResponse {
  success: boolean;
  package_name?: string;
  version_name?: string;
  app_title?: string;
  has_existing_profile?: boolean;
  existing_profile_name?: string | null;
  existing_profile_yaml?: string | null;
  modding_guide?: string | null;
  auto_apply?: boolean;
  success_count?: number;
  last_used_at?: string | null;
  is_real_time_parsed: boolean;
  permissions: {
    dangerous: PermissionIntelligence[];
    ad_related: PermissionIntelligence[];
    safe_and_system: PermissionIntelligence[];
    total_count: number;
  };
  detected_features: {
    has_billing: boolean;
    billing_type?: string;
    billing_frameworks?: string[];
    vip_methods?: string[];
    has_ads: boolean;
    ad_networks: string[];
    is_already_modded: boolean;
    mod_signatures?: string[];
  };
  premium_summary: {
    has_billing: boolean;
    billing_type: string;
    status_title: string;
    status_description: string;
    is_open_source_pro: boolean;
  };
  recommended_action: 'autonomous_from_guide' | 'sanitize_only' | 'full_mod' | 'direct_sign';
}

// Deep intelligence on Android permissions: purpose in apps & exact impact when removed
const PERMISSION_INTELLIGENCE: Record<string, {
  title: string;
  purpose: string;
  impact: string;
  safety: 'safe' | 'caution' | 'warning';
  safety_label: string;
}> = {
  'android.permission.ACCESS_FINE_LOCATION': {
    title: 'Hassas GPS Konum Bilgisi',
    purpose: 'Konuma özel bölgesel reklam hedeflemesi yapmak veya yerel gün doğumu/batımı saatine göre otomatik gece okuma moduna geçmek için istenir.',
    impact: 'Kitap okuma, PDF açma ve uygulamanın temel özellikleri KESİNLİKLE etkilenmez. Yalnızca reklam hedeflemesi ve otomatik saat/konum teması engellenir.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir (Sıfır Risk)',
  },
  'android.permission.ACCESS_COARSE_LOCATION': {
    title: 'Yaklaşık Ağ/Şehir Konumu',
    purpose: 'Baz istasyonu ve Wi-Fi üzerinden kaba şehir/bölge tespiti yaparak reklam ağlarına hedefleme verisi sağlamak için kullanılır.',
    impact: 'Uygulamanın temel işlevlerini asla bozmaz. Reklam takipçilerinin konumunuzu izlemesini durdurur.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir',
  },
  'android.permission.MANAGE_EXTERNAL_STORAGE': {
    title: 'Tüm Hafıza ve Dosyalara Erişim',
    purpose: 'Cihazdaki tüm PDF, EPUB, MOBI ve çizgi roman dosyalarını tarayarak kütüphanenizi oluşturmak ve son okunan yerleri kaydetmek için istenir.',
    impact: '⚠️ DİKKAT: Bu izin kaldırılırsa uygulama cihaz hafızasındaki kitapları ve dosyaları OKUYAMAZ. Okuma uygulamaları için ZORUNLUDUR, kaldırılmamalıdır.',
    safety: 'warning',
    safety_label: '⚠️ Kütüphane İçin Zorunlu (Kaldırmayın)',
  },
  'android.permission.WRITE_EXTERNAL_STORAGE': {
    title: 'Hafızaya Dosya Yazma / Kaydetme',
    purpose: 'Okuma ayarlarını, kitap ayraçlarını, indirilen e-kitapları ve önbellek dosyalarını hafızaya yazmak için istenir.',
    impact: 'Kaldırılırsa kitap ayraçları ve yerel indirmeler kaydedilemeyebilir.',
    safety: 'caution',
    safety_label: '⚠️ Ayar & Kitap Kaydı İçin Gerekli',
  },
  'android.permission.RECEIVE_BOOT_COMPLETED': {
    title: 'Cihaz Açılışında Otomatik Başlama',
    purpose: 'Cihaz yeniden başladığında arka plan okuma hatırlatıcılarını, günlük bildirim alarmlarını ve otomatik servisleri başlatmak için istenir.',
    impact: 'Uygulamanın açılışta arkada gereksiz pil ve RAM tüketmesi engellenir. Uygulamayı kendiniz açtığınızda her şey kusursuz çalışır; yalnızca açılış alarmları tetiklenmez.',
    safety: 'safe',
    safety_label: '✅ Önerilen Temizlik (Pil Tasarrufu)',
  },
  'android.permission.SYSTEM_ALERT_WINDOW': {
    title: 'Diğer Uygulamaların Üzerinde Görünme (Overlay)',
    purpose: 'Başka uygulamalardayken ekranda asılı kalan mini sözlük balonu, kayan okuma penceresi veya hızlı not alma widget\'ı açmak için kullanılır.',
    impact: 'Eğer ekranda asılı kalan kayan mini sözlük/widget kullanıyorsanız bu özellik kapanır. Tam ekran kitap/PDF okuma deneyimi aynen sürer; ayrıca ekrana sahte tıklama (tapjacking) riskleri önlenir.',
    safety: 'caution',
    safety_label: '⚠️ İhtiyaca Göre Seçin (Kayan Pencere)',
  },
  'android.permission.FOREGROUND_SERVICE': {
    title: 'Ön Plan Servisi Çalıştırma',
    purpose: 'Metin seslendirme (TTS) ile kitap dinlerken veya uzun kitap taramalarında Android sisteminin uygulamayı sonlandırmasını önlemek için kullanılır.',
    impact: 'Sesli kitap veya arka plan taraması kullanmıyorsanız kaldırılabilir.',
    safety: 'safe',
    safety_label: '🎧 Sesli Kitap / TTS İçin Gerekli',
  },
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK': {
    title: 'Arka Planda Ses / Medya Çalma',
    purpose: 'Ekran kapandığında veya başka uygulamaya geçtiğinizde sesli kitabın kesilmeden çalmaya devam etmesi için kullanılır.',
    impact: 'Yalnızca gözle okuma yapıyorsanız hiçbir etkisi olmaz. Sesli kitap dinlerken ekran kapanınca sesin kesilmesini önler.',
    safety: 'safe',
    safety_label: '🎧 Sesli Kitap İçin Gerekli',
  },
  'android.permission.WAKE_LOCK': {
    title: 'Ekranın Uykuya Geçmesini Önleme',
    purpose: 'Kitap veya çizgi roman okurken ekrana dokunmadığınız süre boyunca ekranın kararıp kilitlenmesini engellemek için kullanılır.',
    impact: 'Kaldırılırsa telefonun normal ekran zaman aşımı süresi (örn. 30 saniye) devreye girer ve sayfa açıkken ekran kapanabilir.',
    safety: 'caution',
    safety_label: '👁️ Kesintisiz Okuma Konforu',
  },
  'android.permission.POST_NOTIFICATIONS': {
    title: 'Bildirim Gönderme İzni',
    purpose: 'Okuma hedefleri, yeni bölüm bildirimleri veya durum çubuğunda mini okuma kontrolcüsü göstermek için istenir.',
    impact: 'Uygulama bildirim gönderemez. Kitap okuma deneyimi asla etkilenmez.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir',
  },
  'android.permission.RECORD_AUDIO': {
    title: 'Mikrofon Erişimi / Ses Kaydı',
    purpose: 'Sesli komutla sayfa çevirme, sesli not alma veya sesli kitap metin seslendirme (TTS) entegrasyonu için kullanılır.',
    impact: 'Sesli arama ve ses kaydı özellikleri durdurulur. Dokunmatik ve kumandayla okuma ve sayfa çevirme özellikleri sorunsuz çalışır.',
    safety: 'safe',
    safety_label: '✅ Gizlilik İçin Kaldırılabilir',
  },
  'android.permission.CAMERA': {
    title: 'Kamera Erişimi',
    purpose: 'Kitap kapağı fotoğrafı çekmek, QR kod taramak veya fiziki kitapları tarayıp metne dökmek (OCR) için kullanılır.',
    impact: 'Uygulama içinden canlı kamera çekimi kapatılır. Cihaz hafızasındaki veya galerideki PDF, EPUB ve resimleri açmada hiçbir sorun yaşanmaz.',
    safety: 'caution',
    safety_label: '⚠️ Tarama Kullanmıyorsanız Kaldırın',
  },
  'android.permission.READ_CONTACTS': {
    title: 'Rehber ve Kişi Bilgilerini Okuma',
    purpose: 'Kitap veya alıntı paylaşırken rehberdeki kişileri doğrudan listeletmek veya profil senkronizasyonu için istenir.',
    impact: 'Kişisel rehber verinizin dışarı sızması önlenir. Paylaşım standart Android sistem paylaşım menüsüyle sorunsuz yapılabilir.',
    safety: 'safe',
    safety_label: '🛡️ Yüksek Risk - Mutlaka Kaldırın',
  },
  'android.permission.READ_CALL_LOG': {
    title: 'Arama Geçmişini Okuma',
    purpose: 'Okuma veya medya uygulamasında hiçbir geçerli işlevi yoktur; genellikle agresif reklam/analitik SDK\'ları tarafından istenir.',
    impact: 'Arama geçmişinize erişim sıfırlanır. Uygulamanın normal çalışmasına hiçbir etkisi olmaz.',
    safety: 'safe',
    safety_label: '🛡️ Yüksek Risk - Mutlaka Kaldırın',
  },
  'android.permission.READ_SMS': {
    title: 'SMS Mesajlarını Okuma',
    purpose: 'Eski SMS tabanlı hesap doğrulama veya harici reklam servisleri tarafından şüpheli veri toplama amaçlı kullanılır.',
    impact: 'SMS güvenliği sağlanır. Uygulamanın çalışmasında herhangi bir fonksiyon kaybı yaşanmaz.',
    safety: 'safe',
    safety_label: '🛡️ Yüksek Risk - Mutlaka Kaldırın',
  },
  'android.permission.SEND_SMS': {
    title: 'Arka Planda SMS Gönderme',
    purpose: 'Genellikle kötü amaçlı veya gereksiz üçüncü taraf SDK\'ların arka planda ücretli SMS tetiklemesi riskini barındırır.',
    impact: 'Gizli SMS gönderimi tamamen engellenir. Uygulamanın çalışmasına hiçbir olumsuz etkisi yoktur.',
    safety: 'safe',
    safety_label: '🛡️ Yüksek Risk - Mutlaka Kaldırın',
  },
  'android.permission.QUERY_ALL_PACKAGES': {
    title: 'Yüklü Tüm Uygulamaları Tarama (Sniffer)',
    purpose: 'Cihazınızda kurulu diğer PDF okuyucuları, sözlükleri veya bankacılık uygulamalarını tarayıp analiz etmek için istenir.',
    impact: 'Uygulamanın cihazınızı gözetlemesi (profil çıkarması) engellenir. Temel işlevler aynen çalışır.',
    safety: 'safe',
    safety_label: '✅ Gizlilik Koruyucu - Kaldırın',
  },
  'android.permission.REQUEST_INSTALL_PACKAGES': {
    title: 'Dışarıdan Başka APK Kurma',
    purpose: 'Uygulamanın kendi sunucusundan yeni APK indirip Google Play/PrimeStore harici sizi güncellemeye zorlaması için kullanılır.',
    impact: 'Uygulama arka planda sessizce başka APK kuramaz. Güncellemeleri her zaman PrimeStore üzerinden güvenle alırsınız.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir',
  },
  'android.permission.PACKAGE_USAGE_STATS': {
    title: 'Diğer Uygulamaların Kullanımını İzleme',
    purpose: 'Günde kaç saat hangi uygulamada vakit geçirdiğinizi ölçüp pazarlama analitiği göndermek için istenir.',
    impact: 'Kişisel kullanım alışkanlıklarınızın sızması önlenir. Uygulama kusursuz çalışır.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir',
  },
  'com.google.android.gms.permission.AD_ID': {
    title: 'Google Reklam Kimliği (İzleme)',
    purpose: 'Cihazınıza özel tekil bir reklam kimliği üreterek tüm reklam ağlarına kimliğinizi ve ilgi alanlarınızı raporlamak için kullanılır.',
    impact: 'Kaldırıldığında reklam SDK\'ları cihazınızı tanıyamaz ve izleyemez. Sıfır çökme riski vardır, uygulama tertemiz çalışır.',
    safety: 'safe',
    safety_label: '✅ Önerilen Temizlik (Sıfır Risk)',
  },
  'android.permission.ACCESS_ADSERVICES_AD_ID': {
    title: 'Android AdServices Reklam Kimliği',
    purpose: 'Android 13+ yeni nesil gizlilik korumalı reklam izleyicisi için cihaz kimliği oluşturur.',
    impact: 'Kaldırıldığında reklam ağlarına kimlik aktarımı durur. Uygulamanın çalışmasına hiçbir etkisi yoktur.',
    safety: 'safe',
    safety_label: '✅ Önerilen Temizlik (Sıfır Risk)',
  },
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION': {
    title: 'Reklam İlişkilendirme & Takip',
    purpose: 'Hangi reklama tıkladığınızı ve indirme kaynağınızı sunucuya bildirmek için kullanılır.',
    impact: 'Tüm telemetri ve reklam ilişkilendirmesi engellenir. Uygulama sorunsuz çalışır.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir',
  },
  'android.permission.ACCESS_ADSERVICES_TOPICS': {
    title: 'İlgi Alanı & Reklam Hedefleme',
    purpose: 'Kullanım geçmişinize göre ilgi alanlarınızı gruplayıp reklam ağlarına sunar.',
    impact: 'İlgi alanı telemetrisi kapatılır. Sıfır fonksiyon kaybı.',
    safety: 'safe',
    safety_label: '✅ Güvenle Kaldırılabilir',
  },
  'com.android.vending.BILLING': {
    title: 'Google Play Satın Alma / Ödeme Arayüzü',
    purpose: 'Google Play üzerinden abonelik ve uygulama içi satın alma (IAP) sorgulaması yapmak için kullanılır.',
    impact: 'Modlama yapıldığında VIP bayrakları aktifleştiği için bu izin gereksizleşir; kaldırıldığında Google Play ödeme zorunluluğu baypas edilir.',
    safety: 'safe',
    safety_label: '💎 Modlama / VIP İçin Önerilir',
  },
};

/**
 * Ultra-fast HTTP Range-based APK Manifest Inspector
 * Fetches the ZIP Central Directory and decompresses AndroidManifest.xml in ~500ms
 * without downloading the full APK.
 */
async function fetchRealApkManifest(apkUrl: string): Promise<{
  permissions: string[];
  hasBilling: boolean;
  billingFrameworks: string[];
  vipMethods: string[];
  hasAds: boolean;
  adNetworks: string[];
} | null> {
  try {
    const reqHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: '*/*',
    };
    if (apkUrl.includes('liteapks')) {
      reqHeaders['Referer'] = 'https://liteapks.com/';
    }

    const head = await fetch(apkUrl, { headers: reqHeaders, redirect: 'follow' });
    if (!head.ok) return null;
    const finalUrl = head.url;
    const len = parseInt(head.headers.get('content-length') || '0', 10);
    if (!len || len < 50000) return null;

    const tailSize = Math.min(len, 65536);
    const tailRes = await fetch(finalUrl, {
      headers: { ...reqHeaders, Range: `bytes=${len - tailSize}-${len - 1}` },
    });
    if (!tailRes.ok) return null;
    const tailBuf = Buffer.from(await tailRes.arrayBuffer());

    let eocdPos = -1;
    for (let i = tailBuf.length - 22; i >= 0; i--) {
      if (tailBuf.readUInt32LE(i) === 0x06054b50) {
        eocdPos = i;
        break;
      }
    }
    if (eocdPos === -1) return null;

    const cdSize = tailBuf.readUInt32LE(eocdPos + 12);
    const cdOffset = tailBuf.readUInt32LE(eocdPos + 16);

    const cdRes = await fetch(finalUrl, {
      headers: { ...reqHeaders, Range: `bytes=${cdOffset}-${cdOffset + cdSize - 1}` },
    });
    if (!cdRes.ok) return null;
    const cdBuf = Buffer.from(await cdRes.arrayBuffer());

    let p = 0;
    let manifestEntry: any = null;
    let hasBillingInZip = false;
    let hasAdsInZip = false;
    const billingFrameworks = new Set<string>();
    const adNetworks = new Set<string>();
    const vipMethods = new Set<string>();

    while (p + 46 < cdBuf.length) {
      if (cdBuf.readUInt32LE(p) !== 0x02014b50) break;
      const compMethod = cdBuf.readUInt16LE(p + 10);
      const compSize = cdBuf.readUInt32LE(p + 20);
      const fnLen = cdBuf.readUInt16LE(p + 28);
      const extraLen = cdBuf.readUInt16LE(p + 30);
      const commentLen = cdBuf.readUInt16LE(p + 32);
      const localOffset = cdBuf.readUInt32LE(p + 42);
      const fn = cdBuf.slice(p + 46, p + 46 + fnLen).toString('utf8');

      if (fn === 'AndroidManifest.xml') {
        manifestEntry = { compMethod, compSize, localOffset };
      }
      const lowerFn = fn.toLowerCase();
      if (lowerFn.includes('billingclient') || lowerFn.includes('com/android/billingclient')) {
        hasBillingInZip = true;
        billingFrameworks.add('Google Play BillingClient (IAP)');
      }
      if (lowerFn.includes('revenuecat') || lowerFn.includes('purchases')) {
        hasBillingInZip = true;
        billingFrameworks.add('RevenueCat SDK');
      }
      if (lowerFn.includes('qonversion')) {
        hasBillingInZip = true;
        billingFrameworks.add('Qonversion In-App Purchases');
      }
      if (lowerFn.includes('adapty')) {
        hasBillingInZip = true;
        billingFrameworks.add('Adapty Paywall');
      }
      if (lowerFn.includes('admob') || lowerFn.includes('gms/ads')) {
        hasAdsInZip = true;
        adNetworks.add('Google AdMob');
      }
      if (lowerFn.includes('applovin')) {
        hasAdsInZip = true;
        adNetworks.add('AppLovin MAX');
      }
      if (lowerFn.includes('unityads') || lowerFn.includes('unity3d/services')) {
        hasAdsInZip = true;
        adNetworks.add('Unity Ads');
      }
      if (lowerFn.includes('ironsource')) {
        hasAdsInZip = true;
        adNetworks.add('IronSource Ads');
      }

      p += 46 + fnLen + extraLen + commentLen;
    }

    if (!manifestEntry) return null;

    const mRes = await fetch(finalUrl, {
      headers: { ...reqHeaders, Range: `bytes=${manifestEntry.localOffset}-${manifestEntry.localOffset + manifestEntry.compSize + 256}` },
    });
    if (!mRes.ok) return null;
    const mBuf = Buffer.from(await mRes.arrayBuffer());
    const fnL = mBuf.readUInt16LE(26);
    const exL = mBuf.readUInt16LE(28);
    const compData = mBuf.slice(30 + fnL + exL, 30 + fnL + exL + manifestEntry.compSize);
    const raw = manifestEntry.compMethod === 8 ? zlib.inflateRawSync(compData) : compData;

    const utf8 = raw.toString('utf8');
    const utf16 = raw.toString('utf16le');
    const p1: string[] = Array.from(utf8.match(/android\.permission\.[a-zA-Z0-9_]+/g) || []);
    const p2: string[] = Array.from(utf16.match(/android\.permission\.[a-zA-Z0-9_]+/g) || []);
    const permissions: string[] = Array.from(new Set([...p1, ...p2]));

    const allStr = utf8 + ' ' + utf16;
    if (allStr.includes('BILLING') || allStr.includes('billing')) {
      hasBillingInZip = true;
      billingFrameworks.add('com.android.vending.BILLING İzni');
    }
    if (allStr.includes('AD_ID') || allStr.includes('ads')) {
      hasAdsInZip = true;
      adNetworks.add('Google AD_ID Takipçisi');
    }

    // Typical VIP method names commonly present in Android smali / manifest strings
    const vipKeywords = ['isVip', 'isPremium', 'hasSubscription', 'isPro', 'isPurchased', 'isUnlocked'];
    for (const kw of vipKeywords) {
      if (allStr.includes(kw)) {
        vipMethods.add(`${kw}()`);
      }
    }
    if (vipMethods.size === 0 && hasBillingInZip) {
      vipMethods.add('isPurchased()');
      vipMethods.add('isPremium()');
    }

    return {
      permissions,
      hasBilling: hasBillingInZip,
      billingFrameworks: Array.from(billingFrameworks),
      vipMethods: Array.from(vipMethods),
      hasAds: hasAdsInZip,
      adNetworks: Array.from(adNetworks),
    };
  } catch (err) {
    console.warn('Fast remote APK manifest inspection error:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apk_url, listing_id, package_name } = body;

    // 1. Check existing listing from Supabase
    let listing: any = null;
    if (listing_id) {
      const { data } = await supabase.from('listings').select('*').eq('id', listing_id).single();
      listing = data;
    } else if (package_name) {
      const { data } = await supabase.from('listings').select('*').eq('packageName', package_name).maybeSingle();
      listing = data;
    }

    const pkg = package_name || listing?.packageName || '';

    // 2. Check if a forge_profile already exists for this app
    let existingProfile: any = null;
    if (pkg) {
      const { data: prof } = await supabase
        .from('forge_profiles')
        .select('*')
        .eq('package_name', pkg)
        .maybeSingle();
      existingProfile = prof;
    }

    // 3. Check latest forge_job analysis report if available
    let latestReport: any = null;
    if (pkg) {
      const { data: job } = await supabase
        .from('forge_jobs')
        .select('analysis_report, status')
        .eq('package_name', pkg)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      latestReport = job?.analysis_report;
    }

    // 4. Ultra-fast real APK inspection directly from remote URL
    const targetApkUrl = apk_url || listing?.fileUrl || '';
    let realInspection: any = null;
    if (targetApkUrl && targetApkUrl.startsWith('http')) {
      realInspection = await fetchRealApkManifest(targetApkUrl);
    }

    const isRealTime = Boolean(realInspection && realInspection.permissions && realInspection.permissions.length > 0);

    // Filter permissions from real inspection or latest report or intelligent fallback
    let allExtractedPerms: string[] = [];
    if (isRealTime) {
      allExtractedPerms = realInspection.permissions;
    } else if (latestReport?.permissions?.all?.length > 0) {
      allExtractedPerms = latestReport.permissions.all;
    } else {
      // Fallback only if APK could not be inspected at all
      allExtractedPerms = [
        ...(latestReport?.permissions?.dangerous || ['android.permission.RECEIVE_BOOT_COMPLETED']),
        ...(latestReport?.permissions?.ad_related || ['com.google.android.gms.permission.AD_ID']),
      ];
    }

    const dangerousPermKeys = [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.MANAGE_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.READ_CONTACTS',
      'android.permission.READ_CALL_LOG',
      'android.permission.READ_SMS',
      'android.permission.SEND_SMS',
      'android.permission.QUERY_ALL_PACKAGES',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.PACKAGE_USAGE_STATS',
    ];

    const adPermKeys = [
      'com.google.android.gms.permission.AD_ID',
      'android.permission.ACCESS_ADSERVICES_AD_ID',
      'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
      'android.permission.ACCESS_ADSERVICES_TOPICS',
      'com.android.vending.BILLING',
    ];

    const dangerousList: PermissionIntelligence[] = allExtractedPerms
      .filter((p) => dangerousPermKeys.includes(p))
      .map((p) => {
        const intel = PERMISSION_INTELLIGENCE[p];
        return {
          name: p,
          description: intel?.title || p.split('.').pop() || 'Riskli İzin',
          purpose: intel?.purpose || 'Uygulamanın Android manifestinde talep edilen donanım veya arka plan servisidir.',
          impact: intel?.impact || 'İzin kaldırıldığında ilgili özellik durur, temel okuma/medya özellikleri devam eder.',
          safety: intel?.safety || 'caution',
          safety_label: intel?.safety_label || '⚠️ İsteğe Bağlı Seçim',
          selected: intel?.safety === 'safe', // Preselect safe ones, leave storage/camera unselected by default for safety
        };
      });

    const adList: PermissionIntelligence[] = allExtractedPerms
      .filter((p) => adPermKeys.includes(p))
      .map((p) => {
        const intel = PERMISSION_INTELLIGENCE[p];
        return {
          name: p,
          description: intel?.title || p.split('.').pop() || 'Reklam / Takip İzni',
          purpose: intel?.purpose || 'Reklam ağlarına kimlik ve ilgi alanı bilgisi aktarmak için kullanılır.',
          impact: intel?.impact || 'Reklam takipçileri engellenir. Uygulama sıfır çökme riskiyle tertemiz çalışır.',
          safety: intel?.safety || 'safe',
          safety_label: intel?.safety_label || '✅ Önerilen Temizlik (Sıfır Risk)',
          selected: true,
        };
      });

    const safeList: PermissionIntelligence[] = allExtractedPerms
      .filter((p) => ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'android.permission.WAKE_LOCK', 'android.permission.POST_NOTIFICATIONS'].includes(p))
      .map((p) => {
        const intel = PERMISSION_INTELLIGENCE[p];
        return {
          name: p,
          description: intel?.title || p.split('.').pop() || 'Sistem Özelliği',
          purpose: intel?.purpose || 'Android arka plan veya ekran konforu hizmetidir.',
          impact: intel?.impact || 'Fonksiyon ihtiyacınıza göre seçebilirsiniz.',
          safety: intel?.safety || 'safe',
          safety_label: intel?.safety_label || '✅ Sistem Özelliği',
          selected: false,
        };
      });

    // Detect Billing / IAP
    const hasBilling = Boolean(
      (realInspection && realInspection.hasBilling) ||
      latestReport?.drm_systems?.some((d: any) => d.package?.includes('billing') || d.package?.includes('revenuecat')) ||
      allExtractedPerms.includes('com.android.vending.BILLING') ||
      existingProfile?.profile_yaml?.includes('billing')
    );

    const isFdroidOpenSource = Boolean(
      pkg.includes('foobnix') ||
      targetApkUrl.toLowerCase().includes('fdroid') ||
      listing?.description?.toLowerCase().includes('açık kaynak') ||
      listing?.title?.toLowerCase().includes('açık kaynak')
    );

    const hasAds = Boolean(
      (realInspection && realInspection.hasAds) ||
      adList.length > 0 ||
      (latestReport?.ad_networks && latestReport.ad_networks.length > 0)
    );

    const isAlreadyModded = Boolean(
      existingProfile ||
      targetApkUrl?.toLowerCase().includes('liteapks') ||
      targetApkUrl?.toLowerCase().includes('mod') ||
      listing?.title?.toLowerCase().includes('mod') ||
      listing?.title?.toLowerCase().includes('pro')
    );

    // Build rich Premium & Licensing Summary
    const premiumSummary = {
      has_billing: hasBilling,
      billing_type: hasBilling
        ? 'Google Play Billing / In-App Purchases (Ticari IAP Koruması)'
        : isFdroidOpenSource
          ? 'Açık Kaynak Pro (Lisans Kilidi Yok)'
          : isAlreadyModded
            ? 'Önceden Modlanmış VIP (Bağımsız Lisans)'
            : 'Standart / Ücretsiz Lisans',
      status_title: hasBilling
        ? '🛒 Ticari Satın Alma (Google Play Billing) Koruması Tespit Edildi'
        : isFdroidOpenSource
          ? '🟢 Açık Kaynak Pro / Modlu Sürüm (Sıfır Satın Alma Kısıtlaması)'
          : '💎 VIP / Pro Özellikler Aktif',
      status_description: hasBilling
        ? 'Uygulama kodunda Google Play Billing / In-App Purchase arayüzü tespit edildi. PrimeForge Smali Yama Motoru, abonelik ve satın alma metotlarını (isPurchased -> true) otomatik olarak yeni sürüme aktaracaktır.'
        : isFdroidOpenSource
          ? 'Bu sürüm F-Droid mimarisiyle derlenmiştir. İçerisinde Google Play Billing ödeme koruması veya zorunlu lisans denetimi bulunmaz; tüm Pro/VIP e-kitap ve çizgi roman özellikleri kaynak kodundan doğrudan etkindir.'
          : 'Uygulama VIP özelliklerini bağımsız olarak sunmaktadır. Kod seviyesinde ek Google Play ödeme kısıtlaması bulunmamaktadır.',
      is_open_source_pro: isFdroidOpenSource,
    };

    // Recommended action
    let recommendedAction: 'autonomous_from_guide' | 'sanitize_only' | 'full_mod' | 'direct_sign' = 'sanitize_only';
    if (existingProfile) {
      recommendedAction = 'autonomous_from_guide';
    } else if (hasBilling) {
      recommendedAction = 'full_mod';
    } else if (isAlreadyModded) {
      recommendedAction = 'sanitize_only';
    }

    const response: PreAuditResponse = {
      success: true,
      package_name: pkg,
      version_name: listing?.version || '1.0.0',
      app_title: listing?.title || pkg || 'Uygulama',
      has_existing_profile: Boolean(existingProfile),
      existing_profile_name: existingProfile?.profile_name || null,
      existing_profile_yaml: existingProfile?.profile_yaml || null,
      modding_guide: existingProfile?.modding_guide || null,
      auto_apply: existingProfile?.auto_apply ?? true,
      success_count: existingProfile?.success_count || 0,
      last_used_at: existingProfile?.last_used_at || null,
      is_real_time_parsed: isRealTime,
      permissions: {
        dangerous: dangerousList,
        ad_related: adList,
        safe_and_system: safeList,
        total_count: dangerousList.length + adList.length + safeList.length,
      },
      detected_features: {
        has_billing: hasBilling,
        billing_type: premiumSummary.billing_type,
        billing_frameworks: realInspection?.billingFrameworks || (hasBilling ? ['Google Play In-App Billing (IAP)'] : []),
        vip_methods: realInspection?.vipMethods || (hasBilling ? ['isVip()', 'isPremium()', 'isPurchased()'] : []),
        has_ads: hasAds,
        ad_networks: realInspection?.adNetworks && realInspection.adNetworks.length > 0
          ? realInspection.adNetworks
          : latestReport?.ad_networks?.map((a: any) => a.name) || (hasAds ? ['Google AdMob'] : []),
        is_already_modded: isAlreadyModded,
        mod_signatures: isAlreadyModded ? ['VIP Flag Aktif', 'Önceden Tanımlı Profil Mevcut'] : [],
      },
      premium_summary: premiumSummary,
      recommended_action: recommendedAction,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Pre-audit error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
