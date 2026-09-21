import './globals.css';
import Link from 'next/link';
import { Wrench, Layers, FileCode2, Send, Activity, Store, Sparkles, Puzzle, Terminal, RefreshCw, ShieldCheck } from 'lucide-react';

import AiCopilotSidebar from '@/app/components/AiCopilotSidebar';
import PipelineActivityDrawer from '@/app/components/PipelineActivityDrawer';

export const metadata = {
  title: 'PrimeForge – APK Modlama & Test Pipeline',
  description: 'PrimeStore için sunucu taraflı otomatik APK modlama, test ve dağıtım yönetim merkezi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased selection:bg-blue-600 selection:text-white">
        <header className="sticky top-0 z-50 glass-panel border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
                    PrimeForge
                  </span>
                  <span className="text-xs text-blue-400 block -mt-1 font-mono">
                    CI/CD Engine
                  </span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  href="/"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-blue-400" />
                  Dashboard
                </Link>
                <Link
                  href="/security"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-emerald-300 hover:text-white hover:bg-emerald-500/10 border border-emerald-500/20 transition-all flex items-center gap-2 rounded-xl"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Güvenlik Konsolu
                </Link>
                <Link
                  href="/updates"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-amber-300 hover:text-white hover:bg-amber-500/10 border border-amber-500/20 transition-all flex items-center gap-2 rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  Güncellemeler
                </Link>
                <Link
                  href="/console"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-cyan-300 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20 transition-all flex items-center gap-2 rounded-xl"
                >
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Canlı Konsol
                </Link>
                <Link
                  href="/catalog"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-purple-400" />
                  PrimeStore Kataloğu
                </Link>
                <Link
                  href="/jobs"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  İşler & Kuyruk
                </Link>
                <Link
                  href="/profiles"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <FileCode2 className="w-4 h-4 text-amber-400" />
                  Profiller & Rehberler
                </Link>
                <Link
                  href="/patches"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Puzzle className="w-4 h-4 text-indigo-400" />
                  Yama Merkezi (Morphe)
                </Link>
                <Link
                  href="/ai"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-purple-300 hover:text-white hover:bg-purple-500/10 border border-purple-500/20 transition-all flex items-center gap-2 rounded-xl"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  AI Studio
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Bot & Pipeline Aktif
              </div>
              <a
                href="https://t.me/primeappstorebot"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                @primeappstorebot
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Persistent Left-Docked Pipeline Monitor (Live Steps & Logs) */}
        <PipelineActivityDrawer />

        {/* Persistent Right-Docked AI Copilot (FCC-Claude) */}
        <AiCopilotSidebar />
      </body>
    </html>
  );
}
