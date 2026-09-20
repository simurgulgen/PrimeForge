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
      release_channel,
      variants_update,
    } = body;

    if (!listing_id || (!new_version && (!variants_update || variants_update.length === 0))) {
      return NextResponse.json(
        { error: 'listing_id ve geçerli sürüm bilgisi zorunludur.' },
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
    
    // 2. Update variants with channel and architecture awareness
    let updatedVariants = currentVariants;

    if (Array.isArray(variants_update) && variants_update.length > 0) {
      // Batch update matching variants individually
      updatedVariants = currentVariants.map((v: any) => {
        const vArch = (v.architecture || 'UNIVERSAL').toUpperCase();
        const vChan = (v.releaseChannel || 'Stable').toLowerCase();
        const vPlat = (v.platform || 'UNIVERSAL').toUpperCase();

        const match = variants_update.find((u: any) => {
          const uArch = (u.architecture || 'UNIVERSAL').toUpperCase();
          const uChan = (u.releaseChannel || 'Stable').toLowerCase();
          const uPlat = (u.platform || 'UNIVERSAL').toUpperCase();

          const archMatches = uArch === vArch || uArch === 'UNIVERSAL';
          const chanMatches = uChan === vChan;
          const platMatches = !u.platform || uPlat === vPlat || uPlat === 'UNIVERSAL';

          return archMatches && chanMatches && platMatches;
        });

        if (match) {
          return {
            ...v,
            version: match.new_version,
            fileUrl: match.suggested_url,
            githubReleaseAssetUrl: match.suggested_url.includes('github.com') ? match.suggested_url : v.githubReleaseAssetUrl,
          };
        }
        return v;
      });
    } else {
      // Single variant update
      updatedVariants = currentVariants.map((v: any) => {
        const matchPlat = !platform || v.platform === platform || platform === 'UNIVERSAL';
        const matchArch = !architecture || v.architecture === architecture || architecture === 'UNIVERSAL';
        const matchChan = !release_channel || (v.releaseChannel || 'Stable').toLowerCase() === release_channel.toLowerCase();

        if (matchPlat && matchArch && matchChan) {
          return {
            ...v,
            version: new_version,
            fileUrl: download_url,
            githubReleaseAssetUrl: download_url.includes('github.com') ? download_url : v.githubReleaseAssetUrl,
          };
        }
        return v;
      });
    }

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

    // 4. Update in Supabase via SECURITY DEFINER RPC to bypass RLS
    const { data: updatedRpc, error: rpcErr } = await supabase.rpc('primeforge_update_listing', {
      p_listing_id: listing_id,
      p_new_version: new_version,
      p_download_url: download_url,
      p_variants: finalVariants,
      p_version_history: vh,
      p_updated_at: now,
    });

    let updated = updatedRpc;

    if (rpcErr) {
      console.warn('RPC update failed, falling back to direct update:', rpcErr);
      const { data: directUpdated, error: directErr } = await supabase
        .from('listings')
        .update(updatePayload)
        .eq('id', listing_id)
        .select('id, title, version, fileUrl, updatedAt')
        .single();

      if (directErr) {
        console.error('Direct update error in Supabase:', directErr);
        return NextResponse.json({ error: directErr.message }, { status: 500 });
      }
      updated = directUpdated;
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
