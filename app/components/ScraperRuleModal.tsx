'use client';

import { useState } from 'react';
import {
  Globe,
  X,
  Play,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code2,
  Sparkles,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

interface ScraperRule {
  id?: string;
  name: string;
  package_name?: string;
  target_url: string;
  link_regex: string;
  version_regex: string;
  domain_pattern?: string;
  is_active?: boolean;
}

interface ScraperRuleModalProps {
  app: {
    listing_id: string;
    title: string;
    packageName: string | null;
    current_version: string;
    fileUrl?: string | null;
  };
  initialRule?: ScraperRule | null;
  onClose: () => void;
  onSaved: (rule: any) => void;
}

export default function ScraperRuleModal({
  app,
  initialRule,
  onClose,
  onSaved,
}: ScraperRuleModalProps) {
  const [name, setName] = useState(
    initialRule?.name || `${app.title} Scraper`
  );
  const [packageName, setPackageName] = useState(
    initialRule?.package_name || app.packageName || ''
  );
  const [targetUrl, setTargetUrl] = useState(
    initialRule?.target_url || app.fileUrl || ''
  );
  const [linkRegex, setLinkRegex] = useState(
    initialRule?.link_regex || 'href=["\']([^"\']+\\.apk[^"\']*)["\']'
  );
  const [versionRegex, setVersionRegex] = useState(
    initialRule?.version_regex || '(?:v|sürüm|version)?\\s*([0-9]+(?:\\.[0-9]+)+)'
  );
  const [domainPattern, setDomainPattern] = useState(
    initialRule?.domain_pattern || ''
  );
  const [isActive, setIsActive] = useState(
    initialRule?.is_active !== undefined ? initialRule.is_active : true
  );

  // Testing states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  const handleTest = async () => {
    if (!targetUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/scrapers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: targetUrl,
          link_regex: linkRegex,
          version_regex: versionRegex,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: `Bağlantı hatası: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name || !targetUrl) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialRule?.id || undefined,
          name,
          package_name: packageName,
          target_url: targetUrl,
          link_regex: linkRegex,
          version_regex: versionRegex,
          domain_pattern: domainPattern || undefined,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved(data.rule);
        onClose();
      } else {
        alert(data.error || 'Scraper kuralı kaydedilemedi.');
      }
    } catch (e: any) {
      alert(`Kaydetme hatası: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-purple-500/30 shadow-2xl flex flex-col bg-slate-900/95">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {app.title} — Web Scraper Kuralı
                </h3>
                {initialRule ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Düzenle
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Yeni Kural
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {app.packageName || 'Paket adı yok'} • Mevcut: v{app.current_version}
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

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Bu uygulama resmi web sitesinden doğrudan APK dağıttığı için özel scraping kuralı gerektirir.
              Hedef sayfayı ve indirme regex desenlerini belirleyip <strong>Canlı Test Et</strong> ile anında doğrulayabilirsiniz.
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kural Başlığı
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Fox TV Official Scraper"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hedef Paket Adı (Package Name)
              </label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="com.example.app"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-purple-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Hedef İndirme Sayfası URL
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/downloads"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  İndirme Linki Regex (APK Linkini Yakalar)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLinkRegex('href=["\']([^"\']+\\.apk[^"\']*)["\']')}
                    className="text-[10px] text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20"
                  >
                    Standart APK
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkRegex('href=["\']([^"\']*download[^"\']*)["\']')}
                    className="text-[10px] text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20"
                  >
                    Download Link
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={linkRegex}
                onChange={(e) => setLinkRegex(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Sürüm Regex (Versiyon Numarasını Yakalar)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVersionRegex('(?:v|sürüm|version)?\\s*([0-9]+(?:\\.[0-9]+)+)')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                  >
                    v1.2.3 Semver
                  </button>
                  <button
                    type="button"
                    onClick={() => setVersionRegex('([0-9]+(?:[-.][0-9]+)*)')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                  >
                    Esnek Sürüm
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={versionRegex}
                onChange={(e) => setVersionRegex(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Alan Adı Deseni (Domain Pattern - Opsiyonel)
                </label>
                <input
                  type="text"
                  value={domainPattern}
                  onChange={(e) => setDomainPattern(e.target.value)}
                  placeholder="Örn: foxtv7.watch"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/5 mt-auto">
                <span className="text-xs font-semibold text-slate-300">
                  Otomatik Taramada Aktif
                </span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    isActive ? 'bg-purple-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Live Test Results Card */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/30'
                  : 'bg-rose-950/40 border-rose-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span
                    className={`text-xs font-bold ${
                      testResult.success ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {testResult.success
                      ? 'Test Başarılı! APK Bağlantısı ve Sürüm Bulundu'
                      : 'Test Başarısız Oldu'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                  HTTP {testResult.status || 0} • {testResult.duration_ms || 0}ms
                </span>
              </div>

              {testResult.matched_download_url && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400">Bulunan APK Bağlantısı:</div>
                  <div className="flex items-center gap-2 bg-slate-950/70 p-2 rounded-lg border border-white/5 font-mono text-[11px] text-amber-300 break-all">
                    <span className="flex-1 truncate">{testResult.matched_download_url}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(testResult.matched_download_url)}
                      className="p-1 hover:text-white transition-colors"
                      title="Kopyala"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={testResult.matched_download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:text-white transition-colors"
                      title="Yeni Sekmede Aç"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {testResult.matched_version && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 text-[11px]">Tespit Edilen Sürüm:</span>
                  <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    v{testResult.matched_version}
                  </span>
                  {app.current_version && (
                    <span className="text-[11px] text-slate-400">
                      (Mevcut: v{app.current_version})
                    </span>
                  )}
                </div>
              )}

              {testResult.error && (
                <div className="text-xs text-rose-300 font-mono bg-rose-950/50 p-2 rounded-lg border border-rose-500/20">
                  {testResult.error}
                </div>
              )}

              {testResult.html_preview && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline mt-1"
                  >
                    {showHtmlPreview ? 'Önizlemeyi Gizle' : 'Taranan Sayfa Metnini Göster'}
                  </button>
                  {showHtmlPreview && (
                    <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {testResult.html_preview}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 flex items-center justify-between bg-slate-950/60 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !targetUrl}
            className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-600/10 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            ) : (
              <Play className="w-4 h-4 text-purple-400" />
            )}
            {testing ? 'Sayfa Taranıyor...' : '🧪 Canlı Test Et'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-all"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name || !targetUrl}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Kaydediliyor...' : '💾 Kuralı Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
