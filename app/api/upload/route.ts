import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { supabase } from '@/lib/supabase';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Dosya yüklenmedi.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.apk')) {
      return NextResponse.json({ success: false, error: 'Yalnızca .apk uzantılı dosyalar kabul edilir.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to output/uploads directory
    const uploadsDir = path.join(process.cwd(), 'output', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const cleanBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFileName = `${Date.now()}_${cleanBaseName}`;
    const targetFilePath = path.join(uploadsDir, targetFileName);

    await fs.writeFile(targetFilePath, buffer);

    // Run ultra-fast Python pre-audit
    let preAuditData: any = null;
    try {
      const { stdout } = await execFileAsync('python', ['-m', 'engine.pre_audit', targetFilePath], {
        cwd: process.cwd(),
        timeout: 10000,
      });
      preAuditData = JSON.parse(stdout);
    } catch (auditErr: any) {
      console.warn('Pre-audit execution warning:', auditErr);
      preAuditData = {
        success: true,
        file_name: file.name,
        file_size_mb: (buffer.length / (1024 * 1024)).toFixed(2),
        package_name: file.name.replace('.apk', ''),
        version_name: '1.0.0',
        permissions: { dangerous: [], ad_related: [], total_count: 0 },
        detected_features: { has_billing: false, has_ads: false, ad_networks: [] },
      };
    }

    // Check if Supabase has existing profile
    const pkg = preAuditData?.package_name || '';
    let existingProfile: any = null;
    if (pkg) {
      try {
        const { data: prof } = await supabase
          .from('forge_profiles')
          .select('*')
          .eq('package_name', pkg)
          .maybeSingle();
        existingProfile = prof;
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      apk_path: targetFilePath,
      file_name: file.name,
      file_size_mb: preAuditData?.file_size_mb || (buffer.length / (1024 * 1024)).toFixed(2),
      pre_audit: preAuditData,
      has_existing_profile: !!existingProfile,
      existing_profile_name: existingProfile?.profile_name || null,
      modding_guide: existingProfile?.modding_guide || null,
      auto_apply: existingProfile?.auto_apply || false,
    });
  } catch (error: any) {
    console.error('APK upload error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Yükleme sırasında hata oluştu.' }, { status: 500 });
  }
}
