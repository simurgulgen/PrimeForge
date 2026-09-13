'use client';

import { useState, useEffect } from 'react';
import { Layers, RefreshCw, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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
  }, []);

  const filtered = jobs.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return j.status === 'published' || j.status === 'waiting_approval';
    if (filter === 'pending') return ['pending', 'patching', 'building', 'testing'].includes(j.status);
    if (filter === 'failed') return ['failed', 'test_failed'].includes(j.status);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" />
            İş Kuyruğu & Modlama Geçmişi
          </h1>
          <p className="text-xs text-slate-400">PrimeForge motorunun işlediği tüm APK analiz ve modlama kayıtları</p>
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

      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">ID / Paket</th>
                <th className="px-4 py-3">Sürüm</th>
                <th className="px-4 py-3">İşlem</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Emülatör</th>
                <th className="px-4 py-3">APK İndir</th>
                <th className="px-4 py-3">Oluşturulma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Filtreye uygun iş bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">
                      <div>{j.package_name || 'Bilinmiyor'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">#{j.id.substring(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {j.version_name ? `v${j.version_name}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                        {j.action}
                      </span>
                    </td>
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
                    <td className="px-4 py-3">
                      {j.emulator_passed ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Geçti
                        </span>
                      ) : j.emulator_passed === false ? (
                        <span className="text-rose-400 flex items-center gap-1 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Başarısız
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {j.modded_apk_url ? (
                        <a
                          href={j.modded_apk_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          Catbox URL <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(j.created_at).toLocaleString('tr-TR')}
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
