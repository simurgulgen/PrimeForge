'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Sparkles,
  Lock,
  Unlock,
  Ban,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Layers,
  X,
  Send,
  Loader2,
  Check,
  Sliders,
  Cpu,
  Cloud,
  Smartphone,
  Tv,
  Bot,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';

interface PreAuditModalProps {
  app: {
    listing_id: string;
    title: string;
    packageName: string | null;
    current_version: string | null;
    latest_version: string | null;
    download_url: string;
  };
  onClose: () => void;
  onSuccess: (result: { jobId?: string; message: string }) => void;
}

export default function PreAuditModal({ app, onClose, onSuccess }: PreAuditModalProps) {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // User selections
  const [selectedDangerousPerms, setSelectedDangerousPerms] = useState<string[]>([]);
  const [selectedAdPerms, setSelectedAdPerms] = useState<string[]>([]);
  const [actionType, setActionType] = useState<'autonomous_from_guide' | 'sanitize_only' | 'full_mod' | 'direct_sign'>('sanitize_only');
  const [transferModRecipe, setTransferModRecipe] = useState(true);
  const [runEmulatorTest, setRunEmulatorTest] = useState(true);
  const [saveGuide, setSaveGuide] = useState(true);
  const [showGuidePreview, setShowGuidePreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Advanced Game-Changing Options
  const [runnerType, setRunnerType] = useState<'local' | 'cloud'>('local');
  const [enableTvDpad, setEnableTvDpad] = useState(false);
  const [enableAdBlocker, setEnableAdBlocker] = useState(true);
  const [enableSelfHealing, setEnableSelfHealing] = useState(true);

  // Permission Intelligence & AI Inspection
  const [expandedPerms, setExpandedPerms] = useState<Record<string, boolean>>({});
  const [aiInspectingPerm, setAiInspectingPerm] = useState<string | null>(null);
  const [aiInspectResults, setAiInspectResults] = useState<Record<string, any>>({});

  const toggleExpandPerm = (permName: string) => {
    setExpandedPerms((prev) => ({ ...prev, [permName]: !prev[permName] }));
  };

  const handleAskAiAboutPerm = async (e: React.MouseEvent, permName: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (aiInspectResults[permName]) {
      setExpandedPerms((prev) => ({ ...prev, [permName]: true }));
      return;
    }

    setAiInspectingPerm(permName);
    try {
      const res = await fetch('/api/ai/permission-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: app.packageName,
          app_name: app.title,
          permission_name: permName,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiInspectResults((prev) => ({ ...prev, [permName]: data.data }));
        setExpandedPerms((prev) => ({ ...prev, [permName]: true }));
      }
    } catch (err) {
      console.error('AI inspect error:', err);
    } finally {
      setAiInspectingPerm(null);
    }
  };

  useEffect(() => {
    const fetchPreAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/pre-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apk_url: app.download_url,
            listing_id: app.listing_id,
            package_name: app.packageName,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setAuditData(data);
          // Default selections from audit
          setSelectedDangerousPerms(data.permissions?.dangerous?.map((p: any) => p.name) || []);
          setSelectedAdPerms(data.permissions?.ad_related?.map((p: any) => p.name) || []);
          setActionType(data.recommended_action || (data.has_existing_profile ? 'autonomous_from_guide' : 'sanitize_only'));
        } else {
          setError(data.error || 'Ön denetim raporu alınamadı.');
        }
      } catch (err: any) {
        setError(err.message || 'Bağlantı hatası');
      } finally {
        setLoading(false);
      }
    };

    fetchPreAudit();
  }, [app]);

  const toggleDangerousPerm = (permName: string) => {
    setSelectedDangerousPerms((prev) =>
      prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
    );
  };

  const toggleAdPerm = (permName: string) => {
    setSelectedAdPerms((prev) =>
      prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const actionLabels: Record<string, string> = {
        autonomous_from_guide: 'Kayıtlı Rehberden Otonom Modlama',
        sanitize_only: 'Hızlı İzin & Reklam Temizliği (Decompile Yok)',
        full_mod: 'Tam Smali Modu & VIP Baypas',
        direct_sign: 'Doğrudan İmzala',
      };

      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: app.download_url,
          action: actionType,
          package_name: app.packageName,
          app_name: app.title,
          version_name: app.latest_version,
          profile: app.packageName,
          runner_type: runnerType,
          mod_options: {
            strip_dangerous_permissions: selectedDangerousPerms,
            strip_ad_permissions: selectedAdPerms,
            transfer_mod_recipe: transferModRecipe,
            run_emulator_test: runEmulatorTest,
            save_guide: saveGuide,
            use_saved_guide: actionType === 'autonomous_from_guide',
            enable_tv_dpad_converter: enableTvDpad,
            enable_universal_ad_blocker: enableAdBlocker,
            enable_self_healing: enableSelfHealing,
          },
          custom_notes: `İşlem: ${actionLabels[actionType] || actionType}. Runner: ${runnerType}. Rehber Kaydı: ${saveGuide ? 'Aktif' : 'Pasif'}.`,
          publish_mode: 'manual_review',
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess({
          jobId: data.job_id,
          message: `${app.title} için ${actionType === 'autonomous_from_guide' ? 'rehber tabanlı otonom pipeline' : 'güvenlik pipeline'} başarıyla başlatıldı!`,
        });
        onClose();
      } else {
        setError(data.error || 'İşlem başlatılamadı.');
      }
    } catch (err: any) {
      setError(err.message || 'Bağlantı hatası');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl flex flex-col bg-slate-900/95">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Güvenlik Ön Denetimi & Mod Seçenekleri
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Pre-Audit
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {app.title} (v{app.current_version} ➔ v{app.latest_version})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <div className="text-sm font-medium text-white">APK Ön Denetimi Yapılıyor...</div>
              <div className="text-xs text-slate-400">
                Decompile yapmadan binary manifest, izinler ve yama profilleri taranıyor.
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <div>{error}</div>
            </div>
          ) : (
            <>
              {/* Feature Detection Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-500 font-mono">SATIN ALMA / IAP</div>
                  <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                    {auditData?.detected_features?.has_billing ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                        <span>IAP Algılandı</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>IAP Yok</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-500 font-mono">MEVCUT MOD PROFİLİ</div>
                  <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                    {auditData?.has_existing_profile ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Hazır Reçete Var</span>
                      </>
                    ) : (
                      <>
                        <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Yeni Uygulama</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-500 font-mono">ÖNERİLEN YÖNTEM</div>
                  <div className="font-semibold mt-1 flex items-center gap-1.5 text-purple-300">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      {auditData?.recommended_action === 'sanitize_only'
                        ? 'Hızlı Temizlik (Decompilesiz)'
                        : 'Tam Smali Modu'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Existing Profile & Guide Alert Banner */}
              {auditData?.has_existing_profile && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 text-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-xs text-white">
                        Kayıtlı Modlama Rehberi Mevcut ({auditData.existing_profile_name || app.title})
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {auditData.success_count || 1}x Test Edildi
                      </span>
                    </div>
                    {auditData.modding_guide && (
                      <button
                        type="button"
                        onClick={() => setShowGuidePreview(!showGuidePreview)}
                        className="text-[11px] underline text-emerald-400 hover:text-emerald-300"
                      >
                        {showGuidePreview ? 'Rehberi Gizle' : '📖 Rehberi İncele'}
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-200/80">
                    Bu uygulama için daha önce uygulanan güvenlik filtreleri, reklam engellemeleri ve VIP smali yamaları rehbere kaydedilmiş. Yeni sürüme doğrudan otonom aktarabilirsiniz.
                  </div>
                  {showGuidePreview && auditData.modding_guide && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950/80 border border-emerald-500/20 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-300 whitespace-pre-wrap">
                      {auditData.modding_guide}
                    </div>
                  )}
                </div>
              )}

              {/* Action Selection (Gereksiz decompile'ı önleyen radyo butonları) */}
              <div className="space-y-3 pt-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  İşlem Yöntemini Seçin
                </div>
                <div className={`grid grid-cols-1 ${auditData?.has_existing_profile ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                  {auditData?.has_existing_profile && (
                    <label
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        actionType === 'autonomous_from_guide'
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="actionType"
                          checked={actionType === 'autonomous_from_guide'}
                          onChange={() => setActionType('autonomous_from_guide')}
                          className="text-emerald-600 focus:ring-0"
                        />
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          Rehberden Otonom
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Kayıtlı rehberdeki manifest ve smali reçetesini sıfır eforla doğrudan yeni APK'ya uygular.
                      </p>
                    </label>
                  )}

                  <label
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      actionType === 'sanitize_only'
                        ? 'bg-purple-500/10 border-purple-500/40 text-white'
                        : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="actionType"
                        checked={actionType === 'sanitize_only'}
                        onChange={() => setActionType('sanitize_only')}
                        className="text-purple-600 focus:ring-0"
                      />
                      <span className="font-bold text-xs text-white">Hızlı Temizlik (Decompile Yok)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Gereksiz decompile yapmaz. Yalnızca seçilen riskli izinleri ve izleyicileri temizleyip hızlıca imzalar.
                    </p>
                  </label>

                  <label
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      actionType === 'full_mod'
                        ? 'bg-purple-500/10 border-purple-500/40 text-white'
                        : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="actionType"
                        checked={actionType === 'full_mod'}
                        onChange={() => setActionType('full_mod')}
                        className="text-purple-600 focus:ring-0"
                      />
                      <span className="font-bold text-xs text-white">Tam Decompile & Smali</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      APK'yı Smali seviyesinde açar, IAP/Billing bayraklarını ve VIP bağımlılıklarını yeni APK'ya aktarır.
                    </p>
                  </label>
                </div>
              </div>

              {/* Real-time APK Manifest Inspection Badge */}
              {auditData?.is_real_time_parsed && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Gerçek APK İncelemesi:</strong> Bu uygulamanın indirme dosyasındaki ikili AndroidManifest taranarak yalnızca bu APK&apos;ya özel gerçek izinler çıkarıldı.</span>
                </div>
              )}

              {/* Premium & Licensing Status Box (Always visible!) */}
              {/* Premium & Licensing Status Box (Always visible!) */}
              <div className={`p-4 rounded-xl border transition-all ${
                auditData?.premium_summary?.has_billing
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : auditData?.premium_summary?.is_open_source_pro
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-black/40 shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-xs text-white">
                        {auditData?.premium_summary?.status_title || '💎 Premium / VIP Lisans Durumu'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/10 text-white border border-white/10">
                        {auditData?.premium_summary?.billing_type || 'Analiz Edildi'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed">
                      {auditData?.premium_summary?.status_description}
                    </div>

                    {/* Detected Billing Frameworks & SDKs */}
                    {auditData?.detected_features?.billing_frameworks?.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <div className="text-[10px] font-semibold text-amber-300 mb-1">
                          Tespit Edilen Ödeme / IAP Bağımlılıkları:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {auditData.detected_features.billing_frameworks.map((fw: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/30 font-mono text-[10px]"
                            >
                              📦 {fw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detected VIP / Subscription Methods */}
                    {auditData?.detected_features?.vip_methods?.length > 0 && (
                      <div className="pt-1.5">
                        <div className="text-[10px] font-semibold text-emerald-300 mb-1">
                          Koruması Baypas Edilecek VIP / Lisans Metotları:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {auditData.detected_features.vip_methods.map((m: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]"
                            >
                              ⚡ {m} ➔ const/4 0x1 (return true)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ad Networks Detected */}
                    {auditData?.detected_features?.ad_networks?.length > 0 && (
                      <div className="pt-1.5">
                        <div className="text-[10px] font-semibold text-rose-300 mb-1">
                          Engellenecek Reklam SDK Bağımlılıkları:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {auditData.detected_features.ad_networks.map((ad: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[10px]"
                            >
                              🚫 {ad}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {auditData?.premium_summary?.has_billing && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="transferRecipe"
                          checked={transferModRecipe}
                          onChange={(e) => setTransferModRecipe(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-0"
                        />
                        <label htmlFor="transferRecipe" className="text-[11px] text-white font-medium cursor-pointer">
                          Billing metot bağımlılıklarını (isPurchased -&gt; true) yeni sürüme otomatik aktar
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dangerous Permissions Checkboxes */}
              {auditData?.permissions?.dangerous?.length > 0 && (
                <div className="space-y-2.5">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-rose-300 text-xs">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      Kaldırılacak Riskli İzinler ({selectedDangerousPerms.length}/{auditData.permissions.dangerous.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDangerousPerms(
                          selectedDangerousPerms.length === auditData.permissions.dangerous.length
                            ? []
                            : auditData.permissions.dangerous.map((p: any) => p.name)
                        )
                      }
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      {selectedDangerousPerms.length === auditData.permissions.dangerous.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {auditData.permissions.dangerous.map((perm: any) => {
                      const isSelected = selectedDangerousPerms.includes(perm.name);
                      const isAiInspecting = aiInspectingPerm === perm.name;
                      const aiResult = aiInspectResults[perm.name];

                      return (
                        <div
                          key={perm.name}
                          className={`p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-slate-900/80 border-rose-500/30 shadow-sm shadow-rose-500/5'
                              : 'bg-slate-950/40 border-white/5 opacity-80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-start gap-2.5 cursor-pointer flex-1 overflow-hidden">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDangerousPerm(perm.name)}
                                className="mt-1 rounded text-rose-500 focus:ring-0"
                              />
                              <div className="overflow-hidden">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-xs text-white">{perm.description}</span>
                                  {perm.safety_label && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                      perm.safety === 'safe'
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                    }`}>
                                      {perm.safety_label}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{perm.name}</div>
                              </div>
                            </label>

                            <button
                              type="button"
                              onClick={(e) => handleAskAiAboutPerm(e, perm.name)}
                              disabled={isAiInspecting}
                              className="shrink-0 text-[10px] font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                              title="Yapay zekaya bu iznin decompile smali kodundaki yerini ve kullanım amacını sor"
                            >
                              {isAiInspecting ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                                  <span>Taranıyor...</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="w-3 h-3 text-purple-400" />
                                  <span>{aiResult ? 'Koddaki Yeri (AI)' : 'Koddaki Yeri?'}</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Purpose & Impact Explanations */}
                          <div className="mt-2 pt-2 border-t border-white/5 space-y-1 text-[11px]">
                            <div className="flex items-start gap-1.5 text-slate-300">
                              <span className="text-purple-400 font-semibold shrink-0">🎯 Neden Kullanılır:</span>
                              <span className="text-slate-300/90 leading-tight">{perm.purpose}</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-300">
                              <span className="text-amber-400 font-semibold shrink-0">⚡ Kaldırılırsa:</span>
                              <span className="text-slate-400 leading-tight">{perm.impact}</span>
                            </div>
                          </div>

                          {/* Live AI Code Inspection Result Card */}
                          {aiResult && (
                            <div className="mt-2.5 p-2.5 rounded-lg bg-gradient-to-br from-purple-950/60 to-slate-950/80 border border-purple-500/30 text-[11px] text-purple-200 space-y-1.5">
                              <div className="flex items-center justify-between font-semibold text-purple-300 text-xs">
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                  FCC-Claude Smali Kod İçi Teftişi
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Çökme Riski: {aiResult.crash_risk || 'SIFIR'}
                                </span>
                              </div>
                              <div className="text-slate-300 text-[11px] leading-relaxed">
                                <strong className="text-purple-300">Koddaki Yeri:</strong> {aiResult.usage_purpose}
                              </div>
                              <div className="text-amber-300/90 text-[11px] leading-relaxed">
                                <strong className="text-amber-300">Etki & Tavsiye:</strong> {aiResult.removal_impact}
                              </div>
                              {aiResult.code_references?.length > 0 && (
                                <div className="font-mono text-[9px] text-purple-300/70 bg-black/40 p-1.5 rounded border border-purple-500/15">
                                  İlgili Sınıflar: {aiResult.code_references.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ad & Tracker Permissions Checkboxes */}
              {auditData?.permissions?.ad_related?.length > 0 && (
                <div className="space-y-2.5">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-300 text-xs">
                      <Ban className="w-3.5 h-3.5 text-amber-400" />
                      Reklam & Takipçi İzinleri ({selectedAdPerms.length}/{auditData.permissions.ad_related.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {auditData.permissions.ad_related.map((perm: any) => {
                      const isSelected = selectedAdPerms.includes(perm.name);

                      return (
                        <div
                          key={perm.name}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-slate-900/70 border-amber-500/30'
                              : 'bg-slate-950/40 border-white/5 opacity-80'
                          }`}
                        >
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAdPerm(perm.name)}
                              className="mt-0.5 rounded text-amber-500 focus:ring-0"
                            />
                            <div className="overflow-hidden flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-white">{perm.description}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                  {perm.safety_label || '✅ Sıfır Çökme Riski'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{perm.name}</div>
                              <div className="mt-1 text-[11px] text-slate-400">
                                <span className="text-purple-400 font-medium">🎯 Amaç:</span> {perm.purpose}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                <span className="text-amber-400 font-medium">⚡ Kaldırılırsa:</span> {perm.impact}
                              </div>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Runner Selector & Game-Changing Engine Toggles */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" /> Çalıştırıcı (Runner):
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRunnerType('local')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        runnerType === 'local' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🖥️ Lokal Windows
                    </button>
                    <button
                      type="button"
                      onClick={() => setRunnerType('cloud')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        runnerType === 'cloud' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ☁️ GitHub Actions
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 cursor-pointer text-xs text-slate-300 hover:border-white/10">
                    <input
                      type="checkbox"
                      checked={enableTvDpad}
                      onChange={(e) => setEnableTvDpad(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0"
                    />
                    <span className="flex items-center gap-1 text-[11px]">
                      <Tv className="w-3.5 h-3.5 text-blue-400" /> TV DPAD Enjektörü
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 cursor-pointer text-xs text-slate-300 hover:border-white/10">
                    <input
                      type="checkbox"
                      checked={enableAdBlocker}
                      onChange={(e) => setEnableAdBlocker(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0"
                    />
                    <span className="flex items-center gap-1 text-[11px]">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" /> Ağ Reklam Hook'u
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 cursor-pointer text-xs text-slate-300 hover:border-white/10">
                    <input
                      type="checkbox"
                      checked={enableSelfHealing}
                      onChange={(e) => setEnableSelfHealing(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0"
                    />
                    <span className="flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Self-Healing AI
                    </span>
                  </label>
                </div>
              </div>

              {/* Headless Emulator Test & Save Guide Checkboxes */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runEmulatorTest}
                    onChange={(e) => setRunEmulatorTest(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                    <span>15 Saniyelik Emülatör Çökme (Crash) Testine Gönder</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveGuide}
                    onChange={(e) => setSaveGuide(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Yapılan İşlemleri Bu Uygulama İçin Rehber Olarak Kaydet</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Otonom Şablon
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Kaldırılan izinler, reklam filtreleri ve VIP yamaları uygulamanın profiline kaydedilir. Bir sonraki kontrolde bu kurallar doğrudan otonom olarak kullanılacaktır.
                    </div>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Vazgeç
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || submitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Seçilen Ayarlarla Başlat
          </button>
        </div>
      </div>
    </div>
  );
}
