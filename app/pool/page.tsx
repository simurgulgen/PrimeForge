'use client';

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Zap,
  Trash2,
  Cloud,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldAlert,
  Search,
  Users,
  Activity,
  Sparkles,
  Link2
} from 'lucide-react';

interface Account {
  host: string;
  username: string;
  password: string;
  status: string;
  active_cons?: number;
  max_connections?: number;
  latency_ms?: number;
  exp_date?: string;
  has_tr?: boolean;
  claimed?: boolean;
  claimed_by?: {
    user_id: string;
    username?: string;
    slot: number;
    claimed_at?: number;
    device_fp?: string;
  };
  source?: string;
  last_checked?: number;
}

interface Stats {
  total: number;
  active: number;
  claimed: number;
  full: number;
  dead: number;
  tr: number;
  resolved_links_count: number;
  last_updated: number;
}

export default function IptvPoolPage() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    claimed: 0,
    full: 0,
    dead: 0,
    tr: 0,
    resolved_links_count: 0,
    last_updated: 0
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'claimed' | 'full' | 'dead'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

  const fetchPoolData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pool');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
          setAccounts(data.accounts || []);
        }
      }
    } catch (err) {
      console.error('Pool data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();
  }, []);

  const handleAction = async (action: 'scan' | 'scan_unscraped' | 'scan_all' | 'test' | 'clean' | 'sync') => {
    try {
      setActionRunning(action);
      setConsoleOutput(`[*] '${action}' işlemi başlatıldı, lütfen bekleyin...\n`);

      const res = await fetch('/api/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (data.output) {
        setConsoleOutput(data.output);
      } else if (data.error) {
        setConsoleOutput(`[✘] HATA: ${data.error}`);
      } else {
        setConsoleOutput(`[✔] İşlem tamamlandı. Sonuç: ${data.success ? 'Başarılı' : 'Hatalı'}`);
      }

      await fetchPoolData();
    } catch (err: any) {
      setConsoleOutput(`[✘] İstek hatası: ${err.message}`);
    } finally {
      setActionRunning(null);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredAccounts = accounts.filter((acc) => {
    // Sekme filtresi
    if (activeTab === 'active' && (acc.status !== 'Active' || acc.claimed)) return false;
    if (activeTab === 'claimed' && !acc.claimed) return false;
    if (activeTab === 'full' && acc.status !== 'Full') return false;
    if (activeTab === 'dead' && acc.status !== 'Dead' && acc.status !== 'Expired') return false;

    // Arama sorgusu
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hostMatch = acc.host.toLowerCase().includes(q);
      const userMatch = acc.username.toLowerCase().includes(q);
      return hostMatch || userMatch;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Üst Başlık & Açıklama */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 via-amber-300 to-teal-300 bg-clip-text text-transparent">
                IPTV Hediye Havuzu & Scraper
              </h1>
              <p className="text-sm text-slate-400">
                Prime Stream Dinamik Portalı & KısaLinkAtla Bypass Motoru • Canlı 1/1 Doluluk Garantisi
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAction('scan_unscraped')}
            disabled={!!actionRunning}
            title="Henüz taranmamış yeni portal kartlarını tespit edip havuza ekler"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium text-sm shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {actionRunning === 'scan_unscraped' || actionRunning === 'scan' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-amber-200" />
            )}
            Content Taraması Başlat
          </button>

          <button
            onClick={() => handleAction('test')}
            disabled={!!actionRunning}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {actionRunning === 'test' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 text-teal-400" />
            )}
            Havuzu Canlı Test Et
          </button>

          <button
            onClick={() => handleAction('sync')}
            disabled={!!actionRunning}
            className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {actionRunning === 'sync' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 text-blue-400" />
            )}
            Cloudflare KV Sync
          </button>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="text-xs font-mono text-slate-400">Toplam Hesap</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Prime Stream Havuzu</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
          <div className="text-xs font-mono text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Boşta (Aktif)
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{stats.active}</div>
          <div className="text-xs text-emerald-500/80 mt-1">Kullanıma Hazır</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
          <div className="text-xs font-mono text-blue-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Tanımlı
          </div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{stats.claimed}</div>
          <div className="text-xs text-blue-500/80 mt-1">Kullanıcıda Aktif</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 relative overflow-hidden">
          <div className="text-xs font-mono text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Dolu (1/1)
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{stats.full}</div>
          <div className="text-xs text-amber-500/80 mt-1">Kullanıcıya Verilmez</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 relative overflow-hidden">
          <div className="text-xs font-mono text-rose-400 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Ölü / Biten
          </div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{stats.dead}</div>
          <div className="text-xs text-rose-500/80 mt-1">Temizlenebilir</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
          <div className="text-xs font-mono text-purple-400 flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" /> Çözülmüş Link
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-1">{stats.resolved_links_count}</div>
          <div className="text-xs text-purple-500/80 mt-1">Hafızada Kayıtlı</div>
        </div>
      </div>

      {/* Kaynak & Scraper Bilgi Kartı */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden bg-slate-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="font-semibold text-white">Prime Stream Dinamik Portalı & KısaLinkAtla Entegrasyonu</h3>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
                Tek Kaynak (1)
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Yönlendirici: <code className="text-rose-300 font-mono">https://dar.vin/webiphome</code> ➔ Canlı Hedef:{' '}
              <code className="text-amber-300 font-mono">vtrump10.ununbium.zerocdn.com/iptv.html</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://dar.vin/webiphome"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Portalı Aç
            </a>
            <button
              onClick={() => handleAction('clean')}
              disabled={!!actionRunning}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Ölüleri Temizle
            </button>
          </div>
        </div>

        {/* Konsol Çıktısı (Aksiyon çalışınca) */}
        {consoleOutput && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
              <span>İşlem Terminal Çıktısı:</span>
              <button onClick={() => setConsoleOutput('')} className="text-slate-500 hover:text-slate-300 text-xs">
                Kapat
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-emerald-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {consoleOutput}
            </pre>
          </div>
        )}
      </div>

      {/* Havuz Tablosu & Arama */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {/* Tablo Üst Kontroller */}
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-white/5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'all' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tümü ({accounts.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Boşta ({stats.active})
            </button>
            <button
              onClick={() => setActiveTab('claimed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'claimed' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tanımlılar ({stats.claimed})
            </button>
            <button
              onClick={() => setActiveTab('full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'full' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              1/1 Dolu ({stats.full})
            </button>
            <button
              onClick={() => setActiveTab('dead')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dead' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ölü ({stats.dead})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Host veya kullanıcı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
            />
          </div>
        </div>

        {/* Tablo İçeriği */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/40 text-slate-400 font-mono uppercase text-[10px] border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Sunucu (Host)</th>
                <th className="py-3 px-4">Kullanıcı Adı</th>
                <th className="py-3 px-4">Kaynak / İçerik</th>
                <th className="py-3 px-4">Şifre</th>
                <th className="py-3 px-4">Bağlantı Kotası</th>
                <th className="py-3 px-4">Bitiş Tarihi</th>
                <th className="py-3 px-4">Gecikme</th>
                <th className="py-3 px-4">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                    Havuz verileri yükleniyor...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Hesap bulunamadı. "Content Taraması Başlat" butonunu kullanarak havuzu doldurabilirsiniz.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc, idx) => {
                  const key = `${acc.host}|${acc.username}`;
                  const isPassVisible = !!showPasswords[key];
                  const isFull = acc.status === 'Full';
                  const isActive = acc.status === 'Active';

                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate" title={acc.host}>
                        {acc.host}
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-medium">{acc.username}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] truncate max-w-[130px] block" title={acc.source || 'web_scraper'}>
                          {acc.source || 'web_scraper'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono">
                            {isPassVisible ? acc.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(key)}
                            className="text-slate-500 hover:text-slate-300"
                            title="Şifreyi Göster/Gizle"
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                            isFull
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {acc.active_cons ?? 0} / {acc.max_connections ?? 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{acc.exp_date || 'Sınırsız'}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {acc.latency_ms ? `${acc.latency_ms} ms` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {acc.claimed ? (
                          <div className="flex flex-col gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] w-fit font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                              TANIMLI
                            </span>
                            {acc.claimed_by && (
                              <div
                                className="text-[10.5px] text-blue-300 font-sans flex items-center gap-1 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/40 w-fit"
                                title={`Kullanıcı ID: ${acc.claimed_by.user_id}\nCihaz FP: ${acc.claimed_by.device_fp || '-'}\nTarih: ${acc.claimed_by.claimed_at ? new Date(acc.claimed_by.claimed_at).toLocaleString('tr-TR') : '-'}`}
                              >
                                <span>👤</span>
                                <span className="font-semibold text-white">
                                  {acc.claimed_by.username || acc.claimed_by.user_id.substring(0, 8)}
                                </span>
                                <span className="px-1 rounded bg-blue-700/50 text-[9px] text-blue-100 font-bold">
                                  Slot {acc.claimed_by.slot}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : isFull ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]">
                            1/1 DOLU
                          </span>
                        ) : isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">
                            BOŞTA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px]">
                            ÖLÜ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
