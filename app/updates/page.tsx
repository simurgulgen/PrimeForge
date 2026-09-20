'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  ArrowUpCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Download,
  Filter,
  Search,
  Sparkles,
  Zap,
  Globe,
  Github,
  Layers,
  FileCode2,
  ChevronRight,
  ShieldCheck,
  Radio,
  Loader2,
  Check,
  BookOpen,
  Activity,
  XCircle,
  Ban,
  Terminal,
  Settings,
  Plus,
  Play,
} from 'lucide-react';
import PreAuditModal from '@/app/components/PreAuditModal';
import GuideModal from '@/app/components/GuideModal';
import ScraperRuleModal from '@/app/components/ScraperRuleModal';

interface UpdateItem {
  listing_id: string;
  title: string;
  logoUrl: string;
  packageName: string | null;
  current_version: string;
  latest_version: string;
  latest_tag: string;
  source_type: 'GITHUB_RELEASE' | 'GITHUB_REPO_APK' | 'WEB_SCRAPER' | 'APK_MANIFEST' | 'DIRECT';
  source_name: string;
  download_url: string;
  release_url?: string;
  release_notes?: string | null;
  has_guide?: boolean;
  guide_name?: string;
  auto_apply?: boolean;
  channel_summary?: {
    stable?: string;
    beta?: string;
  };
  variants_needing_update?: Array<{
    platform: string;
    architecture: string;
    releaseChannel?: string;
    current_version: string;
    new_version: string;
    suggested_url: string;
    asset_name?: string;
  }>;
}

export default function UpdatesPage() {
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [selectedAppForAudit, setSelectedAppForAudit] = useState<UpdateItem | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [updatesAvailable, setUpdatesAvailable] = useState<UpdateItem[]>([]);
  const [upToDate, setUpToDate] = useState<any[]>([]);
  const [untracked, setUntracked] = useState<any[]>([]);
  const [checkFailed, setCheckFailed] = useState<any[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  // Web Scraper specific states
  const [scraperApps, setScraperApps] = useState<any[]>([]);
  const [scraperRules, setScraperRules] = useState<any[]>([]);
  const [loadingScrapers, setLoadingScrapers] = useState(false);
  const [selectedAppForScraperRule, setSelectedAppForScraperRule] = useState<any | null>(null);
  const [scrapingAppId, setScrapingAppId] = useState<string | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [scraperResults, setScraperResults] = useState<Record<string, any>>({});

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'available' | 'scrapers' | 'uptodate' | 'untracked'>('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'GITHUB' | 'SCRAPER'>('ALL');
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);

  // Guide & Autonomous Update States
  const [selectedAppForGuide, setSelectedAppForGuide] = useState<UpdateItem | null>(null);
  const [guideModalData, setGuideModalData] = useState<{ guideContent: string | null; profileYaml: string | null; successCount: number } | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [runningAutonomousId, setRunningAutonomousId] = useState<string | null>(null);
  const [runningAutonomousAll, setRunningAutonomousAll] = useState(false);

  // Live in-card job tracking states
  const [recentJobs, setRecentJobs] = useState<Record<string, any>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const fetchRecentJobs = async () => {
    try {
      const res = await fetch('/api/job-status');
      const data = await res.json();
      if (data.jobs && Array.isArray(data.jobs)) {
        const map: Record<string, any> = {};
        for (const job of data.jobs) {
          if (job.package_name && !map[job.package_name]) {
            map[job.package_name] = job;
          }
        }
        setRecentJobs(map);
      }
    } catch (_) {}
  };

  const toggleCardExpansion = (listingId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [listingId]: !prev[listingId],
    }));
  };

  const openLeftPipelineDrawer = (jobId?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('primeforge:open_pipeline', {
          detail: { jobId },
        })
      );
    }
  };

  const fetchScrapers = async () => {
    setLoadingScrapers(true);
    try {
      const res = await fetch('/api/scrapers');
      const data = await res.json();
      if (data.success) {
        setScraperApps(data.scraper_apps || []);
        setScraperRules(data.rules || []);
      }
    } catch (err: any) {
      console.error('Error fetching scraper apps:', err);
    } finally {
      setLoadingScrapers(false);
    }
  };

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/update-check');
      const data = await res.json();
      if (data.success) {
        setUpdatesAvailable(data.updates_available || []);
        setUpToDate(data.up_to_date || []);
        setUntracked(data.untracked || []);
        setCheckFailed(data.check_failed || []);
        setCheckedAt(data.checked_at || new Date().toISOString());
      } else {
        showToast('Hata', data.error || 'Kontrol başarısız oldu.', 'error');
      }
    } catch (err: any) {
      showToast('Bağlantı Hatası', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunScraper = async (app: any) => {
    setScrapingAppId(app.listing_id);
    setScraperResults((prev) => ({
      ...prev,
      [app.listing_id]: { status: 'loading' },
    }));

    try {
      const res = await fetch('/api/scrapers/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: app.listing_id,
          rule_id: app.matched_rule?.id,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.has_update && data.update_item) {
          setUpdatesAvailable((prev) => {
            const exists = prev.some((u) => u.listing_id === app.listing_id);
            if (exists) {
              return prev.map((u) => (u.listing_id === app.listing_id ? data.update_item : u));
            }
            return [data.update_item, ...prev];
          });
          setScraperResults((prev) => ({
            ...prev,
            [app.listing_id]: {
              status: 'success',
              message: `🚀 Yeni Sürüm Tespit Edildi: v${data.latest_version}`,
              update_item: data.update_item,
            },
          }));
          showToast(
            'Güncelleme Bulundu! 🚀',
            `${app.title} için yeni sürüm (v${data.latest_version}) bulundu!`,
            'success'
          );
        } else {
          setScraperResults((prev) => ({
            ...prev,
            [app.listing_id]: {
              status: 'up_to_date',
              message: `✅ Uygulama güncel (v${data.latest_version || app.current_version})`,
            },
          }));
          showToast('Uygulama Güncel', `${app.title} son sürümde.`, 'success');
        }
      } else {
        setScraperResults((prev) => ({
          ...prev,
          [app.listing_id]: {
            status: 'failed',
            message: data.error || 'Scraper çalıştırılamadı.',
          },
        }));
        showToast('Scraper Hatası', data.error || 'Sürüm tespit edilemedi.', 'error');
      }
    } catch (err: any) {
      setScraperResults((prev) => ({
        ...prev,
        [app.listing_id]: {
          status: 'failed',
          message: err.message,
        },
      }));
      showToast('Bağlantı Hatası', err.message, 'error');
    } finally {
      setScrapingAppId(null);
    }
  };

  const handleRunAllScrapers = async () => {
    const appsWithRules = scraperApps.filter((a) => a.matched_rule);
    if (appsWithRules.length === 0) {
      showToast('Bilgi', 'Taranabilecek aktif scraper kuralı bulunamadı.', 'error');
      return;
    }
    setScrapingAll(true);
    let foundCount = 0;
    for (const app of appsWithRules) {
      try {
        const res = await fetch('/api/scrapers/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: app.listing_id,
            rule_id: app.matched_rule?.id,
          }),
        });
        const data = await res.json();
        if (data.success && data.has_update && data.update_item) {
          foundCount++;
          setUpdatesAvailable((prev) => {
            const exists = prev.some((u) => u.listing_id === app.listing_id);
            if (exists) {
              return prev.map((u) => (u.listing_id === app.listing_id ? data.update_item : u));
            }
            return [data.update_item, ...prev];
          });
          setScraperResults((prev) => ({
            ...prev,
            [app.listing_id]: {
              status: 'success',
              message: `🚀 Yeni Sürüm: v${data.latest_version}`,
              update_item: data.update_item,
            },
          }));
        } else if (data.success) {
          setScraperResults((prev) => ({
            ...prev,
            [app.listing_id]: {
              status: 'up_to_date',
              message: `✅ Güncel (v${data.latest_version})`,
            },
          }));
        }
      } catch (_) {}
    }
    setScrapingAll(false);
    showToast(
      'Web Scraper Taraması Tamamlandı! 🌐',
      `${appsWithRules.length} uygulama tarandı, ${foundCount} yeni güncelleme tespit edildi!`,
      'success'
    );
  };

  const handleScraperRuleSaved = () => {
    fetchScrapers();
    showToast('Başarılı', 'Scraper kuralı kaydedildi.', 'success');
  };

  useEffect(() => {
    fetchUpdates();
    fetchScrapers();
    fetchRecentJobs();
    const interval = setInterval(() => {
      fetchRecentJobs();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (title: string, message: string, type: 'success' | 'error') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleOpenGuide = async (item: UpdateItem) => {
    setSelectedAppForGuide(item);
    setLoadingGuide(true);
    setGuideModalData(null);
    try {
      const res = await fetch('/api/pre-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: item.download_url,
          listing_id: item.listing_id,
          package_name: item.packageName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGuideModalData({
          guideContent: data.modding_guide || null,
          profileYaml: data.existing_profile_yaml || null,
          successCount: data.success_count || 1,
        });
      }
    } catch (e) {
      console.error('Guide fetch error:', e);
    } finally {
      setLoadingGuide(false);
    }
  };

  const handleAutonomousUpdate = async (item: UpdateItem) => {
    setRunningAutonomousId(item.listing_id);
    try {
      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: item.download_url,
          action: 'autonomous_from_guide',
          package_name: item.packageName,
          app_name: item.title,
          version_name: item.latest_version,
          profile: item.packageName,
          mod_options: {
            use_saved_guide: true,
            auto_apply: true,
            save_guide: true,
            run_emulator_test: true,
          },
          custom_notes: `🤖 Otonom Güncelleme: '${item.guide_name || item.title}' kayıtlı rehberi kullanılarak sıfır müdahale ile güncelleniyor.`,
          publish_mode: 'manual_review',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'Otonom Pipeline Başlatıldı! 🤖',
          `${item.title} için kayıtlı rehber devreye alındı. APK yamalanıp emülatör testine gönderiliyor.`,
          'success'
        );
        setSelectedAppForGuide(null);
        setExpandedCards((prev) => ({ ...prev, [item.listing_id]: true }));
        if (typeof window !== 'undefined' && data.job_id) {
          window.dispatchEvent(
            new CustomEvent('primeforge:job_started', {
              detail: {
                jobId: data.job_id,
                appName: item.title,
                packageName: item.packageName,
              },
            })
          );
        }
        fetchRecentJobs();
      } else {
        showToast('Hata', data.error || 'Otonom güncelleme başlatılamadı.', 'error');
      }
    } catch (err: any) {
      showToast('Bağlantı Hatası', err.message, 'error');
    } finally {
      setRunningAutonomousId(null);
    }
  };

  const handleAutonomousAll = async () => {
    const guideApps = updatesAvailable.filter((u) => u.has_guide);
    if (guideApps.length === 0) return;
    setRunningAutonomousAll(true);
    let count = 0;
    for (const app of guideApps) {
      try {
        const res = await fetch('/api/trigger-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apk_url: app.download_url,
            action: 'autonomous_from_guide',
            package_name: app.packageName,
            app_name: app.title,
            version_name: app.latest_version,
            profile: app.packageName,
            mod_options: {
              use_saved_guide: true,
              auto_apply: true,
              save_guide: true,
              run_emulator_test: true,
            },
            custom_notes: `🤖 Toplu Otonom Güncelleme: '${app.guide_name || app.title}' rehberi kullanılarak güncelleniyor.`,
            publish_mode: 'manual_review',
          }),
        });
        const data = await res.json();
        if (data.success) count++;
      } catch (e) {
        console.error('Batch autonomous error:', e);
      }
    }
    setRunningAutonomousAll(false);
    showToast(
      'Toplu Otonom Başlatıldı! 🤖',
      `${count} uygulama kayıtlı rehberleriyle otonom modlama kuyruğuna alındı!`,
      'success'
    );
  };

  const handleApplyUpdate = async (item: UpdateItem) => {
    setApplyingId(item.listing_id);
    try {
      const res = await fetch('/api/update-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: item.listing_id,
          new_version: item.latest_version,
          download_url: item.download_url,
          source_name: item.source_name,
          release_notes: item.release_notes,
          variants_update: item.variants_needing_update,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Başarılı', data.message, 'success');
        // Move from updatesAvailable to upToDate locally
        setUpdatesAvailable((prev) => prev.filter((u) => u.listing_id !== item.listing_id));
        setUpToDate((prev) => [
          {
            listing_id: item.listing_id,
            title: item.title,
            current_version: item.latest_version,
            source: item.source_name,
          },
          ...prev,
        ]);
      } else {
        showToast('Güncelleme Hatası', data.error || 'Güncelleme uygulanamadı.', 'error');
      }
    } catch (err: any) {
      showToast('Hata', err.message, 'error');
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyAll = async () => {
    if (updatesAvailable.length === 0) return;
    setApplyingAll(true);
    let successCount = 0;
    for (const item of updatesAvailable) {
      try {
        const res = await fetch('/api/update-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: item.listing_id,
            new_version: item.latest_version,
            download_url: item.download_url,
            source_name: item.source_name,
            release_notes: item.release_notes,
            variants_update: item.variants_needing_update,
          }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        }
      } catch (e) {
        console.error('Batch apply error:', e);
      }
    }
    setApplyingAll(false);
    showToast('Toplu Güncelleme', `${successCount} uygulama başarıyla güncellendi!`, 'success');
    fetchUpdates();
  };

  // Filtered lists
  const filteredAvailable = updatesAvailable.filter((it) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      it.title.toLowerCase().includes(q) ||
      (it.packageName && it.packageName.toLowerCase().includes(q));
    const matchesSource =
      sourceFilter === 'ALL' ||
      (sourceFilter === 'GITHUB' && (it.source_type === 'GITHUB_RELEASE' || it.source_type === 'GITHUB_REPO_APK')) ||
      (sourceFilter === 'SCRAPER' && it.source_type === 'WEB_SCRAPER');
    return matchesSearch && matchesSource;
  });

  const filteredScraperApps = scraperApps.filter((it) => {
    const q = searchQuery.toLowerCase();
    return (
      it.title.toLowerCase().includes(q) ||
      (it.packageName && it.packageName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-4 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-sm">{toast.title}</div>
            <div className="text-xs opacity-90">{toast.message}</div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 border border-white/10 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-wider mb-2">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
              Çok Kaynaklı Güncelleme Pipeline
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
              Uygulama Güncelleme Kontrol Merkezi
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              GitHub Releases, doğrudan depo içi APK'lar (Domino TV gibi), Supabase Web Scraper kuralları ve APK Manifest analizlerini eşzamanlı tarayarak güncellemeleri tek tıkla uygulayın.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={fetchUpdates}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Taranıyor...' : 'Tümünü Kontrol Et'}
            </button>

            <button
              onClick={handleRunAllScrapers}
              disabled={scrapingAll || loading}
              className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-600/10 disabled:opacity-50"
              title="Resmi web sitelerinden APK indiren tüm scraper kurallarını sırayla çalıştır"
            >
              <Globe className={`w-4 h-4 text-purple-400 ${scrapingAll ? 'animate-spin' : ''}`} />
              {scrapingAll ? 'Scraperlar Taranıyor...' : 'Tüm Scraperları Tara'}
            </button>

            {updatesAvailable.filter((u) => u.has_guide).length > 0 && (
              <button
                onClick={handleAutonomousAll}
                disabled={runningAutonomousAll}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
                title="Kayıtlı rehberi olan tüm uygulamaları sıfır eforla otonom kuyruğa al"
              >
                {runningAutonomousAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-300" />
                )}
                Rehberli Tümünü Otonom Güncelle ({updatesAvailable.filter((u) => u.has_guide).length})
              </button>
            )}

            {updatesAvailable.length > 0 && (
              <button
                onClick={handleApplyAll}
                disabled={applyingAll}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {applyingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpCircle className="w-4 h-4" />
                )}
                Tümünü Güncelle ({updatesAvailable.length})
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5">
            <div className="text-xs text-slate-400">Güncelleme Mevcut</div>
            <div className="text-2xl font-bold text-amber-400 mt-0.5">
              {updatesAvailable.length}
            </div>
          </div>
          <div
            onClick={() => setActiveTab('scrapers')}
            className="bg-slate-900/40 rounded-xl p-3 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-all"
          >
            <div className="text-xs text-purple-300 flex items-center gap-1">
              <Globe className="w-3 h-3 text-purple-400" />
              Web Scraper Takibi
            </div>
            <div className="text-2xl font-bold text-purple-300 mt-0.5">
              {scraperApps.length}
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5">
            <div className="text-xs text-slate-400">Güncel Uygulamalar</div>
            <div className="text-2xl font-bold text-emerald-400 mt-0.5">
              {upToDate.length}
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5">
            <div className="text-xs text-slate-400">Son Kontrol</div>
            <div className="text-xs font-mono text-slate-300 mt-2 truncate">
              {checkedAt ? new Date(checkedAt).toLocaleTimeString('tr-TR') : 'Henüz yapılmadı'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-white/5">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-white/5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'available'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            Güncelleme Var ({updatesAvailable.length})
          </button>
          <button
            onClick={() => setActiveTab('scrapers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'scrapers'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            Web Scraper Takibi ({scraperApps.length})
          </button>
          <button
            onClick={() => setActiveTab('uptodate')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'uptodate'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Güncel ({upToDate.length})
          </button>
          <button
            onClick={() => setActiveTab('untracked')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'untracked'
                ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Kural Tanımsız ({untracked.length})
          </button>
        </div>

        {/* Source filter & Search input */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeTab === 'available' && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tüm Kaynaklar</option>
              <option value="GITHUB">Sadece GitHub</option>
              <option value="SCRAPER">Sadece Web Scraper</option>
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Uygulama veya paket ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <div className="text-sm font-medium text-slate-300">
            Tüm kaynaklar (GitHub + Web Scraper) taranıyor...
          </div>
          <div className="text-xs text-slate-500 max-w-sm">
            Depo içerikleri, son release'ler ve scraper regex eşleşmeleri kontrol ediliyor.
          </div>
        </div>
      ) : activeTab === 'available' ? (
        filteredAvailable.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-2xl border border-white/5">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
            <h3 className="text-lg font-semibold text-white">Harika! Bekleyen Güncelleme Yok</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tüm uygulamalar son sürümleriyle güncel durumda veya arama filtresine uyan sonuç yok.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAvailable.map((app) => {
              const activeJob = app.packageName ? recentJobs[app.packageName] : null;
              const isExpanded =
                expandedCards[app.listing_id] ||
                (activeJob &&
                  (activeJob.status === 'in_progress' ||
                    activeJob.status === 'running' ||
                    activeJob.status === 'pending' ||
                    activeJob.status === 'failed'));

              return (
                <div
                  key={app.listing_id}
                  className="glass-panel p-5 rounded-2xl border border-amber-500/20 hover:border-amber-500/40 transition-all flex flex-col justify-between group shadow-xl bg-slate-900/60"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {app.logoUrl ? (
                          <img
                            src={app.logoUrl}
                            alt={app.title}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 bg-slate-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {app.title.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-white text-base group-hover:text-amber-300 transition-colors">
                            {app.title}
                          </h4>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {app.packageName || 'Paket adı yok'}
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {app.has_guide && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 flex items-center gap-1 font-semibold shadow-sm">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            Rehber Var
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono border uppercase flex items-center gap-1 ${
                            app.source_type === 'WEB_SCRAPER'
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                              : app.source_type === 'GITHUB_REPO_APK'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                          }`}
                        >
                          {app.source_type === 'WEB_SCRAPER' ? (
                            <Globe className="w-3 h-3" />
                          ) : (
                            <Github className="w-3 h-3" />
                          )}
                          {app.source_name}
                        </span>
                      </div>
                    </div>

                    {/* Version Comparison Card */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Mevcut</span>
                          <span className="font-mono text-slate-300 font-medium">
                            v{app.current_version}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                        <div>
                          <span className="text-amber-400 block text-[10px] font-semibold">
                            Yeni Sürüm
                          </span>
                          <span className="font-mono text-amber-300 font-bold">
                            v{app.latest_version}
                          </span>
                        </div>
                      </div>

                      <a
                        href={app.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1 border border-white/5"
                        title="APK İndir"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-400" />
                        APK
                      </a>
                    </div>

                    {/* Multi-Architecture & Channel Variant Details */}
                    {app.variants_needing_update && app.variants_needing_update.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                        <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            Mimari & Kanal Ayrımı ({app.variants_needing_update.length} Varyant)
                          </span>
                          {app.channel_summary && (app.channel_summary.stable || app.channel_summary.beta) && (
                            <div className="flex items-center gap-2">
                              {app.channel_summary.stable && (
                                <span className="text-emerald-400">Stable: v{app.channel_summary.stable}</span>
                              )}
                              {app.channel_summary.beta && (
                                <span className="text-amber-400">Beta: v{app.channel_summary.beta}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {app.variants_needing_update.map((v, vIdx) => (
                            <div
                              key={vIdx}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/5 flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                    v.releaseChannel?.toLowerCase().includes('beta')
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {v.releaseChannel || 'Stable'}
                                </span>
                                <span className="text-slate-200 font-mono text-[11px] font-medium">
                                  {v.architecture}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                <span className="text-slate-400">v{v.current_version}</span>
                                <span className="text-slate-600">➔</span>
                                <span className="text-amber-300 font-bold">v{v.new_version}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {app.release_notes && (
                      <div className="mt-3 text-xs text-slate-400 line-clamp-2 italic bg-white/5 p-2 rounded-lg">
                        "{app.release_notes}"
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500">
                      {app.variants_needing_update?.length || 1} varyant güncellenecek
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Live Stage Progress Indicator Button */}
                      {activeJob && (
                        <button
                          type="button"
                          onClick={() => toggleCardExpansion(app.listing_id)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-md ${
                            activeJob.status === 'failed'
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                              : activeJob.status === 'published'
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                              : activeJob.status === 'completed'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : activeJob.status === 'cancelled'
                              ? 'bg-slate-800 border-slate-700 text-slate-400'
                              : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 animate-pulse'
                          }`}
                          title="Aşama durumunu ve hata ayrıntılarını aç/kapat"
                        >
                          {activeJob.status === 'failed' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          ) : activeJob.status === 'published' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          ) : activeJob.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : activeJob.status === 'cancelled' ? (
                            <Ban className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                          )}
                          {activeJob.status === 'failed'
                            ? 'Hata Detayı & Aşamalar'
                            : activeJob.status === 'published'
                            ? 'Aşamalar (Yayınlandı)'
                            : activeJob.status === 'completed'
                            ? 'Aşamalar (Tamamlandı)'
                            : activeJob.status === 'cancelled'
                            ? 'Aşamalar (İptal Edildi)'
                            : 'Aşamalar (Çalışıyor)'}
                        </button>
                      )}

                      {app.has_guide && (
                        <button
                          type="button"
                          onClick={() => handleOpenGuide(app)}
                          className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 text-xs font-medium transition-all flex items-center gap-1"
                          title="Daha önce uygulanan modlama rehberini ve YAML reçetesini incele"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                          Rehber
                        </button>
                      )}

                      {app.has_guide && (
                        <button
                          type="button"
                          onClick={() => handleAutonomousUpdate(app)}
                          disabled={runningAutonomousId === app.listing_id}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          title="Kayıtlı rehber kurallarını doğrudan yeni sürüme sıfır eforla uygular"
                        >
                          {runningAutonomousId === app.listing_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          Otonom Güncelle
                        </button>
                      )}

                      {/* Open Pre-Audit Security Modal for user to choose options before heavy decompile */}
                      <button
                        type="button"
                        onClick={() => setSelectedAppForAudit(app)}
                        className="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/10"
                        title="Decompile yapmadan önce güvenlik izinlerini ve mod seçeneklerini incele"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                        Güvenlik & Seçenekler
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyUpdate(app)}
                        disabled={applyingId === app.listing_id}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Yalnızca katalogdaki versiyon numarasını günceller"
                      >
                        {applyingId === app.listing_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Hızlı Uygula
                      </button>
                    </div>
                  </div>

                  {/* In-Card Live Progress & Stage Drawer */}
                  {isExpanded && activeJob && (
                    <div className="mt-4 pt-3 border-t border-white/10 rounded-xl bg-slate-950/80 p-3.5 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {activeJob.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : activeJob.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          ) : activeJob.status === 'cancelled' ? (
                            <Ban className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {activeJob.status === 'completed'
                                ? '✅ Pipeline Başarıyla Tamamlandı'
                                : activeJob.status === 'failed'
                                ? '❌ Pipeline Başarısız Oldu!'
                                : activeJob.status === 'cancelled'
                                ? '🛑 Pipeline İptal Edildi'
                                : '⚡ Modlama Pipeline Çalışıyor...'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              İş #{activeJob.id.substring(0, 8)} • {activeJob.status === 'cancelled' ? 'İptal Edildi' : activeJob.action}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openLeftPipelineDrawer(activeJob.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-medium flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          Sol Monitörde Canlı İzle
                        </button>
                      </div>

                      {/* Failure Message */}
                      {activeJob.status === 'failed' && (
                        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs font-mono space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Hata Açıklaması:
                          </div>
                          <div className="text-[11px] leading-relaxed">
                            {activeJob.error_message ||
                              'Derleme veya araç kurulumu sırasında hata oluştu.'}
                          </div>
                        </div>
                      )}

                      {/* 6-Step Visual Stepper */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                          Aşama Takip Çizelgesi
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {[
                            { step: 1, name: 'İndirme' },
                            { step: 2, name: 'Decompile' },
                            { step: 3, name: 'Smali Hook' },
                            { step: 4, name: 'İmzalama' },
                            { step: 5, name: 'Emülatör' },
                            { step: 6, name: 'Yayınlama' },
                          ].map((s) => {
                            const isDone = activeJob.status === 'completed';
                            const isErr =
                              activeJob.status === 'failed' && (s.step === 1 || s.step === 2);
                            const isCurrent =
                              (activeJob.status === 'in_progress' ||
                                activeJob.status === 'running' ||
                                activeJob.status === 'pending') &&
                              s.step === 2;

                            return (
                              <div
                                key={s.step}
                                className={`p-1.5 rounded-lg text-center border text-[10px] ${
                                  isDone
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                    : isErr
                                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                    : isCurrent
                                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 animate-pulse font-bold'
                                    : 'bg-slate-900 border-white/5 text-slate-500'
                                }`}
                              >
                                <div className="font-mono text-[9px]">{s.step}</div>
                                <div className="truncate text-[9px]">{s.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'scrapers' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                Web Scraper Gerektiren Uygulamalar ({filteredScraperApps.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                GitHub deposu olmayan veya resmi web sitelerinden doğrudan APK sunan uygulamalar. İstediğiniz uygulamanın yanındaki &quot;Scraper İle Tara&quot; butonuna basarak anında kontrol edebilir veya &quot;Kuralı Düzenle&quot; ile ayarlarını değiştirebilirsiniz.
              </p>
            </div>
            <button
              onClick={handleRunAllScrapers}
              disabled={scrapingAll}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shrink-0 transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
            >
              {scrapingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {scrapingAll ? 'Tüm Scraperlar Taranıyor...' : 'Tüm Scraperları Çalıştır'}
            </button>
          </div>

          {loadingScrapers ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
              <div className="text-xs text-slate-400">Scraper uygulamaları ve kuralları yükleniyor...</div>
            </div>
          ) : filteredScraperApps.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl border border-white/5">
              <Globe className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <div className="text-sm text-slate-300 font-medium">Scraper Uygulaması Bulunamadı</div>
              <div className="text-xs text-slate-500 mt-1">Arama filtresini temizleyin veya katalogdan uygulama ekleyin.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredScraperApps.map((app) => {
                const isScraping = scrapingAppId === app.listing_id;
                const result = scraperResults[app.listing_id];
                const rule = app.matched_rule;

                return (
                  <div
                    key={app.listing_id}
                    className="glass-panel p-5 rounded-2xl border border-purple-500/20 hover:border-purple-500/40 transition-all flex flex-col justify-between group shadow-xl bg-slate-900/60"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {app.logoUrl ? (
                            <img
                              src={app.logoUrl}
                              alt={app.title}
                              className="w-12 h-12 rounded-xl object-cover border border-white/10 bg-slate-800"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                              {app.title.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="font-semibold text-white text-base group-hover:text-purple-300 transition-colors">
                              {app.title}
                            </h4>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {app.packageName || 'Paket adı yok'}
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div>
                          {rule ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Kural Tanımlı
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono border bg-amber-500/10 border-amber-500/30 text-amber-300 flex items-center gap-1 font-semibold">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              Kural Yok
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rule & Target info */}
                      <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Mevcut Versiyon:</span>
                          <span className="font-mono text-slate-200 font-semibold">v{app.current_version || '1.0'}</span>
                        </div>
                        {rule ? (
                          <>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Kural Adı:</span>
                              <span className="font-medium text-purple-300 truncate max-w-[200px]">{rule.name}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Hedef URL:</span>
                              <a
                                href={rule.target_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-cyan-400 hover:underline truncate max-w-[220px] flex items-center gap-1"
                              >
                                {rule.target_url}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-amber-400/90 italic pt-1">
                            Bu uygulama için otomatik scraper kuralı tanımlanmamış. &quot;Kural Ekle&quot; ile web adresini ve indirme linki desenini ekleyebilirsiniz.
                          </div>
                        )}
                      </div>

                      {/* Live Scrape Result Display */}
                      {result && (
                        <div className="mt-3">
                          {result.status === 'loading' ? (
                            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2 animate-pulse">
                              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                              Web sitesi taranıyor ve APK bağlantısı aranıyor...
                            </div>
                          ) : result.status === 'success' ? (
                            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-emerald-400" />
                                  {result.message}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                  v{result.update_item?.latest_version}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAppForAudit(result.update_item)}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-[11px] font-semibold flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3 text-purple-400" />
                                  Güvenlik & Ön Denetim
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApplyUpdate(result.update_item)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 text-emerald-200 text-[11px] font-semibold flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  Hızlı Uygula
                                </button>
                              </div>
                            </div>
                          ) : result.status === 'up_to_date' ? (
                            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              {result.message}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                              {result.message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAppForScraperRule(app)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5 text-purple-400" />
                        {rule ? 'Kuralı Düzenle' : 'Kural Tanımla'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRunScraper(app)}
                        disabled={isScraping || !rule}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-lg ${
                          rule
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                            : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                        } disabled:opacity-50`}
                        title={rule ? 'Web sitesine bağlanıp en son APK ve sürümü sorgular' : 'Önce kural ekleyin'}
                      >
                        {isScraping ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        {isScraping ? 'Taranıyor...' : 'Scraper İle Tara'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'uptodate' ? (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 text-xs font-semibold text-slate-300">
            Güncel Olan Uygulamalar ({upToDate.length})
          </div>
          <div className="divide-y divide-white/5">
            {upToDate.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-white">{item.title}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-400 font-mono">
                  <span>v{item.current_version}</span>
                  <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                    {item.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 text-xs font-semibold text-slate-300">
            Otomatik Güncelleme Kuralı Tanımlanmamış Uygulamalar ({untracked.length})
          </div>
          <div className="divide-y divide-white/5">
            {untracked.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {item.packageName || 'Paket yok'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">v{item.current_version || '1.0'}</span>
                  <a
                    href={`/catalog?search=${encodeURIComponent(item.title)}`}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] border border-white/5"
                  >
                    Kataloğu Aç
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Audit Security & Mod Options Modal */}
      {selectedAppForAudit && (
        <PreAuditModal
          app={selectedAppForAudit}
          onClose={() => setSelectedAppForAudit(null)}
          onSuccess={(res) => {
            showToast('Pipeline Başlatıldı! 🛡️', res.message, 'success');
            setExpandedCards((prev) => ({
              ...prev,
              [selectedAppForAudit.listing_id]: true,
            }));
            if (typeof window !== 'undefined' && res.jobId) {
              window.dispatchEvent(
                new CustomEvent('primeforge:job_started', {
                  detail: {
                    jobId: res.jobId,
                    appName: selectedAppForAudit.title,
                    packageName: selectedAppForAudit.packageName,
                  },
                })
              );
            }
            fetchRecentJobs();
            setSelectedAppForAudit(null);
          }}
        />
      )}

      {/* Guide Inspection & Autonomous Run Modal */}
      {selectedAppForGuide && (
        <GuideModal
          app={selectedAppForGuide}
          guideContent={guideModalData?.guideContent}
          profileYaml={guideModalData?.profileYaml}
          successCount={guideModalData?.successCount}
          onClose={() => setSelectedAppForGuide(null)}
          onRunAutonomous={(app) => handleAutonomousUpdate(app)}
        />
      )}

      {/* Scraper Rule Definition & Test Modal */}
      {selectedAppForScraperRule && (
        <ScraperRuleModal
          app={selectedAppForScraperRule}
          initialRule={selectedAppForScraperRule.matched_rule}
          onClose={() => setSelectedAppForScraperRule(null)}
          onSaved={() => {
            handleScraperRuleSaved();
            setSelectedAppForScraperRule(null);
          }}
        />
      )}
    </div>
  );
}
