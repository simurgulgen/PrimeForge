'use client';

import { useState, useEffect } from 'react';
import { FileCode2, BookOpen, Check, Copy, RefreshCw, Zap } from 'lucide-react';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      if (data.profiles) setProfiles(data.profiles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileCode2 className="w-6 h-6 text-amber-400" />
            Uygulama Mod Profilleri & Rehberleri
          </h1>
          <p className="text-xs text-slate-400">
            Her uygulama modlandıktan sonra otomatik oluşturulan yamalama reçeteleri ve gelecek güncellemeler için kurallar
          </p>
        </div>
        <button
          onClick={fetchProfiles}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.length === 0 ? (
          <div className="col-span-full glass-panel rounded-2xl p-12 text-center text-slate-500">
            Kayıtlı profil bulunamadı. Yeni bir APK modlandığında rehber ve profil otomatik kaydedilecektir.
          </div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white truncate">{p.profile_name}</h3>
                    <span className="text-[11px] text-blue-400 font-mono block truncate">
                      {p.package_name}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                      p.auto_apply
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {p.auto_apply ? 'Otomatik Güncelle' : 'Onay Bekler'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center my-4 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Başarılı</span>
                    <span className="text-sm font-bold text-emerald-400">{p.success_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Hata</span>
                    <span className="text-sm font-bold text-rose-400">{p.fail_count || 0}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedProfile(p)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  Rehberi Gör
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Guide / YAML Detail Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedProfile.profile_name}</h3>
                <span className="text-xs text-blue-400 font-mono">{selectedProfile.package_name}</span>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {selectedProfile.modding_guide && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Otomatik Üretilmiş Modlama Rehberi
                  </h4>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {selectedProfile.modding_guide}
                  </pre>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5" />
                    YAML Yama Reçetesi (Tekrar Kullanılabilir)
                  </h4>
                  <button
                    onClick={() => handleCopy(selectedProfile.profile_yaml)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {selectedProfile.profile_yaml}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setSelectedProfile(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
