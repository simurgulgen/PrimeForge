import { NextRequest, NextResponse } from 'next/server';
import { addPatchSource, PatchSource } from '@/lib/morphe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, name, description } = body;

    if (!repo || typeof repo !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir GitHub depo adı veya URL giriniz (örn: crimera/piko).' },
        { status: 400 }
      );
    }

    // Clean up repo string if a full URL was provided
    let cleanRepo = repo.trim();
    if (cleanRepo.startsWith('https://github.com/')) {
      cleanRepo = cleanRepo.replace('https://github.com/', '');
    }
    cleanRepo = cleanRepo.replace(/\/$/, '');

    const parts = cleanRepo.split('/');
    if (parts.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'Depo biçimi geçersiz. "kullanıcı/depo" şeklinde olmalıdır (örn: crimera/piko).' },
        { status: 400 }
      );
    }

    // Verify repository on GitHub
    let repoData: any = {};
    let releaseData: any = {};
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
        headers: { 'User-Agent': 'PrimeForge-Engine' },
      });
      if (!ghRes.ok) {
        return NextResponse.json(
          { success: false, error: `GitHub deposu bulunamadı: ${cleanRepo} (${ghRes.status})` },
          { status: 404 }
        );
      }
      repoData = await ghRes.json();

      // Check releases for .mpp or .jar assets
      const relRes = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/latest`, {
        headers: { 'User-Agent': 'PrimeForge-Engine' },
      });
      if (relRes.ok) {
        releaseData = await relRes.json();
      }
    } catch (e: any) {
      console.warn('GitHub repo verification warning:', e.message);
    }

    const mppAsset = releaseData.assets?.find((a: any) => a.name.endsWith('.mpp') || a.name.endsWith('.jar'));

    const newSource: PatchSource = {
      id: `custom-${parts[0]}-${parts[1]}`,
      name: name || repoData.name || cleanRepo,
      repo: cleanRepo,
      description: description || repoData.description || 'Topluluk Morphe yama paketi.',
      isOfficial: false,
      latestVersion: releaseData.tag_name || 'main',
      mppAssetUrl: mppAsset?.browser_download_url,
      patchCount: 15,
      lastSyncedAt: new Date().toISOString(),
    };

    addPatchSource(newSource);

    return NextResponse.json({
      success: true,
      message: `"${newSource.name}" yama paketi başarıyla sisteme içe aktarıldı.`,
      source: newSource,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Yama paketi içe aktarılırken hata oluştu.' },
      { status: 500 }
    );
  }
}
