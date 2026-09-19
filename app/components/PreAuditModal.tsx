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

              {/* IAP / Premium Recipe Transfer Option */}
              {auditData?.detected_features?.has_billing && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="transferRecipe"
                    checked={transferModRecipe}
                    onChange={(e) => setTransferModRecipe(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-0"
                  />
                  <div>
                    <label htmlFor="transferRecipe" className="font-semibold text-xs text-white cursor-pointer">
                      Mevcut Mod Bağımlılıklarını & VIP Reçetesini Yeni Sürüme Aktar
                    </label>
                    <div className="text-[11px] text-amber-300/80 mt-0.5">
                      Uygulamada önceden yapılmış olan VIP bayraklarını ve Billing metot bağımlılıklarını tespit eder, çökme yaratmadan yeni APK sürümüne bağlar.
                    </div>
                  </div>
                </div>
              )}

              {/* Dangerous Permissions Checkboxes */}
              {auditData?.permissions?.dangerous?.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-rose-300">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                    {auditData.permissions.dangerous.map((perm: any) => (
                      <label
                        key={perm.name}
                        className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 hover:border-white/10 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDangerousPerms.includes(perm.name)}
                          onChange={() => toggleDangerousPerm(perm.name)}
                          className="mt-0.5 rounded text-rose-500 focus:ring-0"
                        />
                        <div className="overflow-hidden">
                          <div className="font-medium text-white truncate text-[11px]">{perm.description}</div>
                          <div className="text-[9px] text-slate-500 font-mono truncate">{perm.name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Ad & Tracker Permissions Checkboxes */}
              {auditData?.permissions?.ad_related?.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Ban className="w-3.5 h-3.5 text-amber-400" />
                      Reklam & Takipçi İzinleri ({selectedAdPerms.length}/{auditData.permissions.ad_related.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto p-1">
                    {auditData.permissions.ad_related.map((perm: any) => (
                      <label
                        key={perm.name}
                        className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 hover:border-white/10 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAdPerms.includes(perm.name)}
                          onChange={() => toggleAdPerm(perm.name)}
                          className="mt-0.5 rounded text-amber-500 focus:ring-0"
                        />
                        <div className="overflow-hidden">
                          <div className="font-medium text-white truncate text-[11px]">{perm.description}</div>
                          <div className="text-[9px] text-slate-500 font-mono truncate">{perm.name}</div>
                        </div>
                      </label>
                    ))}
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
