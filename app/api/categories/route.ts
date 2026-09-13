import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 28 Official PrimeStore Categories with their exact sortOrder from SupabaseCategoryRepository
const FALLBACK_CATEGORIES = [
  { id: 'apk_cat_1', name: 'Son Güncellenenler', sortOrder: 1, type: 'app' },
  { id: 'apk_cat_2', name: 'Yeni Eklenenler', sortOrder: 2, type: 'app' },
  { id: 'apk_cat_3', name: 'Öne Çıkanlar', sortOrder: 3, type: 'app' },
  { id: 'apk_cat_4', name: 'Spor', sortOrder: 4, type: 'app' },
  { id: 'apk_cat_5', name: 'Canlı Yayın', sortOrder: 5, type: 'app' },
  { id: 'apk_cat_6', name: 'Film-Dizi Sinema', sortOrder: 6, type: 'app' },
  { id: 'apk_cat_7', name: 'IPTV Players', sortOrder: 7, type: 'app' },
  { id: 'apk_cat_8', name: 'Araçlar', sortOrder: 8, type: 'app' },
  { id: 'apk_cat_9', name: 'Medya Oynatıcılar', sortOrder: 9, type: 'app' },
  { id: 'apk_cat_10', name: 'Launcher & Kişiselleştirme', sortOrder: 10, type: 'app' },
  { id: 'apk_cat_11', name: 'Sosyal Medya', sortOrder: 11, type: 'app' },
  { id: 'apk_cat_12', name: 'Güvenlik & Gizlilik', sortOrder: 12, type: 'app' },
  { id: 'apk_cat_13', name: 'Modlanmış Uygulamalar', sortOrder: 13, type: 'app' },
  { id: 'apk_cat_14', name: 'Official Uygulamalar', sortOrder: 14, type: 'app' },
  { id: 'apk_cat_15', name: 'Tarayıcı Browser', sortOrder: 15, type: 'app' },
  { id: 'apk_cat_16', name: 'VPN-DNS Değiştiriciler', sortOrder: 16, type: 'app' },
  { id: 'apk_cat_17', name: 'Youtube Clients', sortOrder: 17, type: 'app' },
  { id: 'f97f2632-b019-4fd1-ac91-f7dfdd139681', name: 'Oyunlar', sortOrder: 18, type: 'app' },
  { id: 'apk_cat_18', name: 'Diğer', sortOrder: 19, type: 'app' },
  { id: 'apk_cat_19', name: 'Fotoğraf & Video Düzenleme', sortOrder: 20, type: 'app' },
  { id: 'apk_cat_20', name: 'Eğitim & Dil Öğrenme', sortOrder: 21, type: 'app' },
  { id: 'apk_cat_21', name: 'Müzik & Ses', sortOrder: 22, type: 'app' },
  { id: 'apk_cat_22', name: 'Okuma & Çizgi Roman', sortOrder: 23, type: 'app' },
  { id: 'apk_cat_23', name: 'Sağlık & Fitness', sortOrder: 24, type: 'app' },
  { id: 'apk_cat_24', name: 'Oyunlar & Emülatörler', sortOrder: 25, type: 'app' },
  { id: 'apk_cat_25', name: 'Ofis & Verimlilik', sortOrder: 26, type: 'app' },
  { id: 'apk_cat_26', name: 'Hava Durumu & Navigasyon', sortOrder: 27, type: 'app' },
  { id: 'apk_cat_27', name: 'Geliştirici & Sistem Araçları', sortOrder: 28, type: 'app' },
];

export async function GET() {
  try {
    const { data: dbCategories, error } = await supabase
      .from('categories')
      .select('id, name, sortOrder, type')
      .eq('type', 'app')
      .order('sortOrder', { ascending: true });

    if (error || !dbCategories || dbCategories.length === 0) {
      return NextResponse.json({
        categories: FALLBACK_CATEGORIES,
        source: 'fallback',
      });
    }

    return NextResponse.json({
      categories: dbCategories,
      source: 'supabase',
    });
  } catch (err: any) {
    return NextResponse.json({
      categories: FALLBACK_CATEGORIES,
      source: 'fallback_error',
      error: err.message,
    });
  }
}
