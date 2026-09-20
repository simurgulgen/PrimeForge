// app/api/ai/settings/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_AI_SETTINGS, AISettings } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('forge_settings')
      .select('value')
      .eq('key', 'ai_studio_settings')
      .maybeSingle();

    if (!error && data?.value) {
      return NextResponse.json({ settings: { ...DEFAULT_AI_SETTINGS, ...data.value } });
    }
    return NextResponse.json({ settings: DEFAULT_AI_SETTINGS });
  } catch (err) {
    return NextResponse.json({ settings: DEFAULT_AI_SETTINGS });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const settings: AISettings = body.settings;

    if (!settings) {
      return NextResponse.json({ error: 'Ayarlar eksik.' }, { status: 400 });
    }

    try {
      // Fetch existing settings to safely merge keys and preserve credentials
      const { data: existing } = await supabase
        .from('forge_settings')
        .select('value')
        .eq('key', 'ai_studio_settings')
        .maybeSingle();

      const existingValue = existing?.value || {};
      const mergedKeys = {
        ...(existingValue.keys || {}),
        ...(settings.keys || {}),
      };
      for (const k in existingValue.keys || {}) {
        if (existingValue.keys[k] && (!mergedKeys[k] || mergedKeys[k].trim() === '')) {
          mergedKeys[k] = existingValue.keys[k];
        }
      }

      const mergedSettings = {
        ...DEFAULT_AI_SETTINGS,
        ...existingValue,
        ...settings,
        keys: mergedKeys,
      };

      await supabase
        .from('forge_settings')
        .upsert({
          key: 'ai_studio_settings',
          value: mergedSettings,
          updated_at: new Date().toISOString(),
        });

      return NextResponse.json({ success: true, settings: mergedSettings });
    } catch (dbErr) {
      console.error('Settings upsert warning:', dbErr);
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
