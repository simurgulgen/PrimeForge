import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, apk_path, action = 'full_mod', profile_name, package_name } = body;

    if (!apk_path) {
      return NextResponse.json({ success: false, error: 'apk_path gereklidir.' }, { status: 400 });
    }

    const resolvedJobId = jobId || `local-${Date.now()}`;
    const logDir = path.join(process.cwd(), 'output', 'jobs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFilePath = path.join(logDir, `${resolvedJobId}.log`);
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf-8' });

    const header = `[${new Date().toISOString()}] 🚀 PrimeForge Lokal Windows Çalıştırıcısı Başlatıldı\n` +
      `📦 APK: ${apk_path}\n` +
      `🆔 Job ID: #${resolvedJobId}\n` +
      `🎯 Action: ${action}\n` +
      `--------------------------------------------------------------------------------\n\n`;
    logStream.write(header);

    // Prepare Python environment
    const pythonEnv = {
      ...process.env,
      JOB_ID: resolvedJobId,
      ACTION: action,
      PROFILE: profile_name || '',
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
    };

    const runnerProc = spawn('python', ['-m', 'engine.forge_runner', apk_path], {
      cwd: process.cwd(),
      env: pythonEnv,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    runnerProc.stdout?.pipe(logStream);
    runnerProc.stderr?.pipe(logStream);

    runnerProc.on('error', async (err) => {
      const errMsg = `\n❌ Yerel süreç başlatma hatası: ${err.message}\n`;
      logStream.write(errMsg);
      try {
        await supabase.from('forge_jobs').update({
          status: 'failed',
          error_message: err.message,
        }).eq('id', resolvedJobId);
      } catch (_) {}
    });

    runnerProc.on('close', async (code) => {
      const finishMsg = `\n[${new Date().toISOString()}] 🏁 Lokal süreç tamamlandı (Çıkış kodu: ${code})\n`;
      logStream.write(finishMsg);
      logStream.end();

      const finalStatus = code === 0 ? 'completed' : 'failed';
      try {
        await supabase.from('forge_jobs').update({
          status: finalStatus,
        }).eq('id', resolvedJobId);
      } catch (_) {}
    });

    // Unref so the HTTP response doesn't hang waiting for the process to terminate
    runnerProc.unref();

    return NextResponse.json({
      success: true,
      jobId: resolvedJobId,
      runner_type: 'local',
      log_file: logFilePath,
      message: 'Yerel modlama süreci Windows üzerinde arka planda başlatıldı.',
    });
  } catch (error: any) {
    console.error('Local runner error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
