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

export type AIProvider = AISettings['provider'];

export const MANDATORY_TURKISH_INSTRUCTION = `[KATI VE ZORUNLU DİL KURALI: %100 TÜRKÇE CEVAP]
Kullanıcı ile HER ZAMAN ve İSTİSNASIZ TÜRKÇE konuşacaksın.
Teknik smali opcodeları, Java kod blokları veya AndroidManifest XML etiketleri haricinde; tüm açıklamaların, analizlerin, soru yanıtların ve rehberlerin daima akıcı, net, profesyonel ve eksiksiz Türkçe olacaktır.
Kullanıcı başka bir dilde yazsa veya analiz edilen APK yabancı dilde olsa dahi cevabını daima TÜRKÇE olarak vereceksin.`;

export const SERVER_FALLBACK_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'nvidia_nim',
  model: 'nvidia/nemotron-3-super-120b-a12b',
  fallbackModel: 'gemini-3.6-flash',
  apiKey: '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',
  keys: {
    nvidia_nim: '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',
    opencodezen: 'sk-BwrjJerRUPeTXOtQ70mqfWPp09Sb7dQrHXAEbW1PcFUJ4G2wbhfC6yUfubey9QnY',
    gemini: SERVER_FALLBACK_GEMINI_KEY,
  },
  temperature: 0.2,
  maxTokens: 3000,
  systemPrompt: `Sen PrimeForge'un Kıdemli Android Sistem Mimarı, Güvenlik Araştırmacısı ve Smali/Java Kodlama Uzmanısın.
Kullanıcıya APK analizi, AndroidManifest.xml izin denetimleri, smali mimarisi, reklam temizliği, ağ trafiği analizi ve Android TV DPAD optimizasyonu konularında derinlemesine teknik analizler, uygulanabilir profesyonel Türkçe kod ve rehberler sunarsın.

ÖNEMLİ MİMARİ VE YANIT İLKELERİ:
1. Kullanıcı uygulamalardaki cihaz sayısı sınırları, hesap kısıtlamaları veya oturum bağımlılıkları (örneğin Axon Player, IPTV oynatıcılar vb.) hakkında soru sorduğunda ASLA "Ben bunu yapamam / yardımcı olamam" gibi ezbere ve yüzeysel ret yanıtları verme.
2. Bunun yerine sorunun kök nedenini MİMARİ OLARAK analiz et: Bu kısıtlamanın istemci (APK smali) tarafında mı yoksa sunucu tarafında (Xtream Codes, OTT API, lisans sunucusu active_connections kontrolü, MAC/Token oturum kilidi) mı çalıştığını teknik olarak açıkla.
3. Sunucu tarafında tutulan eşzamanlı akış/oturum kısıtlamalarında istemcide yapılabilecek sahteleme (Device ID, ANDROID_ID, MAC vb.) sınırlarını ve neden sunucunun 2. cihaz bağlandığında 1. cihazı düşürdüğünü anlaşılır, eğitici ve profesyonel bir dille detaylandır.

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
    keyPlaceholder: 'sk-ant-...',
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
    badge: 'GLM 5.3 & GPT-5.4 Mini & Claude',
    models: [
      { id: 'glm-5.3-flash', name: 'GLM 5.3 Flash (Ultra Hızlı / Tavsiye Edilen)' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini (OpenCode Zen)' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex (Kodlama Uzmanı)' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Zen Hızlı)' },
      { id: 'minimax-m2.7', name: 'MiniMax M2.7 (Zen)' },
      { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash (Zen)' },
    ],
    defaultModel: 'glm-5.3-flash',
    keyPlaceholder: 'sk-... (OpenCode Zen API Anahtarı)',
    keyUrl: 'https://opencode.ai/zen',
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
    name: 'Özel OpenAI / Yerel LLM',
    badge: 'Ollama / vLLM / LM Studio / Yerel',
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
  if (modelId.includes('glm-') || modelId.includes('gpt-5.') || modelId.includes('minimax') || modelId.startsWith('opencode')) return 'opencodezen';
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
  systemPrompt: string,
  settings: AISettings
): Promise<{ text: string; modelUsed: string }> {
  const enforcedSystemPrompt = systemPrompt.endsWith(MANDATORY_TURKISH_INSTRUCTION)
    ? systemPrompt
    : `${systemPrompt}\n\n${MANDATORY_TURKISH_INSTRUCTION}`;

  // 1. Google Gemini Provider
  if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API Anahtarı eksik. Lütfen Ayarlar penceresinden girin.');
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const payload = {
      contents,
      systemInstruction: enforcedSystemPrompt ? { parts: [{ text: enforcedSystemPrompt }] } : undefined,
      generationConfig: {
        temperature: temp,
        maxOutputTokens: maxTokens,
      },
    };

    const res = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Hatası (${res.status}): ${err}`);
    }

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || 'Yanıt alınamadı.';
    return { text, modelUsed: model };
  }

  // 2. Anthropic Claude Provider
  if (provider === 'anthropic') {
    if (!apiKey) throw new Error('Anthropic Claude API Anahtarı eksik.');
    const endpoint = 'https://api.anthropic.com/v1/messages';

    const claudeMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const payload = {
      model,
      messages: claudeMessages,
      system: enforcedSystemPrompt,
      max_tokens: maxTokens,
      temperature: temp,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
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
    if (!apiKey) throw new Error('OpenCode Zen API Anahtarı eksik. Lütfen Ayarlar penceresinden OpenCode Zen anahtarınızı girin.');
    const base = settings.baseUrl || 'https://opencode.ai/zen/v1';
    endpoint = `${base.replace(/\/$/, '')}/chat/completions`;
  } else if (provider === 'nvidia_nim') {
    if (!apiKey) throw new Error('NVIDIA NIM API Anahtarı eksik. build.nvidia.com üzerinden alabilirsiniz.');
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    if (provider === 'opencodezen') {
      if (err.includes('CreditsError') || err.includes('No payment method')) {
        throw new Error(`OpenCode Zen Hatası: Hesabınızda bakiye veya kayıtlı ödeme yöntemi yok. (https://opencode.ai/workspace üzerinden bakiye ekleyin veya NVIDIA NIM kullanın)`);
      }
      if (err.includes('FreeTierError')) {
        throw new Error(`OpenCode Zen Uyarısı: Bu ücretsiz model sadece OpenCode terminal arayüzünde geçerlidir. Lütfen standart modellerden (glm-5.3-flash, gpt-5.4-mini vb.) birini seçin.`);
      }
    }
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
  let provider = settings.provider || 'nvidia_nim';
  let model = settings.model;
  const temp = typeof settings.temperature === 'number' ? settings.temperature : 0.4;
  const maxTokens = settings.maxTokens || 3000;
  const system = settings.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt;

  // Resolve API Key strictly per provider
  let apiKey = settings.keys?.[provider]?.trim();
  if (!apiKey && provider === settings.provider && settings.apiKey?.trim()) {
    apiKey = settings.apiKey.trim();
  }

  if (!apiKey) {
    if (provider === 'gemini') apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || SERVER_FALLBACK_GEMINI_KEY;
    else if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
    else if (provider === 'nvidia_nim') apiKey = process.env.NVIDIA_NIM_API_KEY || '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';
    else if (provider === 'opencodezen') apiKey = process.env.OPENCODE_API_KEY || process.env.OPENCODEZEN_API_TOKEN || process.env.OPENCODE_TOKEN;
    else if (provider === 'groq') apiKey = process.env.GROQ_API_KEY;
    else if (provider === 'deepseek') apiKey = process.env.DEEPSEEK_API_KEY;
  }

  // If primary provider key is still missing, auto-switch to a configured provider
  if (!apiKey) {
    const availableProviders: Array<{ id: AIProvider; defaultModel: string; key: string }> = [];
    if (settings.keys?.nvidia_nim?.trim() || process.env.NVIDIA_NIM_API_KEY) {
      availableProviders.push({ id: 'nvidia_nim', defaultModel: 'nvidia/nemotron-3-super-120b-a12b', key: (settings.keys?.nvidia_nim?.trim() || process.env.NVIDIA_NIM_API_KEY || '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')! });
    }
    if (settings.keys?.opencodezen?.trim() || process.env.OPENCODE_API_KEY) {
      availableProviders.push({ id: 'opencodezen', defaultModel: 'glm-5.3-flash', key: (settings.keys?.opencodezen?.trim() || process.env.OPENCODE_API_KEY)! });
    }
    if (settings.keys?.gemini?.trim() || process.env.GEMINI_API_KEY || SERVER_FALLBACK_GEMINI_KEY) {
      availableProviders.push({ id: 'gemini', defaultModel: 'gemini-3.6-flash', key: (settings.keys?.gemini?.trim() || process.env.GEMINI_API_KEY || SERVER_FALLBACK_GEMINI_KEY)! });
    }
    if (settings.keys?.groq?.trim() || process.env.GROQ_API_KEY) {
      availableProviders.push({ id: 'groq', defaultModel: 'llama-3.3-70b-versatile', key: (settings.keys?.groq?.trim() || process.env.GROQ_API_KEY)! });
    }

    if (availableProviders.length > 0) {
      const fb = availableProviders[0];
      provider = fb.id;
      model = fb.defaultModel;
      apiKey = fb.key;
      console.log(`[AI Service] Auto-switched to configured provider: ${provider} (${model})`);
    }
  }

  try {
    return await executeSingleProviderRequest(provider, model, apiKey, messages, temp, maxTokens, system, settings);
  } catch (primaryErr: any) {
    // FCC-style fallback model retry
    if (settings.fallbackModel && settings.fallbackModel !== model) {
      console.warn(`Primary model ${model} failed (${primaryErr.message}). Trying FCC fallback: ${settings.fallbackModel}`);
      const fbProvider = findProviderForModel(settings.fallbackModel);
      let fbKey = settings.keys?.[fbProvider]?.trim();
      if (!fbKey) {
        if (fbProvider === 'nvidia_nim') fbKey = process.env.NVIDIA_NIM_API_KEY || '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';
        else if (fbProvider === 'opencodezen') fbKey = process.env.OPENCODE_API_KEY || process.env.OPENCODEZEN_API_TOKEN;
        else if (fbProvider === 'gemini') fbKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || SERVER_FALLBACK_GEMINI_KEY;
        else if (fbProvider === 'groq') fbKey = process.env.GROQ_API_KEY;
        else if (fbProvider === 'deepseek') fbKey = process.env.DEEPSEEK_API_KEY;
      }
      try {
        const fbRes = await executeSingleProviderRequest(fbProvider, settings.fallbackModel, fbKey, messages, temp, maxTokens, system, settings);
        return {
          text: fbRes.text + `\n\n*(ℹ️ FCC Otomatik Yedek: ${model} yanıt vermediği için yedek model ${settings.fallbackModel} devreye girdi)*`,
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
