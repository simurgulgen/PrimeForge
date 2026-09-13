'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  ShieldCheck,
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Cpu,
  Store,
  FileCode2,
  Search,
} from 'lucide-react';

export default function DashboardPage() {
  const [apkUrl, setApkUrl] = useState('');
  const [action, setAction] = useState('full_mod');
  const [profile, setProfile] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: string; text: string } | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // App Selector Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [catalogApps, setCatalogApps] = useState<any[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedAppInfo, setSelectedAppInfo] = useState<{
    title: string;
    packageName: string;
    version?: string;
    icon?: string;
  } | null>(null);

  const fetchJobs = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(`/api/job-status?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data && Array.isArray(data.jobs)) setJobs(data.jobs);
    } catch (err) {
      console.error(err);
    } finally {
      if (manual) setRefreshing(false);
    }
  };

  const fetchModalApps = async (q: string = '') => {
    setModalLoading(true);
    try {
      const res = await fetch(`/api/apps?search=${encodeURIComponent(q)}&limit=30`);
      const data = await res.json();
      if (data.apps) setCatalogApps(data.apps);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(false);
    const interval = setInterval(() => fetchJobs(false), 6000);
    return () => clearInterval(interval);
  }, []);

  const openAppSelector = () => {
    setModalOpen(true);
    fetchModalApps(modalSearch);
  };

  const selectApp = (app: any) => {
    if (app.fileUrl && !app.fileUrl.startsWith('market://')) {
      setApkUrl(app.fileUrl);
    }
    if (app.packageName) {
      setProfile(app.packageName);
    }
    setSelectedAppInfo({
      title: app.title || app.name || 'Uygulama',
      packageName: app.packageName || '',
      version: app.version || app.versionName || '',
      icon: app.iconUrl || '',
    });
    setModalOpen(false);
  };

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apkUrl) return;
    setLoading(true);
    setSubmitMsg(null);

    const appName = selectedAppInfo?.title || null;
    const pkgName = selectedAppInfo?.packageName || (profile && profile.includes('.') ? profile : null);
    const verName = selectedAppInfo?.version || null;
    const displayName = appName || pkgName || 'APK Dosyası';

    try {
      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: apkUrl,
          action,
          profile,
          package_name: pkgName,
          app_name: appName,
          version_name: verName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitMsg({
          type: 'success',
          text: `✅ ${displayName} için işlem başarıyla kuyruğa alındı! (Job ID: #${data.job_id?.substring(0, 8)})`,
        });
        setApkUrl('');
        setSelectedAppInfo(null);
        fetchJobs(true);
      } else {
        setSubmitMsg({ type: 'error', text: data.error || 'İşlem başarısız oldu.' });
      }
    } catch (err: any) {
      setSubmitMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const completedCount = jobs.filter((j) => ['published', 'waiting_approval', 'completed', 'analyzed'].includes(j.status)).length;
  const pendingCount = jobs.filter((j) => ['pending', 'downloading', 'analyzing', 'waiting_decision', 'patching', 'building', 'testing', 'uploading'].includes(j.status)).length;
  const failedCount = jobs.filter((j) => ['failed', 'test_failed', 'cancelled'].includes(j.status)).length;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-2xl glass-panel p-6 sm:p-8 overflow-hidden border border-blue-500/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Otomatik APK Modlama & Test Fabrikası
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            PrimeStore APK Modlama & Dağıtım Motoru
          </h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">
            APK dosyasını bağla veya PrimeStore mağaza kataloğundan seç; decompile, statik analiz, akıllı smali yamalama, manifest izin temizliği,
            Android emülatör 15sn çökme testi ve Telegram inline onay döngüsünü sunucu tarafında çalıştır.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/catalog" className="glass-card rounded-xl p-5 border border-slate-800 hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>PrimeStore Kataloğu</span>
            <Store className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-400 mt-2">481 Uygulama</p>
          <span className="text-xs text-slate-500">Katalogdaki tüm uygulamalar →</span>
        </Link>

        <div className="glass-card rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Başarılı / Yayında</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{completedCount}</p>
          <span className="text-xs text-slate-500">Modlanmış & onaylanmış</span>
        </div>

        <div className="glass-card rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>İşleniyor / Bekleyen</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{pendingCount}</p>
          <span className="text-xs text-slate-500">Aktif CI/CD kuyruğu</span>
        </div>

        <Link href="/profiles" className="glass-card rounded-xl p-5 border border-slate-800 hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Kayıtlı Mod Profilleri</span>
            <FileCode2 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">Kalıcı Reçeteler</p>
          <span className="text-xs text-slate-500">Yama rehberleri & YAML →</span>
        </Link>
      </div>

      {/* Trigger New Job Form & Quick Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-400" />
              Yeni APK Modlama İşi Başlat
            </h2>
            <button
              type="button"
              onClick={openAppSelector}
              className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Store className="w-3.5 h-3.5" />
              PrimeStore Kataloğundan Seç
            </button>
          </div>

          {selectedAppInfo && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 mb-4 shadow-sm">
              <div className="flex items-center gap-3">
                {selectedAppInfo.icon ? (
                  <img
                    src={selectedAppInfo.icon}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover border border-purple-500/30 shadow"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center">
                    <Store className="w-5 h-5 text-purple-400" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{selectedAppInfo.title}</span>
                    {selectedAppInfo.version && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-medium">
                        v{selectedAppInfo.version}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">{selectedAppInfo.packageName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedAppInfo(null);
                  setProfile('');
                }}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800"
                title="Katalog seçimini temizle"
              >
                ✕ Seçimi Kaldır
              </button>
            </div>
          )}

          <form onSubmit={handleTrigger} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                APK İndirme Linki (Direct URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  placeholder="https://example.com/app-v3.4.apk"
                  value={apkUrl}
                  onChange={(e) => setApkUrl(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Yapılacak İşlem
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="full_mod">Tam Modlama (Analiz + Yama + Test + Yayın)</option>
                  <option value="analyze_only">Sadece Analiz Et (Telegram Raporu Sun)</option>
                  <option value="sanitize_only">Sadece İzinleri Temizle & İmzala</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Özel Profil (Opsiyonel)
                </label>
                <input
                  type="text"
                  placeholder="Otomatik (örn: com.metawave.xtreamiptv)"
                  value={profile}
                  onChange={(e) => setProfile(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {submitMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  submitMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {submitMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                {submitMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Kuyruğa Alınıyor...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Pipeline'ı Başlat
                </>
              )}
            </button>
          </form>
        </div>

        {/* Telegram & Bot Helper Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-3">
              <ShieldCheck className="w-4 h-4" />
              Telegram Etkileşimli Kontrol
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              PrimeForge botu test tamamlandığında Telegram üzerinden ekran görüntüsü ve emülatör
              sonucunu butonlarla birlikte sana iletir.
            </p>

            <div className="space-y-2 text-xs font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-slate-300">
              <div className="text-blue-400"># Telegram Komutları:</div>
              <div>/mod &lt;url&gt;</div>
              <div>/analyze &lt;url&gt;</div>
              <div>/sanitize &lt;url&gt;</div>
              <div>/status</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Kullanıcı: <b>simurgulgen</b></span>
            <span className="text-emerald-400">Vercel Hobby Plan</span>
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              Son İşler & Pipeline Takibi
            </h2>
            <p className="text-xs text-slate-400">Gerçek zamanlı Supabase forge_jobs kayıtları</p>
          </div>
          <button
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Paket / Uygulama</th>
                <th className="px-4 py-3">İşlem</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Test</th>
                <th className="px-4 py-3">Çıktı APK</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Henüz kayıtlı bir iş bulunmuyor. Yukarıdaki formdan yeni bir APK gönderebilirsin.
                  </td>
                </tr>
              ) : (
                jobs.slice(0, 8).map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">
                      <div className="font-bold text-slate-100">{job.app_name || job.package_name || 'Bilinmiyor'}</div>
                      <div className="text-slate-500 text-[10px] font-mono">
                        {job.app_name && job.package_name ? `${job.package_name} • ` : ''}
                        {job.version_name ? `v${job.version_name}` : (job.apk_url ? job.apk_url.substring(0, 25) + '...' : '')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                        {job.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const s = job.status;
                        if (s === 'completed' || s === 'analyzed') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Analiz Tamamlandı
                            </span>
                          );
                        }
                        if (s === 'published') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Yayınlandı
                            </span>
                          );
                        }
                        if (s === 'waiting_approval') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Onay Bekliyor
                            </span>
                          );
                        }
                        if (s === 'analyzing') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                              Analiz Ediliyor...
                            </span>
                          );
                        }
                        if (s === 'patching') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse">
                              Yamalanıyor...
                            </span>
                          );
                        }
                        if (s === 'building') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
                              Derleniyor...
                            </span>
                          );
                        }
                        if (s === 'testing') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 animate-pulse">
                              Test Ediliyor...
                            </span>
                          );
                        }
                        if (s === 'failed' || s === 'test_failed') {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Hata
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Bekliyor
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {job.emulator_passed ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Geçti
                        </span>
                      ) : job.emulator_passed === false ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Çöktü
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {job.modded_apk_url ? (
                        <a
                          href={job.modded_apk_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          Catbox APK <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(job.created_at).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Select from PrimeStore Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">PrimeStore Kataloğundan Uygulama Seç</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-900/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Uygulama ara..."
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    fetchModalApps(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {modalLoading ? (
                <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  Uygulamalar aranıyor...
                </div>
              ) : catalogApps.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">Uygulama bulunamadı.</div>
              ) : (
                catalogApps.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => selectApp(app)}
                    className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {app.logoUrl ? (
                          <img src={app.logoUrl} alt={app.title} className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{app.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{app.packageName}</div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] text-purple-400 font-medium">Seç →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
