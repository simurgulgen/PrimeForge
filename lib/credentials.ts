import { supabase } from '@/lib/supabase';

export interface AppCredentials {
  githubToken: string;
  githubRepo: string;
  nimApiKey: string;
  nimModel: string;
}

let cachedCreds: AppCredentials | null = null;
let cacheTime = 0;

export async function getAppCredentials(forceRefresh = false): Promise<AppCredentials> {
  const now = Date.now();
  if (!forceRefresh && cachedCreds && now - cacheTime < 30000) {
    return cachedCreds;
  }

  let githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GITHUB_DATA_PAT || '';
  let githubRepo = process.env.GITHUB_REPO || 'simurgulgen/PrimeForge';
  let nimApiKey = process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY || '';
  let nimModel = 'nvidia/nemotron-3-super-120b-a12b';

  try {
    const { data: rows } = await supabase
      .from('forge_settings')
      .select('key, value')
      .in('key', ['ai_studio_settings', 'github_settings']);

    if (rows) {
      for (const row of rows) {
        if (row.key === 'github_settings' && row.value) {
          if (!githubToken && row.value.token) {
            githubToken = String(row.value.token).trim();
          }
          if (row.value.repo) {
            githubRepo = String(row.value.repo).trim();
          }
        }
        if (row.key === 'ai_studio_settings' && row.value) {
          if (!nimApiKey) {
            nimApiKey = row.value.keys?.nvidia_nim || row.value.apiKey || '';
          }
          if (row.value.model) {
            nimModel = row.value.model;
          }
        }
      }
    }
  } catch (err) {
    console.error('getAppCredentials error:', err);
  }

  cachedCreds = {
    githubToken,
    githubRepo,
    nimApiKey,
    nimModel,
  };
  cacheTime = now;
  return cachedCreds;
}
