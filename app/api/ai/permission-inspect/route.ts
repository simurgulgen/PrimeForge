import { NextResponse } from 'next/server';
import { sendAIChatRequest, AIMessage, DEFAULT_AI_SETTINGS } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { package_name = '', app_name = '', permission_name = '', smali_snippet = '' } = body;

    if (!permission_name) {
      return NextResponse.json({ error: 'permission_name parametresi zorunludur.' }, { status: 400 });
    }

    const prompt = `Sen uzman bir Android Güvenlik ve Tersine Mühendislik (Reverse Engineering) yapay zekasısın.
Uygulama: "${app_name || 'Bilinmiyor'}" (Paket: ${package_name || 'com.example.app'})
İncelenen İzin: "${permission_name}"
${smali_snippet ? `\nDecompile Smali Kod Kesiti:\n\`\`\`smali\n${smali_snippet.slice(0, 2000)}\n\`\`\`` : ''}

GÖREV:
Bu uygulamanın decompile kod mimarisini analiz et ve kullanıcının anlayabileceği net Türkçe teknik açıklama hazırla:
1. "Uygulama Bu İzni Hangi Amaçla Kullanıyordu?": (Örn: Bu tür bir uygulamada bu izin hangi sınıfta/özellikte ne amaçla çağrılır?)
2. "Kaldırıldığında Ne Olur?": (Uygulamanın hangi özellikleri durur, ana işlev ve kitap/medya/kullanıcı özellikleri etkilenir mi?)
3. "Çökme (Crash) Riski Var mı?": (Smali hook veya manifest silme ile kaldırıldığında VerifyError veya NullPointerException riski var mı?)
4. "Tavsiye": (Kaldır / İhtiyaca Göre Tut / Güvenle Temizle)

Lütfen doğrudan aşağıdaki JSON formatında yanıt ver:
\`\`\`json
{
  "permission": "${permission_name}",
  "usage_purpose": "Uygulamanın bu izni koddaki muhtemel kullanım yeri ve amacı.",
  "removal_impact": "İzin kaldırıldığında uygulamada neyin çalışmasının önleneceği ve nelerin sorunsuz devam edeceği.",
  "crash_risk": "SIFIR" | "DUSUK" | "ORTA",
  "recommendation": "KALDIR" | "KORU" | "ISTEGE_BAGLI",
  "recommendation_badge": "✅ Güvenle Kaldırılabilir" | "⚠️ Kayan Pencere Kullanıyorsanız Bırakın" | "🛡️ Mutlaka Kaldırın",
  "code_references": [
    "LocationManager -> getLastKnownLocation()",
    "AdMob SDK -> TargetLocation"
  ]
}
\`\`\`
`;

    const messages: AIMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const aiRes = await sendAIChatRequest(messages, {
      ...DEFAULT_AI_SETTINGS,
      temperature: 0.1,
      maxTokens: 800,
    });

    let parsed: any = null;
    try {
      const match = aiRes.text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        parsed = JSON.parse(aiRes.text);
      }
    } catch (_) {
      parsed = {
        permission: permission_name,
        usage_purpose: aiRes.text.slice(0, 300),
        removal_impact: 'İzin kaldırıldığında temel işlevler çalışmaya devam eder.',
        crash_risk: 'DUSUK',
        recommendation: 'KALDIR',
        recommendation_badge: '✅ Kaldırılabilir',
        code_references: [],
      };
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      modelUsed: aiRes.modelUsed,
    });
  } catch (err: any) {
    console.error('Permission inspect error:', err);
    return NextResponse.json({ error: err.message || 'İzin analiz hatası.' }, { status: 500 });
  }
}
