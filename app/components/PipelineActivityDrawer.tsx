'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCw,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Terminal,
  Play,
  Copy,
  Check,
  Zap,
  Sparkles,
  Bot,
  RefreshCw,
  Loader2,
  Cpu,
  Cloud,
} from 'lucide-react';

interface JobItem {
  id: string;
  package_name: string | null;
  app_name: string | null;
  version_name: string | null;
  status: 'pending' | 'in_progress' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_decision' | 'waiting_approval' | string;
  action: string;
  created_at: string;
  error_message?: string | null;
  github_run_id?: string | null;
  analysis_report?: any;
  modded_apk_url?: string | null;
  runner_type?: string | null;
}

interface StepItem {
  number: number;
  title: string;
  desc: string;
  status: 'completed' | 'in_progress' | 'failed' | 'pending' | 'skipped';
  detail?: string;
}

export default function PipelineActivityDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const [logs, setLogs] = useState<string>('');
  const [runInfo, setRunInfo] = useState<any>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Listen for global job start events from updates page, modals, dropzone
  useEffect(() => {
    const handleJobStarted = (e: any) => {
      if (e.detail?.jobId) {
        setSelectedJobId(e.detail.jobId);
        setIsOpen(true);
        // Reset old logs and runInfo from previous runs so old errors are not displayed
        setLogs('');
        setRunInfo(null);
        fetchJobsAndDetails(e.detail.jobId);
      }
    };

    const handleOpenPipeline = (e: any) => {
      setIsOpen(true);
      if (e.detail?.jobId) {
        setSelectedJobId(e.detail.jobId);
        fetchJobsAndDetails(e.detail.jobId);
      }
    };

    window.addEventListener('primeforge:job_started', handleJobStarted);
    window.addEventListener('primeforge:open_pipeline', handleOpenPipeline);

    return () => {
      window.removeEventListener('primeforge:job_started', handleJobStarted);
      window.removeEventListener('primeforge:open_pipeline', handleOpenPipeline);
    };
  }, []);

  // Fetch jobs & selected job details
  const fetchJobsAndDetails = async (jobIdToSelect?: string) => {
    setLoading(true);
    try {
      const activeId = jobIdToSelect || selectedJobId;
      const url = activeId ? `/api/console?jobId=${activeId}` : '/api/console';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (data.allJobs) setJobs(data.allJobs);
        if (data.selectedJob) {
          setSelectedJobId(data.selectedJob.id);
        } else if (!selectedJobId && data.allJobs?.[0]) {
          setSelectedJobId(data.allJobs[0].id);
        }
        setLogs(data.logs || '');
        setRunInfo(data.runInfo || null);
      }
    } catch (err) {
      console.error('Pipeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchJobsAndDetails();
  }, []);

  // Auto-polling interval
  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(() => {
      fetchJobsAndDetails();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoPoll, selectedJobId]);

  // Auto scroll logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchJobsAndDetails();
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0] || null;

  // Derive high-level 6 stages
  const derivePipelineSteps = (job: JobItem | null, runInfoData: any): StepItem[] => {
    if (!job) return [];

    const defaultSteps: StepItem[] = [
      {
        number: 1,
        title: 'APK İndirme & Doğrulama',
        desc: 'APK dosyası çekiliyor ve SHA-256 hash doğrulanıyor.',
        status: 'pending',
      },
      {
        number: 2,
        title: 'Decompile & İzin Temizliği',
        desc: 'Manifest ayrıştırılıyor, tehlikeli izinler ve reklam izinleri ayıklanıyor.',
        status: 'pending',
      },
      {
        number: 3,
        title: 'Smali Yamalama & AI Hook',
        desc: 'Universal Ad-Blocker hook, TV DPAD ve profil yamaları uygulanıyor.',
        status: 'pending',
      },
      {
        number: 4,
        title: 'Recompile & Keystore İmza',
        desc: 'Apktool yeniden paketleme, Zipalign hizalama ve V1-V3 imzalama.',
        status: 'pending',
      },
      {
        number: 5,
        title: 'Emülatör Çökme Testi',
        desc: 'Android x86 emülatörde 15 saniye smoke test & ekran görüntüleri.',
        status: 'pending',
      },
      {
        number: 6,
        title: 'Dağıtım & Telegram Onayı',
        desc: 'Catbox/GitHub Releases yüklemesi, Supabase kaydı ve bildirim.',
        status: 'pending',
      },
    ];

    // If GitHub actions steps are available
    if (runInfoData?.job?.steps) {
      const ghSteps = runInfoData.job.steps;

      const mapGhStepStatus = (stepNameKeyword: string): StepItem['status'] => {
        const found = ghSteps.find((s: any) =>
          s.name.toLowerCase().includes(stepNameKeyword.toLowerCase())
        );
        if (!found) return 'pending';
        if (found.conclusion === 'skipped') return 'skipped';
        if (found.conclusion === 'cancelled') return 'pending';
        if (found.status === 'in_progress') return 'in_progress';
        if (found.status === 'completed') {
          return found.conclusion === 'success' ? 'completed' : 'failed';
        }
        return 'pending';
      };

      // Check overall conclusion
      const isFailedOverall =
        job.status === 'failed' || runInfoData.conclusion === 'failure';

      // 1. Download
      const dlStatus = mapGhStepStatus('Download Target APK');
      defaultSteps[0].status = dlStatus !== 'pending' ? dlStatus : (isFailedOverall ? 'failed' : 'in_progress');

      // 2. Setup & Decompile / Engine
      const engineStatus = mapGhStepStatus('Run PrimeForge Engine');
      const sdkStatus = mapGhStepStatus('Android SDK');

      if (sdkStatus === 'failed') {
        defaultSteps[0].status = 'failed';
        defaultSteps[0].detail = 'Android SDK yapılandırması başarısız oldu.';
      } else if (engineStatus === 'completed') {
        defaultSteps[0].status = 'completed';
        defaultSteps[1].status = 'completed';
        defaultSteps[2].status = 'completed';
        defaultSteps[3].status = 'completed';
      } else if (engineStatus === 'in_progress') {
        defaultSteps[0].status = 'completed';
        defaultSteps[1].status = 'in_progress';
        defaultSteps[2].status = 'pending';
      } else if (engineStatus === 'failed') {
        defaultSteps[0].status = 'completed';
        defaultSteps[1].status = 'failed';
        defaultSteps[1].detail = job.error_message || 'Motor yürütme sırasında hata oluştu.';
      }

      // 5. Emulator
      const emuStatus = mapGhStepStatus('Android Emulator Test');
      if (emuStatus !== 'pending') defaultSteps[4].status = emuStatus;

      // 6. Publish
      const pubStatus = mapGhStepStatus('Post-test Catbox Publish');
      if (pubStatus !== 'pending') defaultSteps[5].status = pubStatus;

      return defaultSteps;
    }

    // Status-based fallback
    if (job.status === 'completed') {
      return defaultSteps.map((s) => ({ ...s, status: 'completed' }));
    }

    if (job.status === 'waiting_approval') {
      defaultSteps[0].status = 'completed';
      defaultSteps[1].status = 'completed';
      defaultSteps[2].status = 'completed';
      defaultSteps[3].status = 'completed';
      defaultSteps[5].status = 'completed';
      defaultSteps[5].detail = 'Yayınlandı. Telegram onayınız bekleniyor.';
      return defaultSteps;
    }

    if (job.status === 'waiting_decision') {
      defaultSteps[0].status = 'completed';
      defaultSteps[1].status = 'completed';
      defaultSteps[2].status = 'in_progress';
      defaultSteps[2].detail = 'Telegram üzerinden modlama kararı bekleniyor.';
      defaultSteps[4].status = 'skipped';
      defaultSteps[5].status = 'pending';
      return defaultSteps;
    }

    if (job.status === 'failed') {
      defaultSteps[0].status = 'completed';
      defaultSteps[1].status = 'failed';
      defaultSteps[1].detail = job.error_message || 'İşlem başarısız oldu.';
      return defaultSteps;
    }

    if (job.status === 'in_progress' || job.status === 'running') {
      defaultSteps[0].status = 'completed';
      defaultSteps[1].status = 'in_progress';
      return defaultSteps;
    }

    return defaultSteps;
  };

  const steps = derivePipelineSteps(selectedJob, runInfo);

  // Count active jobs
  const activeJobsCount = jobs.filter(
    (j) => j.status === 'in_progress' || j.status === 'running' || j.status === 'pending'
  ).length;

  const failedJobsCount = jobs.filter((j) => j.status === 'failed').length;

  // Send failure message to AI Copilot
  const handleAskAIAboutFailure = (errorText: string) => {
    const prompt = `Aşağıdaki PrimeForge modlama / derleme hatasını teşhis et ve çözüm öner:\n\nUygulama: ${selectedJob?.app_name} (${selectedJob?.package_name})\nHata Detayı: ${errorText}\n\nSon Konsol Logları:\n${logs.slice(-800)}`;
    window.dispatchEvent(
      new CustomEvent('primeforge:ask_ai', {
        detail: { message: prompt },
      })
    );
  };

  return (
    <>
      {/* Floating Left Trigger Button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className={`fixed left-4 bottom-6 z-40 px-4 py-2.5 rounded-full text-white text-xs font-semibold shadow-2xl transition-all flex items-center gap-2.5 border group hover:scale-105 ${
            activeJobsCount > 0
              ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 border-cyan-400/40 shadow-cyan-500/30 animate-pulse'
              : failedJobsCount > 0
              ? 'bg-gradient-to-r from-rose-600 to-red-600 border-rose-400/40 shadow-rose-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 border-white/10 shadow-black/50 text-slate-200'
          }`}
          title="Canlı İşlem ve Pipeline Monitörünü Aç"
        >
          {activeJobsCount > 0 ? (
            <Loader2 className="w-4 h-4 text-cyan-200 animate-spin" />
          ) : failedJobsCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-amber-300" />
          ) : (
            <Activity className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
          )}

          <span className="tracking-wide font-medium">
            {activeJobsCount > 0
              ? `⚡ Pipeline Çalışıyor (${activeJobsCount})`
              : failedJobsCount > 0
              ? `⚠️ ${failedJobsCount} Hata Var`
              : 'Canlı Pipeline Monitörü'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
        </button>
      )}

      {/* Left Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed left-0 top-16 bottom-0 w-[490px] max-w-[95vw] z-40 bg-slate-950/95 backdrop-blur-2xl border-r border-cyan-500/20 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 bg-slate-900/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Canlı Pipeline Monitörü
                  </h4>
                  {activeJobsCount > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-mono text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {activeJobsCount} Aktif
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Aşama aşama APK modlama, test ve log akışı
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchJobsAndDetails()}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Yenile"
              >
                <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={toggleOpen}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Paneli Gizle"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Job List Selector Dropdown / Scrollbar */}
          {jobs.length > 0 && (
            <div className="p-2.5 border-b border-white/5 bg-slate-950/40">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-1">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
                  İşlemdeki Görevler ({jobs.length})
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {selectedJob?.runner_type === 'local' ? '🖥️ Yerel Runner' : '☁️ Cloud Runner'}
                </span>
              </div>
              <select
                value={selectedJobId || ''}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  fetchJobsAndDetails(e.target.value);
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {jobs.map((job) => {
                  const statusIcon =
                    job.status === 'completed'
                      ? '✅'
                      : job.status === 'failed'
                      ? '❌'
                      : job.status === 'in_progress' || job.status === 'running'
                      ? '⏳'
                      : '⚪';
                  return (
                    <option key={job.id} value={job.id}>
                      {statusIcon} {job.app_name || job.package_name || 'Bilinmeyen Uygulama'} (
                      {job.version_name || 'Sürüm yok'}) – {job.action}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Main Content: Steps & Live Terminal */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedJob ? (
              <>
                {/* Active Job Card */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {selectedJob.app_name || selectedJob.package_name}
                      </h4>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {selectedJob.package_name || 'Paket adı yok'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        selectedJob.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : selectedJob.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse'
                      }`}
                    >
                      {selectedJob.status === 'completed'
                        ? 'Tamamlandı'
                        : selectedJob.status === 'failed'
                        ? 'Başarısız Oldu'
                        : 'İşleniyor'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="font-mono text-cyan-300">
                      v{selectedJob.version_name || 'Güncel'}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{selectedJob.action}</span>
                    <span>•</span>
                    <span className="text-[10px]">
                      {new Date(selectedJob.created_at).toLocaleTimeString('tr-TR')}
                    </span>
                  </div>
                </div>

                {/* Failure Banner with Instant AI Diagnostic Button */}
                {selectedJob.status === 'failed' && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 font-bold text-rose-300">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>İşlem Başarısız Oldu!</span>
                    </div>
                    <div className="text-[11px] text-rose-200/90 leading-relaxed font-mono bg-black/40 p-2 rounded-lg border border-rose-500/20">
                      {selectedJob.error_message || 'Bilinmeyen derleme veya çalıştırma hatası.'}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() =>
                          handleAskAIAboutFailure(
                            selectedJob.error_message || 'Derleme başarısız oldu'
                          )
                        }
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 transition-all"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        FCC-Claude AI ile Teşhis Et
                      </button>
                      <a
                        href="/console"
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-white/10 flex items-center gap-1"
                      >
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        Detaylı Konsol
                      </a>
                    </div>
                  </div>
                )}

                {/* 6-Step Visual Pipeline Tracker */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-3">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Aşama Aşama İlerleme Durumu</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {steps.filter((s) => s.status === 'completed').length} / {steps.length} Tamamlandı
                    </span>
                  </div>

                  <div className="space-y-2">
                    {steps.map((step) => {
                      const isDone = step.status === 'completed';
                      const isWorking = step.status === 'in_progress';
                      const isError = step.status === 'failed';
                      const isSkipped = step.status === 'skipped';

                      return (
                        <div
                          key={step.number}
                          className={`p-2.5 rounded-xl border transition-all flex items-start gap-3 ${
                            isDone
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                              : isWorking
                              ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-100 shadow-lg shadow-cyan-500/10'
                              : isError
                              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                              : isSkipped
                              ? 'bg-slate-950/20 border-white/5 text-slate-500 opacity-60'
                              : 'bg-slate-950/30 border-white/5 text-slate-400'
                          }`}
                        >
                          {/* Step Icon */}
                          <div className="mt-0.5">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : isWorking ? (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                            ) : isError ? (
                              <XCircle className="w-4 h-4 text-rose-400" />
                            ) : isSkipped ? (
                              <div className="w-4 h-4 rounded-full border border-dashed border-slate-600 flex items-center justify-center text-[9px] font-mono text-slate-500">
                                -
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] font-mono text-slate-500">
                                {step.number}
                              </div>
                            )}
                          </div>

                          {/* Step Text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5
                                className={`text-xs font-semibold ${
                                  isDone
                                    ? 'text-emerald-300'
                                    : isWorking
                                    ? 'text-cyan-300 font-bold'
                                    : isError
                                    ? 'text-rose-300 font-bold'
                                    : isSkipped
                                    ? 'text-slate-500 line-through'
                                    : 'text-slate-300'
                                }`}
                              >
                                {step.number}. {step.title}
                              </h5>
                              <span className="text-[10px] font-mono">
                                {isDone
                                  ? 'Tamamlandı'
                                  : isWorking
                                  ? 'İşleniyor...'
                                  : isError
                                  ? 'Hata'
                                  : isSkipped
                                  ? 'Atlandı'
                                  : 'Sırada'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              {step.desc}
                            </p>
                            {step.detail && (
                              <div className="text-[10px] font-mono text-rose-300 mt-1 bg-rose-950/60 p-1.5 rounded border border-rose-500/20">
                                {step.detail}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Terminal Log Stream */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Canlı Log Akışı</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      <label className="flex items-center gap-1 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                          className="rounded bg-slate-900 border-white/20 text-cyan-500"
                        />
                        Oto Kaydır
                      </label>
                      <button
                        onClick={handleCopyLogs}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
                        title="Logları Kopyala"
                      >
                        {copiedLogs ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 font-mono text-[11px] text-emerald-400 h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {logs || 'Henüz log akışı başlamadı...'}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs">
                Aktif veya kayıtlı bir pipeline görevi bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
