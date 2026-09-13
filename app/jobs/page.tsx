'use client';

import { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Tv,
  Smartphone,
  Tablet,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Eye,
  ChevronRight,
  Maximize2,
  Info,
} from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tv' | 'mobile' | 'tablet' | 'logs'>('overview');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/job-status');
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const timer = setInterval(fetchJobs, 15000);
    return () => clearInterval(timer);
  }, []);

  const filtered = jobs.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return j.status === 'published' || j.status === 'waiting_approval';
    if (filter === 'pending') return ['pending', 'patching', 'building', 'testing'].includes(j.status);
    if (filter === 'failed') return ['failed', 'test_failed'].includes(j.status);
    return true;
  });

  const getEmulatorReport = (job: any) => {
    return job?.analysis_report?.emulator_test_report || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" />
            İş Kuyruğu & Çoklu Emülatör Testleri
          </h1>
          <p className="text-xs text-slate-400">
            TV (DPAD), Mobil (20:9 Dokunmatik) ve Tablet (16:10) form faktörlerinde otomatik uyumluluk ve çökme takibi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1 text-xs">
            {['all', 'completed', 'pending', 'failed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                  filter === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? 'Tümü' : tab === 'completed' ? 'Tamamlanan' : tab === 'pending' ? 'Bekleyen' : 'Hatalı'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchJobs}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Paket / Uygulama</th>
                <th className="px-4 py-3">Sürüm</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-indigo-400" /> TV (DPAD)
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" /> Mobil (20:9)
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Tablet className="w-3.5 h-3.5 text-purple-400" /> Tablet (16:10)
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Çökme / Log
                  </div>
                </th>
                <th className="px-4 py-3">İndir / İncele</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Filtreye uygun kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((j) => {
                  const rep = getEmulatorReport(j);
                  const tvStatus = rep?.tv_test?.dpad_compatibility;
                  const mobStatus = rep?.mobile_test?.aspect_ratio_status;
                  const hasCrash = rep?.crash_analysis?.crashed;

                  return (
                    <tr
                      key={j.id}
                      onClick={() => {
                        setSelectedJob(j);
                        setActiveTab('overview');
                      }}
                      className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{j.package_name || 'Bilinmiyor'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">#{j.id.substring(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{j.version_name ? `v${j.version_name}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            j.status === 'published'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : j.status === 'waiting_approval'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : j.status === 'failed' || j.status === 'test_failed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>

                      {/* TV Badge */}
                      <td className="px-4 py-3">
                        {tvStatus === 'COMPATIBLE' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Uyumlu
                          </span>
                        ) : tvStatus === 'PARTIAL' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Kısmi (Mouse)
                          </span>
                        ) : tvStatus === 'INCOMPATIBLE' ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Kumandasız
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Mobile Badge */}
                      <td className="px-4 py-3">
                        {mobStatus === 'FULL_SCREEN' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Tam Ekran
                          </span>
                        ) : mobStatus === 'LETTERBOXED' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Şeritli
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Tablet Badge */}
                      <td className="px-4 py-3">
                        {rep?.tablet_test ? (
                          <span className="inline-flex items-center gap-1 text-purple-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Geniş Ekran
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Crash Badge */}
                      <td className="px-4 py-3">
                        {hasCrash ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Çöktü ({rep.crash_analysis.crash_count})
                          </span>
                        ) : j.emulator_passed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 0 Hata
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 flex items-center gap-2">
                        {j.modded_apk_url && (
                          <a
                            href={j.modded_apk_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            APK <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Detay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Job & Multi-Device Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedJob.package_name || 'Uygulama Test Raporu'}
                    {selectedJob.version_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                        v{selectedJob.version_name}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">ID: #{selectedJob.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/40 px-5 gap-4 text-xs font-medium">
              {[
                { id: 'overview', label: 'Genel Bakış', icon: Info },
                { id: 'tv', label: 'TV & DPAD (16:9)', icon: Tv },
                { id: 'mobile', label: 'Mobil & Dokunmatik (20:9)', icon: Smartphone },
                { id: 'tablet', label: 'Tablet (16:10)', icon: Tablet },
                { id: 'logs', label: 'Logcat & Çökme Kaydı', icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(() => {
                const rep = getEmulatorReport(selectedJob);
                const tv = rep?.tv_test;
                const mob = rep?.mobile_test;
                const tab = rep?.tablet_test;
                const crash = rep?.crash_analysis;

                if (activeTab === 'overview') {
                  return (
                    <div className="space-y-6">
                      {/* 3 Metric Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>TV Kumanda Uyumu</span>
                            <Tv className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="text-base font-bold text-white">
                            {tv?.dpad_compatibility === 'COMPATIBLE' ? (
                              <span className="text-emerald-400">✅ Tam Uyumlu</span>
                            ) : tv?.dpad_compatibility === 'PARTIAL' ? (
                              <span className="text-amber-400">⚠️ Kısmi (Mouse)</span>
                            ) : tv?.dpad_compatibility === 'INCOMPATIBLE' ? (
                              <span className="text-rose-400">❌ Uyumsuz</span>
                            ) : (
                              '—'
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {tv?.focused_elements || 0} odaklanabilir kumanda öğesi
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>Mobil En-Boy Oranı</span>
                            <Smartphone className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="text-base font-bold text-white">
                            {mob?.aspect_ratio_status === 'FULL_SCREEN' ? (
                              <span className="text-emerald-400">✅ 20:9 Tam Ekran</span>
                            ) : mob?.aspect_ratio_status === 'LETTERBOXED' ? (
                              <span className="text-amber-400">⚠️ Siyah Şeritli</span>
                            ) : (
                              '—'
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">Dokunmatik ve kaydırma aktif</p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>Stabilite & Çökme</span>
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-base font-bold text-white">
                            {crash?.crashed ? (
                              <span className="text-rose-400">❌ {crash.crash_count} Hata</span>
                            ) : (
                              <span className="text-emerald-400">✅ 0 Crash / 0 ANR</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">AndroidRuntime logcat temiz</p>
                        </div>
                      </div>

                      {/* Screen Previews Row */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                          📸 Çoklu Cihaz Ekran Görüntüleri
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2 flex flex-col items-center">
                            <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                              <Tv className="w-3 h-3 text-indigo-400" /> TV (1920x1080 16:9)
                            </div>
                            <div className="w-full aspect-video rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80">
                              <img
                                src={`/screenshots/${selectedJob.package_name}_tv.png`}
                                onError={(e: any) => {
                                  e.target.style.display = 'none';
                                }}
                                alt="TV Test"
                                className="w-full h-full object-cover"
                              />
                              <span className="text-slate-600 text-xs flex items-center gap-1">
                                <Tv className="w-6 h-6 text-slate-700" />
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2 flex flex-col items-center">
                            <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-blue-400" /> Mobil (1080x2400 20:9)
                            </div>
                            <div className="w-full aspect-[9/16] max-h-[160px] rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80">
                              <img
                                src={`/screenshots/${selectedJob.package_name}_mobile.png`}
                                onError={(e: any) => {
                                  e.target.style.display = 'none';
                                }}
                                alt="Mobile Test"
                                className="w-full h-full object-cover"
                              />
                              <span className="text-slate-600 text-xs flex items-center gap-1">
                                <Smartphone className="w-6 h-6 text-slate-700" />
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2 flex flex-col items-center">
                            <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                              <Tablet className="w-3 h-3 text-purple-400" /> Tablet (2560x1600 16:10)
                            </div>
                            <div className="w-full aspect-video rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80">
                              <img
                                src={`/screenshots/${selectedJob.package_name}_tablet.png`}
                                onError={(e: any) => {
                                  e.target.style.display = 'none';
                                }}
                                alt="Tablet Test"
                                className="w-full h-full object-cover"
                              />
                              <span className="text-slate-600 text-xs flex items-center gap-1">
                                <Tablet className="w-6 h-6 text-slate-700" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'tv') {
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Tv className="w-4 h-4 text-indigo-400" /> Android TV & DPAD Kumanda Navigasyon Sonuçları
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500">Çözünürlük:</span> {tv?.resolution || '1920x1080 (16:9)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Ekran Yoğunluğu:</span> {tv?.density || '320 dpi (xhdpi)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Leanback Manifest:</span>{' '}
                            {tv?.leanback_manifest ? '✅ Mevcut' : '⚠️ Standart Launcher'}
                          </div>
                          <div>
                            <span className="text-slate-500">Kumanda Odaklanabilir Öğe:</span>{' '}
                            {tv?.focusable_elements || 0} adet
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                          {tv?.details || 'DPAD test verisi mevcut.'}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'mobile') {
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-400" /> Mobil 20:9 En-Boy & Dokunmatik Testi
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500">Çözünürlük:</span> {mob?.resolution || '1080x2400 (20:9)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Ekran Yoğunluğu:</span> {mob?.density || '440 dpi (xxhdpi)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Letterboxing:</span>{' '}
                            {mob?.letterboxed ? '⚠️ Siyah Kenar Şeritleri Var' : '✅ Tam Ekran (20:9)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Dokunmatik Tepki:</span>{' '}
                            {mob?.touch_responsive ? '✅ Aktif & Duyarlı' : '⚠️ Tepkisiz'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                          {mob?.details || 'Mobil ekran ve dokunmatik test verisi.'}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'tablet') {
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Tablet className="w-4 h-4 text-purple-400" /> Tablet 16:10 Geniş Ekran Düzeni
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500">Çözünürlük:</span> {tab?.resolution || '2560x1600 (16:10)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Ekran Yoğunluğu:</span> {tab?.density || '280 dpi'}
                          </div>
                          <div>
                            <span className="text-slate-500">Yatay Mod Düzeni:</span>{' '}
                            {tab?.adaptive_layout ? '✅ Geniş Ekran Destekli' : '⚠️ Ölçekli'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                          {tab?.details || 'Tablet geniş ekran test verisi.'}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'logs') {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Logcat Hata & Çökme Kayıtları
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Hata Sayısı: {crash?.crash_count || 0}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[300px] overflow-y-auto space-y-1">
                        {crash?.errors && crash.errors.length > 0 ? (
                          crash.errors.map((err: any, idx: number) => (
                            <div key={idx} className="text-rose-400">
                              <span className="text-slate-500">[{err.time}]</span> {err.line}
                            </div>
                          ))
                        ) : (
                          <div className="text-emerald-400">
                            ✅ Temiz: Emülatör testi süresince FATAL EXCEPTION, SIGSEGV veya ANR hatası yakalanmadı.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 text-xs">
              <div className="text-slate-400">
                Oluşturulma: {new Date(selectedJob.created_at).toLocaleString('tr-TR')}
              </div>
              <div className="flex gap-2">
                {selectedJob.modded_apk_url && (
                  <a
                    href={selectedJob.modded_apk_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors"
                  >
                    Modlu APK İndir <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
