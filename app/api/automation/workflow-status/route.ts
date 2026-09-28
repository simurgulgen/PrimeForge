import { NextResponse } from 'next/server';
import { getAppCredentials } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get('run_id');
    const eventType = url.searchParams.get('event_type');

    const creds = await getAppCredentials();
    if (!creds.githubToken) {
      return NextResponse.json({ error: 'GitHub token tanımlı değil' }, { status: 401 });
    }

    const repo = creds.githubRepo || 'simurgulgen/PrimeForge';
    const headers = {
      Authorization: `Bearer ${creds.githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    };

    // Specific run by ID
    if (runId) {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}`, { headers });
      if (!res.ok) {
        return NextResponse.json({ error: `GitHub API ${res.status}` }, { status: res.status });
      }
      const run = await res.json();
      return NextResponse.json({
        id: run.id,
        name: run.name,
        status: run.status,          // queued, in_progress, completed
        conclusion: run.conclusion,   // success, failure, cancelled, null
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at,
        run_started_at: run.run_started_at,
        event: run.event,
        head_sha: run.head_sha?.slice(0, 7),
      });
    }

    // Recent runs (last 10)
    let apiUrl = `https://api.github.com/repos/${repo}/actions/runs?per_page=10`;
    if (eventType) {
      apiUrl += `&event=${eventType}`;
    }
    
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    
    const runs = (data.workflow_runs || []).map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      created_at: run.created_at,
      updated_at: run.updated_at,
      event: run.event,
      head_sha: run.head_sha?.slice(0, 7),
      duration_seconds: run.run_started_at && run.updated_at
        ? Math.round((new Date(run.updated_at).getTime() - new Date(run.run_started_at).getTime()) / 1000)
        : null,
    }));

    return NextResponse.json({ runs, total_count: data.total_count });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Workflow status fetch failed' },
      { status: 500 }
    );
  }
}
