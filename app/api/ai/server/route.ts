// app/api/ai/server/route.ts
import { NextResponse } from 'next/server';
import { getAIServerState, restartAIServer, clearAIServerCache } from '@/lib/ai-server-manager';
import { testAIConnection, DEFAULT_AI_SETTINGS } from '@/lib/ai-service';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const state = await getAIServerState();
    return NextResponse.json({ success: true, server: state });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Sunucu durumu alınamadı.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action = 'restart', initiatedBy = 'dashboard' } = body;

    if (action === 'restart') {
      const result = await restartAIServer(initiatedBy);
      return NextResponse.json({
        action: 'restart',
        ...result,
      });
    }

    if (action === 'clear_cache') {
      const result = clearAIServerCache();
      return NextResponse.json({
        action: 'clear_cache',
        ...result,
      });
    }

    if (action === 'ping') {
      let settings = DEFAULT_AI_SETTINGS;
      try {
        const { data } = await supabase
          .from('forge_settings')
          .select('value')
          .eq('key', 'ai_studio_settings')
          .maybeSingle();
        if (data?.value) settings = { ...DEFAULT_AI_SETTINGS, ...data.value };
      } catch (_) {}

      const ping = await testAIConnection(settings);
      return NextResponse.json({
        success: ping.success,
        action: 'ping',
        latencyMs: ping.latencyMs,
        modelUsed: ping.modelUsed,
        error: ping.error,
      });
    }

    return NextResponse.json(
      { success: false, error: `Bilinmeyen işlem: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('AI Server API Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'İşlem sırasında hata oluştu.' },
      { status: 500 }
    );
  }
}
