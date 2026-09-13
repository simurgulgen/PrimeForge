'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Settings2,
  Trash2,
  Bot,
  User,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Sliders,
  ShieldCheck,
  FileCode2,
  Tv,
  Store,
  ChevronDown,
  X,
  Zap,
  Info,
  Eye,
  EyeOff,
  Activity,
  Server,
  Power,
  RotateCw,
  Cpu,
} from 'lucide-react';
import {
  AIMessage,
  AISettings,
  DEFAULT_AI_SETTINGS,
  PROVIDER_CATALOG,
} from '@/lib/ai-service';

export default function AIStudioPage() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: `Merhaba! Ben **PrimeForge AI Studio** asistanınızım. 

Android APK'larının tersine mühendisliği, \`AndroidManifest.xml\` izin analizleri, smali yama reçeteleri, reklam/DRM kodlarının baypas edilmesi ve Android TV kumanda (DPAD) optimizasyonu konularında size yardımcı olabilirim.

Sağ üstteki **Model Ayarları** butonundan Claude, NVIDIA NIM, Gemini veya Groq modelleri arasında geçiş yapabilir, aşağıdaki **Sunucuyu Yeniden Başlat** butonunu veya hızlı istekleri kullanabilir veya doğrudan bir soru sorabilirsiniz!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; latencyMs?: number; error?: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showKey, setShowKey] = useState(false);

  // AI Server State
  const [serverState, setServerState] = useState<{
    status: 'online' | 'restarting' | 'standby' | 'error';
    uptimeFormatted: string;
    lastPingMs: number;
    activeModel: string;
    fallbackModel: string;
    serverType: string;
    lastRestartAt: string;
  } | null>(null);
  const [serverActionLoading, setServerActionLoading] = useState<string | null>(null);
  const [serverToast, setServerToast] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // APK Context
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchServerStatus = async () => {
    try {
      const res = await fetch('/api/ai/server');
      const data = await res.json();
      if (data.success && data.server) {
        setServerState(data.server);
      }
    } catch (_) {}
  };

  useEffect(() => {
    // Check URL search params for job_id
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlJobId = urlParams.get('job_id');
      if (urlJobId) {
        setSelectedJobId(urlJobId);
      }
    }

    // Load settings from local storage or backend
    const saved = localStorage.getItem('primeforge_ai_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_AI_SETTINGS, ...JSON.parse(saved) });
      } catch (_) {}
    } else {
      fetch('/api/ai/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.settings) setSettings(data.settings);
        })
        .catch(() => {});
    }

    // Load recent jobs for APK context
    fetch('/api/job-status?t=' + Date.now())
      .then((res) => res.json())
      .then((data) => {
        if (data.jobs) setRecentJobs(data.jobs);
      })
      .catch(() => {});

    // Initial server state fetch
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setServerToast({ type, text });
    setTimeout(() => setServerToast(null), 4000);
  };

  const handleRestartServer = async () => {
    setServerActionLoading('restart');
    showToast('info', '🔄 AI Sunucusu yeniden başlatılıyor, bağlantılar tazeleniyor...');

    try {
      const res = await fetch('/api/ai/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', initiatedBy: 'web_button' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', `✅ AI Sunucusu başarıyla yeniden başlatıldı! (${data.latencyMs} ms)`);
        await fetchServerStatus();
      } else {
        showToast('error', `⚠️ Yeniden başlatma uyarısı: ${data.error || 'Bilinmeyen hata'}`);
      }
    } catch (err: any) {
      showToast('error', `❌ Bağlantı hatası: ${err.message}`);
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleClearServerCache = async () => {
    setServerActionLoading('clear_cache');
    try {
      const res = await fetch('/api/ai/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_cache' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', '🧹 Yapay zeka oturumu ve önbellek sıfırlandı.');
        setMessages([]);
      } else {
        showToast('error', data.error || 'Önbellek temizlenemedi.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleHealthPing = async () => {
    setServerActionLoading('ping');
    try {
      const res = await fetch('/api/ai/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `⚡ Sağlık Testi: ${data.modelUsed} aktif (${data.latencyMs} ms)`);
        await fetchServerStatus();
      } else {
        showToast('error', `⚠️ Sağlık Testi Hatası: ${data.error}`);
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: AIMessage = { role: 'user', content: textToSend };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customPrompt) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          settings,
          job_id: selectedJobId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: data.text },
        ]);
        if (data.restarted) {
          fetchServerStatus();
          showToast('success', '🔄 AI Sunucusu komutunuzla yeniden başlatıldı!');
        }
      } else {
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: `⚠️ **Hata:** ${data.error || 'Yapay zeka yanıt oluşturamadı. Lütfen model ayarlarınızı kontrol edin.'}`,
          },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `❌ **Bağlantı Hatası:** ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveSettings = async (restartAfter: boolean = false) => {
    localStorage.setItem('primeforge_ai_settings', JSON.stringify(settings));
    setSaveMsg('Ayarlar kaydedildi!');
    setTimeout(() => setSaveMsg(null), 3000);

    // Save to server
    try {
      await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (restartAfter) {
        await handleRestartServer();
      } else {
        await fetchServerStatus();
      }
    } catch (_) {}
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      setTestStatus({
        loading: false,
        success: data.success,
        latencyMs: data.latencyMs,
        error: data.error,
      });
    } catch (err: any) {
      setTestStatus({ loading: false, success: false, error: err.message });
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentProviderInfo = PROVIDER_CATALOG.find((p) => p.id === settings.provider) || PROVIDER_CATALOG[2];
  const selectedJob = recentJobs.find((j) => j.id === selectedJobId);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {serverToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-medium backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-5 ${
            serverToast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : serverToast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200'
          }`}
        >
          {serverToast.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
          {serverToast.type === 'error' && <X className="w-4 h-4 text-rose-400" />}
          {serverToast.type === 'info' && <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />}
          <span>{serverToast.text}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              PrimeForge AI Studio
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-medium border border-purple-500/30">
                FCC Core v2.4
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Sunucu taraflı yapay zeka: APK izin denetimi, smali yama asistanı ve çoklu sağlayıcı
            </p>
          </div>
        </div>

        {/* Model Badge & Control Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Model Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">{currentProviderInfo.name}:</span>
            <span className="text-purple-300 font-mono font-semibold">{settings.model}</span>
          </div>

          {/* APK Context Selector */}
          <div className="relative">
            <button
              onClick={() => setContextDrawerOpen(!contextDrawerOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                selectedJobId
                  ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>{selectedJob ? (selectedJob.app_name || selectedJob.package_name) : 'APK Bağlamı Seç'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {contextDrawerOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl glass-panel border border-slate-700 shadow-2xl p-2 z-50 text-xs">
                <div className="font-semibold text-slate-300 px-2 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                  <span>İncelenecek APK</span>
                  {selectedJobId && (
                    <button
                      onClick={() => {
                        setSelectedJobId('');
                        setContextDrawerOpen(false);
                      }}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {recentJobs.length === 0 ? (
                    <div className="p-3 text-slate-500 text-center">Kayıtlı iş bulunamadı.</div>
                  ) : (
                    recentJobs.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => {
                          setSelectedJobId(j.id);
                          setContextDrawerOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between ${
                          selectedJobId === j.id ? 'bg-purple-600/30 text-white font-bold' : 'hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="truncate">
                          <div className="truncate font-medium">{j.app_name || j.package_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{j.package_name}</div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 font-mono shrink-0 ml-1">
                          {j.action}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Clear Chat Button */}
          <button
            onClick={() => setMessages([])}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700/60"
            title="Sohbeti Temizle"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Model Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all"
          >
            <Settings2 className="w-4 h-4" />
            Model Ayarları
          </button>
        </div>
      </div>

      {/* AI SERVER CONTROL BAR */}
      <div className="glass-panel rounded-2xl p-3 sm:p-4 border border-slate-800 bg-slate-950/70 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                serverActionLoading === 'restart'
                  ? 'bg-amber-400 animate-spin'
                  : serverState?.status === 'online' || !serverState
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-semibold text-white">
              {serverActionLoading === 'restart'
                ? 'Yeniden Başlatılıyor...'
                : 'AI Server: Çevrimiçi'}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Süre:</span>
              <strong className="text-slate-200">{serverState?.uptimeFormatted || 'Aktif'}</strong>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Gecikme:</span>
              <strong className="text-slate-200">{serverState?.lastPingMs || 180} ms</strong>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Yedek Rota:</span>
              <strong className="text-purple-300 font-mono">{settings.fallbackModel || 'gemini-1.5-flash'}</strong>
            </span>
          </div>
        </div>

        {/* Server Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Restart Server Button */}
          <button
            onClick={handleRestartServer}
            disabled={serverActionLoading !== null}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
              serverActionLoading === 'restart'
                ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/20'
            }`}
            title="Yapay zeka oturumunu, sağlayıcı bağlantılarını ve anahtarları tazeleyerek sunucuyu yeniden başlatır"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${serverActionLoading === 'restart' ? 'animate-spin' : ''}`}
            />
            <span>{serverActionLoading === 'restart' ? 'Başlatılıyor...' : 'Sunucuyu Yeniden Başlat'}</span>
          </button>

          {/* Health Ping Button */}
          <button
            onClick={handleHealthPing}
            disabled={serverActionLoading !== null}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
            title="Aktif modele ping göndererek tepki süresini test et"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Test</span>
          </button>

          {/* Clear Cache Button */}
          <button
            onClick={handleClearServerCache}
            disabled={serverActionLoading !== null}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-rose-400 text-xs font-medium flex items-center gap-1 transition-colors"
            title="Model önbelleğini ve sohbet oturumunu sıfırla"
          >
            <Trash2 className="w-3 h-3" />
            <span>Önbellek</span>
          </button>
        </div>
      </div>

      {/* Quick Prompt Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Hızlı İstekler:
        </span>
        {[
          {
            label: '🔄 Sunucuyu Yeniden Başlat',
            prompt: 'yapay zeka serverını yeniden başlat',
          },
          {
            label: '🛡️ APK İzin Risk Raporu',
            prompt: selectedJob
              ? `${selectedJob.app_name || selectedJob.package_name} uygulamasının izinlerini incele: hangi izinler ne amaçla istenmiş, gereksiz veya şüpheli olanlar hangileri ve hangilerini manifestten güvenle silebiliriz?`
              : 'Genel bir Android uygulamasındaki tehlikeli izinleri ve reklam takipçilerinin kullandığı izinleri listele.',
          },
          {
            label: '📺 TV Kumanda (DPAD) Rehberi',
            prompt: 'Android TV uygulamalarında kumanda (DPAD) yön tuşlarının odaklanmama (focus loss) sorununu smali ve XML layout seviyesinde nasıl çözerim?',
          },
          {
            label: '🧩 Reklam & DRM Smali Baypası',
            prompt: 'Android smali kodunda AdMob veya Google Play Billing lisans kontrolü yapan methodları nasıl tespit edip her zaman "true" dönecek şekilde baypas edebilirim? Örnek smali opcodeları ver.',
          },
          {
            label: '📜 Manifest Temizlik Reçetesi',
            prompt: 'PrimeForge sanitizer motoru için örnek bir manifest_cleaning YAML profili oluştur. Hangi receiver, service ve uses-permission etiketlerini temizlemeliyiz?',
          },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (item.label.includes('Yeniden Başlat')) {
                handleRestartServer();
              } else {
                handleSend(item.prompt);
              }
            }}
            disabled={loading}
            className={`px-3 py-1.5 rounded-full border transition-all shrink-0 shadow-sm flex items-center gap-1.5 ${
              item.label.includes('Yeniden Başlat')
                ? 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300 font-semibold'
                : 'bg-slate-900/80 hover:bg-purple-950/40 border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Chat Container */}
      <div className="glass-panel rounded-2xl border border-slate-800 flex flex-col h-[650px] shadow-2xl overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs ${
                    isUser
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-purple-900/60 border border-purple-500/40 text-purple-300 shadow-md shadow-purple-600/20'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed relative group ${
                    isUser
                      ? 'bg-blue-600/90 text-white rounded-tr-none'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800/80 rounded-tl-none shadow-lg'
                  }`}
                >
                  {/* Copy Button for Assistant */}
                  {!isUser && (
                    <button
                      onClick={() => copyToClipboard(msg.content, idx)}
                      className="absolute top-3 right-3 p-1 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      title="Kopyala"
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  {/* Render content */}
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-2xl">
              <div className="w-8 h-8 rounded-lg shrink-0 bg-purple-900/60 border border-purple-500/40 text-purple-300 flex items-center justify-center text-xs animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-slate-900/90 border border-slate-800 p-4 flex items-center gap-2 text-xs text-purple-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>PrimeForge AI yanıt hazırlıyor...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex flex-col gap-2">
          {selectedJob && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Aktif APK Bağlamı: <strong>{selectedJob.app_name || selectedJob.package_name}</strong></span>
              </span>
              <button
                onClick={() => setSelectedJobId('')}
                className="hover:text-white transition-colors text-[10px]"
              >
                Kaldır
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bir soru sorun veya smali/izin yaması isteyin... (Sunucuyu yeniden başlatmak için 'sunucuyu yeniden başlat' yazabilirsiniz)"
              className="flex-1 px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20 transition-all h-[50px]"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Gönder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Model Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-base font-bold text-white">Yapay Zeka & FCC Model Ayarları</h2>
                  <p className="text-xs text-slate-400">
                    NVIDIA NIM, Claude, Gemini, Groq sağlayıcıları ve sunucu denetimleri
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
              {/* SERVER MANAGEMENT BOX INSIDE SETTINGS */}
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white text-xs">AI Sunucu Durumu & Kontrolleri</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                    🟢 Çevrimiçi
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Çalışma Süresi</span>
                    <strong className="text-slate-200">{serverState?.uptimeFormatted || 'Aktif'}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Canlı Gecikme</span>
                    <strong className="text-slate-200">{serverState?.lastPingMs || 180} ms</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Aktif Model</span>
                    <strong className="text-purple-300 truncate block">{settings.model}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">FCC Yedek Rota</span>
                    <strong className="text-teal-300 truncate block">{settings.fallbackModel || 'Gemini 1.5'}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRestartServer}
                    disabled={serverActionLoading !== null}
                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${serverActionLoading === 'restart' ? 'animate-spin' : ''}`} />
                    <span>{serverActionLoading === 'restart' ? 'Başlatılıyor...' : 'Sunucuyu Yeniden Başlat'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearServerCache}
                    disabled={serverActionLoading !== null}
                    className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Önbelleği Boşalt</span>
                  </button>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block font-semibold text-white mb-2">Aktif Sağlayıcı (Provider)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROVIDER_CATALOG.map((prov) => {
                    const isSelected = settings.provider === prov.id;
                    const hasKey = Boolean(settings.keys?.[prov.id]);

                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => {
                          setSettings({
                            ...settings,
                            provider: prov.id as any,
                            model: prov.defaultModel,
                          });
                        }}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-xs text-white">{prov.name}</div>
                          {hasKey && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                              🔑 Kayıtlı
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-purple-300">{prov.badge}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model Selection for Active Provider */}
              <div>
                <label className="block font-semibold text-white mb-1.5">
                  Aktif Model ({currentProviderInfo.name})
                </label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                >
                  {currentProviderInfo.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* FCC Automatic Fallback Model */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-white flex items-center gap-1.5">
                    <span>FCC Otomatik Yedek Model (Fallback Model)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Kota Aşımı Koruması
                    </span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Ana model hata verdiğinde veya kotası bittiğinde isteği kesmeden otomatik devreye girer.
                </p>
                <select
                  value={settings.fallbackModel || 'gemini-1.5-flash'}
                  onChange={(e) => setSettings({ ...settings, fallbackModel: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-teal-300 text-xs focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (1M Context / Ücretsiz)</option>
                  <option value="hy3-free">OpenCode Zen HY3 Free (Tencent Hunyuan 3 / Ücretsiz)</option>
                  <option value="deepseek-v4-free">OpenCode Zen DeepSeek V4 Free (Yeni Nesil)</option>
                  <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B Versatile (Ultra Hızlı)</option>
                  <option value="nvidia/nemotron-3-super-120b-a12b">NVIDIA Nemotron 3 Super 120B</option>
                  <option value="claude-3-5-haiku-20241022">Anthropic Claude 3.5 Haiku</option>
                </select>
              </div>

              {/* API Key / Token Configuration for Selected Provider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-white">
                    {currentProviderInfo.name} {currentProviderInfo.id === 'opencodezen' ? 'API Token' : 'API Anahtarı'}
                  </label>
                  {currentProviderInfo.keyUrl && (
                    <a
                      href={currentProviderInfo.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                    >
                      {currentProviderInfo.id === 'opencodezen' ? 'Token Al' : 'Anahtar Al'} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={settings.keys?.[settings.provider] || ''}
                    onChange={(e) => {
                      const newKeys = { ...(settings.keys || {}) };
                      newKeys[settings.provider] = e.target.value;
                      setSettings({
                        ...settings,
                        keys: newKeys,
                        apiKey: e.target.value,
                      });
                    }}
                    placeholder={currentProviderInfo.keyPlaceholder || 'API anahtarınızı yapıştırın...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Anahtar Supabase veritabanına kaydedilir ve Vercel sunucusunda güvenle kullanılır.
                </p>
              </div>

              {/* Custom Endpoint URL if custom_openai */}
              {settings.provider === 'custom_openai' && (
                <div>
                  <label className="block font-semibold text-white mb-1.5">Base URL (Endpoint)</label>
                  <input
                    type="text"
                    value={settings.baseUrl || ''}
                    onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Temperature Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-white">Sıcaklık (Temperature): {settings.temperature}</label>
                  <span className="text-slate-500 text-[10px]">0 = Kesin & Tutarlı, 1 = Yaratıcı</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* System Prompt Presets */}
              <div>
                <label className="block font-semibold text-white mb-1.5">Sistem Talimatı (System Prompt)</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {[
                    {
                      label: 'Android & Smali Uzmanı',
                      prompt: 'Sen PrimeForge APK tersine mühendislik ve smali modlama uzmanısın. Kullanıcıya doğrudan uygulanabilir kod parçaları, baypas rehberleri ve izin analizleri sunarsın.',
                    },
                    {
                      label: 'TV & DPAD Optimizatörü',
                      prompt: 'Sen Android TV ve DPAD kumanda odaklama uzmanısın. Odak kaybı, menü yönlendirme ve büyük ekran televizyon uyumu için smali/layout çözümleri üretirsin.',
                    },
                    {
                      label: 'Genel Kod Asistanı',
                      prompt: 'Sen kıdemli bir yazılım mimarı ve kodlama asistanısın. Temiz, optimize ve profesyonel çözümler üretirsin.',
                    },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSettings({ ...settings, systemPrompt: p.prompt })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Test Status Banner */}
              {testStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    testStatus.loading
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : testStatus.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testStatus.loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    ) : testStatus.success ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {testStatus.loading
                        ? 'Model bağlantısı test ediliyor...'
                        : testStatus.success
                        ? `Bağlantı başarılı! (${testStatus.latencyMs} ms)`
                        : `Hata: ${testStatus.error}`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus?.loading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Bağlantıyı Test Et
              </button>

              <div className="flex items-center gap-2">
                {saveMsg && <span className="text-xs text-emerald-400 font-medium">{saveMsg}</span>}
                <button
                  type="button"
                  onClick={() => handleSaveSettings(true)}
                  disabled={serverActionLoading !== null}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Kaydet ve Yeniden Başlat
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings(false)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all"
                >
                  Ayarları Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
