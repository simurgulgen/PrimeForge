'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Puzzle,
  Download,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  Globe,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { MorphePatch, PatchSource } from '@/lib/morphe';

export default function PatchesPage() {
  const [patches, setPatches] = useState<MorphePatch[]>([]);
  const [sources, setSources] = useState<PatchSource[]>([]);
  const [releaseInfo, setReleaseInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRepo, setImportRepo] = useState('');
  const [importName, setImportName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/morphe/patches', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setPatches(data.patches || []);
        setSources(data.sources || []);
        setReleaseInfo(data.releaseInfo || null);
      }
    } catch (e) {
      console.error('Failed to load Morphe patches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatches();
  }, []);

  const handleImportSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importRepo.trim()) return;

    setImportLoading(true);
    setImportMsg(null);

    try {
      const res = await fetch('/api/morphe/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: importRepo.trim(), name: importName.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setImportMsg({ type: 'success', text: data.message });
        setImportRepo('');
        setImportName('');
        fetchPatches();
        setTimeout(() => {
          setImportModalOpen(false);
          setImportMsg(null);
        }, 1800);
      } else {
        setImportMsg({ type: 'error', text: data.error || 'İçe aktarma başarısız oldu.' });
      }
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.message || 'Bağlantı hatası oluştu.' });
    } finally {
      setImportLoading(false);
    }
  };

  const categories = [
    { id: 'all', label: 'Tüm Yamalar' },
    { id: 'YouTube', label: 'YouTube' },
    { id: 'YouTube Music', label: 'YouTube Music' },
    { id: 'Reddit', label: 'Reddit' },
    { id: 'Twitter / X', label: 'Twitter / X' },
    { id: 'Universal', label: 'Evrensel (Universal)' },
  ];

  const filteredPatches = patches.filter((p) => {
    const matchesCat =
      selectedCategory === 'all' ||
      p.targetApp.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (selectedCategory === 'Universal' && p.isUniversal);

    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.targetApp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sourceRepo.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-slate-800 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 text-white">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                Morphe & Harici Yama Yönetim Merkezi
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                  {releaseInfo?.patchesVersion || 'v1.42.0'}
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Açık kaynak Morphe ekosistemi, resmi bytecode yamaları ve dışarıdan içe aktarılan topluluk paketleri.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchPatches}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Senkronize Et
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Harici Yama Paketi İçe Aktar
          </button>
        </div>
      </div>

      {/* Sources Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sources.map((s) => (
          <div
            key={s.id}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {s.name}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  s.isOfficial
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                }`}
              >
                {s.isOfficial ? 'Resmi' : 'Topluluk'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{s.description}</p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>{s.repo}</span>
              <a
                href={`https://github.com/${s.repo}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline flex items-center gap-1"
              >
                GitHub <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        ))}

        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/30 to-purple-950/30 border border-indigo-500/20 flex flex-col justify-center space-y-1">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Aktif Morphe Motoru
          </div>
          <div className="text-sm font-bold text-white">Morphe Desktop CLI v1.15.1</div>
          <div className="text-[10px] text-slate-400">Bytecode dönüşümleri Java 21+ ile çalışır.</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80 shrink-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Yama adı veya açıklama ara..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Patches Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-purple-400" />
          <p className="text-xs">Morphe yamaları ve harici paketler taranıyor...</p>
        </div>
      ) : filteredPatches.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/30 border border-slate-800/60 text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Aranan kriterlere uygun yama bulunamadı.</p>
          <p className="text-xs text-slate-600">Arama terimini değiştirebilir veya harici bir yama deposu içe aktarabilirsiniz.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatches.map((patch) => (
            <div
              key={patch.id}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all flex flex-col justify-between space-y-3 group shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-purple-400 shrink-0" />
                    {patch.name}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                      patch.isUniversal
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    }`}
                  >
                    {patch.targetApp}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{patch.description}</p>

                {patch.options && patch.options.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <Sliders className="w-3 h-3 text-slate-500" />
                    {patch.options.map((opt, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-mono flex items-center gap-1 truncate max-w-[160px]">
                  <Tag className="w-2.5 h-2.5" />
                  {patch.sourceRepo}
                </span>

                <Link
                  href={`/catalog`}
                  className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold flex items-center gap-1 transition-all text-[11px]"
                >
                  Uygula <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Custom Patch Source Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Harici Yama Paketi İçe Aktar</h3>
                  <p className="text-[11px] text-slate-400">GitHub üzerinde yayınlanmış Morphe yama paketini sisteme ekleyin.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSource} className="p-6 space-y-4">
              {importMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    importMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {importMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{importMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  GitHub Deposu (Kullanıcı / Depo) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={importRepo}
                  onChange={(e) => setImportRepo(e.target.value)}
                  placeholder="örn: crimera/piko veya hoo-dles/morphe-patches"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Depo içinde Releases sekmesinde yayınlanmış bir <code>.mpp</code> veya <code>.jar</code> dosyası aranır.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Görünür İsim (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="örn: Piko Twitter Modları"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Güvenlik & Uyum Garantisi
                </div>
                <div>
                  İçe aktarılan harici yama paketleri, derleme ve emülatör test aşamalarında otomatik olarak güvenlik (VirusTotal, APKiD, Quark) süzgecinden geçirilir.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importRepo.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-purple-600/30"
                >
                  {importLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  İçe Aktar ve Doğrula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
