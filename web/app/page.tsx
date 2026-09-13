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
  FileCode2,
} from 'lucide-react';

export default function DashboardPage() {
  const [apkUrl, setApkUrl] = useState('');
  const [action, setAction] = useState('full_mod');
  const [profile, setProfile] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: string; text: string } | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/job-status');
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apkUrl) return;
    setLoading(true);
    setSubmitMsg(null);

    try {
      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apk_url: apkUrl, action, profile }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitMsg({
          type: 'success',
          text: `İş kuyruğa alındı! Job ID: #${data.job_id?.substring(0, 8)}`,
        });
        setApkUrl('');
        fetchJobs();
      } else {
        setSubmitMsg({ type: 'error', text: data.error || 'İşlem başarısız oldu.' });
      }
    } catch (err: any) {
      setSubmitMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const completedCount = jobs.filter((j) => j.status === 'published' || j.status === 'waiting_approval').length;
  const pendingCount = jobs.filter((j) => ['pending', 'patching', 'building', 'testing'].includes(j.status)).length;
  const failedCount = jobs.filter((j) => ['failed', 'test_failed'].includes(j.status)).length;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-2xl glass-panel p-6 sm:p-8 overflow-hidden border border-blue-500/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Otomatik APK Modlama Fabrikası
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            APK Modlama, Test & Dağıtım Motoru
          </h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">
            APK dosyasını bağla; decompile, statik analiz, akıllı smali yamalama, manifest izni temizliği,
            Android emülatör 15sn çökme testi ve Telegram inline onay döngüsünü sunucu tarafında çalıştır.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Toplam İş Sayısı</span>
            <Play className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{jobs.length}</p>
          <span className="text-xs text-slate-500">Pipeline kayıtları</span>
        </div>

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

        <div className="glass-card rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Test Başarısız</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">{failedCount}</p>
          <span className="text-xs text-slate-500">Emülatörde çökenler</span>
        </div>
      </div>

      {/* Trigger New Job Form & Quick Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-400" />
              Yeni APK Modlama İşi Başlat
            </h2>
            <span className="text-xs text-slate-400">GitHub Actions Dispatch</span>
          </div>

          <form onSubmit={handleTrigger} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                APK İndirme Linki (Direct URL)
              </label>
              <input
                type="url"
                required
                placeholder="https://example.com/app-v3.4.apk"
                value={apkUrl}
                onChange={(e) => setApkUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
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
                <select
                  value={profile}
                  onChange={(e) => setProfile(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Otomatik Eşle (Paket Adından)</option>
                  <option value="com.metawave.xtreamiptv">Xtiva IPTV Pro Mod</option>
                  <option value="com.example.vivox">VivoX Mod</option>
                  <option value="com.medya.warstv">WarsTV Mod</option>
                </select>
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
            onClick={fetchJobs}
            disabled={refreshing}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition-colors"
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
                      <div>{job.package_name || 'Bilinmiyor'}</div>
                      <div className="text-slate-500 text-[10px] font-mono">
                        {job.version_name ? `v${job.version_name}` : job.apk_url?.substring(0, 30) + '...'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                        {job.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          job.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : job.status === 'waiting_approval'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : job.status === 'failed' || job.status === 'test_failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {job.status}
                      </span>
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
    </div>
  );
}
