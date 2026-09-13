'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Store,
  Search,
  Zap,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Layers,
  Wrench,
  XCircle,
  FileCode2,
} from 'lucide-react';

export default function CatalogPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; type: string; text: string } | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category,
        page: page.toString(),
        limit: '60',
      });
      const res = await fetch(`/api/apps?${params.toString()}`);
      const data = await res.json();
      if (data.apps) {
        setApps(data.apps);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [search, category, page]);

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
        setActionMsg({
          id: app.id,
          type: 'success',
          text: `İş kuyruğa alındı! Job ID: #${data.job_id?.substring(0, 8)}`,
        });
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

  const categories = [
    { id: 'all', label: 'Tüm Kategoriler' },
    { id: 'Film-Dizi Sinema', label: 'Film & Dizi' },
    { id: 'IPTV', label: 'IPTV & Canlı TV' },
    { id: 'Müzik & Ses', label: 'Müzik & Ses' },
    { id: 'Araçlar', label: 'Araçlar' },
    { id: 'Fotoğraf & Video Düzenleme', label: 'Fotoğraf & Video' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative rounded-2xl glass-panel p-6 sm:p-8 overflow-hidden border border-blue-500/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Store className="w-3.5 h-3.5" />
              Supabase PrimeStore Kataloğu
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              PrimeStore Uygulamaları ({total} Uygulama)
            </h1>
            <p className="mt-1 text-slate-400 text-xs sm:text-sm">
              PrimeStore mağaza kataloğundaki tüm uygulamaları inceleyebilir, tek tıkla PrimeForge modlama pipeline'ına gönderebilirsiniz.
            </p>
          </div>

          <button
            onClick={fetchApps}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Uygulama adı veya paket ara (ör: xtiva, netflix)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                category === c.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Applications */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.length === 0 ? (
          <div className="col-span-full glass-panel rounded-2xl p-12 text-center text-slate-500">
            {loading ? 'Uygulamalar yükleniyor...' : 'Arama kriterlerine uygun uygulama bulunamadı.'}
          </div>
        ) : (
          apps.map((app) => (
            <div
              key={app.id}
              className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between"
            >
              <div>
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
                        <span className="text-[10px] text-slate-500 truncate">
                          {app.categoryName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {app.has_profile ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Mod Profili Hazır
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Yeni Uygulama
                    </span>
                  )}
                  {app.status && (
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                      {app.status}
                    </span>
                  )}
                </div>

                {actionMsg && actionMsg.id === app.id && (
                  <div
                    className={`mb-3 p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                      actionMsg.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {actionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{actionMsg.text}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex items-center gap-2">
                <button
                  onClick={() => handleModApp(app, 'full_mod')}
                  disabled={triggeringId === app.id || !app.fileUrl}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-600/20"
                >
                  {triggeringId === app.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  )}
                  Modla
                </button>

                <button
                  onClick={() => handleModApp(app, 'analyze_only')}
                  disabled={triggeringId === app.id || !app.fileUrl}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                  title="Sadece Analiz Et"
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
    </div>
  );
}
