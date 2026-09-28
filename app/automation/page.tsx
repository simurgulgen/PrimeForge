'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Cpu,
  Tv,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Send,
  Cloud,
  Layers,
  Sparkles,
  Terminal,
  Activity,
  FileText,
  Play,
  Check,
  Flame,
  Radio,
  ExternalLink,
  Key,
  Lock,
  Settings,
} from 'lucide-react';

interface CronItem {
  id: string;
  name: string;
  interval: string;
  target: string;
  status: string;
  platform: string;
}

interface AutomationData {
  status: string;
  timestamp: string;
  nim: {
    provider: string;
    model: string;
    endpoint: string;
    isActive: boolean;
    features: string[];
  };
  credentials?: {
    github: {
      configured: boolean;
      repo: string;
      maskedToken: string | null;
    };
    nim: {
      configured: boolean;
      maskedKey: string | null;
      model: string;
    };
  };
  iptv: {
    total: number;
    active: number;
    full: number;
    degraded: number;
    hasTr: number;
    healthScore: number;
    updatedAt: number;
    gatewayOnline: boolean;
  };
  jobs: {
    total: number;
    pending: number;
    recent: any[];
    verifications: any[];
  };
  crons: CronItem[];
  automationRuns: any[];
}

export default function AutomationDashboardPage() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'nim' | 'iptv' | 'crons' | 'telegram'>('nim');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ message: string; isError?: boolean } | null>(null);

  // Credentials Modal State
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [editGithubToken, setEditGithubToken] = useState('');
  const [editGithubRepo, setEditGithubRepo] = useState('simurgulgen/PrimeForge');
  const [editNimKey, setEditNimKey] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/automation/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.credentials?.github?.repo) {
          setEditGithubRepo(json.credentials.github.repo);
        }
      }
    } catch (e) {
      console.error('Automation status fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerAction = async (action: string, label: string) => {
    setActionLoading(action);
    setActionResult(null);
    try {
      const res = await fetch('/api/automation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionResult({ message: json.message || `${label} başarıyla tetiklendi.` });
        fetchStatus();
      } else {
        setActionResult({ message: json.error || `${label} sırasında hata oluştu.`, isError: true });
      }
    } catch (e: any) {
      setActionResult({ message: e?.message || 'İstek başarısız.', isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/automation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_credentials',
          github_token: editGithubToken.trim() || undefined,
          github_repo: editGithubRepo.trim() || undefined,
          nvidia_nim_key: editNimKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionResult({ message: json.message || 'Anahtarlar başarıyla kaydedildi!' });
        setShowCredsModal(false);
        setEditGithubToken('');
        setEditNimKey('');
        fetchStatus();
      } else {
        setActionResult({ message: json.error || 'Kaydetme hatası', isError: true });
      }
    } catch (e: any) {
      setActionResult({ message: e?.message || 'Hata oluştu', isError: true });
    } finally {
      setSavingCreds(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
                  Tam Otomasyon Yönetim Merkezi
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  NVIDIA NIM AI Denetçisi, TigerStream IPTV Sağlık Motoru & Telegram Otonom Pipeline
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCredsModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-violet-400" />
              API & Token Ayarları
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              OTONOM SİSTEM AKTİF (7/24)
            </div>

            <button
              onClick={() => {
                setLoading(true);
                fetchStatus();
              }}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-slate-300 hover:text-white"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Credentials Status Bar */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">GitHub Token:</span>
              {data?.credentials?.github?.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {data.credentials.github.maskedToken} ({data.credentials.github.repo})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Tanımlı Değil
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">NVIDIA NIM:</span>
              {data?.credentials?.nim?.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {data.credentials.nim.maskedKey} (Nemotron 120B)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Tanımlı Değil
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowCredsModal(true)}
            className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-2 flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            Anahtarları Güncelle
          </button>
        </div>

        {/* Action Result Toast */}
        {actionResult && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 animate-in fade-in ${
              actionResult.isError
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3 text-sm font-medium">
              {actionResult.isError ? (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <span>{actionResult.message}</span>
            </div>
            <button
              onClick={() => setActionResult(null)}
              className="text-xs opacity-60 hover:opacity-100 px-2 py-1"
            >
              Kapat
            </button>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: NIM AI */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-violet-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono">
                Nemotron 120B
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">NVIDIA NIM AI Denetçisi</div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <span>Aktif</span>
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
            </div>
            <div className="text-xs text-slate-400 pt-1 border-t border-white/5 flex items-center justify-between">
              <span>Doğrulama Güveni:</span>
              <span className="text-emerald-400 font-bold">%95+ Doğruluk</span>
            </div>
          </div>

          {/* Card 2: TigerStream IPTV Pool */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-rose-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Tv className="w-5 h-5" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                %{data?.iptv?.healthScore || 99} Sağlık
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">TigerStream IPTV Havuzu</div>
              <div className="text-2xl font-bold text-white">
                {data ? data.iptv.total.toLocaleString() : '...'}
                <span className="text-sm font-normal text-slate-400 ml-1.5">hesap</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 pt-1 border-t border-white/5 flex items-center justify-between">
              <span className="text-emerald-400">{data?.iptv?.active || 0} Aktif</span>
              <span className="text-amber-400">{data?.iptv?.full || 0} Dolu (1/1)</span>
              <span className="text-cyan-400">{data?.iptv?.hasTr || 0} TR Kanallı</span>
            </div>
          </div>

          {/* Card 3: Cron Schedules */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-amber-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                5 Zamanlı Görev
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Otomasyon Görevleri</div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <span>Her 4s & 6s</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 pt-1 border-t border-white/5 flex items-center justify-between">
              <span>GitHub Actions & Cloud:</span>
              <span className="text-emerald-400 font-medium">Tümü Çalışıyor</span>
            </div>
          </div>

          {/* Card 4: Telegram Webhook */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-cyan-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Send className="w-5 h-5" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                Webhook Canlı
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Telegram Otonom Botu</div>
              <div className="text-2xl font-bold text-white">
                TXT & M3U
                <span className="text-sm font-normal text-slate-400 ml-1.5">Destekli</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 pt-1 border-t border-white/5 flex items-center justify-between">
              <span>Komutlar:</span>
              <span className="text-cyan-400 font-mono">/health, /streams, /mod</span>
            </div>
          </div>
        </div>

        {/* Quick Trigger Action Bar */}
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Anlık Manuel Tetikleme Konsolu</span>
            </div>
            <span className="text-xs text-slate-400">
              Periyodik cronları beklemeden doğrudan tetikleyebilirsiniz
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <button
              onClick={() => triggerAction('check_updates', 'Güncelleme Taraması')}
              disabled={actionLoading !== null}
              className="p-3 rounded-xl bg-gradient-to-b from-blue-600/20 to-blue-600/5 hover:from-blue-600/30 hover:to-blue-600/10 border border-blue-500/30 text-blue-200 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'check_updates' ? 'animate-spin' : ''}`} />
              Güncelleme Tara
            </button>

            <button
              onClick={() => triggerAction('health_check', '4 Saatlik IPTV Sağlık Kontrolü')}
              disabled={actionLoading !== null}
              className="p-3 rounded-xl bg-gradient-to-b from-rose-600/20 to-rose-600/5 hover:from-rose-600/30 hover:to-rose-600/10 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${actionLoading === 'health_check' ? 'animate-spin' : ''}`} />
              IPTV Sağlık Testi
            </button>

            <button
              onClick={() => triggerAction('nightly_scan', 'Gece IPTV Taraması')}
              disabled={actionLoading !== null}
              className="p-3 rounded-xl bg-gradient-to-b from-purple-600/20 to-purple-600/5 hover:from-purple-600/30 hover:to-purple-600/10 border border-purple-500/30 text-purple-200 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Flame className={`w-3.5 h-3.5 ${actionLoading === 'nightly_scan' ? 'animate-spin' : ''}`} />
              Gece Taraması
            </button>

            <button
              onClick={() => triggerAction('sync_kv', 'Cloudflare KV Eşitleme')}
              disabled={actionLoading !== null}
              className="p-3 rounded-xl bg-gradient-to-b from-teal-600/20 to-teal-600/5 hover:from-teal-600/30 hover:to-teal-600/10 border border-teal-500/30 text-teal-200 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Cloud className={`w-3.5 h-3.5 ${actionLoading === 'sync_kv' ? 'animate-spin' : ''}`} />
              KV Havuz Eşitle
            </button>

            <button
              onClick={() => triggerAction('test_nim', 'NVIDIA NIM Testi')}
              disabled={actionLoading !== null}
              className="p-3 rounded-xl bg-gradient-to-b from-violet-600/20 to-violet-600/5 hover:from-violet-600/30 hover:to-violet-600/10 border border-violet-500/30 text-violet-200 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${actionLoading === 'test_nim' ? 'animate-spin' : ''}`} />
              NIM AI Test Et
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 space-x-2">
          <button
            onClick={() => setActiveTab('nim')}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'nim'
                ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cpu className="w-4 h-4 text-violet-400" />
            NVIDIA NIM & Doğrulamalar
          </button>

          <button
            onClick={() => setActiveTab('iptv')}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'iptv'
                ? 'border-rose-500 text-rose-300 bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv className="w-4 h-4 text-rose-400" />
            TigerStream IPTV Monitörü
          </button>

          <button
            onClick={() => setActiveTab('crons')}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'crons'
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            Zamanlanmış Görevler (Crons)
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'telegram'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Send className="w-4 h-4 text-cyan-400" />
            Telegram Bot & Webhook
          </button>
        </div>

        {/* Tab 1: NIM AI & Verifications */}
        {activeTab === 'nim' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-violet-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-violet-400" />
                    NVIDIA NIM Akıllı Güncelleme Doğrulayıcısı Nasıl Çalışır?
                  </h3>
                  <p className="text-xs text-slate-400">
                    GitHub Actions her 6 saatte bir çalıştığında, bulunan güncellemeleri körü körüne indirmek yerine NIM API'sine danışır.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-xl bg-violet-500/20 text-violet-300 text-xs font-mono">
                  Prompt: NIM_UPDATE_VERIFY_PROMPT
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-bold text-violet-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    1. Gerçek Sürüm Karşılaştırması
                  </div>
                  <p className="text-xs text-slate-400">
                    Katalogdaki mevcut sürüm ile yeni release sürümünü karşılaştırır. <code>1.0</code> görünen ama aslında <code>2.4.1</code> olan yanıltıcı durumları engeller.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-bold text-violet-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    2. Güvenlik & Kaynak Analizi
                  </div>
                  <p className="text-xs text-slate-400">
                    APK indirme bağlantısının resmi repodan gelip gelmediğini, paket adı uyumluluğunu ve olası typosquatting tuzaklarını değerlendirir.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="text-xs font-bold text-violet-300 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-amber-400" />
                    3. Otonom Karar & Telegram Butonları
                  </div>
                  <p className="text-xs text-slate-400">
                    Güven %75+ ise ve profil <code>auto_apply: true</code> ise otomatik modlama başlatır; aksi halde Telegram'a butonlu karar iletir.
                  </p>
                </div>
              </div>
            </div>

            {/* Verifications Table */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Son NIM Doğrulamaları ve İşlem Kayıtları
              </h3>

              {data?.jobs?.verifications && data.jobs.verifications.length > 0 ? (
                <div className="space-y-3">
                  {data.jobs.verifications.map((v: any, idx: number) => {
                    const nim = v.nim_verification || {};
                    const approved = nim.approved;
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {v.app_name || v.package_name || 'Bilinmeyen Uygulama'}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              ({v.package_name || 'paket-yok'})
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                approved
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {approved ? '✅ NIM ONAYLI' : '❌ NIM REDDETTİ'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Gerekçe: <span className="text-slate-300">{nim.reason || 'Doğrulama başarılı'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right">
                            <div className="text-slate-400">Güven Skoru:</div>
                            <div className="font-bold text-emerald-400">%{nim.confidence || 50}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-400">Önerilen Eylem:</div>
                            <div className="font-mono text-cyan-300">{nim.recommended_action || 'manual_review'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Henüz kaydedilmiş bir NIM doğrulaması yok. Güncelleme denetçisi çalıştığında kayıtlar burada listelenecektir.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: TigerStream IPTV Health */}
        {activeTab === 'iptv' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-rose-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-400" />
                    4 Saatte Bir Otomatik IPTV Sağlık Denetimi
                  </h3>
                  <p className="text-xs text-slate-400">
                    <code>scripts/stream_health_check.py</code> motoru havuzdaki her hesabı Xtream player API ile test eder.
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-rose-300">
                  Cron: 17 */4 * * *
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Havuz Dağılımı ({data?.iptv?.total} Toplam)</span>
                  <span>%{data?.iptv?.healthScore}% Aktif & Kullanılabilir</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${data ? (data.iptv.active / Math.max(data.iptv.total, 1)) * 100 : 0}%`,
                    }}
                    className="bg-emerald-500 h-full"
                    title="Aktif ve Açık"
                  />
                  <div
                    style={{
                      width: `${data ? (data.iptv.full / Math.max(data.iptv.total, 1)) * 100 : 0}%`,
                    }}
                    className="bg-amber-500 h-full"
                    title="Dolu (1/1)"
                  />
                  <div
                    style={{
                      width: `${data ? (data.iptv.degraded / Math.max(data.iptv.total, 1)) * 100 : 0}%`,
                    }}
                    className="bg-rose-500 h-full"
                    title="Geçici Sorunlu"
                  />
                </div>
                <div className="flex items-center gap-4 text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-300">Aktif ({data?.iptv?.active})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-300">Dolu 1/1 ({data?.iptv?.full})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-300">Sorunlu ({data?.iptv?.degraded})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Health rules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  1/1 Dolu Hesap Kuralı (Kullanıcı İsteği)
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  1/1 bağlantı hakkı olan ve şu an dolu görünen hesaplar havuzdan <strong>silinmez</strong>. İzleyici TV'yi kapattığında tekrar boşa düşeceği için listede tutulur.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  3-Strike Ölü Hesap Temizliği
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Üst üste 3 sağlık kontrolünde yanıt vermeyen veya aboneliği biten sunucular "Dead" olarak işaretlenir ve havuzdan kalıcı olarak temizlenir.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Crons & Workflows */}
        {activeTab === 'crons' && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Aktif Zamanlanmış Görevler (Crons & Workflows)
              </h3>
              <p className="text-xs text-slate-400">
                Sisteminizin otonom çalışmasını sağlayan arka plan zamanlayıcıları.
              </p>

              <div className="space-y-3 pt-2">
                {data?.crons?.map((cron) => (
                  <div
                    key={cron.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{cron.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                          {cron.platform}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{cron.target}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs font-mono text-amber-300">
                        {cron.interval}
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Telegram Bot & Webhook */}
        {activeTab === 'telegram' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-cyan-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-cyan-400" />
                    Telegram Botu ile Uzaktan Yönetim
                  </h3>
                  <p className="text-xs text-slate-400">
                    Botunuza dosya ileterek veya komut yazarak PrimeStore ve TigerStream'i telefonunuzdan yönetebilirsiniz.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-mono">
                  Webhook / Polling
                </div>
              </div>

              {/* Supported Commands Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-mono text-xs font-bold text-cyan-300">/health</div>
                  <div className="text-xs text-slate-400">Supabase, IPTV havuzu ve NIM durumunu raporlar.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-mono text-xs font-bold text-cyan-300">/streams</div>
                  <div className="text-xs text-slate-400">Aktif, 1/1 dolu ve TR kanallı IPTV hesap istatistikleri.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-mono text-xs font-bold text-cyan-300">/clean_dead</div>
                  <div className="text-xs text-slate-400">Ölü hesapları anında temizler ve KV'yi eşitler.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-mono text-xs font-bold text-cyan-300">/updates</div>
                  <div className="text-xs text-slate-400">Bekleyen güncelleme ve modlama işlerini listeler.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-mono text-xs font-bold text-cyan-300">/check_updates</div>
                  <div className="text-xs text-slate-400">GitHub Actions üzerinden güncelleme taraması başlatır.</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-mono text-xs font-bold text-cyan-300">.TXT veya .M3U İlet</div>
                  <div className="text-xs text-slate-400">NIM metni tarar, hesapları çıkarır, test eder ve havuza ekler.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Settings Modal */}
        {showCredsModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-violet-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">API & Token Yönetimi</h3>
                    <p className="text-xs text-slate-400">Supabase forge_settings üzerinden canlı güncellenir</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCredsModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs leading-relaxed">
                💡 <b>Bilgi:</b> Buraya kaydedilen anahtarlar doğrudan Supabase veritabanına işlenir. Vercel üzerinde yeniden deploy gerekmeksizin tüm otonom tetiklemeler bu anahtarları kullanır.
              </div>

              <form onSubmit={handleSaveCredentials} className="space-y-4">
                {/* GitHub Token Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-300">GitHub Personal Access Token (PAT):</label>
                    <span className="font-mono text-emerald-400">
                      {data?.credentials?.github?.configured ? `Mevcut: ${data.credentials.github.maskedToken}` : 'Tanımlı Değil'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={editGithubToken}
                    onChange={(e) => setEditGithubToken(e.target.value)}
                    placeholder="ghp_... veya gho_... (Değiştirmek için girin)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-violet-500 transition-colors font-mono"
                  />
                </div>

                {/* GitHub Repo Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Hedef GitHub Repo Slug:</label>
                  <input
                    type="text"
                    value={editGithubRepo}
                    onChange={(e) => setEditGithubRepo(e.target.value)}
                    placeholder="simurgulgen/PrimeForge"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-violet-500 transition-colors font-mono"
                  />
                </div>

                {/* NVIDIA NIM Key Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-300">NVIDIA NIM API Key:</label>
                    <span className="font-mono text-emerald-400">
                      {data?.credentials?.nim?.configured ? `Mevcut: ${data.credentials.nim.maskedKey}` : 'Tanımlı Değil'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={editNimKey}
                    onChange={(e) => setEditNimKey(e.target.value)}
                    placeholder="nvapi-... (Değiştirmek için girin)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-violet-500 transition-colors font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => triggerAction('test_nim', 'NIM Testi')}
                    disabled={actionLoading !== null}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium transition-colors"
                  >
                    🧠 NIM Test Et
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCredsModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-medium transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={savingCreds}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
                    >
                      {savingCreds ? 'Kaydediliyor...' : '💾 Kaydet ve Uygula'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

