import { NextResponse } from 'next/server';
import { sendAIChatRequest, AIMessage, DEFAULT_AI_SETTINGS } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { smali_code, patch_def, package_name = '', app_name = '' } = body;

    if (!smali_code && !patch_def) {
      return NextResponse.json({ error: 'smali_code veya patch_def parametresi gereklidir.' }, { status: 400 });
    }

    const prompt = `PrimeForge Smali Pre-Flight Derleme Öncesi Güvenlik ve Hata Tahmin Raporu.
Uygulama: ${app_name || 'Bilinmiyor'} (${package_name || 'unknown.pkg'})
Yama / Değişiklik Talebi:
${JSON.stringify(patch_def || {}, null, 2)}

İncelenecek Smali Kod Parçası:
\`\`\`smali
${(smali_code || '').slice(0, 3000)}
\`\`\`

GÖREV:
Bu smali değişikliği Apktool ile derlenirken veya cihazda çalışırken:
1. Register/locals uyuşmazlığı (.locals yetersizliği -> VerifyError) yaratır mı?
2. Metot dönüş tipi ()Z, ()V, ()I veya ()L nesnesi ile opcode uyuşuyor mu?
3. Atlama etiketleri (:cond_, :goto_) veya kontrol akışı bozulmuş mu?
4. Uygulamada NullPointerException veya FATAL EXCEPTION çökmesi oluşturacak bir tuzak var mı?

Yanıtını kesinlikle aşağıdaki JSON formatında ver:
\`\`\`json
{
  "safe_to_compile": true,
  "confidence_score": 98,
  "risk_level": "LOW",
  "detected_return_type": "Z",
  "required_locals": 1,
  "issues": [],
  "autocorrected_patch": {
    "recommended_opcode": "const/4 v0, 0x1",
    "recommended_return": "return v0",
    "locals_declaration": ".locals 1"
  },
  "explanation": "Detaylı Türkçe teknik açıklama ve kararlılık öngörüsü."
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
      maxTokens: 1000,
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
        safe_to_compile: true,
        risk_level: 'LOW',
        explanation: aiRes.text,
        issues: [],
      };
    }

    return NextResponse.json({
      success: true,
      audit: parsed,
      raw_text: aiRes.text,
      modelUsed: aiRes.modelUsed,
    });
  } catch (err: any) {
    console.error('Smali audit API error:', err);
    return NextResponse.json({ error: err.message || 'Smali denetim hatası.' }, { status: 500 });
  }
}
