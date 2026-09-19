import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
  permissions: {
    dangerous: Array<{ name: string; description: string; selected: boolean }>;
    ad_related: Array<{ name: string; description: string; selected: boolean }>;
    total_count: number;
  };
  detected_features: {
    has_billing: boolean;
    billing_type?: string;
    has_ads: boolean;
    ad_networks: string[];
    is_already_modded: boolean;
    mod_signatures?: string[];
  };
  recommended_action: 'autonomous_from_guide' | 'sanitize_only' | 'full_mod' | 'direct_sign';
}

// Known dangerous permissions with user-friendly descriptions
const DANGEROUS_PERMISSION_MAP: Record<string, string> = {
  'android.permission.ACCESS_FINE_LOCATION': 'Hassas GPS Konum Bilgisi',
  'android.permission.ACCESS_COARSE_LOCATION': 'Yaklaşık Ağ Konumu',
  'android.permission.RECORD_AUDIO': 'Mikrofon Erişimi / Ses Kaydı',
  'android.permission.CAMERA': 'Kamera Erişimi',
  'android.permission.READ_CONTACTS': 'Rehber ve Kişi Bilgilerini Okuma',
  'android.permission.READ_CALL_LOG': 'Arama Geçmişini Okuma',
  'android.permission.RECEIVE_BOOT_COMPLETED': 'Cihaz Açılışında Otomatik Başlama',
  'android.permission.READ_SMS': 'SMS Mesajlarını Okuma',
  'android.permission.SEND_SMS': 'Arka Planda SMS Gönderme',
  'android.permission.SYSTEM_ALERT_WINDOW': 'Diğer Uygulamaların Üzerinde Görünme',
  'android.permission.REQUEST_INSTALL_PACKAGES': 'Dışarıdan Başka APK İndirip Kurma',
  'android.permission.PACKAGE_USAGE_STATS': 'Diğer Uygulamaların Kullanımını İzleme',
  'android.permission.QUERY_ALL_PACKAGES': 'Yüklü Tüm Uygulamaları Tarama (Sniffer)',
};

const AD_PERMISSION_MAP: Record<string, string> = {
  'com.google.android.gms.permission.AD_ID': 'Google Reklam Kimliği (İzleme)',
  'android.permission.ACCESS_ADSERVICES_AD_ID': 'Android AdServices Reklam Kimliği',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION': 'Reklam İlişkilendirme & Takip',
  'android.permission.ACCESS_ADSERVICES_TOPICS': 'İlgi Alanı & Reklam Hedefleme',
  'com.android.vending.BILLING': 'Google Play Satın Alma / Ödeme Arayüzü',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apk_url, listing_id, package_name } = body;

    // 1. Check existing listing analysis or profile from Supabase
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

    // Extract permissions from latest report or infer defaults
    const rawDangerous = latestReport?.permissions?.dangerous || [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ];
    const rawAdPerms = latestReport?.permissions?.ad_related || [
      'com.google.android.gms.permission.AD_ID',
      'android.permission.ACCESS_ADSERVICES_AD_ID',
    ];

    const dangerousList = rawDangerous.map((p: string) => ({
      name: p,
      description: DANGEROUS_PERMISSION_MAP[p] || 'Gereksiz / Riskli İzin',
      selected: true, // Selected for removal by default
    }));

    const adList = rawAdPerms.map((p: string) => ({
      name: p,
      description: AD_PERMISSION_MAP[p] || 'Reklam & Takip İzni',
      selected: true,
    }));

    // Detect Billing / IAP
    const hasBilling = Boolean(
      latestReport?.drm_systems?.some((d: any) => d.package?.includes('billing') || d.package?.includes('revenuecat')) ||
      rawAdPerms.includes('com.android.vending.BILLING') ||
      existingProfile?.profile_yaml?.includes('billing')
    );

    // Detect Ad Networks
    const adNetworks = latestReport?.ad_networks?.map((a: any) => a.name) || ['Google AdMob', 'Unity Ads'];

    // Detect if already modded (LiteAPKs signature, existing profile, or smali patches)
    const isAlreadyModded = Boolean(
      existingProfile ||
      apk_url?.toLowerCase().includes('liteapks') ||
      apk_url?.toLowerCase().includes('mod') ||
      listing?.title?.toLowerCase().includes('mod') ||
      listing?.title?.toLowerCase().includes('pro')
    );

    // Recommended action: if profile/guide exists, autonomous_from_guide is the best choice!
    let recommendedAction: 'autonomous_from_guide' | 'sanitize_only' | 'full_mod' | 'direct_sign' = 'full_mod';
    if (existingProfile) {
      recommendedAction = 'autonomous_from_guide';
    } else if (isAlreadyModded) {
      recommendedAction = 'sanitize_only';
    } else if (!hasBilling && dangerousList.length === 0) {
      recommendedAction = 'direct_sign';
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
      permissions: {
        dangerous: dangerousList,
        ad_related: adList,
        total_count: dangerousList.length + adList.length,
      },
      detected_features: {
        has_billing: hasBilling,
        billing_type: hasBilling ? 'Google Play Billing / In-App Purchases' : undefined,
        has_ads: adNetworks.length > 0,
        ad_networks: adNetworks,
        is_already_modded: isAlreadyModded,
        mod_signatures: isAlreadyModded ? ['VIP Flag Aktif', 'Reklam İmzaları Bypass Edilmiş', 'Önceden Tanımlı Profil Mevcut'] : [],
      },
      recommended_action: recommendedAction,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Pre-audit error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
