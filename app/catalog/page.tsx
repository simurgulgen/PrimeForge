'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Store,
  Search,
  Zap,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Wrench,
  XCircle,
  Tv,
  Smartphone,
  Tablet,
  Filter,
  SlidersHorizontal,
  ShieldCheck,
  ChevronRight,
  Layers,
} from 'lucide-react';
import PreAuditModal from '@/app/components/PreAuditModal';

export default function CatalogPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState<any[]>([
    { id: 'all', name: 'Tüm Kategoriler' },
  ]);
  const [tvOnly, setTvOnly] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; type: string; text: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; jobId?: string } | null>(null);
  const [selectedModApp, setSelectedModApp] = useState<any | null>(null);

  // Load TV-only preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('primestore_catalog_tv_only');
      if (saved !== null) {
        setTvOnly(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch real categories from /api/categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category && category !== 'all') params.set('category', category);
      if (tvOnly) {
        params.set('tv_only', 'true');
        params.set('tvOnly', 'true');
      }
      params.set('page', String(page));
      params.set('limit', '60');

      const res = await fetch(`/api/apps?${params.toString()}`);
      const data = await res.json();
      if (data.apps) {
        setApps(data.apps);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [search, category, tvOnly, page]);

  const toggleTvOnly = () => {
    const next = !tvOnly;
    setTvOnly(next);
    setPage(1);
    try {
      localStorage.setItem('primestore_catalog_tv_only', String(next));
    } catch {
      // ignore
    }
  };

  const handleModApp = async (app: any, actionType: 'full_mod' | 'analyze_only' = 'full_mod') => {
    if (!app.fileUrl || app.fileUrl.startsWith('market://')) {
      setActionMsg({
        id: app.id,
        type: 'error',
        text: 'Bu uygulama için doğrudan APK bağlantısı bulunamadı (Google Play yönlendirmesi).',
      });
      return;
    }

    setTriggeringId(app.id);
    setActionMsg(null);

    try {
      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: app.fileUrl,
          package_name: app.packageName,
          action: actionType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const jobIdShort = data.job_id ? `#${data.job_id.substring(0, 8)}` : '';
        const actionLabel = actionType === 'analyze_only' ? 'Statik Analiz' : 'Modlama';
        setActionMsg({
          id: app.id,
          type: 'success',
          text: `${actionLabel} kuyruğa alındı! (${jobIdShort})`,
        });
        setToast({
          title: `🚀 ${app.name || app.packageName} — ${actionLabel} Başlatıldı`,
          message: `İş kuyruğa eklendi (${jobIdShort}). Sonuçları İş Kuyruğu sayfasından takip edebilirsiniz.`,
          jobId: data.job_id,
        });
        setTimeout(() => setToast(null), 8000);
      } else {
        setActionMsg({
          id: app.id,
          type: 'error',
          text: data.error || 'İşlem başlatılamadı.',
        });
      }
    } catch (err: any) {
      setActionMsg({
        id: app.id,
        type: 'error',
        text: err.message,
      });
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl glass-panel p-6 sm:p-8 overflow-hidden border border-blue-500/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Store className="w-3.5 h-3.5" />
              PrimeStore Resmi Kataloğu
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              PrimeStore Uygulamaları ({total} Uygulama)
            </h1>
            <p className="mt-1 text-slate-400 text-xs sm:text-sm">
              PrimeStore mağaza kataloğundaki tüm uygulamaları kategorilerine göre inceleyebilir, TV uyumluluk filtresini kullanarak TV modlu sürümleri keşfedebilirsiniz.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/jobs"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all shrink-0"
            >
              <Layers className="w-4 h-4" />
              İş Kuyruğu
            </a>
            <button
              onClick={fetchApps}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              Yenile
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & TV Toggle */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Uygulama adı veya paket ara (ör: xtiva, warstv, netflix)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* TV Mode Toggle - PrimeStore TV Filter */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTvOnly}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 select-none ${
              tvOnly
                ? 'bg-blue-600/20 border-blue-500/80 text-blue-300 shadow-md shadow-blue-500/10'
                : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Tv className={`w-4 h-4 ${tvOnly ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
              <span>Mobil Uyumlu Olanları Gizle (Sadece TV)</span>
            </div>
            
            {/* Custom Toggle Switch Pill */}
            <div
              className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                tvOnly ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                  tvOnly ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Category Pills Bar (Horizontal Scroll with Gradient Fade) */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
          {categories.map((c) => {
            const isSelected = category === (c.id === 'all' ? 'all' : c.name || c.id);
            return (
              <button
                key={c.id}
                onClick={() => {
                  setCategory(c.id === 'all' ? 'all' : c.name || c.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-500'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-800'
                }`}
              >
                {c.name || c.label || c.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Applications */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.length === 0 ? (
          <div className="col-span-full glass-panel rounded-2xl p-12 text-center text-slate-500">
            {loading ? 'Uygulamalar yükleniyor...' : 'Seçilen kriterlere uygun uygulama bulunamadı.'}
          </div>
        ) : (
          apps.map((app) => (
            <div
              key={app.id}
              className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                {/* Header row: Logo & Titles */}
                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative shadow-md">
                    {app.logoUrl ? (
                      <img
                        src={app.logoUrl}
                        alt={app.title}
                        className="w-full h-full object-cover"
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Store className="w-6 h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate" title={app.title}>
                      {app.title}
                    </h3>
                    <div className="text-[11px] text-blue-400 font-mono truncate" title={app.packageName}>
                      {app.packageName || 'Paket adı yok'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 font-medium">
                        {app.version || 'v1.0'}
                      </span>
                      {app.categoryName && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={app.categoryName}>
                          {app.categoryName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Device Compatibility Badges */}
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  {/* TV Badge */}
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      app.is_tv_compatible
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-900 text-slate-500 border-slate-800 line-through opacity-60'
                    }`}
                    title={
                      app.is_tv_compatible
                        ? app.verified_by_test
                          ? '⚡ PrimeForge Emülatör Testi ile Doğrulanmış TV Kumanda Uyumu'
                          : 'Android TV / Kumanda Uyumlu'
                        : 'TV Kumanda Desteği Yok (Yalnızca Mobil)'
                    }
                  >
                    <Tv className="w-3 h-3" />
                    TV
                    {app.verified_by_test && app.is_tv_compatible && (
                      <span className="text-[10px] text-amber-400 font-black" title="Test Edilerek TV'ye Uyarlandı">
                        ⚡
                      </span>
                    )}
                  </span>

                  {/* Mobile Badge */}
                  {app.is_mobile_compatible && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25"
                      title="Mobil Dokunmatik Uyumlu"
                    >
                      <Smartphone className="w-3 h-3" />
                      Mobil
                    </span>
                  )}

                  {/* Tablet Badge */}
                  {app.is_tablet_compatible && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/25"
                      title="Tablet Geniş Ekran Uyumlu"
                    >
                      <Tablet className="w-3 h-3" />
                      Tablet
                    </span>
                  )}

                  {/* Security Verified Badge */}
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                    title="VirusTotal, APKiD, Quark-Engine ve ClamAV ile Taranıp Doğrulandı"
                  >
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Doğrulandı
                  </span>

                  {/* Mod Profile status */}
                  {app.has_profile ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full ml-auto">
                      <CheckCircle2 className="w-3 h-3" /> Mod Hazır
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full ml-auto">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Ham
                    </span>
                  )}
                </div>

                {actionMsg && actionMsg.id === app.id && (
                  <div
                    className={`mb-3 p-2.5 rounded-xl text-[11px] flex items-center justify-between gap-2 border ${
                      actionMsg.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {actionMsg.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      )}
                      <span className="truncate font-medium">{actionMsg.text}</span>
                    </div>
                    {actionMsg.type === 'success' && (
                      <a
                        href="/jobs"
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-100 font-semibold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        Kuyruğa Git <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/60 flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedModApp({
                      listing_id: app.id,
                      id: app.id,
                      title: app.name || app.title || app.packageName,
                      name: app.name || app.title || app.packageName,
                      packageName: app.packageName,
                      current_version: app.version,
                      latest_version: app.version,
                      download_url: app.fileUrl,
                      fileUrl: app.fileUrl,
                    });
                  }}
                  disabled={triggeringId === app.id || !app.fileUrl || app.fileUrl.startsWith('market://')}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                  title={app.fileUrl?.startsWith('market://') ? 'Doğrudan APK bağlantısı yok (Google Play)' : 'Uygulamayı incele ve modlama seçeneklerini aç'}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Modla
                </button>

                <button
                  onClick={() => handleModApp(app, 'analyze_only')}
                  disabled={triggeringId === app.id || !app.fileUrl || app.fileUrl.startsWith('market://')}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                  title="Sadece Statik Analiz Et"
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  Analiz
                </button>

                {app.fileUrl && !app.fileUrl.startsWith('market://') && (
                  <a
                    href={app.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title="Orijinal APK İndir"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 60 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-white"
          >
            Önceki
          </button>
          <span className="text-xs text-slate-400 px-3">
            Sayfa {page} / {Math.ceil(total / 60)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 60)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-white"
          >
            Sonraki
          </button>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl p-4 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{toast.title}</div>
            <div className="text-[11px] text-slate-300 truncate mt-0.5">{toast.message}</div>
          </div>
          <a
            href="/jobs"
            className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 shadow-md shadow-blue-600/25 transition-all"
          >
            Kuyruğu Aç <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Pre-Audit & Dynamic Modding Options Modal */}
      {selectedModApp && (
        <PreAuditModal
          app={selectedModApp}
          onClose={() => setSelectedModApp(null)}
          onSuccess={(result: any) => {
            const shortId = result.jobId ? `#${result.jobId.substring(0, 8)}` : '';
            setActionMsg({
              id: selectedModApp.id || selectedModApp.listing_id,
              type: 'success',
              text: result.message || `Özelleştirilmiş modlama başlatıldı! (${shortId})`,
            });
            setToast({
              title: `🚀 ${selectedModApp.name || selectedModApp.title || selectedModApp.packageName} Modlanıyor`,
              message: result.message || `Seçtiğiniz modlar ve güvenlik düzeltmeleri kuyruğa alındı (${shortId}).`,
              jobId: result.jobId,
            });
            setTimeout(() => setToast(null), 8000);
            setSelectedModApp(null);
          }}
        />
      )}
    </div>
  );
}
