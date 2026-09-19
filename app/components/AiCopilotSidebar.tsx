'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Check,
  Copy,
  RotateCw,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Zap,
  Terminal,
  FileCode2,
  AlertTriangle,
  Loader2,
  Maximize2,
  Minimize2,
  Split,
} from 'lucide-react';
import SmaliDiffViewer from '@/app/components/SmaliDiffViewer';
import { AISettings } from '@/lib/ai-service';

interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function AiCopilotSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'audit'>('chat');
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [copilotSettings, setCopilotSettings] = useState<AISettings | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: `Merhaba! Ben **FCC-Claude AI Copilot**. 

Ekranın sağında açık kalarak siz gezinirken kodları inceleyebilir, decompile edilen smali metotlarının **derleme öncesi hata ve çökme öngörülerini** çıkarabilir ve VIP baypas kodları üretebilirim.

Aşağıdaki hızlı butonları kullanabilir veya doğrudan incelemek istediğiniz smali metodunu yapıştırabilirsiniz!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Pre-flight audit tab states
  const [auditSmaliInput, setAuditSmaliInput] = useState('');
  const [auditTargetClass, setAuditTargetClass] = useState('');
  const [auditPatchType, setAuditPatchType] = useState('return_true');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  // Server state
  const [serverPing, setServerPing] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<'online' | 'standby' | 'error'>('online');
  const [restartingServer, setRestartingServer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore open state
    const savedOpen = localStorage.getItem('primeforge_ai_copilot_open');
    if (savedOpen === 'true') {
      setIsOpen(true);
    }

    // Ping AI Server & Load Settings
    const checkServer = async () => {
      try {
        const start = Date.now();
        const [serverRes, settingsRes] = await Promise.all([
          fetch('/api/ai/server'),
          fetch('/api/ai/settings'),
        ]);
        const data = await serverRes.json();
        const settingsData = await settingsRes.json();
        setServerPing(Date.now() - start);
        if (data.success) {
          setServerStatus('online');
        } else {
          setServerStatus('standby');
        }
        if (settingsData?.settings) {
          setCopilotSettings(settingsData.settings);
        }
      } catch (_) {
        setServerStatus('error');
      }
    };

    checkServer();
  }, []);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem('primeforge_ai_copilot_open', String(next));
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const newMessages: AIMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          settings: copilotSettings || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ Hata: ${data.error || 'AI sunucusundan cevap alınamadı.'}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Bağlantı hatası: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartServer = async () => {
    setRestartingServer(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'yapay zeka sunucusunu yeniden başlat' }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.text || '🔄 FCC Sunucusu başarıyla yeniden başlatıldı!' },
        ]);
        setServerStatus('online');
      }
    } catch (_) {
    } finally {
      setRestartingServer(false);
    }
  };

  const handleRunAudit = async () => {
    if (!auditSmaliInput.trim() || auditLoading) return;
    setAuditLoading(true);
    setAuditResult(null);

    try {
      const res = await fetch('/api/ai/smali-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smali_code: auditSmaliInput,
          patch_def: {
            target_class: auditTargetClass || 'TargetClass',
            patch_type: auditPatchType,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.audit) {
        setAuditResult(data.audit);
      } else {
        setAuditResult({
          safe_to_compile: false,
          risk_level: 'HIGH',
          explanation: data.error || 'Denetim başarısız oldu.',
          issues: ['API yanıt veremedi.'],
        });
      }
    } catch (err: any) {
      setAuditResult({
        safe_to_compile: false,
        risk_level: 'HIGH',
        explanation: err.message,
        issues: ['Bağlantı hatası.'],
      });
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button when Closed */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="fixed right-4 bottom-6 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white text-xs font-semibold shadow-2xl shadow-purple-600/40 hover:scale-105 transition-all flex items-center gap-2.5 border border-purple-400/30 group animate-pulse"
          title="FCC-Claude AI Copilot Panelini Aç"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <Bot className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
          <span className="tracking-wide">FCC-Claude Copilot</span>
          <ChevronLeft className="w-3.5 h-3.5 opacity-70" />
        </button>
      )}

      {/* Persistent Docked Sidebar when Open */}
      {isOpen && (
        <div className="fixed right-0 top-16 bottom-0 w-[420px] max-w-[95vw] z-40 bg-slate-950/95 backdrop-blur-2xl border-l border-purple-500/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white tracking-wide">FCC-Claude Copilot</h4>
                  <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {serverStatus === 'online' ? 'Online' : 'Standby'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {copilotSettings?.model || 'Gemini 3.6 Flash'} {serverPing ? `• ${serverPing}ms` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleRestartServer}
                disabled={restartingServer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="AI Sunucusunu Yeniden Başlat"
              >
                <RotateCw className={`w-3.5 h-3.5 text-amber-400 ${restartingServer ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={toggleOpen}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Paneli Gizle"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="p-2 border-b border-white/5 bg-slate-950/40 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Canlı Araştırma
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Smali Pre-Flight
            </button>
          </div>

          {/* Body Content */}
          {activeTab === 'chat' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Quick Action Chips */}
              <div className="p-2.5 border-b border-white/5 bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto text-[10px]">
                <button
                  onClick={() => handleSend('Decompile edilen bu APK kodlarında anti-mod veya güvenlik kontrolleri nerede saklanır?')}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white whitespace-nowrap transition-all border border-white/5"
                >
                  🔍 Anti-Mod Bul
                </button>
                <button
                  onClick={() => handleSend('Google Play Billing v5/v6 isPurchased baypas smali reçetesi yazar mısın?')}
                  className="px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 whitespace-nowrap transition-all border border-amber-500/20"
                >
                  🔓 VIP Smali Yaz
                </button>
                <button
                  onClick={() => handleSend('Apktool derleme hatası ve .locals VerifyError uyuşmazlığı nasıl önlenir?')}
                  className="px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 whitespace-nowrap transition-all border border-purple-500/20"
                >
                  🛡️ Çökme Önle
                </button>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 ${
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {m.role !== 'user' && (
                      <div className="w-6 h-6 rounded bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-xl p-3 leading-relaxed relative group ${
                        m.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none shadow-md'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                      {m.role !== 'user' && (
                        <button
                          onClick={() => handleCopy(m.content, idx)}
                          className="absolute top-2 right-2 p-1 rounded bg-black/40 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Kopyala"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {m.role === 'user' && (
                      <div className="w-6 h-6 rounded bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>FCC-Claude smali kodlarını araştırıyor...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-3 border-t border-white/10 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Soru sorun veya araştırılacak smali kodunu yapıştırın..."
                    className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none max-h-24 h-11"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className="p-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow-lg shadow-purple-600/20 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Pre-Flight Audit Tab */
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-white mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Derleme Öncesi Hata Öngörüsü
                </div>
                Buraya yamalamak istediğiniz smali metodunu yapıştırın. FCC-Claude register (.locals) uyuşmazlığını, dönüş tipi doğruluğunu ve çökme risklerini derleme öncesinde analiz eder.
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Hedef Sınıf Adı</label>
                <input
                  type="text"
                  placeholder="Örn: com.medya.warstv.MainActivity"
                  value={auditTargetClass}
                  onChange={(e) => setAuditTargetClass(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Uygulanacak Yama Türü</label>
                <select
                  value={auditPatchType}
                  onChange={(e) => setAuditPatchType(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="return_true">return_true (const/4 v0, 0x1 & return v0)</option>
                  <option value="return_false">return_false (const/4 v0, 0x0 & return v0)</option>
                  <option value="return_void">return_void (return-void)</option>
                  <option value="return_boolean_object_true">return_boolean_object_true (Boolean.TRUE)</option>
                  <option value="empty_list">empty_list (CollectionsKt.emptyList)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Smali Metot Kodu</label>
                <textarea
                  rows={6}
                  placeholder={`.method public isPremiumUser()Z\n    .locals 0\n    const/4 v0, 0x0\n    return v0\n.end method`}
                  value={auditSmaliInput}
                  onChange={(e) => setAuditSmaliInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-emerald-400 font-mono placeholder-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={handleRunAudit}
                disabled={!auditSmaliInput.trim() || auditLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {auditLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-300" />
                )}
                Derleme Öncesi Hatasızlık Testi Yap
              </button>

              {/* Audit Results Card */}
              {auditResult && (
                <div
                  className={`p-3.5 rounded-xl border space-y-2 mt-4 transition-all ${
                    auditResult.safe_to_compile
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white">
                      {auditResult.safe_to_compile ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>
                        {auditResult.safe_to_compile ? 'Derleme İçin Güvenli' : 'Derleme Hatası Riski Var!'}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        auditResult.risk_level === 'LOW'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      Risk: {auditResult.risk_level || 'LOW'}
                    </span>
                  </div>

                  <div className="text-[11px] leading-relaxed">{auditResult.explanation}</div>

                  {auditResult.autocorrected_patch && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-white/10 font-mono text-[10px] text-slate-300">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 font-bold">
                        Otomatik Düzeltilmiş Güvenli Yama:
                      </div>
                      <pre className="text-emerald-400 whitespace-pre-wrap">
                        {JSON.stringify(auditResult.autocorrected_patch, null, 2)}
                      </pre>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setDiffModalOpen(true)}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <Split className="w-3.5 h-3.5 text-purple-300" /> Görsel Smali Diff Karşılaştır
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visual Smali Diff Viewer Modal */}
      <SmaliDiffViewer
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        title={`${auditTargetClass || 'Metot'} Smali Karşılaştırması`}
        originalCode={auditSmaliInput}
        modifiedCode={
          auditResult?.autocorrected_patch
            ? `# PrimeForge AI Autocorrected Smali Output\n# Type: ${auditResult.autocorrected_patch.patch_type}\n.method public ${auditResult.autocorrected_patch.method || 'targetMethod'}()Z\n    .locals ${auditResult.autocorrected_patch.locals_count || 1}\n\n    const/4 v0, 0x1\n    return v0\n.end method`
            : auditSmaliInput
        }
      />
    </>
  );
}
