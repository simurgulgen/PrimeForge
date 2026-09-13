import { NextRequest, NextResponse } from 'next/server';
import { getAllPatches, getPatchSources, fetchMorpheReleaseInfo } from '@/lib/morphe';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packageName = searchParams.get('package_name') || undefined;

    const patches = getAllPatches(packageName);
    const sources = getPatchSources();
    const releaseInfo = await fetchMorpheReleaseInfo();

    return NextResponse.json({
      success: true,
      patches,
      sources,
      releaseInfo,
      count: patches.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve Morphe patches' },
      { status: 500 }
    );
  }
}
