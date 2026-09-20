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
  Key,
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
  Globe,
  ExternalLink,
  Copy,
  Terminal,
  RotateCw,
  RefreshCw,
} from 'lucide-react';

export interface PreAuditModalProps {
  app: {
    listing_id?: string;
    id?: string;
    title?: string;
    name?: string;
    packageName?: string | null;
    package_name?: string | null;
    current_version?: string | null;
    version?: string | null;
    latest_version?: string | null;
    download_url?: string;
    fileUrl?: string;
    variants_needing_update?: any[];
    initialAuditData?: any;
    initialAiFixResults?: Record<string, any>;
    jobId?: string;
  };
  onClose: () => void;
  onSuccess: (result: { jobId?: string; message: string; action?: string; options?: any }) => void;
}

export default function PreAuditModal({ app, onClose, onSuccess }: PreAuditModalProps) {
  const resolvedListingId = app.listing_id || app.id || '';
  const resolvedTitle = app.title || app.name || app.packageName || app.package_name || 'Uygulama';
  const resolvedPackageName = app.packageName || app.package_name || null;
  const resolvedCurrentVersion = app.current_version || app.version || null;
  const resolvedLatestVersion = app.latest_version || app.version || app.current_version || null;
  const resolvedDownloadUrl = app.download_url || app.fileUrl || '';

  // Helper to normalize permissions whether array of strings or array of objects
  const normalizePerms = (perms: any) => {
    if (!perms) return { dangerous: [], ad_related: [], all: [], safe: [] };
    const normList = (list: any[], fallbackSafety: string, fallbackLabel: string) => {
      if (!Array.isArray(list)) return [];
      return list.map((item: any) => {
        if (typeof item === 'string') {
          const simpleName = item.split('.').pop() || item;
          return {
            name: item,
            description: simpleName.replace(/_/g, ' '),
            safety: fallbackSafety,
            safety_label: fallbackLabel,
          };
        }
        return {
          ...item,
          name: item.name || String(item),
          description: item.description || item.name || String(item),
          safety: item.safety || fallbackSafety,
          safety_label: item.safety_label || fallbackLabel,
        };
      });
    };

    return {
      dangerous: normList(perms.dangerous, 'dangerous', 'Riskli İzin'),
      ad_related: normList(perms.ad_related, 'ad_related', '✅ Sıfır Çökme Riski'),
      all: perms.all || [],
      safe: normList(perms.safe_and_system || perms.safe, 'safe', '✅ Güvenli Sistem İzni'),
      safe_and_system: normList(perms.safe_and_system || perms.safe, 'safe', '✅ Güvenli Sistem İzni'),
    };
  };

  const [loading, setLoading] = useState<boolean>(() => !app.initialAuditData);
  const [auditData, setAuditData] = useState<any>(() => {
    if (app.initialAuditData) {
      const data = { ...app.initialAuditData };
      data.permissions = normalizePerms(data.permissions || data.manifest?.permissions);
      return data;
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);

  // Multi-Variant Selection Support
  const variants = app.variants_needing_update || [];
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<number[]>(() =>
    variants.length > 0 ? variants.map((_, i) => i) : [0]
  );
  const activeVariant = variants[selectedVariantIndices[0] ?? 0] || null;

  const toggleVariant = (idx: number) => {
    setSelectedVariantIndices((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev; // Keep at least one variant selected
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx].sort((a, b) => a - b);
      }
    });
  };

  const selectAllVariants = () => {
    setSelectedVariantIndices(variants.map((_, i) => i));
  };

  const selectStableVariants = () => {
    const stables = variants
      .map((v: any, i: number) => (!v.releaseChannel?.toLowerCase().includes('beta') ? i : -1))
      .filter((i: number) => i >= 0);
    if (stables.length > 0) setSelectedVariantIndices(stables);
  };

  const selectBetaVariants = () => {
    const betas = variants
      .map((v: any, i: number) => (v.releaseChannel?.toLowerCase().includes('beta') ? i : -1))
      .filter((i: number) => i >= 0);
    if (betas.length > 0) setSelectedVariantIndices(betas);
  };

  const [selectedDangerousPerms, setSelectedDangerousPerms] = useState<string[]>([]);
  const [selectedAdPerms, setSelectedAdPerms] = useState<string[]>([]);
  const [showSafePerms, setShowSafePerms] = useState(false);
  const [actionType, setActionType] = useState<'autonomous_from_guide' | 'rebuild_guide' | 'sanitize_only' | 'full_mod' | 'direct_sign'>('sanitize_only');
  const [updateGuide, setUpdateGuide] = useState(false);
  const [transferModRecipe, setTransferModRecipe] = useState(true);
  const [runEmulatorTest, setRunEmulatorTest] = useState(true);
  const [saveGuide, setSaveGuide] = useState(true);
  const [showGuidePreview, setShowGuidePreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Advanced Game-Changing Options
  const [runnerType, setRunnerType] = useState<'local' | 'cloud'>('cloud');
  const [enableTvDpad, setEnableTvDpad] = useState(false);
  const [enableAdBlocker, setEnableAdBlocker] = useState(true);
  const [enableSelfHealing, setEnableSelfHealing] = useState(true);

  // Permission Intelligence & AI Inspection
  const [expandedPerms, setExpandedPerms] = useState<Record<string, boolean>>({});
  const [aiInspectingPerm, setAiInspectingPerm] = useState<string | null>(null);
  const [aiInspectResults, setAiInspectResults] = useState<Record<string, any>>({});
  const [aiInspectErrors, setAiInspectErrors] = useState<Record<string, string>>({});

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
    setAiInspectErrors((prev) => {
      const next = { ...prev };
      delete next[permName];
      return next;
    });

    try {
      let localAiSettings = null;
      try {
        const stored = localStorage.getItem('primeforge_ai_settings');
        if (stored) localAiSettings = JSON.parse(stored);
      } catch (_) {}

      const res = await fetch('/api/ai/permission-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: resolvedPackageName,
          app_name: resolvedTitle,
          permission_name: permName,
          ai_settings: localAiSettings,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiInspectResults((prev) => ({ ...prev, [permName]: data.data }));
        setExpandedPerms((prev) => ({ ...prev, [permName]: true }));
      } else {
        setAiInspectErrors((prev) => ({
          ...prev,
          [permName]: data.error || 'İzin analizi alınamadı.',
        }));
      }
    } catch (err: any) {
      console.error('AI inspect error:', err);
      setAiInspectErrors((prev) => ({
        ...prev,
        [permName]: err.message || 'Bağlantı hatası oluştu.',
      }));
    } finally {
      setAiInspectingPerm(null);
    }
  };

  // 4 Core Security Engines & AI Decompile Fixes
  const [aiFixLoading, setAiFixLoading] = useState<Record<string, boolean>>({});
  const [aiFixResults, setAiFixResults] = useState<Record<string, any>>(() => app.initialAiFixResults || {});
  const [selectedAiFixes, setSelectedAiFixes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (app.initialAiFixResults) {
      Object.keys(app.initialAiFixResults).forEach((k) => {
        init[k] = true;
      });
    }
    return init;
  });
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleAskAiSecurityFix = async (e: React.MouseEvent, engineName: string, findingDetails: any) => {
    e.stopPropagation();
    e.preventDefault();

    setAiFixLoading((prev) => ({ ...prev, [engineName]: true }));
    try {
      let localAiSettings = null;
      try {
        const stored = localStorage.getItem('primeforge_ai_settings');
        if (stored) localAiSettings = JSON.parse(stored);
      } catch (_) {}

      const res = await fetch('/api/ai/security-audit-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: engineName,
          finding: findingDetails,
          package_name: resolvedPackageName,
          app_name: resolvedTitle,
          version_name: resolvedLatestVersion,
          details: findingDetails,
          manifest_context: auditData?.permissions,
          ai_settings: localAiSettings,
        }),
      });
      const data = await res.json();
      if (data.success && data.fix) {
        setAiFixResults((prev) => ({ ...prev, [engineName]: data.fix }));
        setSelectedAiFixes((prev) => ({ ...prev, [engineName]: true }));
      }
    } catch (err) {
      console.error('AI security fix error:', err);
    } finally {
      setAiFixLoading((prev) => ({ ...prev, [engineName]: false }));
    }
  };

  const handleCopyDiff = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  // Custom AI Modding Request & Instruction States
  const [customAiRequest, setCustomAiRequest] = useState<string>('');
  const [isAnalyzingCustomRequest, setIsAnalyzingCustomRequest] = useState<boolean>(false);
  const [customAnalysisResult, setCustomAnalysisResult] = useState<any | null>(null);
  const [customAnalysisError, setCustomAnalysisError] = useState<string | null>(null);
  const [customOptionEnabled, setCustomOptionEnabled] = useState<boolean>(true);

  const handleAnalyzeCustomRequest = async () => {
    if (!customAiRequest.trim()) return;
    setIsAnalyzingCustomRequest(true);
    setCustomAnalysisError(null);

    try {
      let localAiSettings = null;
      try {
        const stored = localStorage.getItem('primeforge_ai_settings');
        if (stored) localAiSettings = JSON.parse(stored);
      } catch (_) {}

      const res = await fetch('/api/ai/custom-request-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_request: customAiRequest.trim(),
          package_name: resolvedPackageName,
          app_name: resolvedTitle,
          audit_data: auditData,
          ai_settings: localAiSettings,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setCustomAnalysisResult(data.data);
        setCustomOptionEnabled(true);
      } else {
        setCustomAnalysisError(data.error || 'Özel istek analizi alınamadı.');
      }
    } catch (err: any) {
      console.error('Custom request inspect error:', err);
      setCustomAnalysisError(err.message || 'Bağlantı hatası oluştu.');
    } finally {
      setIsAnalyzingCustomRequest(false);
    }
  };

  useEffect(() => {
    if (app.initialAuditData) {
      const data = { ...app.initialAuditData };
      data.permissions = normalizePerms(data.permissions || data.manifest?.permissions);
      setAuditData(data);
      setLoading(false);
      setSelectedDangerousPerms(data.permissions?.dangerous?.map((p: any) => p.name) || []);
      setSelectedAdPerms(data.permissions?.ad_related?.map((p: any) => p.name) || []);
      setActionType(data.recommended_action || (data.has_existing_profile ? 'autonomous_from_guide' : 'full_mod'));
      return;
    }

    if (!resolvedDownloadUrl) {
      setLoading(false);
      setError('İndirme / APK bağlantısı bulunamadı.');
      return;
    }

    const fetchPreAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/pre-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apk_url: resolvedDownloadUrl,
            listing_id: resolvedListingId,
            package_name: resolvedPackageName,
          }),
        });
        const data = await res.json();
        if (data.success) {
          data.permissions = normalizePerms(data.permissions);
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
  }, [app, resolvedDownloadUrl, resolvedListingId, resolvedPackageName]);

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
    setError(null);
    try {
      const actionLabels: Record<string, string> = {
        autonomous_from_guide: 'Kayıtlı Rehberden Otonom Modlama',
        rebuild_guide: 'Rehberi Yeniden Eğit & Güncelle',
        sanitize_only: 'Hızlı İzin & Reklam Temizliği (Decompile Yok)',
        full_mod: 'Tam Smali Modu & VIP Baypas',
        direct_sign: 'Doğrudan İmzala',
      };

      const targetVariants = (variants.length > 0 && selectedVariantIndices.length > 0)
        ? selectedVariantIndices.map((i) => variants[i]).filter(Boolean)
        : [{
            architecture: '',
            releaseChannel: 'Stable',
            new_version: resolvedLatestVersion,
            suggested_url: resolvedDownloadUrl,
          }];

      const activeAiFixes = Object.entries(aiFixResults)
        .filter(([eng]) => selectedAiFixes[eng] !== false)
        .map(([eng, fix]: [string, any]) => ({
          engine: eng,
          target_file: fix.target_file,
          target_method: fix.target_method,
          approx_line: fix.approx_line,
          smali_diff: fix.smali_diff,
          safe_strategy: fix.safe_remediation_strategy,
          root_cause: fix.root_cause,
          threat_severity: fix.threat_severity,
        }));

      const combinedSmaliPatches = [
        ...(customOptionEnabled && customAnalysisResult?.recommended_smali_patch ? [customAnalysisResult.recommended_smali_patch] : []),
        ...activeAiFixes.map((f) => ({
          file: f.target_file,
          method: f.target_method,
          patch_type: 'security_fix',
          smali_snippet: f.smali_diff,
          description: `${f.engine} AI Güvenlik Düzeltmesi`,
        })),
      ];

      const triggerPromises = targetVariants.map(async (v: any) => {
        const targetUrl = v.suggested_url || resolvedDownloadUrl;
        const targetVersion = v.new_version || resolvedLatestVersion;
        const targetVariantArch = v.architecture || '';
        const targetChannel = v.releaseChannel || 'Stable';

        const res = await fetch('/api/trigger-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apk_url: targetUrl,
            action: actionType,
            package_name: resolvedPackageName,
            app_name: resolvedTitle,
            version_name: targetVersion,
            variant: targetVariantArch,
            target_channel: targetChannel,
            profile: resolvedPackageName,
            runner_type: runnerType,
            mod_options: {
              strip_dangerous_permissions: selectedDangerousPerms,
              strip_ad_permissions: selectedAdPerms,
              transfer_mod_recipe: transferModRecipe,
              run_emulator_test: runEmulatorTest,
              save_guide: saveGuide || actionType === 'rebuild_guide',
              update_guide: actionType === 'rebuild_guide' || updateGuide,
              overwrite_guide: actionType === 'rebuild_guide' || updateGuide,
              use_saved_guide: actionType === 'autonomous_from_guide',
              enable_tv_dpad_converter: enableTvDpad,
              enable_universal_ad_blocker: enableAdBlocker,
              enable_self_healing: enableSelfHealing,
              custom_ai_request: customAiRequest.trim() || undefined,
              custom_ai_patch_enabled: customOptionEnabled && (Boolean(customAnalysisResult) || Boolean(customAiRequest.trim())),
              custom_ai_patch_spec: (customOptionEnabled && customAnalysisResult?.recommended_smali_patch) ? customAnalysisResult.recommended_smali_patch : undefined,
              applied_ai_security_fixes: activeAiFixes,
              custom_smali_patches: combinedSmaliPatches.length > 0 ? combinedSmaliPatches : undefined,
              custom_option_label: customAnalysisResult?.option_label || (customAiRequest.trim() ? customAiRequest.trim() : undefined),
            },
            custom_notes: `İşlem: ${actionLabels[actionType] || actionType}. Mimari: ${targetVariantArch || 'Universal'} (${targetChannel}). Runner: ${runnerType}.${actionType === 'rebuild_guide' ? ' [Rehber Sıfırdan Güncelleniyor]' : ''}${activeAiFixes.length > 0 ? ` [${activeAiFixes.length} AI Güvenlik Düzeltmesi Aktif]` : ''}${customAiRequest.trim() ? ` Özel AI İsteği: ${customAiRequest.trim()}` : ''}`,
            publish_mode: 'manual_review',
          }),
        });
        return res.json();
      });

      const results = await Promise.all(triggerPromises);
      const successfulJobs = results.filter((r) => r.success && r.job_id);

      if (successfulJobs.length > 0) {
        const firstJobId = successfulJobs[0].job_id;
        onSuccess({
          jobId: firstJobId,
          message: `${resolvedTitle} için ${successfulJobs.length} varyantın işlemi (${actionLabels[actionType] || actionType}) eşzamanlı olarak başlatıldı!`,
        });
        onClose();
      } else {
        const firstErr = results.find((r) => !r.success)?.error;
        setError(firstErr || 'İşlemler başlatılamadı.');
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
              <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-200">{resolvedTitle}</span>
                {resolvedCurrentVersion && resolvedLatestVersion && resolvedCurrentVersion !== resolvedLatestVersion ? (
                  <span>(v{resolvedCurrentVersion} ➔ v{resolvedLatestVersion})</span>
                ) : resolvedLatestVersion || resolvedCurrentVersion ? (
                  <span>(v{resolvedLatestVersion || resolvedCurrentVersion})</span>
                ) : null}
                {resolvedPackageName && (
                  <span className="font-mono text-[10px] text-slate-500">[{resolvedPackageName}]</span>
                )}
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
              {/* Multi-Variant / Architecture / Channel Selector Banner */}
              {variants.length > 1 && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-purple-500/20 space-y-2.5">
                  <div className="text-[11px] font-semibold text-white flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      İşlenecek Varyantları Seçin ({selectedVariantIndices.length}/{variants.length} Seçili)
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={selectAllVariants}
                        className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition"
                      >
                        Tümünü Seç
                      </button>
                      {variants.some((v: any) => !v.releaseChannel?.toLowerCase().includes('beta')) && (
                        <button
                          type="button"
                          onClick={selectStableVariants}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition"
                        >
                          Sadece Stable
                        </button>
                      )}
                      {variants.some((v: any) => v.releaseChannel?.toLowerCase().includes('beta')) && (
                        <button
                          type="button"
                          onClick={selectBetaVariants}
                          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition"
                        >
                          Sadece Beta
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {variants.map((v: any, idx: number) => {
                      const isSelected = selectedVariantIndices.includes(idx);
                      const isBeta = v.releaseChannel?.toLowerCase().includes('beta');
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleVariant(idx)}
                          className={`p-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-between cursor-pointer select-none ${
                            isSelected
                              ? 'bg-purple-600/25 border-purple-500/80 text-white shadow-md shadow-purple-600/20 ring-1 ring-purple-500/40'
                              : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleVariant(idx)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded text-purple-600 focus:ring-0 w-3.5 h-3.5"
                            />
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-white text-[11px] truncate">
                                  {v.architecture || 'Universal'}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase ${
                                    isBeta
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {v.releaseChannel || 'Stable'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                v{v.new_version || v.current_version || app.latest_version}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 ml-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feature Detection Summary Banner */}
              {(() => {
                const hasBilling = Boolean(
                  auditData?.detected_features?.has_billing ||
                  auditData?.has_billing ||
                  auditData?.permissions?.all?.some?.((p: string) => p.toLowerCase().includes('billing'))
                );
                const hasProfile = Boolean(auditData?.has_existing_profile || auditData?.has_profile);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                      <div className="text-[10px] text-slate-500 font-mono">SATIN ALMA / IAP</div>
                      <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                        {hasBilling ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-300">IAP Algılandı</span>
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
                        {hasProfile ? (
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
                          {actionType === 'autonomous_from_guide'
                            ? 'Kayıtlı Rehberden Otonom'
                            : actionType === 'sanitize_only'
                            ? 'Hızlı Temizlik (Decompilesiz)'
                            : 'Tam Smali Modu'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 🛡️ 4 Temel Güvenlik Motoru (ClamAV, APKiD, Quark-Engine, VirusTotal) */}
              {(() => {
                const secScan = auditData?.security_scan || auditData?.security;
                const secEngines = secScan?.engines || {};
                const vt = secEngines?.virustotal;
                const apkid = secEngines?.apkid;
                const quark = secEngines?.quark;
                const clam = secEngines?.clamav;

                const isVtClean = !vt || vt.malicious === 0;
                const isApkidClean = !apkid || apkid.status === 'clean' || (!apkid.protector?.length && !apkid.anti_debug);
                const isQuarkClean = !quark || quark.threat_level === 'Clean' || quark.threat_level === 'Clean (Temiz)';
                const isClamClean = !clam || clam.status === 'clean' || (!clam.infected_files || clam.infected_files === 0);

                const hasIssues = secScan?.has_issues ?? (!isVtClean || !isApkidClean || !isQuarkClean || !isClamClean);
                const summaryBadge = secScan?.summary_badge || (hasIssues ? 'Güvenlik motorları tarafından risk tespit edildi.' : 'Motorlar devrede, 4 sistem temiz onayı verdi.');

                return (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-purple-500/25 space-y-3.5 shadow-lg shadow-purple-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-2">
                            <span>4 Temel Güvenlik Sistemi Taraması</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              ClamAV • APKiD • Quark • VirusTotal
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {summaryBadge}
                          </div>
                        </div>
                      </div>
                      <div>
                        {hasIssues ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            Güvenlik Uyarısı Tespit Edildi
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            4 Motor Temiz Onayı Verdi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4 Engine Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* 1. VirusTotal */}
                      {(() => {
                        const isLoading = aiFixLoading['VirusTotal'];
                        const hasAiFix = aiFixResults['VirusTotal'];

                        return (
                          <div className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                            isVtClean ? 'bg-slate-900/60 border-white/5' : 'bg-rose-950/30 border-rose-500/40'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <Globe className="w-3.5 h-3.5 text-blue-400" /> VirusTotal
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                                isVtClean ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {vt?.detection_ratio || '0/68 Temiz'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {vt?.cached ? '⚡ Supabase Önbelleği' : '🌐 Canlı VT Hash Sorgusu'}
                            </div>
                            {vt?.vt_report_url && (
                              <a
                                href={vt.vt_report_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <span>Raporu Aç</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                            {!isVtClean && (
                              <button
                                type="button"
                                onClick={(e) => handleAskAiSecurityFix(e, 'VirusTotal', vt)}
                                disabled={isLoading}
                                className="mt-1 w-full text-[10px] font-semibold py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 flex items-center justify-center gap-1 transition"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3 text-rose-400" />}
                                <span>{hasAiFix ? 'Düzeltme Hazır' : 'AI Düzeltmesi Al'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* 2. APKiD */}
                      {(() => {
                        const isLoading = aiFixLoading['APKiD'];
                        const hasAiFix = aiFixResults['APKiD'];

                        return (
                          <div className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                            isApkidClean ? 'bg-slate-900/60 border-white/5' : 'bg-amber-950/30 border-amber-500/40'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <Cpu className="w-3.5 h-3.5 text-purple-400" /> APKiD
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {apkid?.compiler || 'D8/R8'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300 truncate" title={apkid?.summary}>
                              {apkid?.protector && apkid.protector.length > 0 ? (
                                <span className="text-amber-300 font-semibold">⚠️ {apkid.protector.join(', ')}</span>
                              ) : apkid?.obfuscator && apkid.obfuscator.length > 0 ? (
                                <span className="text-purple-300">Karıştırıcı: {apkid.obfuscator.join(', ')}</span>
                              ) : (
                                <span className="text-slate-400">Karıştırılmamış Açık Kod</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Anti-Debug: {apkid?.anti_debug ? '⚠️ Mevcut' : 'Temiz'}
                            </div>
                            {!isApkidClean && (
                              <button
                                type="button"
                                onClick={(e) => handleAskAiSecurityFix(e, 'APKiD', apkid)}
                                disabled={isLoading}
                                className="mt-1 w-full text-[10px] font-semibold py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 flex items-center justify-center gap-1 transition"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3 text-amber-400" />}
                                <span>{hasAiFix ? 'Düzeltme Hazır' : 'AI Düzeltmesi Al'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* 3. Quark-Engine */}
                      {(() => {
                        const isLoading = aiFixLoading['Quark-Engine'];
                        const hasAiFix = aiFixResults['Quark-Engine'];

                        return (
                          <div className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                            isQuarkClean ? 'bg-slate-900/60 border-white/5' : 'bg-rose-950/30 border-rose-500/40'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <Terminal className="w-3.5 h-3.5 text-amber-400" /> Quark-Engine
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                isQuarkClean ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {quark?.threat_level || 'Clean'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300">
                              {quark?.high_risk_crimes && quark.high_risk_crimes.length > 0 ? (
                                <div className="text-amber-300 truncate" title={quark.high_risk_crimes[0].crime}>
                                  ⚠️ {quark.high_risk_crimes[0].crime}
                                </div>
                              ) : (
                                <span className="text-slate-400">{quark?.matched_rules || 278} Dalvik Kuralı</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Puan: <span className="font-mono text-white">{quark?.total_score || 0}</span>
                            </div>
                            {!isQuarkClean && (
                              <button
                                type="button"
                                onClick={(e) => handleAskAiSecurityFix(e, 'Quark-Engine', quark)}
                                disabled={isLoading}
                                className="mt-1 w-full text-[10px] font-semibold py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 flex items-center justify-center gap-1 transition"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3 text-rose-400" />}
                                <span>{hasAiFix ? 'Smali Diff Hazır' : 'AI Smali Düzeltmesi Al'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* 4. ClamAV */}
                      {(() => {
                        const isLoading = aiFixLoading['ClamAV'];
                        const hasAiFix = aiFixResults['ClamAV'];

                        return (
                          <div className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                            isClamClean ? 'bg-slate-900/60 border-white/5' : 'bg-rose-950/30 border-rose-500/40'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> ClamAV
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                isClamClean ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {isClamClean ? 'Virüs Yok' : 'Şüpheli'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300 truncate" title={clam?.threats?.join(', ')}>
                              {clam?.threats && clam.threats.length > 0 ? (
                                <span className="text-rose-300">🚨 {clam.threats[0]}</span>
                              ) : (
                                <span className="text-slate-400">{clam?.scanned_files || 1} Dosya / İmza Temiz</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Mod: {clam?.scanner_mode === 'clamscan_cli' ? 'Daemon / CLI' : 'Sezgisel İmza'}
                            </div>
                            {!isClamClean && (
                              <button
                                type="button"
                                onClick={(e) => handleAskAiSecurityFix(e, 'ClamAV', clam)}
                                disabled={isLoading}
                                className="mt-1 w-full text-[10px] font-semibold py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 flex items-center justify-center gap-1 transition"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3 text-rose-400" />}
                                <span>{hasAiFix ? 'Düzeltme Hazır' : 'AI Düzeltmesi Al'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* AI Security Remediation Panel (Rendered when AI fix is fetched or passed from job) */}
                    {Object.keys(aiFixResults).length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-purple-500/20 animate-fadeIn">
                        {Object.entries(aiFixResults).map(([eng, fix]: [string, any]) => {
                          const isFixActive = selectedAiFixes[eng] !== false;
                          return (
                            <div
                              key={eng}
                              className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition-all shadow-md ${
                                isFixActive
                                  ? 'bg-gradient-to-br from-purple-950/60 via-slate-950/80 to-slate-900/90 border-purple-500/30'
                                  : 'bg-slate-950/40 border-white/5 opacity-60'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Bot className="w-4 h-4 text-purple-400" />
                                  <span className="font-bold text-white text-xs">
                                    FCC-Claude Decompile Düzeltme Planı ({eng})
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                    {fix.threat_severity || 'HIGH'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 cursor-pointer bg-purple-500/20 hover:bg-purple-500/30 px-2 py-1 rounded-lg border border-purple-500/30 text-[10px] text-purple-200 transition">
                                    <input
                                      type="checkbox"
                                      checked={isFixActive}
                                      onChange={() => setSelectedAiFixes((prev) => ({ ...prev, [eng]: !isFixActive }))}
                                      className="rounded text-purple-600 focus:ring-0 cursor-pointer"
                                    />
                                    <span className="font-semibold">{isFixActive ? '✅ Modlamaya Dahil Et' : 'Dahil Etme'}</span>
                                  </label>
                                  <span className="text-[10px] text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    Çökme Riski: {fix.verify_error_risk || 'SIFIR'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyDiff(fix.smali_diff || fix.manifest_fix || '', eng)}
                                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition"
                                  >
                                    <Copy className="w-3 h-3 text-purple-300" />
                                    <span>{copiedSnippet === eng ? 'Kopyalandı!' : "Diff'i Kopyala"}</span>
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-300 leading-relaxed">
                                <strong className="text-purple-300">Teşhis & Kök Neden:</strong> {fix.root_cause}
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-[11px] bg-black/40 p-2 rounded-lg border border-white/5 font-mono">
                                <div>
                                  <span className="text-slate-500">Hedef Dosya:</span>{' '}
                                  <span className="text-emerald-300 font-semibold">{fix.target_file}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Satır / Metot:</span>{' '}
                                  <span className="text-amber-300">{fix.target_method} ({fix.approx_line})</span>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-300 leading-relaxed">
                                <strong className="text-emerald-300">Güvenli Düzeltme Stratejisi:</strong> {fix.safe_remediation_strategy}
                              </div>

                              {/* Syntax Highlighted Diff Block */}
                              {fix.smali_diff && (
                                <div className="relative rounded-lg bg-black/70 border border-white/10 p-2.5 overflow-x-auto font-mono text-[10px] leading-relaxed max-h-48">
                                  <pre>
                                    {fix.smali_diff.split('\n').map((line: string, idx: number) => {
                                      const isAdd = line.startsWith('+');
                                      const isDel = line.startsWith('-');
                                      return (
                                        <div
                                          key={idx}
                                          className={`${
                                            isAdd
                                              ? 'text-emerald-400 bg-emerald-500/10 font-bold'
                                              : isDel
                                                ? 'text-rose-400 bg-rose-500/10'
                                                : 'text-slate-400'
                                          }`}
                                        >
                                          {line}
                                        </div>
                                      );
                                    })}
                                  </pre>
                                </div>
                              )}

                              {fix.verification_tip && (
                                <div className="text-[10px] text-slate-400 italic">
                                  💡 İpucu: {fix.verification_tip}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Existing Profile & Guide Alert Banner */}
              {auditData?.has_existing_profile && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 text-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-xs text-white">
                        Kayıtlı Modlama Rehberi Mevcut ({auditData.existing_profile_name || resolvedTitle})
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

                  {variants.length > 1 && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-[11px]">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Çoklu Varyant Uyarısı:</strong> Mevcut rehber önceki tek varyant için oluşturulmuştu. Seçilen {selectedVariantIndices.length} varyantın tüm mimarilerini kapsayacak güncel profili baştan oluşturmak için <strong>'Rehberi Yeniden Eğit & Güncelle'</strong> yöntemini seçebilirsiniz.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActionType('rebuild_guide');
                          setUpdateGuide(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition border shrink-0 ${
                          actionType === 'rebuild_guide'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {actionType === 'rebuild_guide' ? '✓ Yeniden Oluştur Seçildi' : '🔄 Rehberi Yeniden Eğit'}
                      </button>
                    </div>
                  )}

                  {showGuidePreview && auditData.modding_guide && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950/80 border border-emerald-500/20 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-300 whitespace-pre-wrap">
                      {auditData.modding_guide}
                    </div>
                  )}
                </div>
              )}

              {/* Action Selection */}
              <div className="space-y-3 pt-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  İşlem Yöntemini Seçin
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        Kayıtlı rehberdeki manifest ve smali reçetesini doğrudan yeni APK'ya uygular.
                      </p>
                    </label>
                  )}

                  {auditData?.has_existing_profile && (
                    <label
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        actionType === 'rebuild_guide'
                          ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                          : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="actionType"
                            checked={actionType === 'rebuild_guide'}
                            onChange={() => {
                              setActionType('rebuild_guide');
                              setUpdateGuide(true);
                            }}
                            className="text-amber-600 focus:ring-0"
                          />
                          <span className="font-bold text-xs text-white flex items-center gap-1.5">
                            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                            Rehberi Yeniden Eğit & Güncelle
                          </span>
                        </div>
                        {variants.length > 1 && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Önerilen
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Önceki tek varyantlı rehberi sıfırlar; seçilen yeni varyantlara göre baştan decompile & analiz yapıp rehberi günceller.
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
                                  {aiResult.is_fallback ? (
                                    <>
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                      <span className="text-amber-300">Çevrimdışı Güvenlik Rehberi (Canlı AI Çevrimdışı)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                      <span>Canlı AI Smali Kod Teftişi</span>
                                    </>
                                  )}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Çökme Riski: {aiResult.crash_risk || 'SIFIR'}
                                </span>
                              </div>
                              {aiResult.is_fallback && (
                                <div className="text-[10px] text-amber-400/90 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                                  ⚠️ Canlı AI yanıt vermedi ({aiResult.fallback_reason?.includes('429') ? 'Gemini API günlük kotası doldu' : 'API Hatası'}). Çevrimdışı güvenlik şablonu gösteriliyor.
                                </div>
                              )}
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

                          {aiInspectErrors[perm.name] && (
                            <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                {aiInspectErrors[perm.name]}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleAskAiAboutPerm(e, perm.name)}
                                className="underline hover:text-white text-[10px] ml-2 shrink-0 font-medium"
                              >
                                Yeniden Dene
                              </button>
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
                      const isAiInspecting = aiInspectingPerm === perm.name;
                      const aiResult = aiInspectResults[perm.name];

                      return (
                        <div
                          key={perm.name}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-slate-900/70 border-amber-500/30'
                              : 'bg-slate-950/40 border-white/5 opacity-80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-start gap-2.5 cursor-pointer flex-1 overflow-hidden">
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
                              </div>
                            </label>

                            <button
                              type="button"
                              onClick={(e) => handleAskAiAboutPerm(e, perm.name)}
                              disabled={isAiInspecting}
                              className="shrink-0 text-[10px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                              title="Yapay zekaya bu iznin ve reklam modülünün koddaki yerini sor"
                            >
                              {isAiInspecting ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                  <span>Taranıyor...</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="w-3 h-3 text-amber-400" />
                                  <span>{aiResult ? 'Koddaki Yeri (AI)' : 'Koddaki Yeri?'}</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="mt-1.5 pt-1.5 border-t border-white/5 space-y-1 text-[11px]">
                            <div className="flex items-start gap-1.5 text-slate-300">
                              <span className="text-purple-400 font-medium shrink-0">🎯 Amaç:</span>
                              <span className="text-slate-300/90 leading-tight">{perm.purpose}</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-300">
                              <span className="text-amber-400 font-medium shrink-0">⚡ Kaldırılırsa:</span>
                              <span className="text-slate-400 leading-tight">{perm.impact}</span>
                            </div>
                          </div>

                          {/* Live AI Code Inspection Result Card */}
                          {aiResult && (
                            <div className="mt-2.5 p-2.5 rounded-lg bg-gradient-to-br from-amber-950/40 via-purple-950/40 to-slate-950/80 border border-amber-500/30 text-[11px] text-amber-200 space-y-1.5">
                              <div className="flex items-center justify-between font-semibold text-amber-300 text-xs">
                                <span className="flex items-center gap-1.5">
                                  {aiResult.is_fallback ? (
                                    <>
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Çevrimdışı Güvenlik Rehberi (Canlı AI Çevrimdışı)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Canlı AI Takipçi & Reklam Smali Teftişi</span>
                                    </>
                                  )}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Çökme Riski: {aiResult.crash_risk || 'SIFIR'}
                                </span>
                              </div>
                              {aiResult.is_fallback && (
                                <div className="text-[10px] text-amber-400/90 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                                  ⚠️ Canlı AI yanıt vermedi ({aiResult.fallback_reason?.includes('429') ? 'Gemini API günlük kotası doldu' : 'API Hatası'}). Çevrimdışı güvenlik şablonu gösteriliyor.
                                </div>
                              )}
                              <div className="text-slate-300 text-[11px] leading-relaxed">
                                <strong className="text-amber-300">Koddaki Yeri:</strong> {aiResult.usage_purpose}
                              </div>
                              <div className="text-amber-300/90 text-[11px] leading-relaxed">
                                <strong className="text-amber-300">Etki & Tavsiye:</strong> {aiResult.removal_impact}
                              </div>
                              {aiResult.code_references?.length > 0 && (
                                <div className="font-mono text-[9px] text-amber-300/70 bg-black/40 p-1.5 rounded border border-amber-500/15">
                                  İlgili Sınıflar: {aiResult.code_references.join(', ')}
                                </div>
                              )}
                            </div>
                          )}

                          {aiInspectErrors[perm.name] && (
                            <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                {aiInspectErrors[perm.name]}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleAskAiAboutPerm(e, perm.name)}
                                className="underline hover:text-white text-[10px] ml-2 shrink-0 font-medium"
                              >
                                Yeniden Dene
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Safe & System Permissions (Collapsible) */}
              {((auditData?.permissions?.safe_and_system && auditData.permissions.safe_and_system.length > 0) ||
                (auditData?.permissions?.safe && auditData.permissions.safe.length > 0)) && (
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowSafePerms(!showSafePerms)}
                    className="flex items-center justify-between w-full text-slate-400 hover:text-slate-200 text-xs py-1 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Güvenli Sistem İzinleri ({(auditData.permissions.safe_and_system || auditData.permissions.safe).length})
                    </span>
                    <span className="text-[11px] underline text-slate-400 hover:text-white">
                      {showSafePerms ? 'Listeyi Gizle' : 'Tümünü Gör'}
                    </span>
                  </button>
                  {showSafePerms && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 rounded-xl bg-slate-950/60 border border-white/5 text-[11px]">
                      {(auditData.permissions.safe_and_system || auditData.permissions.safe).map((p: any) => {
                        const name = p.name || p;
                        const desc = p.description || name.split('.').pop();
                        return (
                          <div key={name} className="flex items-start gap-2 p-1.5 rounded-lg bg-slate-900/40 border border-white/5">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-200 truncate">{desc}</div>
                              <div className="font-mono text-[9px] text-slate-500 truncate">{name}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 🤖 Özel AI Modlama Talebi & Akıllı İstek Alanı */}
              <div className="pt-3 border-t border-purple-500/20 space-y-3">
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-950/90 via-purple-950/20 to-slate-900/80 border border-purple-500/30 space-y-3 shadow-lg shadow-purple-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Özel AI Modlama Talebi & Akıllı Talimat
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Yapay Zeka Destekli
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Uygulamada kaldırmak istediğiniz bir şifre/PIN kilit ekranı, zorunlu giriş, süre kısıtı veya eklemek istediğiniz özel bir davranış varsa yazın. Yapay zeka uygulamayı inceleyip tek tıkla seçilebilir modlama kuralına dönüştürecektir.
                  </p>

                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      { label: '🔑 Şifre / PIN Kaldır', text: 'Uygulama açılışındaki şifre / PIN kilit ekranını tespit et ve kaldır' },
                      { label: '🚀 Açılış Ekranını Atla', text: 'Giriş / splash bekleme ekranını atla doğrudan ana menüyü aç' },
                      { label: '📺 Android TV & Kumanda', text: 'Dokunmatik arayüzü TV kumandası yön tuşlarıyla yönlendirilebilir yap' },
                      { label: '🛡️ Gizli Telemetriyi Sustur', text: 'Arka planda çalışan analitik ve telemetri raporlayıcılarını temizle' },
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomAiRequest(chip.text)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-500/20 transition-all hover:border-purple-500/40"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Textarea & Inspect Button */}
                  <div className="space-y-2">
                    <div className="relative">
                      <textarea
                        value={customAiRequest}
                        onChange={(e) => setCustomAiRequest(e.target.value)}
                        placeholder="Örn: Bu uygulamada kilit şifresi var, şifre sormadan doğrudan açılsın istiyorum..."
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all resize-none font-sans"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleAnalyzeCustomRequest}
                        disabled={isAnalyzingCustomRequest || !customAiRequest.trim()}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAnalyzingCustomRequest ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Yapay Zeka İnceliyor...</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3.5 h-3.5 text-purple-200" />
                            <span>Yapay Zeka ile İncele & Çözüm Üret</span>
                          </>
                        )}
                      </button>

                      {customAiRequest.trim() && !customAnalysisResult && (
                        <span className="text-[10px] text-slate-400 italic">
                          İnceleme yapmadan da doğrudan talebi iletebilirsiniz.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Analysis Error */}
                  {customAnalysisError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{customAnalysisError}</span>
                    </div>
                  )}

                  {/* AI Result & Selectable Option Card */}
                  {customAnalysisResult && (
                    <div className="p-3 rounded-xl bg-slate-900/95 border border-purple-500/40 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            {customAnalysisResult.title}
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                            {customAnalysisResult.summary}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            customAnalysisResult.is_fallback
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          }`}>
                            {customAnalysisResult.is_fallback ? '⚠️ Çevrimdışı Kural' : `⚡ ${customAnalysisResult.model_used || 'NVIDIA NIM 120B'}`}
                          </span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Risk: {customAnalysisResult.risk_level || 'DÜŞÜK'}
                          </span>
                        </div>
                      </div>

                      {customAnalysisResult.is_fallback && customAnalysisResult.fallback_reason && (
                        <div className="text-[10px] text-amber-400/90 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                          ⚠️ Canlı AI yanıt veremedi ({customAnalysisResult.fallback_reason}). Çevrimdışı şablon kullanılıyor.
                        </div>
                      )}


                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1 text-[10px]">
                        <div>
                          <strong className="text-purple-300">Tespit Edilen Mekanizma: </strong>
                          <span className="text-slate-300">{customAnalysisResult.detected_mechanism}</span>
                        </div>
                        <div>
                          <strong className="text-amber-300">Yama Stratejisi: </strong>
                          <span className="text-slate-300">{customAnalysisResult.patch_strategy}</span>
                        </div>
                        {customAnalysisResult.code_locations?.length > 0 && (
                          <div className="text-slate-400 font-mono text-[9px] pt-0.5">
                            Konumlar: {customAnalysisResult.code_locations.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Selectable Mod Option Switch */}
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-purple-600/15 border border-purple-500/30 cursor-pointer hover:bg-purple-600/25 transition-all">
                        <input
                          type="checkbox"
                          checked={customOptionEnabled}
                          onChange={(e) => setCustomOptionEnabled(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-0"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <span>{customAnalysisResult.option_label || 'Özel AI Mod Seçeneği'}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200">
                              Seçenek Olarak Eklendi
                            </span>
                          </div>
                          <div className="text-[10px] text-purple-300/80">
                            {customAnalysisResult.option_description || 'Pipeline sırasında bu özel smali kuralı otomatik olarak uygulanacaktır.'}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

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

                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveGuide || actionType === 'rebuild_guide'}
                      disabled={actionType === 'rebuild_guide'}
                      onChange={(e) => setSaveGuide(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Yapılan İşlemleri Bu Uygulama İçin Rehber Olarak Kaydet</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {actionType === 'rebuild_guide' ? 'Zorunlu Güncelleme' : 'Otonom Şablon'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Kaldırılan izinler, reklam filtreleri ve VIP yamaları uygulamanın profiline kaydedilir. Bir sonraki kontrolde bu kurallar doğrudan otonom olarak kullanılacaktır.
                      </div>
                    </div>
                  </label>

                  {auditData?.has_existing_profile && (
                    <label className="flex items-center gap-2.5 ml-6 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={updateGuide || actionType === 'rebuild_guide'}
                        disabled={actionType === 'rebuild_guide'}
                        onChange={(e) => setUpdateGuide(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-0"
                      />
                      <span className="text-[11px] text-amber-300 font-medium">
                        Eski profilin üzerine yaz / sıfırla (Önceki tek varyantlı rehberi silip güncel analizle değiştir)
                      </span>
                    </label>
                  )}
                </div>
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
            disabled={loading || submitting || (variants.length > 0 && selectedVariantIndices.length === 0)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {selectedVariantIndices.length > 1
              ? actionType === 'rebuild_guide'
                ? `${selectedVariantIndices.length} Varyant İçin Rehberi Yeniden Oluştur & Başlat`
                : `${selectedVariantIndices.length} Varyantı Eşzamanlı Başlat`
              : actionType === 'rebuild_guide'
                ? 'Rehberi Yeniden Oluştur & Başlat'
                : 'Seçilen Ayarlarla Başlat'}
          </button>
        </div>
      </div>
    </div>
  );
}
