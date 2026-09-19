'use client';

import { useState } from 'react';
import {
  BookOpen,
  FileCode2,
  Check,
  Copy,
  X,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface GuideModalProps {
  app: {
    listing_id: string;
    title: string;
    packageName: string | null;
    current_version: string;
    latest_version: string;
    download_url: string;
    guide_name?: string;
  };
  guideContent?: string | null;
  profileYaml?: string | null;
  successCount?: number;
  onClose: () => void;
  onRunAutonomous?: (app: any) => void;
}

export default function GuideModal({
  app,
  guideContent,
  profileYaml,
  successCount = 1,
  onClose,
  onRunAutonomous,
}: GuideModalProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'yaml'>('guide');
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutonomousClick = async () => {
    if (onRunAutonomous) {
      setRunning(true);
      try {
        await onRunAutonomous(app);
      } finally {
        setRunning(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl border border-emerald-500/30 shadow-2xl flex flex-col bg-slate-900/95">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {app.title} — Modlama Rehberi
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Hazır Reçete
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {app.packageName || 'Paket'} • {successCount} kez başarıyla test edildi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 pb-2 border-b border-white/5 bg-slate-950/30 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Detaylı Rehber & Rapor
          </button>

          {profileYaml && (
            <button
              onClick={() => setActiveTab('yaml')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'yaml'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              YAML Yama Reçetesi
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {activeTab === 'guide' ? (
            guideContent ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5">
                  <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                    {guideContent}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-3 bg-slate-950/40 rounded-xl border border-white/5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-sm font-semibold text-white">Rehber Kayıtlı ve Kullanıma Hazır</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Bu uygulama için riskli izin filtreleri, reklam engellemeleri ve VIP smali baypas kuralları veritabanında saklanmaktadır. Bir sonraki kontrolde bu kurallar doğrudan otonom olarak yeni APK'ya aktarılacaktır.
                </p>
              </div>
            )
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">profiles/{app.packageName}.yml</span>
                <button
                  onClick={() => handleCopy(profileYaml || '')}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1.5 transition-colors border border-white/5"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {profileYaml}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Kapat
          </button>

          {onRunAutonomous && (
            <button
              onClick={handleAutonomousClick}
              disabled={running}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-300" />
              )}
              Rehberi Kullanarak Otonom Güncelle (v{app.latest_version})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
