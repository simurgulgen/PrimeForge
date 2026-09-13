import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedJobId = searchParams.get('jobId');

    // 1. Fetch recent jobs from Supabase
    const { data: jobs, error: jobsErr } = await supabase
      .from('forge_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);

    if (jobsErr) {
      return NextResponse.json({ error: jobsErr.message }, { status: 500 });
    }

    const allJobs = jobs || [];
    let selectedJob = requestedJobId
      ? allJobs.find((j) => j.id === requestedJobId)
      : allJobs[0];

    // If requested job wasn't in top 25, query specifically
    if (requestedJobId && !selectedJob) {
      const { data: singleJob } = await supabase
        .from('forge_jobs')
        .select('*')
        .eq('id', requestedJobId)
        .maybeSingle();
      if (singleJob) selectedJob = singleJob;
    }

    if (!selectedJob && allJobs.length > 0) {
      selectedJob = allJobs[0];
    }

    if (!selectedJob) {
      return NextResponse.json({
        success: true,
        selectedJob: null,
        allJobs: [],
        runInfo: null,
        logs: 'Henüz herhangi bir modlama veya analiz görevi bulunmuyor.',
      });
    }

    // 2. Fetch GitHub Actions run details and logs if github_run_id exists
    const runId = selectedJob.github_run_id;
    let runInfo: any = null;
    let logs = '';

    if (runId) {
      try {
        // Fetch run details via gh CLI or GitHub API
        const { stdout: runJson } = await execAsync(
          `gh api repos/${GITHUB_REPO}/actions/runs/${runId} --jq "{id, status, conclusion, created_at, updated_at, run_attempt, html_url}"`
        );
        const parsedRun = JSON.parse(runJson.trim());

        // Fetch jobs and steps
        const { stdout: jobsJson } = await execAsync(
          `gh api repos/${GITHUB_REPO}/actions/runs/${runId}/jobs --jq ".jobs[0] | {id, name, status, conclusion, started_at, completed_at, steps}"`
        );
        const parsedJob = JSON.parse(jobsJson.trim());

        runInfo = {
          runId: parsedRun.id,
          status: parsedRun.status,
          conclusion: parsedRun.conclusion,
          htmlUrl: parsedRun.html_url,
          job: {
            id: parsedJob.id,
            name: parsedJob.name,
            status: parsedJob.status,
            conclusion: parsedJob.conclusion,
            startedAt: parsedJob.started_at,
            completedAt: parsedJob.completed_at,
            steps: parsedJob.steps || [],
          },
        };

        // Try to fetch real log
        try {
          const { stdout: logOutput } = await execAsync(
            `gh run view ${runId} --repo ${GITHUB_REPO} --log`,
            { maxBuffer: 10 * 1024 * 1024 }
          );
          logs = logOutput;
        } catch (logErr: any) {
          if (parsedRun.status === 'in_progress' || parsedRun.status === 'queued') {
            logs = `[${new Date().toLocaleTimeString('tr-TR')}] 🚀 GitHub Actions işi (#${runId}) aktif olarak çalışıyor...\n` +
                   `Adımlar: ${parsedJob.steps?.filter((s: any) => s.status === 'completed').length || 0} / ${parsedJob.steps?.length || 0} tamamlandı.\n` +
                   `Log akışı GitHub tarafından iş tamamlandığında tam olarak indirilebilir olacaktır.\n` +
                   `Canlı GitHub Arayüzü: ${parsedRun.html_url}`;
          } else {
            logs = logErr.stdout || logErr.message || 'Loglar alınamadı.';
          }
        }
      } catch (err: any) {
        console.warn('Failed to fetch GitHub run details via gh:', err.message);
      }
    }

    // If no GitHub logs are available, generate a synthetic report from analysis_report
    if (!logs && selectedJob.analysis_report) {
      const rep = selectedJob.analysis_report;
      logs = `=== PRIMESTORE FORGE GÖREV RAPORU ===\n` +
             `ID: ${selectedJob.id}\n` +
             `Uygulama: ${selectedJob.app_name || selectedJob.package_name}\n` +
             `Paket: ${selectedJob.package_name} (Sürüm: ${selectedJob.version_name || '?'})\n` +
             `Durum: ${selectedJob.status}\n` +
             `Oluşturulma: ${selectedJob.created_at}\n` +
             `Mod Seçenekleri: ${JSON.stringify(rep.requested_mod_options || {}, null, 2)}\n` +
             `Özel Notlar: ${rep.custom_notes || 'Yok'}\n` +
             `Güvenlik Taraması: VT: ${rep.security?.engines?.virustotal?.detection_ratio || 'Temiz'}, Quark: ${rep.security?.engines?.quark?.status || 'Temiz'}\n` +
             (selectedJob.modded_apk_url ? `Modlu APK: ${selectedJob.modded_apk_url}\n` : '') +
             (rep.github_release_url ? `GitHub Release: ${rep.github_release_url}\n` : '');
    }

    return NextResponse.json({
      success: true,
      selectedJob,
      allJobs,
      runInfo,
      logs: logs || 'Henüz log çıktısı üretilmedi.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId parametresi zorunludur.' }, { status: 400 });
    }

    const { data: job, error: jobErr } = await supabase
      .from('forge_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 });
    }

    if (action === 'cancel') {
      // 1. Cancel GitHub Actions run if running
      if (job.github_run_id) {
        try {
          await execAsync(`gh run cancel ${job.github_run_id} --repo ${GITHUB_REPO}`);
        } catch (e: any) {
          console.warn('gh run cancel warning:', e.message);
        }
      }

      // 2. Mark job as cancelled in Supabase
      await supabase
        .from('forge_jobs')
        .update({
          status: 'cancelled',
          error_message: 'Kullanıcı tarafından canlı konsoldan iptal edildi.',
        })
        .eq('id', jobId);

      return NextResponse.json({
        success: true,
        message: 'Görev başarıyla iptal edildi.',
      });
    }

    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
