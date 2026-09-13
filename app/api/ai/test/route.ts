// app/api/ai/test/route.ts
import { NextResponse } from 'next/server';
import { testAIConnection, AISettings } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const settings: AISettings = body.settings;

    if (!settings || !settings.provider || !settings.model) {
      return NextResponse.json({ error: 'Eksik sağlayıcı veya model parametresi.' }, { status: 400 });
    }

    const result = await testAIConnection(settings);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
