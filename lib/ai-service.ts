// lib/ai-service.ts
// Multi-provider AI service supporting Claude, NVIDIA NIM, Gemini, Groq, DeepSeek, OpenCode Zen, and Custom

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AISettings {
  provider: 'anthropic' | 'nvidia_nim' | 'gemini' | 'groq' | 'deepseek' | 'opencodezen' | 'custom_openai';
  model: string;
  fallbackModel?: string;
  keys?: Record<string, string>;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export const MANDATORY_TURKISH_INSTRUCTION = `[KATI VE ZORUNLU DİL KURALI: %100 TÜRKÇE CEVAP]
Kullanıcı ile HER ZAMAN ve İSTİSNASIZ TÜRKÇE konuşacaksın.
Teknik smali opcodeları, Java kod blokları veya AndroidManifest XML etiketleri haricinde; tüm açıklamaların, analizlerin, soru yanıtların ve rehberlerin daima akıcı, net, profesyonel ve eksiksiz Türkçe olacaktır.
Kullanıcı başka bir dilde yazsa veya analiz edilen APK yabancı dilde olsa dahi cevabını daima TÜRKÇE olarak vereceksin.`;

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'nvidia_nim',
  model: 'nvidia/nemotron-3-super-120b-a12b',
  fallbackModel: 'gemini-1.5-flash',
  keys: {},
  temperature: 0.4,
  maxTokens: 3000,
  systemPrompt: `Sen PrimeForge'un Kıdemli Android Güvenlik, Tersine Mühendislik ve Smali Kodlama Asistanısın.
Kullanıcıya APK analizi, AndroidManifest.xml izin denetimleri, smali baypas yamaları, reklam/DRM temizliği ve Android TV DPAD optimizasyonu konularında net, uygulanabilir, profesyonel Türkçe kod ve rehberler sunarsın.

${MANDATORY_TURKISH_INSTRUCTION}`,
};

export const PROVIDER_CATALOG = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Akıllı Kodlama & Analiz',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Tavsiye Edilen)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Ultra Hızlı)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Derin Mantık)' },
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'nvidia_nim',
    name: 'NVIDIA NIM (Free Claude Code)',
    badge: 'FCC Ücretsiz Kota (120B+)',
    models: [
      { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'NVIDIA Nemotron 3 Super 120B' },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (NVIDIA)' },
      { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B Instruct' },
    ],
    defaultModel: 'nvidia/nemotron-3-super-120b-a12b',
    keyPlaceholder: 'nvapi-...',
    keyUrl: 'https://build.nvidia.com/settings/api-keys',
  },
  {
    id: 'opencodezen',
    name: 'OpenCode Zen',
    badge: 'HY3 Free & DeepSeek V4 Free',
    models: [
      { id: 'hy3-free', name: 'HY3 Free (Tencent Hunyuan 3 - Hızlı & Ücretsiz)' },
      { id: 'deepseek-v4-free', name: 'DeepSeek V4 Free (Yeni Nesil Derin Akıl Yürütme)' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex (OpenCode Zen)' },
      { id: 'minimax-m2.7', name: 'MiniMax M2.7 (OpenCode)' },
    ],
    defaultModel: 'hy3-free',
    keyPlaceholder: 'opencode_zen_... veya OpenCode API token',
    keyUrl: 'https://opencode.ai/auth',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: '100% Ücretsiz Tier (1M Context)',
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (En Güncel / Tavsiye Edilen)' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Gelişmiş Akıl Yürütme)' },
    ],
    defaultModel: 'gemini-3.6-flash',
    keyPlaceholder: 'AQ... veya AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Ultra Yüksek Hız (300+ tps / Ücretsiz)',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k Context)' },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Official',
    badge: 'Gelişmiş Muhakeme & Kod',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat / Coder)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Derin Muhakeme)' },
    ],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'custom_openai',
    name: 'Özel Sunucu / Yerel Ollama',
    badge: 'Self-Hosted / Yerel Proxy',
    models: [
      { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B' },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B' },
      { id: 'custom-model', name: 'Özel Model Kimliği' },
    ],
    defaultModel: 'qwen2.5-coder:7b',
    keyPlaceholder: 'İsteğe bağlı veya ollama',
    keyUrl: '',
  },
];

export function findProviderForModel(modelId: string): string {
  for (const prov of PROVIDER_CATALOG) {
    if (prov.models.some((m) => m.id === modelId)) {
      return prov.id;
    }
  }
  if (modelId.includes('hy3') || modelId.includes('deepseek-v4') || modelId.startsWith('opencode')) return 'opencodezen';
  if (modelId.startsWith('nvidia/') || modelId.startsWith('meta/')) return 'nvidia_nim';
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  if (modelId.startsWith('llama-') || modelId.startsWith('mixtral-')) return 'groq';
  if (modelId.startsWith('deepseek-')) return 'deepseek';
  return 'gemini';
}

async function executeSingleProviderRequest(
  provider: string,
  model: string,
  apiKey: string | undefined,
  messages: AIMessage[],
  temp: number,
  maxTokens: number,
  system: string,
  settings: AISettings
): Promise<{ text: string; modelUsed: string }> {
  // Always append mandatory Turkish language enforcement
  const enforcedSystemPrompt = `${system}\n\n${MANDATORY_TURKISH_INSTRUCTION}`;

  // 1. Google Gemini API
  if (provider === 'gemini') {
    if (!apiKey) {
      throw new Error('Google Gemini API Anahtarı eksik. Lütfen Ayarlar penceresinden ekleyin veya GEMINI_API_KEY ortam değişkenini tanımlayın.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const formattedContents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const payload: any = {
      contents: formattedContents,
      generationConfig: {
        temperature: temp,
        maxOutputTokens: maxTokens,
      },
    };
    if (enforcedSystemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: enforcedSystemPrompt }],
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Hatası (${res.status}): ${err}`);
    }

    const json = await res.json();
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || 'Yanıt alınamadı.';
    return { text, modelUsed: model };
  }

  // 2. Anthropic Claude API
  if (provider === 'anthropic') {
    if (!apiKey) {
      throw new Error('Anthropic Claude API Anahtarı eksik. Lütfen Ayarlar penceresinden ekleyin.');
    }
    const url = 'https://api.anthropic.com/v1/messages';
    const formattedMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const payload = {
      model,
      max_tokens: maxTokens,
      temperature: temp,
      system: enforcedSystemPrompt || undefined,
      messages: formattedMessages,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API Hatası (${res.status}): ${err}`);
    }

    const json = await res.json();
    const text = json.content?.[0]?.text || 'Yanıt alınamadı.';
    return { text, modelUsed: model };
  }

  // 3. OpenCode Zen / NVIDIA NIM / Groq / DeepSeek / Custom OpenAI
  let endpoint = '';
  let authHeader = `Bearer ${apiKey}`;

  if (provider === 'opencodezen') {
    if (!apiKey) throw new Error('OpenCode Zen Token eksik. Lütfen Ayarlar penceresinden OpenCode Zen tokenınızı girin veya OPENCODE_API_KEY tanımlayın.');
    const base = settings.baseUrl || 'https://api.opencode.ai/v1';
    endpoint = `${base.replace(/\/$/, '')}/chat/completions`;
  } else if (provider === 'nvidia_nim') {
    if (!apiKey) throw new Error('NVIDIA NIM API Anahtarı eksik. build.nvidia.com üzerinden ücretsiz alabilirsiniz.');
    endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  } else if (provider === 'groq') {
    if (!apiKey) throw new Error('Groq API Anahtarı eksik. console.groq.com üzerinden ücretsiz alabilirsiniz.');
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  } else if (provider === 'deepseek') {
    if (!apiKey) throw new Error('DeepSeek API Anahtarı eksik.');
    endpoint = 'https://api.deepseek.com/v1/chat/completions';
  } else if (provider === 'custom_openai') {
    const base = settings.baseUrl || 'http://localhost:11434/v1';
    endpoint = `${base.replace(/\/$/, '')}/chat/completions`;
    if (!apiKey) authHeader = 'Bearer ollama';
  }

  const openAiMessages = [
    ...(enforcedSystemPrompt ? [{ role: 'system', content: enforcedSystemPrompt }] : []),
    ...messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
  ];

  const payload = {
    model,
    messages: openAiMessages,
    temperature: temp,
    max_tokens: maxTokens,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider} API Hatası (${res.status}): ${err}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || 'Yanıt alınamadı.';
  return { text, modelUsed: model };
}

export async function sendAIChatRequest(
  messages: AIMessage[],
  settings: AISettings
): Promise<{ text: string; modelUsed: string }> {
  const provider = settings.provider || 'nvidia_nim';
  const model = settings.model;
  const temp = typeof settings.temperature === 'number' ? settings.temperature : 0.4;
  const maxTokens = settings.maxTokens || 3000;
  const system = settings.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt;

  // Resolve API Key: per-provider keys map, or generic apiKey, or env
  let apiKey = settings.keys?.[provider]?.trim() || settings.apiKey?.trim();
  if (!apiKey) {
    if (provider === 'gemini') apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    else if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
    else if (provider === 'nvidia_nim') apiKey = process.env.NVIDIA_NIM_API_KEY;
    else if (provider === 'opencodezen') apiKey = process.env.OPENCODE_API_KEY || process.env.OPENCODEZEN_API_TOKEN || process.env.OPENCODE_TOKEN;
    else if (provider === 'groq') apiKey = process.env.GROQ_API_KEY;
    else if (provider === 'deepseek') apiKey = process.env.DEEPSEEK_API_KEY;
  }

  try {
    return await executeSingleProviderRequest(provider, model, apiKey, messages, temp, maxTokens, system, settings);
  } catch (primaryErr: any) {
    // FCC-style fallback model retry
    if (settings.fallbackModel && settings.fallbackModel !== model) {
      console.warn(`Primary model ${model} failed (${primaryErr.message}). Trying FCC fallback: ${settings.fallbackModel}`);
      const fbProvider = findProviderForModel(settings.fallbackModel);
      let fbKey = settings.keys?.[fbProvider]?.trim() || settings.apiKey?.trim();
      if (!fbKey) {
        if (fbProvider === 'gemini') fbKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        else if (fbProvider === 'nvidia_nim') fbKey = process.env.NVIDIA_NIM_API_KEY;
        else if (fbProvider === 'opencodezen') fbKey = process.env.OPENCODE_API_KEY || process.env.OPENCODEZEN_API_TOKEN;
        else if (fbProvider === 'groq') fbKey = process.env.GROQ_API_KEY;
        else if (fbProvider === 'deepseek') fbKey = process.env.DEEPSEEK_API_KEY;
      }
      try {
        const fbRes = await executeSingleProviderRequest(fbProvider, settings.fallbackModel, fbKey, messages, temp, maxTokens, system, settings);
        return {
          text: fbRes.text + `\n\n*(ℹ️ Free Claude Code Fallback: ${model} yanıt vermediği için yedek model ${settings.fallbackModel} devreye girdi)*`,
          modelUsed: settings.fallbackModel,
        };
      } catch (fbErr: any) {
        throw new Error(`Ana model hatası: ${primaryErr.message} | Yedek model hatası: ${fbErr.message}`);
      }
    }
    throw primaryErr;
  }
}

export async function testAIConnection(
  settings: AISettings
): Promise<{ success: boolean; latencyMs: number; error?: string; modelUsed?: string }> {
  const start = Date.now();
  try {
    const res = await sendAIChatRequest(
      [{ role: 'user', content: 'Merhaba, test mesajıdır. Yalnızca "TAMAM" yanıtı ver.' }],
      { ...settings, maxTokens: 20 }
    );
    const latencyMs = Date.now() - start;
    return { success: true, latencyMs, modelUsed: res.modelUsed };
  } catch (err: any) {
    return { success: false, latencyMs: Date.now() - start, error: err.message };
  }
}
