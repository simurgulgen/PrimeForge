'use client';

import { useState } from 'react';
import { X, Copy, Check, FileCode, Split, AlignLeft } from 'lucide-react';

interface SmaliDiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  originalCode: string;
  modifiedCode: string;
}

export default function SmaliDiffViewer({
  isOpen,
  onClose,
  title = 'Smali Karşılaştırıcı (Diff Viewer)',
  originalCode,
  modifiedCode,
}: SmaliDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(modifiedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const origLines = originalCode.split('\n');
  const modLines = modifiedCode.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-purple-500/30 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>
              <p className="text-xs text-slate-400 font-mono">Smali Opcode & Register Değişiklik İncelemesi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
                  viewMode === 'split' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Split className="w-3.5 h-3.5" /> Yan Yana (Split)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
                  viewMode === 'unified' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" /> Birleşik (Unified)
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-xs font-medium"
              title="Değiştirilmiş Kodu Kopyala"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diff Content Area */}
        <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed bg-slate-950/60">
          {viewMode === 'split' ? (
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Left: Original */}
              <div className="border border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-900/40">
                <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-rose-400 flex items-center justify-between">
                  <span>Orijinal / Önceki Sürüm</span>
                  <span className="text-slate-500">{origLines.length} satır</span>
                </div>
                <div className="flex-1 overflow-auto p-3 text-slate-300">
                  {origLines.map((line, i) => (
                    <div key={i} className="flex gap-3 hover:bg-slate-800/40 py-0.5">
                      <span className="w-8 text-right text-slate-600 select-none text-[10px]">{i + 1}</span>
                      <pre className="whitespace-pre-wrap">{line || ' '}</pre>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Modified */}
              <div className="border border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-900/40">
                <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-emerald-400 flex items-center justify-between">
                  <span>Yamalanmış / Yeni Sürüm</span>
                  <span className="text-slate-500">{modLines.length} satır</span>
                </div>
                <div className="flex-1 overflow-auto p-3 text-slate-300">
                  {modLines.map((line, i) => (
                    <div key={i} className="flex gap-3 hover:bg-slate-800/40 py-0.5">
                      <span className="w-8 text-right text-slate-600 select-none text-[10px]">{i + 1}</span>
                      <pre className="whitespace-pre-wrap">{line || ' '}</pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Unified Mode */
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 p-4">
              {modLines.map((line, i) => {
                const isNew = !origLines.includes(line);
                return (
                  <div
                    key={i}
                    className={`flex gap-3 py-0.5 px-2 rounded ${
                      isNew ? 'bg-emerald-950/40 text-emerald-300' : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="w-8 text-right text-slate-600 select-none text-[10px]">{i + 1}</span>
                    <span className="select-none text-slate-500 w-3">{isNew ? '+' : ' '}</span>
                    <pre className="whitespace-pre-wrap">{line || ' '}</pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
