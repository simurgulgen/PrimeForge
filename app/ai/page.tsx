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

Sağ üstteki **Model Ayarları** butonundan Claude, NVIDIA NIM, Gemini veya Groq modelleri arasında geçiş yapabilir, aşağıdaki hızlı butonları kullanabilir veya doğrudan bir soru sorabilirsiniz!`,
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

  // APK Context
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

  const handleSaveSettings = async () => {
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
                Multi-Model & Reverse Engineer
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

      {/* Quick Prompt Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Hızlı İstekler:
        </span>
        {[
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
            onClick={() => handleSend(item.prompt)}
            disabled={loading}
            className="px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-white transition-all shrink-0 shadow-sm"
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

                  <div className="whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-3xl">
              <div className="w-8 h-8 rounded-lg bg-purple-900/60 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl p-4 bg-slate-900/90 text-slate-300 border border-slate-800/80 rounded-tl-none flex items-center gap-3">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                <span className="text-xs font-medium text-slate-400">
                  {settings.model} modeli yanıt üretiyor...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800/80">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedJob
                  ? `${selectedJob.app_name || selectedJob.package_name} hakkında bir soru sor veya smali/izin analizi iste...`
                  : 'APK modlama, izin analizi, smali kodu veya Android TV hakkında bir soru sor... (Enter ile gönder)'
              }
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />

            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-40 transition-all shadow-lg shadow-purple-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span>Shift + Enter: Yeni satır</span>
              <span>•</span>
              <span>Enter: Gönder</span>
            </div>
            {selectedJob && (
              <span className="text-purple-400 font-mono">
                Aktif Bağlam: {selectedJob.app_name || selectedJob.package_name}
              </span>
            )}
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
                  <h2 className="text-base font-bold text-white">Yapay Zeka & Model Ayarları</h2>
                  <p className="text-xs text-slate-400">
                    Sunucu tarafında çalışacak model sağlayıcısını ve parametrelerini yapılandırın
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
              {/* Provider Selection */}
              <div>
                <label className="block font-semibold text-white mb-2">Sağlayıcı (Provider)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PROVIDER_CATALOG.map((prov) => {
                    const isKeySet = Boolean(
                      settings.keys?.[prov.id]?.trim() ||
                      (settings.provider === prov.id && settings.apiKey?.trim())
                    );
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
                          setTestStatus(null);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          settings.provider === prov.id
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{prov.name}</span>
                          {settings.provider === prov.id && (
                            <Check className="w-3.5 h-3.5 text-purple-400" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                          <span>{prov.badge}</span>
                          {isKeySet ? (
                            <span className="text-emerald-400 font-semibold">🔑 Kayıtlı</span>
                          ) : (
                            <span className="text-slate-500">Anahtar Yok</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model Dropdown */}
              <div>
                <label className="block font-semibold text-white mb-1.5">Model Seçimi</label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  {currentProviderInfo.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fallback Model Dropdown (FCC Fallback Routing) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-white flex items-center gap-1.5">
                    <span>Yedek Model (FCC Fallback Routing)</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Otomatik Kota Kurtarma
                    </span>
                  </label>
                </div>
                <select
                  value={settings.fallbackModel || ''}
                  onChange={(e) => setSettings({ ...settings, fallbackModel: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">Yedek Model Devre Dışı</option>
                  <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Ücretsiz & Ultra Hızlı)</option>
                  <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B (Yüksek Performans)</option>
                  <option value="nvidia/nemotron-3-super-120b-a12b">NVIDIA Nemotron 3 Super 120B</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  <option value="deepseek-chat">DeepSeek V3</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Free Claude Code mantığıyla; ana model hata verirse veya kotası biterse istek kesilmeden otomatik bu modele geçer.
                </p>
              </div>

              {/* API Key Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-white flex items-center gap-2">
                    <span>{currentProviderInfo.name} API Anahtarı</span>
                    {Boolean(settings.keys?.[settings.provider]?.trim() || settings.apiKey?.trim()) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        Aktif
                      </span>
                    )}
                  </label>
                  {currentProviderInfo.keyUrl && (
                    <a
                      href={currentProviderInfo.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <span>Ücretsiz Anahtar Al</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={settings.keys?.[settings.provider] || settings.apiKey || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSettings({
                        ...settings,
                        apiKey: val,
                        keys: {
                          ...(settings.keys || {}),
                          [settings.provider]: val,
                        },
                      });
                    }}
                    placeholder={currentProviderInfo.keyPlaceholder || 'API Anahtarınızı buraya girin...'}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 text-slate-400 hover:text-white transition-colors"
                    title={showKey ? 'Gizle' : 'Göster'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Her sağlayıcı için ayrı anahtar kaydedebilirsiniz. Anahtarlar güvenle saklanır ve sadece ilgili sağlayıcıya iletilir.
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
            <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
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
                  onClick={handleSaveSettings}
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
