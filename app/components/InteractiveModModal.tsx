'use client';

import { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Sparkles,
  Lock,
  Unlock,
  Ban,
  Tv,
  Smartphone,
  Tablet,
  Radio,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Layers,
  Info,
  X,
  Send,
  Eye,
  ArrowRight,
  Puzzle,
} from 'lucide-react';
import { getAllPatches } from '@/lib/morphe';

export interface ModOptions {
  unlock_premium: boolean;
  remove_ads: boolean;
  strip_permissions: boolean;
  bypass_update: boolean;
  enable_tv_compat: boolean;
  signature_bypass: boolean;
  morphe_patches?: string[];
}

export interface InteractiveModModalProps {
  app: any;
  onClose: () => void;
  onSuccess: (result: { jobId: string; action: string; options: ModOptions }) => void;
}

export default function InteractiveModModal({ app, onClose, onSuccess }: InteractiveModModalProps) {
  const analysis = app?.analysis_report || {};
  const hasAnalysis = Boolean(app?.analysis_report || app?.latest_job_id);

  // Dynamic analysis detections
  const detectedBilling = Boolean(
    analysis.has_billing ||
    analysis.obfuscation_info?.has_billing ||
    analysis.permissions?.some?.((p: string) => p.includes('BILLING')) ||
    app.packageName === 'ar.tvplayer.tv' // TiviMate
  );

  const detectedAds = Boolean(
    analysis.has_ads ||
    analysis.has_adservices ||
    analysis.ad_services?.length > 0 ||
    analysis.permissions?.some?.((p: string) => p.includes('AD_ID')) ||
    app.packageName === 'ar.tvplayer.tv'
  );

  const detectedRemoteConfig = Boolean(
    analysis.update_mechanism?.has_update_mechanism ||
    analysis.has_remote_config ||
    app.packageName === 'ar.tvplayer.tv'
  );

  const obfuscationPercent = analysis.obfuscation_info?.obfuscated_percentage ?? (app.packageName === 'ar.tvplayer.tv' ? 63.1 : 0);
  const isHeavyObfuscated = obfuscationPercent > 30;

  // Modding selections
  const [options, setOptions] = useState<ModOptions>({
    unlock_premium: detectedBilling || true,
    remove_ads: detectedAds || true,
    strip_permissions: true,
    bypass_update: detectedRemoteConfig || false,
    enable_tv_compat: !app.isTvCompatible || app.packageName === 'ar.tvplayer.tv',
    signature_bypass: true,
  });

  // Publishing policy (Default: require approval before publishing to PrimeStore!)
  const [requireApproval, setRequireApproval] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableMorphePatches = getAllPatches(app.packageName);
  const [selectedMorphePatches, setSelectedMorphePatches] = useState<string[]>([]);
  const [showMorpheSection, setShowMorpheSection] = useState<boolean>(
    Boolean(app.packageName && (app.packageName.includes('youtube') || app.packageName.includes('reddit') || app.packageName.includes('twitter')))
  );

  const toggleMorphePatch = (patchId: string) => {
    setSelectedMorphePatches((prev) =>
      prev.includes(patchId) ? prev.filter((p) => p !== patchId) : [...prev, patchId]
    );
  };

  // Quick preset handlers
  const applyPreset = (preset: 'all' | 'premium_only' | 'ads_only' | 'tv_only' | 'reset') => {
    if (preset === 'all') {
      setOptions({
        unlock_premium: true,
        remove_ads: true,
        strip_permissions: true,
        bypass_update: true,
        enable_tv_compat: true,
        signature_bypass: true,
      });
    } else if (preset === 'premium_only') {
      setOptions({
        unlock_premium: true,
        remove_ads: false,
        strip_permissions: false,
        bypass_update: false,
        enable_tv_compat: false,
        signature_bypass: true,
      });
    } else if (preset === 'ads_only') {
      setOptions({
        unlock_premium: false,
        remove_ads: true,
        strip_permissions: true,
        bypass_update: false,
        enable_tv_compat: false,
        signature_bypass: false,
      });
    } else if (preset === 'tv_only') {
      setOptions({
        unlock_premium: false,
        remove_ads: false,
        strip_permissions: false,
        bypass_update: false,
        enable_tv_compat: true,
        signature_bypass: false,
      });
    } else if (preset === 'reset') {
      setOptions({
        unlock_premium: false,
        remove_ads: false,
        strip_permissions: false,
        bypass_update: false,
        enable_tv_compat: false,
        signature_bypass: false,
      });
    }
  };

  const toggleOption = (key: keyof ModOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    // Check if at least one option is chosen
    const hasAnyOption = Object.values(options).some(Boolean);
    if (!hasAnyOption && !customNotes.trim()) {
      setErrorMsg('Lütfen en az bir modlama seçeneği işaretleyin veya özel not girin.');
      return;
    }

    if (!app.fileUrl || app.fileUrl.startsWith('market://')) {
      setErrorMsg('Bu uygulama için doğrudan APK indirme bağlantısı mevcut değil.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: app.fileUrl,
          package_name: app.packageName,
          app_name: app.name || app.title,
          version_name: app.version,
          profile: app.packageName, // Matches profiles/<package>.yml if present
          action: 'full_mod',
          publish_mode: requireApproval ? 'manual_review' : 'auto_publish',
          mod_options: {
            ...options,
            morphe_patches: selectedMorphePatches,
          },
          custom_notes: customNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess({
          jobId: data.job_id,
          action: 'full_mod',
          options: {
            ...options,
            morphe_patches: selectedMorphePatches,
          },
        });
      } else {
        setErrorMsg(data.error || 'Modlama görevi başlatılamadı.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sunucu ile iletişim kurulurken hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.values(options).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="glass-panel w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold text-base overflow-hidden">
              {app.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={app.icon_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (app.name || app.packageName || 'AP').substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  {app.name || app.title || app.packageName}
                </h3>
                {app.version && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                    v{app.version}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md">{app.packageName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Analysis Findings Card */}
          <div className="rounded-xl p-4 bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Statik Analiz & Tespit Raporu
              </div>
              {hasAnalysis ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Ön İnceleme Mevcut
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1 font-medium">
                  <Info className="w-3 h-3" /> İlk Modlama & Analiz
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* Billing Detection */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  detectedBilling
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Faturalandırma</span>
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 font-bold text-[11px]">
                  {detectedBilling ? '💳 Google Billing Var' : 'Faturalandırma Yok'}
                </div>
              </div>

              {/* Ads Detection */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  detectedAds
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Reklam & İzleyici</span>
                  <Ban className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 font-bold text-[11px]">
                  {detectedAds ? '📢 AdServices / Referrer' : 'Reklam Yok'}
                </div>
              </div>

              {/* Obfuscation Level */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  isHeavyObfuscated
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Kod Gizleme</span>
                  <FileCode2 className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 font-bold text-[11px]">
                  {obfuscationPercent > 0 ? `%${obfuscationPercent} R8 Obfuscated` : 'Standart Derleme'}
                </div>
              </div>

              {/* Remote Config / Updates */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  detectedRemoteConfig
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Sürüm Koruması</span>
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1.5 font-bold text-[11px]">
                  {detectedRemoteConfig ? '🔄 Firebase Remote' : 'Yerel Kontrol'}
                </div>
              </div>
            </div>

            {app.packageName === 'ar.tvplayer.tv' && (
              <div className="text-[11px] bg-purple-950/40 border border-purple-800/50 p-2.5 rounded-lg text-purple-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <b>TiviMate İçin Özel Profil Mevcut:</b> %63 R8 kod gizlemesi nedeniyle sınıf isimleri karmaşıklaştırılmıştır.
                  Özel profilimiz <code>BillingResult</code> ve <code>Purchase</code> standart bytecode arayüzlerine kanca atarak premium kilidini çözer.
                </div>
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Hızlı Modlama Profilleri
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Seçili Modlar: <b className="text-blue-400">{selectedCount}</b> / 6
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                Tam Paket (Tüm Modlar)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('premium_only')}
                className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Unlock className="w-3.5 h-3.5 text-purple-400" />
                Sadece Premium Aç
              </button>
              <button
                type="button"
                onClick={() => applyPreset('ads_only')}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                Sadece Reklamları Kaldır
              </button>
              <button
                type="button"
                onClick={() => applyPreset('tv_only')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Tv className="w-3.5 h-3.5 text-emerald-400" />
                Sadece TV Kumanda Uyumu
              </button>
              <button
                type="button"
                onClick={() => applyPreset('reset')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium transition-all"
              >
                Temizle
              </button>
            </div>
          </div>

          {/* Interactive Feature Checkboxes */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Uygulanacak Modlama Bileşenleri
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: Unlock Premium */}
              <div
                onClick={() => toggleOption('unlock_premium')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  options.unlock_premium
                    ? 'bg-purple-950/30 border-purple-500/50 shadow-sm shadow-purple-950/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.unlock_premium}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <Unlock className="w-4 h-4 text-purple-400" />
                    Premium & Abonelik Kilidi Aç
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Google Play In-App Billing ve abonelik kancalarını (BillingResult OK, PurchaseState PURCHASED) smali seviyesinde simüle eder.
                  </p>
                </div>
              </div>

              {/* Option 2: Remove Ads */}
              <div
                onClick={() => toggleOption('remove_ads')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  options.remove_ads
                    ? 'bg-rose-950/30 border-rose-500/50 shadow-sm shadow-rose-950/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.remove_ads}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 rounded text-rose-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <Ban className="w-4 h-4 text-rose-400" />
                    Reklam & Takipçileri Kaldır
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Google AdServices, AdMob, Unity, AppsFlyer ve telemetri SDK'larını smali ve manifestten tamamen arındırır.
                  </p>
                </div>
              </div>

              {/* Option 3: Strip Permissions */}
              <div
                onClick={() => toggleOption('strip_permissions')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  options.strip_permissions
                    ? 'bg-amber-950/30 border-amber-500/50 shadow-sm shadow-amber-950/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.strip_permissions}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 rounded text-amber-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Gereksiz İzinleri & AD_ID Budama
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Uygulamanın gereksiz yere talep ettiği reklam kimliği (AD_ID), konum veya hassas telefon durum izinlerini AndroidManifest'ten çıkarır.
                  </p>
                </div>
              </div>

              {/* Option 4: Bypass Remote Config & Updates */}
              <div
                onClick={() => toggleOption('bypass_update')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  options.bypass_update
                    ? 'bg-blue-950/30 border-blue-500/50 shadow-sm shadow-blue-950/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.bypass_update}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <Radio className="w-4 h-4 text-blue-400" />
                    Zorunlu Güncelleme / Remote Config Bypass
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Firebase Remote Config veya sunucu taraflı zorunlu sürüm yükseltme / son kullanma tarihi kilitlerini etkisiz kılar.
                  </p>
                </div>
              </div>

              {/* Option 5: Android TV Compatibility */}
              <div
                onClick={() => toggleOption('enable_tv_compat')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  options.enable_tv_compat
                    ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm shadow-emerald-950/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.enable_tv_compat}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <Tv className="w-4 h-4 text-emerald-400" />
                    Android TV & Kumanda Optimizasyonu
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Leanback banner, LEANBACK_LAUNCHER intenti ve kumanda (DPAD) gezinme bayraklarını manifest ve layoutlara enjekte eder.
                  </p>
                </div>
              </div>

              {/* Option 6: Signature Bypass */}
              <div
                onClick={() => toggleOption('signature_bypass')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  options.signature_bypass
                    ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-950/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.signature_bypass}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 rounded text-cyan-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    İmza & Anti-Tamper Kontrolü Bypass
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Uygulama içi imza doğrulama, root veya emülatör varlığı tespit kontrollerini pasifize eder.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Morphe Patches Section */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMorpheSection(!showMorpheSection)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-indigo-900/20 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Puzzle className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    Morphe & ReVanced Uyumlu Bytecode Yamaları
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                      {availableMorphePatches.length} yama uygun
                    </span>
                    {selectedMorphePatches.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        {selectedMorphePatches.length} seçildi
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Morphe Patcher motoruyla doğrudan bytecode düzeyinde uygulanan modlar.
                  </div>
                </div>
              </div>
              {showMorpheSection ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showMorpheSection && (
              <div className="p-4 border-t border-indigo-500/20 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableMorphePatches.map((patch) => {
                    const isSelected = selectedMorphePatches.includes(patch.id);
                    return (
                      <div
                        key={patch.id}
                        onClick={() => toggleMorphePatch(patch.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                          isSelected
                            ? 'bg-indigo-950/50 border-indigo-500/60 shadow-sm'
                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 w-3.5 h-3.5 rounded text-indigo-600 bg-slate-800 border-slate-700 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                            {patch.name}
                            {patch.isUniversal && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-300">
                                Evrensel
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                            {patch.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Publishing Policy Card (CRITICAL USER REQUIREMENT) */}
          <div className="rounded-xl p-4 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    PrimeStore Yayınlama Politikası
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                    Önce Test & İnceleme
                  </span>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={requireApproval}
                    onChange={(e) => setRequireApproval(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    🛡️ Doğrudan PrimeStore'da yayınlama, önce onayıma sun (Tavsiye Edilen)
                  </span>
                </label>

                <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                  {requireApproval ? (
                    <span>
                      Modlanan APK derlenip emülatörde test edilecek, ekran görüntüleri ve indirme bağlantısı{' '}
                      <b>İş Kuyruğunda önizlemenize sunulacaktır</b>. Siz <i>"PrimeStore'da Yayınla"</i> butonuna basmadan
                      mağazada yayına alınmaz.
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      ⚠️ Dikkat: Modlama ve emülatör testi başarılı olursa APK doğrudan PrimeStore mağaza kataloğuna yayınlanacaktır.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Accordion */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-3 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-between text-xs font-semibold text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-slate-400" />
                Gelişmiş Smali & Özel Yamalama Notları (Opsiyonel)
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 bg-slate-950/60 border-t border-slate-800 space-y-3">
                <p className="text-[11px] text-slate-400">
                  Belirli bir smali metodu veya sınıfı hedeflemek istiyorsanız buraya özel not veya talimat ekleyebilirsiniz:
                </p>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Örn: com/tivimate/billing/PremiumStatus->isSubscribed()Z dönüş değerini const/4 v0, 0x1 yap..."
                  rows={3}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Kuyruğa Gönderiliyor...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Seçili Modları Başlat ({selectedCount})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
