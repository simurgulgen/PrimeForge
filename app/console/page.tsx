'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Terminal as TerminalIcon,
  RefreshCw,
  Ban,
  Download,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  Layers,
  Shield,
  Tv,
  Smartphone,
  Tablet,
  Package,
  Sparkles,
  ArrowRight,
  Maximize2,
  Radio,
  FileCode2,
} from 'lucide-react';

interface PipelineStep {
  name: string;
  status: 'completed' | 'in_progress' | 'failed' | 'pending' | 'skipped';
  conclusion?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export default function ConsolePage() {
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [runInfo, setRunInfo] = useState<any>(null);
  const [rawLogs, setRawLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'step' | 'warn'>('all');
  const [activeStepFilter, setActiveStepFilter] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch console data from API
  const fetchConsoleData = async (jobId?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = jobId ? `/api/console?jobId=${jobId}` : '/api/console';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (data.success) {
        setAllJobs(data.allJobs || []);
        if (data.selectedJob) {
          setSelectedJob(data.selectedJob);
          setSelectedJobId(data.selectedJob.id);
        }
        setRunInfo(data.runInfo || null);
        setRawLogs(data.logs || '');
      }
    } catch (err: any) {
      console.error('Failed to load console data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConsoleData();
  }, []);

  // Poll for active jobs every 5 seconds
  useEffect(() => {
    const isJobActive =
      selectedJob?.status &&
      ['pending', 'downloading', 'analyzing', 'patching', 'building', 'testing'].includes(selectedJob.status);

    if (!isJobActive && runInfo?.status !== 'in_progress') return;

    const interval = setInterval(() => {
      fetchConsoleData(selectedJobId, true);
    }, 4500);

    return () => clearInterval(interval);
  }, [selectedJob?.status, selectedJobId, runInfo?.status]);

  // Handle autoscroll
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rawLogs, autoScroll]);

  // Cancel running job
  const handleCancelJob = async () => {
    if (!selectedJobId) return;
    setIsCancelling(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', jobId: selectedJobId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: 'success', text: data.message || 'Görev başarıyla iptal edildi.' });
        fetchConsoleData(selectedJobId);
      } else {
        setActionMsg({ type: 'error', text: data.error || 'İptal edilemedi.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Bağlantı hatası oluştu.' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Download raw log
  const handleDownloadLog = () => {
    const blob = new Blob([rawLogs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `primeforge-${selectedJob?.package_name || 'job'}-${selectedJobId.substring(0, 8)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Format pipeline steps for visual tracker
  const pipelineStages = [
    {
      id: 'setup',
      title: 'Hazırlık & SDK',
      subtitle: 'Java 21, Android SDK & Araçlar',
      matchKeys: ['Setup Java', 'Setup Android', 'Install Python', 'Decode Signing'],
    },
    {
      id: 'download',
      title: 'APK İndir & Çöz',
      subtitle: 'Hedef APK & Kod Ayrıştırma',
      matchKeys: ['Download Target', 'Step 1: Decompile'],
    },
    {
      id: 'analysis',
      title: 'Statik Kod Analizi',
      subtitle: 'R8 / Obfuscation & İzin Taraması',
      matchKeys: ['Step 1: Static Analysis', 'Obfuscation'],
    },
    {
      id: 'security',
      title: 'Güvenlik Taraması',
      subtitle: 'VirusTotal, APKiD, Quark, ClamAV',
      matchKeys: ['VirusTotal', 'APKiD', 'Quark', 'ClamAV', 'Güvenlik'],
    },
    {
      id: 'patching',
      title: 'Smali & Morphe Mod',
      subtitle: 'Bytecode Kancaları & Reklam Temizliği',
      matchKeys: ['Smali Patching', 'Morphe', 'Manifest Sanitization'],
    },
    {
      id: 'build',
      title: 'Derleme & İmza',
      subtitle: 'Apktool + aapt2, Zipalign, V1-V3',
      matchKeys: ['Recompiling', 'Build & Sign', 'zipalign', 'apksigner', 'Step 6'],
    },
    {
      id: 'emulator',
      title: 'Canlı Emülatör Testi',
      subtitle: 'Android TV DPAD, Mobil, Tablet',
      matchKeys: ['Android Emulator Test', 'Multi-Device Screenshot'],
    },
    {
      id: 'publish',
      title: 'Yayın & Arşiv',
      subtitle: 'GitHub Releases & Mağaza Onayı',
      matchKeys: ['Post-test Catbox', 'GitHub Release', 'Upload Output'],
    },
  ];

  // Map GitHub run steps to visual stages
  const getStageStatus = (stage: typeof pipelineStages[0]) => {
    if (!runInfo?.job?.steps) {
      if (selectedJob?.status === 'completed' || selectedJob?.status === 'published') return 'completed';
      if (selectedJob?.status === 'failed') return 'failed';
      if (selectedJob?.status === 'cancelled') return 'cancelled';
      return 'pending';
    }

    const steps = runInfo.job.steps;
    const matching = steps.filter((s: any) =>
      stage.matchKeys.some((k) => s.name.toLowerCase().includes(k.toLowerCase()))
    );

    if (matching.length === 0) {
      // Look at current job status
      return 'pending';
    }

    const hasFailed = matching.some((s: any) => s.conclusion === 'failure');
    if (hasFailed) return 'failed';

    const hasRunning = matching.some((s: any) => s.status === 'in_progress');
    if (hasRunning) return 'in_progress';

    const allCompleted = matching.every((s: any) => s.status === 'completed');
    if (allCompleted) return 'completed';

    return 'pending';
  };

  // Filter raw log lines
  const logLines = rawLogs.split('\n').filter((line) => {
    if (!line.trim()) return false;

    // Filter by active stage selection
    if (activeStepFilter) {
      const stage = pipelineStages.find((s) => s.id === activeStepFilter);
      if (stage && !stage.matchKeys.some((k) => line.toLowerCase().includes(k.toLowerCase()))) {
        return false;
      }
    }

    // Filter by search query
    if (searchQuery.trim() && !line.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Filter by log level
    if (logFilter === 'error') {
      return (
        line.includes('error') ||
        line.includes('Error') ||
        line.includes('ERROR') ||
        line.includes('failed') ||
        line.includes('RuntimeError') ||
        line.includes('❌') ||
        line.includes('Exception')
      );
    }
    if (logFilter === 'warn') {
      return line.includes('warn') || line.includes('Warn') || line.includes('WARN') || line.includes('⚠️');
    }
    if (logFilter === 'step') {
      return line.includes('Step ') || line.includes('📋') || line.includes('🔧') || line.includes('📦') || line.includes('🔐');
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Job Selector */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-indigo-950/40 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30">
              <TerminalIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                PrimeForge Canlı Log & Görev Konsolu
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  CANLI AKIŞ
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                APK derleme, bytecode yamalama, güvenlik taramaları ve emülatör testlerinin gerçek zamanlı terminali.
              </p>
            </div>
          </div>
        </div>

        {/* Job Selection Dropdown & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px]">
            <select
              value={selectedJobId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedJobId(id);
                fetchConsoleData(id);
              }}
              className="w-full px-3.5 py-2 pr-8 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 font-semibold focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
            >
              {allJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.app_name || j.package_name} ({j.package_name}) [#{j.id.substring(0, 8)}] - {j.status}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => fetchConsoleData(selectedJobId)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Logları ve Durumu Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Cancel Button */}
          {selectedJob &&
            ['pending', 'downloading', 'analyzing', 'patching', 'building', 'testing', 'waiting_decision'].includes(
              selectedJob.status
            ) && (
              <button
                type="button"
                onClick={handleCancelJob}
                disabled={isCancelling}
                className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Görevi ve Arka Plan Pipeline'ını İptal Et"
              >
                <Ban className="w-3.5 h-3.5" />
                İptal Et
              </button>
            )}

          <button
            type="button"
            onClick={handleDownloadLog}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            title="Ham Log Dosyasını İndir (.log)"
          >
            <Download className="w-3.5 h-3.5" />
            İndir
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border animate-in slide-in-from-top duration-200 ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span className="font-medium">{actionMsg.text}</span>
          </div>
          <button type="button" onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Selected Job Metadata Card */}
      {selectedJob && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-cyan-400">
              APK
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                {selectedJob.app_name || selectedJob.package_name}
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  ({selectedJob.package_name})
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    selectedJob.status === 'completed' || selectedJob.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : selectedJob.status === 'failed'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : selectedJob.status === 'cancelled'
                      ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse'
                  }`}
                >
                  {selectedJob.status.toUpperCase()}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                <span>İşlem: <b>{selectedJob.action || 'full_mod'}</b></span>
                <span>•</span>
                <span>Görev ID: <code className="text-slate-300">{selectedJob.id.substring(0, 8)}</code></span>
                {selectedJob.github_run_id && (
                  <>
                    <span>•</span>
                    <a
                      href={`https://github.com/simurgulgen/PrimeForge/actions/runs/${selectedJob.github_run_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                    >
                      Run #{selectedJob.github_run_id} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedJob.modded_apk_url && (
              <a
                href={selectedJob.modded_apk_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                Modlu APK İndir <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {(selectedJob.github_release_url || selectedJob.analysis_report?.github_release_url) && (
              <a
                href={selectedJob.github_release_url || selectedJob.analysis_report?.github_release_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Package className="w-3 h-3" />
                GitHub Release
              </a>
            )}
            <Link
              href="/jobs"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              İşler Sayfası
            </Link>
          </div>
        </div>
      )}

      {/* Visual Pipeline Stage Stepper */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" /> Pipeline Aşamaları
          </span>
          <span className="text-slate-400 text-[11px]">
            {activeStepFilter ? (
              <button
                type="button"
                onClick={() => setActiveStepFilter(null)}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Filtreyi Kaldır (Tüm Aşamalar)
              </button>
            ) : (
              'Aşamaya tıklayarak logları filtreleyin'
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {pipelineStages.map((stage, idx) => {
            const status = getStageStatus(stage);
            const isSelected = activeStepFilter === stage.id;

            let badgeColor = 'bg-slate-900/60 border-slate-800 text-slate-400';
            let icon = <Clock className="w-3.5 h-3.5 text-slate-500" />;

            if (status === 'completed') {
              badgeColor = 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300';
              icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
            } else if (status === 'in_progress') {
              badgeColor = 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 animate-pulse';
              icon = <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />;
            } else if (status === 'failed') {
              badgeColor = 'bg-rose-950/40 border-rose-500/50 text-rose-300';
              icon = <XCircle className="w-3.5 h-3.5 text-rose-400" />;
            }

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStepFilter(isSelected ? null : stage.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 select-none ${badgeColor} ${
                  isSelected ? 'ring-2 ring-cyan-500 shadow-md shadow-cyan-500/20' : 'hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">#{idx + 1}</span>
                  {icon}
                </div>
                <div>
                  <div className="text-xs font-bold text-white truncate">{stage.title}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{stage.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Terminal Log Viewer */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] overflow-hidden shadow-2xl flex flex-col font-mono text-xs">
        {/* Terminal Header Bar */}
        <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Mac/Linux Style Window Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium ml-2 select-none">
              runner@primeforge-ci: ~ /pipeline/engine.log
            </span>
          </div>

          {/* Controls: Search, Log Level Filter, Autoscroll */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Log ara..."
                className="pl-7 pr-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
              {(['all', 'step', 'error', 'warn'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLogFilter(mode)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                    logFilter === mode
                      ? mode === 'error'
                        ? 'bg-rose-600 text-white'
                        : 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'all'
                    ? 'Tümü'
                    : mode === 'step'
                    ? 'Adımlar'
                    : mode === 'error'
                    ? 'Hatalar'
                    : 'Uyarılar'}
                </button>
              ))}
            </div>

            {/* Autoscroll Toggle */}
            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                autoScroll
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Oto Kaydır: {autoScroll ? 'AÇIK' : 'KAPALI'}
            </button>

            {/* Clear Screen */}
            <button
              type="button"
              onClick={() => setRawLogs('')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Ekranı Temizle"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Screen Lines */}
        <div className="p-4 overflow-x-auto max-h-[620px] min-h-[420px] space-y-1 select-text bg-[#070a13]">
          {logLines.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <TerminalIcon className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">
                {searchQuery || logFilter !== 'all' || activeStepFilter
                  ? 'Belirtilen kriterlere uygun log kaydı bulunamadı.'
                  : 'Log bekleniyor...'}
              </p>
            </div>
          ) : (
            logLines.map((line, idx) => {
              // Syntax color highlights
              const isError =
                line.includes('error') ||
                line.includes('Error') ||
                line.includes('ERROR') ||
                line.includes('RuntimeError') ||
                line.includes('failed') ||
                line.includes('❌') ||
                line.includes('Exception');
              const isWarn = line.includes('warn') || line.includes('WARN') || line.includes('⚠️');
              const isSuccess = line.includes('✅') || line.includes('success') || line.includes('Clean');
              const isStep =
                line.includes('Step ') ||
                line.includes('📋') ||
                line.includes('🔧') ||
                line.includes('📦') ||
                line.includes('🔐') ||
                line.includes('🧹') ||
                line.includes('============================================================');
              const isInfo = line.includes('INFO') || line.includes('ℹ️') || line.includes('🛡️');

              let lineClass = 'text-slate-300';
              if (isError) lineClass = 'text-rose-400 font-bold bg-rose-950/20 px-1 rounded';
              else if (isWarn) lineClass = 'text-amber-300 bg-amber-950/15 px-1 rounded';
              else if (isSuccess) lineClass = 'text-emerald-300 font-semibold';
              else if (isStep) lineClass = 'text-cyan-300 font-bold';
              else if (isInfo) lineClass = 'text-blue-300';

              return (
                <div key={idx} className="flex items-start gap-3 hover:bg-white/[0.02] py-0.5 px-1 rounded leading-relaxed">
                  <span className="text-slate-600 select-none text-[10px] w-9 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className={`break-all whitespace-pre-wrap ${lineClass}`}>
                    {line}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer Bar */}
        <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>Toplam Satır: <b className="text-slate-200">{logLines.length}</b></span>
            {activeStepFilter && (
              <span className="text-cyan-400 font-semibold">
                Filtre: {pipelineStages.find((s) => s.id === activeStepFilter)?.title}
              </span>
            )}
            {searchQuery && (
              <span className="text-amber-300">
                Arama: &quot;{searchQuery}&quot;
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Encoding: UTF-8</span>
            <span>•</span>
            <span>Shell: Linux x86_64</span>
          </div>
        </div>
      </div>
    </div>
  );
}
