import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      listing_id,
      new_version,
      download_url,
      source_name,
      release_notes,
      platform,
      architecture,
    } = body;

    if (!listing_id || !new_version || !download_url) {
      return NextResponse.json(
        { error: 'listing_id, new_version ve download_url parametreleri zorunludur.' },
        { status: 400 }
      );
    }

    // 1. Fetch current listing
    const { data: listing, error: fetchErr } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listing_id)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json(
        { error: fetchErr?.message || 'Listing bulunamadı.' },
        { status: 404 }
      );
    }

    const now = Date.now();
    const currentVariants = Array.isArray(listing.variants) ? listing.variants : [];
    
    // 2. Update variants
    const updatedVariants = currentVariants.map((v: any) => {
      // If specific platform/arch requested, only update matching or all
      const matchPlat = !platform || v.platform === platform || platform === 'UNIVERSAL';
      const matchArch = !architecture || v.architecture === architecture || architecture === 'UNIVERSAL';

      if (matchPlat && matchArch) {
        return {
          ...v,
          version: new_version,
          fileUrl: download_url,
          githubReleaseAssetUrl: download_url.includes('github.com') ? download_url : v.githubReleaseAssetUrl,
        };
      }
      return v;
    });

    // If variants were empty, create default ones
    const finalVariants = updatedVariants.length > 0 ? updatedVariants : [
      {
        platform: platform || 'UNIVERSAL',
        architecture: architecture || 'UNIVERSAL',
        version: new_version,
        fileUrl: download_url,
        releaseChannel: 'Stable',
      },
    ];

    // 3. Append to version history
    const vh = Array.isArray(listing.versionHistory) ? [...listing.versionHistory] : [];
    vh.push({
      version: new_version,
      platform: platform || 'UNIVERSAL',
      architecture: architecture || 'UNIVERSAL',
      file_url: download_url,
      file_host: 'CUSTOM_URL',
      release_notes: release_notes || `PrimeForge Güncelleme: ${source_name || 'Otomatik Kontrol'}`,
      created_at: now,
    });

    // 4. Update in Supabase
    const updatePayload: any = {
      version: new_version,
      fileUrl: download_url,
      variants: finalVariants,
      versionHistory: vh,
      updatedAt: now,
    };

    const { data: updated, error: updateErr } = await supabase
      .from('listings')
      .update(updatePayload)
      .eq('id', listing_id)
      .select('id, title, version, fileUrl, updatedAt')
      .single();

    if (updateErr) {
      console.error('Update error in Supabase:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${listing.title} başarıyla ${new_version} sürümüne güncellendi!`,
      listing: updated,
    });
  } catch (err: any) {
    console.error('Update apply error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
