'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  ChevronRight,
  ArrowRight,
  History,
  Loader2,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  GitBranch,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================
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

interface ActionResult {
  action: string;
  message: string;
  triggered_at: string;
  details?: {
    description: string;
    next_steps?: string[];
    related_page?: string;
    related_page_label?: string;
    stats?: any;
  };
  workflow_run_id?: number;
  workflow_url?: string;
  github?: { success: boolean; error?: string };
  nim?: { success: boolean; latencyMs?: number; reply?: string; error?: string };
  kv?: { success: boolean; count?: number; error?: string };
}

interface HistoryItem {
  id: string;
  run_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  label: string;
  icon: string;
  color: string;
  message: string | null;
  github_success: boolean | null;
  nim_success: boolean | null;
  nim_latency: number | null;
  kv_success: boolean | null;
  kv_count: number | null;
  workflow_run_id: number | null;
  workflow_url: string | null;
  raw_summary: any;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  event: string;
  head_sha: string;
  duration_seconds: number | null;
}

// =============================================================================
// Component
// =============================================================================
export default function AutomationDashboardPage() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'nim' | 'iptv' | 'crons' | 'telegram' | 'history'>('live');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Live Action Result (detailed card instead of toast)
  const [liveResults, setLiveResults] = useState<ActionResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  // GitHub Workflow Runs
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Credentials Modal State
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [editGithubToken, setEditGithubToken] = useState('');
  const [editGithubRepo, setEditGithubRepo] = useState('simurgulgen/PrimeForge');
  const [editNimKey, setEditNimKey] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  // ─── Data Fetching ────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
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
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/automation/history?limit=30');
      if (res.ok) {
        const json = await res.json();
        setHistory(json.runs || []);
        setHistoryTotal(json.total || 0);
      }
    } catch (_) {} finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchWorkflowRuns = useCallback(async () => {
    setWorkflowLoading(true);
    try {
      const res = await fetch('/api/automation/workflow-status');
      if (res.ok) {
        const json = await res.json();
        setWorkflowRuns(json.runs || []);
      }
    } catch (_) {} finally {
      setWorkflowLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchHistory]);

  // ─── Action Trigger ───────────────────────────────────────────────────────────

  const triggerAction = async (action: string, label: string) => {
    setActionLoading(action);
    setActiveTab('live'); // Switch to live tab to show results
    try {
      const res = await fetch('/api/automation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json: ActionResult = await res.json();
      // Prepend to live results
      setLiveResults(prev => [json, ...prev].slice(0, 20));
      setExpandedResult(0); // Auto-expand latest
      // Refresh history
      setTimeout(() => fetchHistory(), 1000);
    } catch (e: any) {
      setLiveResults(prev => [{
        action,
        message: e?.message || 'İstek başarısız.',
        triggered_at: new Date().toISOString(),
      }, ...prev].slice(0, 20));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
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
        setLiveResults(prev => [json, ...prev].slice(0, 20));
        setShowCredsModal(false);
        setEditGithubToken('');
        setEditNimKey('');
        fetchStatus();
      }
    } catch (_) {} finally {
      setSavingCreds(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      triggered: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      running: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      failed: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    };
    const labels: Record<string, string> = {
      triggered: '⏳ Tetiklendi',
      running: '🔄 Çalışıyor',
      success: '✅ Başarılı',
      failed: '❌ Başarısız',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${styles[status] || styles.triggered}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      check_updates: 'blue',
      health_check: 'rose',
      nightly_scan: 'purple',
      sync_kv: 'teal',
      test_nim: 'violet',
      save_credentials: 'amber',
    };
    return colors[action] || 'slate';
  };

  const isSuccess = (result: ActionResult) => {
    if (result.github) return result.github.success;
    if (result.nim) return result.nim.success;
    if (result.kv) return result.kv.success;
    return true;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Az önce';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
    return `${Math.floor(diff / 86400000)} gün önce`;
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ─── Header ──────────────────────────────────────────────────── */}
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
                fetchHistory();
              }}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-slate-300 hover:text-white"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ─── Credentials Status Bar ──────────────────────────────────── */}
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

        {/* ─── 4 Metric Cards ──────────────────────────────────────────── */}
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
          <Link href="/pool" className="group">
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-rose-500/20 shadow-xl space-y-3 group-hover:border-rose-500/40 transition-colors h-full">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Tv className="w-5 h-5" />
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono flex items-center gap-1">
                  %{data?.iptv?.healthScore || 99} Sağlık
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                <span className="text-cyan-400">{data?.iptv?.hasTr || 0} TR</span>
              </div>
            </div>
          </Link>

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

          {/* Card 4: Action History */}
          <div
            className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-cyan-500/20 shadow-xl space-y-3 cursor-pointer hover:border-cyan-500/40 transition-colors"
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <History className="w-5 h-5" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                Son 30 İşlem
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">İşlem Geçmişi</div>
              <div className="text-2xl font-bold text-white">
                {historyTotal}
                <span className="text-sm font-normal text-slate-400 ml-1.5">kayıt</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 pt-1 border-t border-white/5 flex items-center justify-between">
              <span>Son:</span>
              <span className="text-cyan-400 font-medium">
                {history[0] ? timeAgo(history[0].started_at) : 'Veri yok'}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Quick Trigger Action Bar ──────────────────────────────── */}
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

        {/* ─── Tab Navigation ──────────────────────────────────────────── */}
        <div className="flex border-b border-white/5 space-x-1 overflow-x-auto">
          {([
            { key: 'live' as const, label: 'Canlı İşlem Sonuçları', icon: <Zap className="w-4 h-4" />, color: 'amber', count: liveResults.length },
            { key: 'history' as const, label: 'İşlem Geçmişi', icon: <History className="w-4 h-4" />, color: 'cyan', count: historyTotal },
            { key: 'nim' as const, label: 'NIM & Doğrulamalar', icon: <Cpu className="w-4 h-4" />, color: 'violet', count: undefined as number | undefined },
            { key: 'iptv' as const, label: 'IPTV Monitörü', icon: <Tv className="w-4 h-4" />, color: 'rose', count: undefined as number | undefined },
            { key: 'crons' as const, label: 'Zamanlanmış Görevler', icon: <Clock className="w-4 h-4" />, color: 'amber', count: undefined as number | undefined },
            { key: 'telegram' as const, label: 'Telegram Bot', icon: <Send className="w-4 h-4" />, color: 'cyan', count: undefined as number | undefined },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'history') fetchHistory();
                if (tab.key === 'crons') fetchWorkflowRuns();
              }}
              className={`px-3 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? `border-${tab.color}-500 text-${tab.color}-300 bg-${tab.color}-500/10`
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-${tab.color}-500/20`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Canlı İşlem Sonuçları (LIVE) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            {liveResults.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-amber-400" />
                </div>
                <p className="text-slate-400 text-sm">Henüz bir işlem tetiklenmedi.</p>
                <p className="text-slate-500 text-xs">Yukarıdaki butonlardan birini kullanarak bir otomasyon başlatın.</p>
              </div>
            ) : (
              liveResults.map((result, idx) => {
                const success = isSuccess(result);
                const expanded = expandedResult === idx;
                const color = getActionColor(result.action);
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border transition-all ${
                      success
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-rose-500/5 border-rose-500/20'
                    }`}
                  >
                    {/* Header */}
                    <div
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                      onClick={() => setExpandedResult(expanded ? null : idx)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                          success ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                          {success ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{result.message}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {timeAgo(result.triggered_at)}
                            {result.workflow_url && (
                              <a
                                href={result.workflow_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                onClick={e => e.stopPropagation()}
                              >
                                <GitBranch className="w-3 h-3" />
                                GitHub Actions
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.details?.related_page && (
                          <Link
                            href={result.details.related_page}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <ArrowRight className="w-3 h-3" />
                            {result.details.related_page_label}
                          </Link>
                        )}
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expanded && result.details && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {result.details.description}
                        </p>

                        {result.details.next_steps && result.details.next_steps.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sonraki Adımlar:</div>
                            {result.details.next_steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                {step}
                              </div>
                            ))}
                          </div>
                        )}

                        {result.details.stats && (
                          <div className="flex flex-wrap gap-3 pt-1">
                            {Object.entries(result.details.stats).map(([k, v]) => (
                              <div key={k} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs">
                                <span className="text-slate-400">{k}: </span>
                                <span className="text-white font-mono font-bold">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {result.nim && (
                          <div className="flex flex-wrap gap-3 pt-1">
                            <div className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                              🧠 Gecikme: <span className="font-bold">{result.nim.latencyMs}ms</span>
                            </div>
                            {result.nim.reply && (
                              <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs font-mono text-slate-300">
                                Yanıt: {result.nim.reply}
                              </div>
                            )}
                          </div>
                        )}

                        {result.kv && (
                          <div className="flex flex-wrap gap-3 pt-1">
                            <div className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300">
                              ☁️ Senkronize: <span className="font-bold">{result.kv.count} hesap</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: İşlem Geçmişi (HISTORY) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                İşlem Geçmişi ({historyTotal} kayıt)
              </h3>
              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
              >
                <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyLoading && history.length === 0 ? (
              <div className="text-center py-12">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                <p className="text-xs text-slate-400 mt-2">Geçmiş yükleniyor...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Henüz kayıtlı bir işlem geçmişi yok.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-${item.color}-500/10 border border-${item.color}-500/20`}>
                        {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {item.status === 'failed' && <XCircle className="w-4 h-4 text-rose-400" />}
                        {item.status === 'running' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                        {item.status === 'triggered' && <Play className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{item.label}</div>
                        <div className="text-xs text-slate-400 truncate">{item.message || 'Detay yok'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {getStatusBadge(item.status)}

                      {item.workflow_url && (
                        <a
                          href={item.workflow_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <GitBranch className="w-3 h-3" />
                          Actions
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {item.nim_latency && (
                        <span className="text-violet-300 font-mono">{item.nim_latency}ms</span>
                      )}

                      {item.kv_count && (
                        <span className="text-teal-300 font-mono">{item.kv_count} hesap</span>
                      )}

                      <span className="text-slate-500 font-mono whitespace-nowrap">
                        {timeAgo(item.started_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: NIM AI & Verifications */}
        {/* ═══════════════════════════════════════════════════════════════ */}
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
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Son NIM Doğrulamaları ve İşlem Kayıtları
                </h3>
                <Link
                  href="/updates"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Güncellemeler Sayfası <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: TigerStream IPTV Health */}
        {/* ═══════════════════════════════════════════════════════════════ */}
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
                <div className="flex items-center gap-2">
                  <Link
                    href="/pool"
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    IPTV Havuzunu Aç
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <div className="text-right font-mono text-xs text-rose-300">
                    Cron: 17 */4 * * *
                  </div>
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
                    style={{ width: `${data ? (data.iptv.active / Math.max(data.iptv.total, 1)) * 100 : 0}%` }}
                    className="bg-emerald-500 h-full"
                    title="Aktif ve Açık"
                  />
                  <div
                    style={{ width: `${data ? (data.iptv.full / Math.max(data.iptv.total, 1)) * 100 : 0}%` }}
                    className="bg-amber-500 h-full"
                    title="Dolu (1/1)"
                  />
                  <div
                    style={{ width: `${data ? (data.iptv.degraded / Math.max(data.iptv.total, 1)) * 100 : 0}%` }}
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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Crons & Workflows */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'crons' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Aktif Zamanlanmış Görevler (Crons & Workflows)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sisteminizin otonom çalışmasını sağlayan arka plan zamanlayıcıları.
                  </p>
                </div>
                <button
                  onClick={fetchWorkflowRuns}
                  disabled={workflowLoading}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${workflowLoading ? 'animate-spin' : ''}`} />
                  GitHub Actions Durumu
                </button>
              </div>

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

            {/* GitHub Actions Recent Runs */}
            {workflowRuns.length > 0 && (
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 space-y-4">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-400" />
                  Son GitHub Actions Çalıştırmaları
                </h3>
                <div className="space-y-2">
                  {workflowRuns.map(run => (
                    <div
                      key={run.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          run.conclusion === 'success' ? 'bg-emerald-400' :
                          run.conclusion === 'failure' ? 'bg-rose-400' :
                          run.status === 'in_progress' ? 'bg-amber-400 animate-pulse' :
                          'bg-blue-400'
                        }`} />
                        <span className="text-xs font-medium text-white truncate">{run.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{run.head_sha}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        {run.duration_seconds && (
                          <span className="text-slate-400">{run.duration_seconds}s</span>
                        )}
                        <span className="text-slate-500">{timeAgo(run.created_at)}</span>
                        <a
                          href={run.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Telegram Bot & Webhook */}
        {/* ═══════════════════════════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Credentials Settings Modal */}
        {/* ═══════════════════════════════════════════════════════════════ */}
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
                  <X className="w-5 h-5" />
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
