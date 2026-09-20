import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

const GITHUB_REPO = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN ||
  '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';

function getGhHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PrimeForge-Web',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedJobId = searchParams.get('jobId');

    // 1. Supabase'den son işleri çek
    const { data: jobs, error: jobsErr } = await supabase
      .from('forge_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (jobsErr) {
      return NextResponse.json({ error: jobsErr.message }, { status: 500 });
    }

    const allJobs = jobs || [];
    let selectedJob = requestedJobId
      ? allJobs.find((j) => j.id === requestedJobId)
      : allJobs[0];

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

    // 2. Runner & Logs resolution
    let runId = selectedJob.github_run_id;
    let runInfo: any = null;
    let logs = '';
    const headers = getGhHeaders();

    // Check if local log file exists for this job
    const localLogPath = path.join(process.cwd(), 'output', 'jobs', `${selectedJob.id}.log`);
    if (fs.existsSync(localLogPath)) {
      try {
        logs = fs.readFileSync(localLogPath, 'utf-8');
      } catch (e) {
        console.warn('Failed to read local log:', e);
      }
    }

    // Run ID yoksa, GitHub API'den son dispatch edilmiş veya aktif olan workflow run'ı bul
    if (!logs && !runId && GITHUB_TOKEN) {
      try {
        const runsRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?event=repository_dispatch&per_page=10`,
          { headers, cache: 'no-store' }
        );
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const workflowRuns = runsData.workflow_runs || [];

          // Job oluşturulma zamanına en yakın repository_dispatch run'ı bul
          const jobTime = new Date(selectedJob.created_at).getTime();
          const matchingRun =
            workflowRuns.find((r: any) => {
              const rTime = new Date(r.created_at).getTime();
              return Math.abs(rTime - jobTime) < 15 * 60 * 1000; // 15 dk içinde
            }) ||
            (workflowRuns.length > 0 &&
            Math.abs(new Date(workflowRuns[0].created_at).getTime() - jobTime) < 30 * 60 * 1000
              ? workflowRuns[0]
              : null);

          if (matchingRun) {
            runId = String(matchingRun.id);
            // Supabase'e kalıcı olarak kaydet
            await supabase
              .from('forge_jobs')
              .update({ github_run_id: runId })
              .eq('id', selectedJob.id);
            selectedJob.github_run_id = runId;
          }
        }
      } catch (findErr) {
        console.warn('Could not auto-detect GitHub run:', findErr);
      }
    }

    // Run ID varsa detayları ve logları çek
    if (runId && GITHUB_TOKEN) {
      try {
        // Run detayı
        const runRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}`,
          { headers, cache: 'no-store' }
        );

        if (runRes.ok) {
          const parsedRun = await runRes.json();

          // İş ve adımları çek
          const jobsRes = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs`,
            { headers, cache: 'no-store' }
          );

          let parsedJob: any = null;
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            parsedJob = jobsData.jobs?.[0] || null;
          }

          runInfo = {
            runId: parsedRun.id,
            status: parsedRun.status,
            conclusion: parsedRun.conclusion,
            htmlUrl: parsedRun.html_url,
            createdAt: parsedRun.created_at,
            updatedAt: parsedRun.updated_at,
            job: parsedJob
              ? {
                  id: parsedJob.id,
                  name: parsedJob.name,
                  status: parsedJob.status,
                  conclusion: parsedJob.conclusion,
                  startedAt: parsedJob.started_at,
                  completedAt: parsedJob.completed_at,
                  steps: parsedJob.steps || [],
                }
              : null,
          };

          // Auto-sync GitHub run conclusion to Supabase forge_jobs if finished
          if (
            parsedRun.status === 'completed' &&
            (selectedJob.status === 'pending' || selectedJob.status === 'in_progress' || selectedJob.status === 'running')
          ) {
            const finalStatus =
              parsedRun.conclusion === 'success'
                ? 'completed'
                : parsedRun.conclusion === 'cancelled'
                ? 'cancelled'
                : 'failed';
            const failedStep = parsedJob?.steps?.find((s: any) => s.conclusion === 'failure');
            const failureReason =
              parsedRun.conclusion === 'cancelled'
                ? 'Görev iptal edildi.'
                : failedStep
                ? `Adım ${failedStep.number} (${failedStep.name}) başarısız oldu.`
                : parsedRun.conclusion === 'failure'
                ? 'GitHub Actions işi başarısız oldu.'
                : null;

            try {
              await supabase
                .from('forge_jobs')
                .update({
                  status: finalStatus,
                  error_message: failureReason || selectedJob.error_message,
                })
                .eq('id', selectedJob.id);
              selectedJob.status = finalStatus;
              if (failureReason) selectedJob.error_message = failureReason;
            } catch (syncErr) {
              console.warn('Failed to sync job status to Supabase:', syncErr);
            }
          }

          // Canlı veya tamamlanmış logları çek
          if (parsedJob?.id) {
            try {
              const logRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/actions/jobs/${parsedJob.id}/logs`,
                {
                  headers,
                  redirect: 'follow',
                  cache: 'no-store',
                }
              );

              if (logRes.ok) {
                logs = await logRes.text();
              }
            } catch (lErr) {
              console.warn('Failed to fetch job log text:', lErr);
            }
          }

          // Eğer henüz ham log gelmediyse ve iş çalışıyorsa dinamik canlı durum metni oluştur
          if (!logs && parsedRun.status !== 'completed') {
            const stepsList = (parsedJob?.steps || [])
              .map((s: any) => {
                const icon =
                  s.status === 'completed'
                    ? s.conclusion === 'success'
                      ? '✅'
                      : '❌'
                    : s.status === 'in_progress'
                    ? '⏳'
                    : '⚪';
                return `  ${icon} Adım ${s.number}: ${s.name} [${s.status.toUpperCase()}${s.conclusion ? ` - ${s.conclusion}` : ''}]`;
              })
              .join('\n');

            logs =
              `[${new Date().toLocaleTimeString('tr-TR')}] 🚀 GitHub Actions Runner Aktif (#${runId})\n` +
              `================================================================================\n` +
              `📱 Uygulama: ${selectedJob.app_name || selectedJob.package_name}\n` +
              `📦 Paket: ${selectedJob.package_name || 'Bilinmiyor'} (İş: #${selectedJob.id.substring(0, 8)})\n` +
              `⚡ Runner Durumu: ${parsedRun.status.toUpperCase()}\n` +
              `🔗 Canlı Takip: ${parsedRun.html_url}\n\n` +
              `📋 Canlı Adım Takip Çizelgesi:\n` +
              `--------------------------------------------------------------------------------\n` +
              (stepsList || '  ⏳ Adımlar GitHub Runner tarafından sıraya alınıyor...\n') +
              `\n💡 Terminal çıktısı her 2 saniyede bir otomatik olarak güncellenmektedir.`;
          }
        }
      } catch (err: any) {
        console.warn('GitHub API fetch failed:', err.message);
      }
    }

    // Eğer log yoksa analiz raporundan sentetik özet üret
    if (!logs && selectedJob.analysis_report) {
      const rep = selectedJob.analysis_report;
      logs =
        `=== PRIMESTORE FORGE GÖREV RAPORU ===\n` +
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
      logs: logs || 'Henüz log çıktısı üretilmedi. İşlem başladığında terminal akışı burada görünecektir.',
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
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 });
    }

    if (action === 'cancel') {
      // 1. GitHub Actions iptal et
      if (job.github_run_id && GITHUB_TOKEN) {
        try {
          await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${job.github_run_id}/cancel`,
            {
              method: 'POST',
              headers: getGhHeaders(),
            }
          );
        } catch (ghErr) {
          console.warn('Failed to cancel GitHub run via API:', ghErr);
        }
      }

      // 2. Supabase durumunu 'cancelled' yap
      const { error: updErr } = await supabase
        .from('forge_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Görev başarıyla iptal edildi.',
      });
    }

    return NextResponse.json({ error: 'Bilinmeyen işlem.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
