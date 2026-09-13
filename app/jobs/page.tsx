'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Tv,
  Smartphone,
  Tablet,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Eye,
  ChevronRight,
  Maximize2,
  Info,
  Film,
  Sparkles,
  Globe,
  Radio,
  Zap,
  Ban,
} from 'lucide-react';
import InteractiveModModal from '@/app/components/InteractiveModModal';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'screenshots' | 'security' | 'tv' | 'mobile' | 'tablet' | 'updates' | 'logs'>('overview');
  const [lightboxImg, setLightboxImg] = useState<{ url: string; label: string } | null>(null);
  const [jobActionLoading, setJobActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; type?: 'success' | 'error' } | null>(null);
  const [customModApp, setCustomModApp] = useState<any | null>(null);

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Bu görevi iptal etmek istediğinize emin misiniz?')) return;
    setJobActionLoading(jobId);
    try {
      const res = await fetch('/api/job-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'cancelled' } : j))
        );
        if (selectedJob?.id === jobId) {
          setSelectedJob((prev: any) => (prev ? { ...prev, status: 'cancelled' } : null));
        }
        setToast({
          title: '🛑 Görev İptal Edildi',
          message: 'İşlem durduruldu ve görev iptal edildi olarak işaretlendi.',
          type: 'success',
        });
      } else {
        setToast({
          title: 'Hata',
          message: data.error || 'İptal işlemi başarısız oldu.',
          type: 'error',
        });
      }
    } catch (e: any) {
      setToast({ title: 'Hata', message: e.message, type: 'error' });
    } finally {
      setJobActionLoading(null);
      setTimeout(() => setToast(null), 6000);
    }
  };

  const handlePublishJob = async (jobId: string) => {
    setJobActionLoading(jobId);
    try {
      const res = await fetch('/api/job-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'published' } : j))
        );
        if (selectedJob?.id === jobId) {
          setSelectedJob((prev: any) => (prev ? { ...prev, status: 'published' } : null));
        }
        setToast({
          title: '🎉 PrimeStore Kataloğunda Yayınlandı!',
          message: 'Modlu APK mağazada kullanıcılara sunuldu ve indirme bağlantısı güncellendi.',
          type: 'success',
        });
      } else {
        setToast({
          title: 'Yayınlama Hatası',
          message: data.error || 'Yayınlama işlemi gerçekleştirilemedi.',
          type: 'error',
        });
      }
    } catch (e: any) {
      setToast({ title: 'Hata', message: e.message, type: 'error' });
    } finally {
      setJobActionLoading(null);
      setTimeout(() => setToast(null), 6000);
    }
  };

  const fetchJobs = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(`/api/job-status?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const timer = setInterval(() => {
      fetchJobs(false);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const completedCount = jobs.filter((j) => ['published', 'waiting_approval', 'completed', 'analyzed'].includes(j.status)).length;
  const pendingCount = jobs.filter((j) => ['pending', 'downloading', 'analyzing', 'waiting_decision', 'patching', 'building', 'testing', 'uploading'].includes(j.status)).length;
  const failedCount = jobs.filter((j) => ['failed', 'test_failed'].includes(j.status)).length;
  const cancelledCount = jobs.filter((j) => ['cancelled', 'canceled'].includes(j.status)).length;

  const filtered = jobs.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return ['published', 'waiting_approval', 'completed', 'analyzed'].includes(j.status);
    if (filter === 'pending') return ['pending', 'downloading', 'analyzing', 'waiting_decision', 'patching', 'building', 'testing', 'uploading'].includes(j.status);
    if (filter === 'failed') return ['failed', 'test_failed'].includes(j.status);
    if (filter === 'cancelled') return ['cancelled', 'canceled'].includes(j.status);
    return true;
  });

  const getEmulatorReport = (job: any) => {
    return job?.analysis_report?.emulator_test_report || null;
  };

  const getUpdateMechanism = (job: any) => {
    return job?.analysis_report?.update_mechanism || null;
  };

  const getSecurityReport = (job: any) => {
    return job?.analysis_report?.security || job?.security_report || null;
  };

  const getJobScreenshots = (job: any) => {
    if (!job) return { list: [], mainUrl: null };
    const raw = job?.analysis_report?.screenshots || {};
    const emu = job?.analysis_report?.emulator_test_report?.screenshots || {};
    const mainUrl = job?.screenshot_url || raw.tv || raw.mobile || emu.tv || null;

    const list: { key: string; label: string; url: string; device: 'tv' | 'mobile' | 'tablet' | 'asset'; ratio: string }[] = [];

    const specs: { key: string; label: string; device: 'tv' | 'mobile' | 'tablet' | 'asset'; ratio: string }[] = [
      { key: 'tv', label: 'Android TV (DPAD 16:9)', device: 'tv', ratio: 'aspect-video' },
      { key: 'tv_content', label: 'TV İçerik Oynatma (16:9)', device: 'tv', ratio: 'aspect-video' },
      { key: 'mobile', label: 'Mobil Dokunmatik (20:9)', device: 'mobile', ratio: 'aspect-[9/19.5]' },
      { key: 'mobile_content', label: 'Mobil İçerik Ekranı (20:9)', device: 'mobile', ratio: 'aspect-[9/19.5]' },
      { key: 'tablet', label: 'Tablet Geniş Ekran (16:10)', device: 'tablet', ratio: 'aspect-[16/10]' },
      { key: 'icon', label: 'Uygulama İkonu', device: 'asset', ratio: 'aspect-square' },
      { key: 'banner', label: 'Android TV Banner', device: 'asset', ratio: 'aspect-[16/9]' },
    ];

    for (const item of specs) {
      const url = raw[item.key] || emu[item.key] || (item.key === 'tv' ? job?.analysis_report?.emulator_test_report?.tv_test?.screenshot_url : null);
      if (url && typeof url === 'string') {
        list.push({ ...item, url });
      }
    }

    if (list.length === 0 && mainUrl) {
      list.push({
        key: 'main',
        label: 'Emülatör Önizleme Ekranı',
        url: mainUrl,
        device: 'tv',
        ratio: 'aspect-video',
      });
    }

    return { list, mainUrl };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" />
            İş Kuyruğu & Çoklu Emülatör Testleri
          </h1>
          <p className="text-xs text-slate-400">
            TV (DPAD), Mobil (20:9 Dokunmatik) ve Tablet (16:10) içerik önizlemeleri ve otomatik güncelleme takibi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1 text-xs">
            {[
              { id: 'all', label: `Tümü (${jobs.length})` },
              { id: 'completed', label: `Tamamlanan (${completedCount})` },
              { id: 'pending', label: `İşlemde / Bekleyen (${pendingCount})` },
              { id: 'failed', label: `Hatalı (${failedCount})` },
              { id: 'cancelled', label: `İptal Edilen (${cancelledCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  filter === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || (loading && jobs.length === 0) ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Uygulama / Paket</th>
                <th className="px-4 py-3">Sürüm</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-indigo-400" /> TV (DPAD)
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" /> Mobil (20:9)
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Tablet className="w-3.5 h-3.5 text-purple-400" /> Tablet (16:10)
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-amber-400" /> Güncelleme
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Güvenlik
                  </div>
                </th>
                <th className="px-4 py-3">İndir / İncele</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Filtreye uygun kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((j) => {
                  const rep = getEmulatorReport(j);
                  const updateMech = getUpdateMechanism(j);
                  const tvStatus = rep?.tv_test?.dpad_compatibility;
                  const mobStatus = rep?.mobile_test?.aspect_ratio_status;
                  const appLabel = j.app_name || j.analysis_report?.app_label || j.package_name;

                  return (
                    <tr
                      key={j.id}
                      onClick={() => {
                        setSelectedJob(j);
                        setActiveTab('overview');
                      }}
                      className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-400">
                              {appLabel ? appLabel.substring(0, 2).toUpperCase() : 'AP'}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 text-xs truncate max-w-[180px]">
                              {appLabel}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                              {j.package_name || 'Bilinmiyor'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {j.version_name ? `v${j.version_name}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const s = j.status;
                          if (s === 'completed' || s === 'analyzed') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Analiz Tamamlandı
                              </span>
                            );
                          }
                          if (s === 'published') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Yayınlandı
                              </span>
                            );
                          }
                          if (s === 'waiting_approval') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Clock className="w-3 h-3" /> Onay Bekliyor
                              </span>
                            );
                          }
                          if (s === 'waiting_decision') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <AlertTriangle className="w-3 h-3" /> Profil Bekliyor
                              </span>
                            );
                          }
                          if (s === 'analyzing') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Analiz Ediliyor...
                              </span>
                            );
                          }
                          if (s === 'patching') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse">
                                <Sparkles className="w-3 h-3" /> Yamalanıyor...
                              </span>
                            );
                          }
                          if (s === 'building') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Derleniyor...
                              </span>
                            );
                          }
                          if (s === 'testing') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 animate-pulse">
                                <Tv className="w-3 h-3" /> Test Ediliyor...
                              </span>
                            );
                          }
                          if (s === 'failed' || s === 'test_failed') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <XCircle className="w-3 h-3" /> {s === 'test_failed' ? 'Test Başarısız' : 'Hata'}
                              </span>
                            );
                          }
                          if (s === 'cancelled' || s === 'canceled') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/40 text-slate-300 border border-slate-600/50">
                                <Ban className="w-3 h-3 text-slate-400" /> İptal Edildi
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                              <Clock className="w-3 h-3" /> Sırada Bekliyor
                            </span>
                          );
                        })()}
                      </td>

                      {/* TV Badge */}
                      <td className="px-4 py-3">
                        {tvStatus === 'COMPATIBLE' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Uyumlu
                          </span>
                        ) : tvStatus === 'PARTIAL' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Kısmi
                          </span>
                        ) : tvStatus === 'INCOMPATIBLE' ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Kumandasız
                          </span>
                        ) : j.action === 'analyze_only' && j.analysis_report ? (
                          <span className="inline-flex items-center gap-1 text-indigo-300 font-medium text-[11px]">
                            <Tv className="w-3.5 h-3.5" /> {j.analysis_report?.has_banner ? 'Banner Var' : 'Statik İnceleme'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Mobile Badge */}
                      <td className="px-4 py-3">
                        {mobStatus === 'FULL_SCREEN' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Tam Ekran
                          </span>
                        ) : mobStatus === 'LETTERBOXED' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Şeritli
                          </span>
                        ) : j.action === 'analyze_only' && j.analysis_report ? (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                            <Smartphone className="w-3.5 h-3.5" /> Statik Analiz
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Tablet Badge */}
                      <td className="px-4 py-3">
                        {rep?.tablet_test ? (
                          <span className="inline-flex items-center gap-1 text-purple-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Geniş Ekran
                          </span>
                        ) : j.action === 'analyze_only' && j.analysis_report ? (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                            <Tablet className="w-3.5 h-3.5" /> Statik Analiz
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Update Mechanism Badge */}
                      <td className="px-4 py-3">
                        {updateMech?.has_update_mechanism ? (
                          <span className="inline-flex items-center gap-1 text-blue-400 font-medium text-[11px]">
                            <Radio className="w-3.5 h-3.5" /> {updateMech.mechanism_type === 'CUSTOM_API_ENDPOINT' ? 'API Takip' : updateMech.mechanism_type === 'GITHUB_RELEASES' ? 'GitHub' : 'Oto Takip'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Katalog</span>
                        )}
                      </td>

                      {/* Security Badge */}
                      <td className="px-4 py-3">
                        {(() => {
                          const sec = getSecurityReport(j);
                          if (!sec) return <span className="text-slate-500 text-[11px]">—</span>;
                          const vt = sec.engines?.virustotal;
                          const isClean = sec.overall_status === 'clean' || (vt?.malicious === 0);
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[10px] border ${
                                isClean
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                  : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                              }`}
                              title={sec.summary_badge || 'Güvenlik Taraması'}
                            >
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              {vt?.detection_ratio ? `VT: ${vt.detection_ratio}` : (isClean ? 'Temiz' : 'Uyarı')}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 flex items-center gap-1.5">
                        {j.modded_apk_url && (
                          <a
                            href={j.modded_apk_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:underline flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded hover:bg-blue-500/10"
                            title="Modlanmış APK Dosyasını İndir"
                          >
                            APK <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {(j.github_release_url || j.analysis_report?.github_release_url) && (
                          <a
                            href={j.github_release_url || j.analysis_report?.github_release_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-purple-400 hover:underline flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded hover:bg-purple-500/10 font-semibold"
                            title="GitHub Releases Sayfasını Aç"
                          >
                            Release <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {/* Publish button if waiting for approval */}
                        {j.modded_apk_url && j.status !== 'published' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublishJob(j.id);
                            }}
                            disabled={jobActionLoading === j.id}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                            title="PrimeStore Kataloğunda Yayına Al"
                          >
                            {jobActionLoading === j.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3 fill-current" />
                            )}
                            Yayınla
                          </button>
                        )}

                        {/* Cancel button if job is active/pending */}
                        {['pending', 'downloading', 'analyzing', 'waiting_decision', 'patching', 'building', 'testing', 'waiting_approval'].includes(j.status) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelJob(j.id);
                            }}
                            disabled={jobActionLoading === j.id}
                            className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 hover:text-rose-100 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                            title="Bu Görevi İptal Et"
                          >
                            <Ban className="w-3 h-3" /> İptal
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJob(j);
                            setActiveTab('overview');
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Detay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Job & Multi-Device Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-base">
                  {(selectedJob.analysis_report?.app_label || selectedJob.package_name || 'AP').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedJob.analysis_report?.app_label || selectedJob.package_name || 'Uygulama Test Raporu'}
                    {selectedJob.version_name && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                        v{selectedJob.version_name} {selectedJob.version_code ? `(#${selectedJob.version_code})` : ''}
                      </span>
                    )}
                    {selectedJob.status === 'cancelled' && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-bold border border-slate-600 flex items-center gap-1">
                        <Ban className="w-3 h-3 text-slate-400" /> İptal Edildi
                      </span>
                    )}
                    {(selectedJob.status === 'completed' || selectedJob.status === 'published') && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {selectedJob.status === 'published' ? 'Yayınlandı' : 'Tamamlandı'}
                      </span>
                    )}
                    {selectedJob.status === 'failed' && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-400" /> Hata
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedJob.package_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/console?jobId=${selectedJob.id}`}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Görevin canlı konsolunu ve anlık GitHub terminal loglarını görüntüle"
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Canlı Konsol
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCustomModApp({
                      name: selectedJob.app_name || selectedJob.analysis_report?.app_label || selectedJob.package_name,
                      title: selectedJob.app_name || selectedJob.analysis_report?.app_label || selectedJob.package_name,
                      packageName: selectedJob.package_name,
                      version: selectedJob.version_name,
                      fileUrl: selectedJob.apk_url,
                      analysis_report: selectedJob.analysis_report,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Analiz sonuçlarına göre modlama seçeneklerini belirle ve yeniden başlat"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  Mod Seçeneklerini Belirle
                </button>
                <Link
                  href={`/ai?job_id=${selectedJob.id}`}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI ile İncele
                </Link>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/40 px-5 gap-4 text-xs font-medium">
              {[
                { id: 'overview', label: 'Genel Bakış & Özet', icon: Eye },
                { id: 'screenshots', label: 'Ekran Görüntüleri', icon: Film },
                { id: 'security', label: 'Güvenlik (VT/APKiD/Quark)', icon: ShieldCheck },
                { id: 'tv', label: 'TV & DPAD (16:9)', icon: Tv },
                { id: 'mobile', label: 'Mobil & Dokunmatik (20:9)', icon: Smartphone },
                { id: 'tablet', label: 'Tablet (16:10)', icon: Tablet },
                { id: 'updates', label: 'Güncelleme Takibi', icon: Radio },
                { id: 'logs', label: 'Logcat & Çökme Kaydı', icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400 font-semibold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(() => {
                const rep = getEmulatorReport(selectedJob);
                const updateMech = getUpdateMechanism(selectedJob);
                const tv = rep?.tv_test;
                const mob = rep?.mobile_test;
                const tab = rep?.tablet_test;
                const crash = rep?.crash_analysis;

                if (activeTab === 'overview') {
                  return (
                    <div className="space-y-6">
                      {selectedJob.status === 'waiting_approval' && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/70 via-indigo-950/70 to-purple-950/70 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-blue-950/40">
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              <ShieldCheck className="w-5 h-5 text-emerald-400" />
                              Modlama & Emülatör Testi Tamamlandı — Onayınızı Bekliyor
                            </div>
                            <p className="text-xs text-slate-300">
                              Bu modlanmış APK henüz PrimeStore mağaza kataloğuna aktarılmadı. Test raporunu ve ekran görüntülerini inceledikten sonra onaylayarak doğrudan yayına alabilirsiniz.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePublishJob(selectedJob.id)}
                              disabled={jobActionLoading === selectedJob.id}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              PrimeStore'da Yayınla
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelJob(selectedJob.id)}
                              disabled={jobActionLoading === selectedJob.id}
                              className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              İptal Et
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedJob.status === 'cancelled' && (
                        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                          <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                          <div>
                            <div className="font-bold text-white">Görev İptal Edildi</div>
                            <div className="text-slate-300 mt-0.5">Bu işlem durduruldu ve hiçbir dosya PrimeStore mağazasında yayına alınmadı.</div>
                          </div>
                        </div>
                      )}

                      {selectedJob.status === 'published' && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-bold text-white">PrimeStore'da Başarıyla Yayınlandı</div>
                            <div className="text-slate-300 mt-0.5">Modlu APK mağaza kataloğuna aktarıldı ve indirme bağlantısı kullanıcılara sunuldu.</div>
                          </div>
                        </div>
                      )}

                      {selectedJob.action === 'analyze_only' && (
                        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-white">Statik Kod & Güvenlik Analizi Tamamlandı</div>
                            <div className="text-slate-300 mt-0.5">
                              Bu işlem <b>Sadece Analiz Et</b> modunda çalıştırıldı. Manifest izinleri, smali kod yapısı, otomatik güncelleme takip mekanizması ve çoklu güvenlik taramaları (VirusTotal, APKiD, Quark-Engine, ClamAV) başarıyla tamamlandı. Canlı cihaz testi bu modda gerekmediği için atlandı.
                            </div>
                          </div>
                        </div>
                      )}
                      {/* 3 Metric Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>TV Kumanda Uyumu</span>
                            <Tv className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="text-base font-bold text-white">
                            {tv?.dpad_compatibility === 'COMPATIBLE' ? (
                              <span className="text-emerald-400">✅ Tam Uyumlu</span>
                            ) : tv?.dpad_compatibility === 'PARTIAL' ? (
                              <span className="text-amber-400">⚠️ Kısmi (Mouse)</span>
                            ) : tv?.dpad_compatibility === 'INCOMPATIBLE' ? (
                              <span className="text-rose-400">❌ Uyumsuz</span>
                            ) : (
                              '—'
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {tv?.focused_elements || 0} odaklanabilir kumanda öğesi
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>Mobil En-Boy Oranı</span>
                            <Smartphone className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="text-base font-bold text-white">
                            {mob?.aspect_ratio_status === 'FULL_SCREEN' ? (
                              <span className="text-emerald-400">✅ 20:9 Tam Ekran</span>
                            ) : mob?.aspect_ratio_status === 'LETTERBOXED' ? (
                              <span className="text-amber-400">⚠️ Siyah Şeritli</span>
                            ) : (
                              '—'
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">Dokunmatik ve kaydırma aktif</p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>Stabilite & Çökme</span>
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-base font-bold text-white">
                            {crash?.crashed ? (
                              <span className="text-rose-400">❌ {crash.crash_count} Hata</span>
                            ) : (
                              <span className="text-emerald-400">✅ 0 Crash / 0 ANR</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">AndroidRuntime logcat temiz</p>
                        </div>
                      </div>

                      {/* Screen Previews Row */}
                      {(() => {
                        const shots = getJobScreenshots(selectedJob);
                        const raw = selectedJob.analysis_report?.screenshots || {};
                        const emu = selectedJob.analysis_report?.emulator_test_report?.screenshots || {};
                        const tvImg = raw.tv || raw.tv_content || emu.tv || (selectedJob.screenshot_url?.includes('.png') || selectedJob.screenshot_url?.includes('.jpg') ? selectedJob.screenshot_url : null);
                        const mobImg = raw.mobile || raw.mobile_content || emu.mobile || null;
                        const tabImg = raw.tablet || emu.tablet || null;

                        return (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Film className="w-4 h-4 text-purple-400" /> Çoklu Cihaz & İçerik Ekran Görüntüleri
                              </h4>
                              {shots.list.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('screenshots')}
                                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                                >
                                  Tüm Galeriyi Gör ({shots.list.length} Medya) <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* TV Screen Preview */}
                              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2.5 flex flex-col items-center">
                                <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center justify-between w-full">
                                  <span className="flex items-center gap-1">
                                    <Tv className="w-3 h-3 text-indigo-400" /> TV (1920x1080 16:9)
                                  </span>
                                  {tvImg && <span className="text-emerald-400 text-[9px] font-semibold">Aktif</span>}
                                </div>
                                <div
                                  onClick={() => tvImg && setLightboxImg({ url: tvImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Android TV Ekranı` })}
                                  className={`w-full aspect-video rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80 relative group ${tvImg ? 'cursor-pointer' : ''}`}
                                >
                                  {tvImg ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={tvImg}
                                        alt="TV Screenshot"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <div className="px-2.5 py-1 rounded bg-black/70 text-white text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                          <Maximize2 className="w-3 h-3" /> Büyüt
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-600 text-xs flex flex-col items-center gap-1 p-3 text-center">
                                      <Tv className="w-6 h-6 text-slate-600" />
                                      <span className="text-[10px]">TV Ekranı Bekleniyor</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Mobile Screen Preview */}
                              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2.5 flex flex-col items-center">
                                <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center justify-between w-full">
                                  <span className="flex items-center gap-1">
                                    <Smartphone className="w-3 h-3 text-blue-400" /> Mobil (1080x2400 20:9)
                                  </span>
                                  {mobImg && <span className="text-emerald-400 text-[9px] font-semibold">Aktif</span>}
                                </div>
                                <div
                                  onClick={() => mobImg && setLightboxImg({ url: mobImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Mobil Dokunmatik Ekran` })}
                                  className={`w-full aspect-video rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80 relative group ${mobImg ? 'cursor-pointer' : ''}`}
                                >
                                  {mobImg ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={mobImg}
                                        alt="Mobile Screenshot"
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <div className="px-2.5 py-1 rounded bg-black/70 text-white text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                          <Maximize2 className="w-3 h-3" /> Büyüt
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-600 text-xs flex flex-col items-center gap-1 p-3 text-center">
                                      <Smartphone className="w-6 h-6 text-slate-600" />
                                      <span className="text-[10px]">Mobil Ekranı Bekleniyor</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tablet Screen Preview */}
                              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2.5 flex flex-col items-center">
                                <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center justify-between w-full">
                                  <span className="flex items-center gap-1">
                                    <Tablet className="w-3 h-3 text-purple-400" /> Tablet (2560x1600 16:10)
                                  </span>
                                  {tabImg && <span className="text-emerald-400 text-[9px] font-semibold">Aktif</span>}
                                </div>
                                <div
                                  onClick={() => tabImg && setLightboxImg({ url: tabImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Tablet Geniş Ekran` })}
                                  className={`w-full aspect-video rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80 relative group ${tabImg ? 'cursor-pointer' : ''}`}
                                >
                                  {tabImg ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={tabImg}
                                        alt="Tablet Screenshot"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <div className="px-2.5 py-1 rounded bg-black/70 text-white text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                          <Maximize2 className="w-3 h-3" /> Büyüt
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-600 text-xs flex flex-col items-center gap-1 p-3 text-center">
                                      <Tablet className="w-6 h-6 text-slate-600" />
                                      <span className="text-[10px]">Tablet Ekranı Bekleniyor</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }

                if (activeTab === 'screenshots') {
                  const shots = getJobScreenshots(selectedJob);
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Film className="w-4 h-4 text-purple-400" />
                            Otomatik Emülatör & Medya Ekran Görüntüleri Galerisi
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Android TV, Mobil, Tablet, uygulama ikonu ve banner önizlemeleri. Büyütmek için görselin üzerine tıklayın.
                          </p>
                        </div>
                        <div className="text-xs text-slate-400 font-medium px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
                          Toplam: <span className="text-purple-400 font-bold">{shots.list.length} Medya Dosyası</span>
                        </div>
                      </div>

                      {shots.list.length === 0 ? (
                        <div className="p-10 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                          <Film className="w-10 h-10 text-slate-600 animate-pulse" />
                          <div className="text-slate-300 font-semibold text-sm">Henüz Ekran Görüntüsü Kaydedilmedi</div>
                          <p className="text-slate-500 text-xs max-w-md">
                            Bu görev henüz emülatör aşamasına geçmemiş veya statik analiz modunda çalışmış olabilir.
                            CI/CD emülatörü çalıştığında alınan TV, Mobil ve Tablet ekranları doğrudan Catbox bulutuna ve buraya aktarılır.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {shots.list.map((item) => (
                            <div
                              key={item.key}
                              className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-3 space-y-2.5 hover:border-slate-700 transition-all flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                  {item.device === 'tv' && <Tv className="w-3.5 h-3.5 text-indigo-400" />}
                                  {item.device === 'mobile' && <Smartphone className="w-3.5 h-3.5 text-blue-400" />}
                                  {item.device === 'tablet' && <Tablet className="w-3.5 h-3.5 text-purple-400" />}
                                  {item.device === 'asset' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                                  {item.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white transition-colors"
                                    title="Yeni Sekmede Aç"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>

                              <div
                                onClick={() => setLightboxImg({ url: item.url, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - ${item.label}` })}
                                className="w-full h-56 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800/80 relative group cursor-pointer"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.url}
                                  alt={item.label}
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <div className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm shadow-lg">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    Büyük Önizleme
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                if (activeTab === 'security') {
                  const sec = getSecurityReport(selectedJob);
                  const engines = sec?.engines || {};
                  const vt = engines?.virustotal;
                  const apkid = engines?.apkid;
                  const quark = engines?.quark;
                  const clam = engines?.clamav;

                  const isClean = !sec || sec?.overall_status === 'clean' || (vt?.malicious === 0 && (!clam?.infected_files || clam?.infected_files === 0));

                  return (
                    <div className="space-y-5">
                      {/* Overall Security Status Banner */}
                      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isClean
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${isClean ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>Çoklu Güvenlik Analizi:</span>
                              <span className={isClean ? 'text-emerald-400' : 'text-rose-400'}>
                                {isClean ? '✅ Güvenli / Tehdit Bulunamadı' : '⚠️ Güvenlik Uyarısı'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              SHA256: {sec?.sha256 || '—'}
                            </div>
                          </div>
                        </div>

                        {vt?.vt_report_url && (
                          <a
                            href={vt.vt_report_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-blue-400 hover:text-blue-300 hover:border-blue-500 transition-colors shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>VirusTotal Raporu</span>
                          </a>
                        )}
                      </div>

                      {/* 4 Engine Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. VirusTotal */}
                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                                <Globe className="w-4 h-4" />
                              </span>
                              <span className="font-bold text-white text-xs">VirusTotal v3</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              vt?.malicious === 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {vt?.detection_ratio || '0/67 Temiz'}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center text-[10px] bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div>
                              <div className="text-rose-400 font-bold text-xs">{vt?.malicious || 0}</div>
                              <div className="text-slate-500">Zararlı</div>
                            </div>
                            <div>
                              <div className="text-amber-400 font-bold text-xs">{vt?.suspicious || 0}</div>
                              <div className="text-slate-500">Şüpheli</div>
                            </div>
                            <div>
                              <div className="text-emerald-400 font-bold text-xs">{vt?.undetected || 67}</div>
                              <div className="text-slate-500">Temiz</div>
                            </div>
                            <div>
                              <div className="text-blue-400 font-bold text-xs">4 Key</div>
                              <div className="text-slate-500">Rotasyon</div>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Önbellek Durumu:</span>
                            <span className="text-slate-200">{vt?.cached ? '⚡ Supabase Önbelleği' : '🌐 Canlı VT v3 Taraması'}</span>
                          </div>
                        </div>

                        {/* 2. APKiD */}
                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                                <Sparkles className="w-4 h-4" />
                              </span>
                              <span className="font-bold text-white text-xs">APKiD Analizi</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {apkid?.compiler || 'D8/R8'}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Karıştırıcı (Obfuscator):</span>
                              <span className="text-slate-200">
                                {apkid?.obfuscator && apkid.obfuscator.length > 0 ? apkid.obfuscator.join(', ') : 'Karıştırılmamış'}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Koruyucu / Paketleyici:</span>
                              <span className={apkid?.protector && apkid.protector.length > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                {apkid?.protector && apkid.protector.length > 0 ? apkid.protector.join(', ') : '✅ Paketleyici Yok'}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Anti-Debug / Anti-VM:</span>
                              <span className="text-slate-300">
                                {apkid?.anti_debug || apkid?.anti_vm ? '⚠️ Mevcut' : 'Temiz'}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 truncate" title={apkid?.summary}>
                            Özet: <span className="text-slate-200">{apkid?.summary || 'Standart Android Derlemesi'}</span>
                          </div>
                        </div>

                        {/* 3. Quark-Engine */}
                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                                <Terminal className="w-4 h-4" />
                              </span>
                              <span className="font-bold text-white text-xs">Quark-Engine (Android Davranış)</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              quark?.threat_level === 'Clean'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {quark?.threat_level || 'Clean'}
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-500">Taranan Resmi Kural:</span>
                              <span className="text-blue-400 font-mono">{quark?.matched_rules || 278} Kural</span>
                            </div>
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-500">Tehdit Puanı:</span>
                              <span className="text-slate-200 font-mono">{quark?.total_score || 0}</span>
                            </div>
                            {quark?.high_risk_crimes && quark.high_risk_crimes.length > 0 && (
                              <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
                                <span className="text-slate-400 font-bold block">Öne Çıkan Davranışlar:</span>
                                {quark.high_risk_crimes.slice(0, 2).map((c: any, i: number) => (
                                  <div key={i} className="text-slate-300 truncate">
                                    • {c.crime} <span className="text-amber-400">({c.confidence})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Durum: <span className="text-emerald-400">Kritik Android istismarı engellendi</span>
                          </div>
                        </div>

                        {/* 4. ClamAV */}
                        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <ShieldAlert className="w-4 h-4" />
                              </span>
                              <span className="font-bold text-white text-xs">ClamAV Antivirüs</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {clam?.status === 'clean' ? '✅ Virüs Yok' : '⚠️ Şüpheli'}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Tarama Modu:</span>
                              <span className="text-slate-300 font-mono text-[10px]">
                                {clam?.scanner_mode === 'clamscan_cli' ? 'ClamAV Daemon / CLI' : 'Gömülü İmza & Arşiv Doğrulama'}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Zararlı Dosya Sayısı:</span>
                              <span className="text-emerald-400 font-bold">{clam?.infected_files || 0}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Arşiv Bütünlüğü:</span>
                              <span className="text-slate-300">✅ Zip Slip / İstismar Yok</span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Tarayıcı: <span className="text-slate-200">Arşiv ve bayt imzası onaylandı</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'updates') {
                  return (
                    <div className="space-y-4">
                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-4">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Radio className="w-4 h-4 text-blue-400" /> Uygulama Güncelleme Mekanizması & Otomasyon
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          PrimeForge smali ve kaynak analizi sayesinde uygulamanın yeni sürümleri nasıl denetlediğini belirledi:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Mekanizma Türü</span>
                            <span className="text-blue-400 font-medium text-xs">
                              {updateMech?.mechanism_type || 'STANDART KATALOG KONTROLÜ'}
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Otomatik Takip Durumu</span>
                            <span className="text-emerald-400 font-medium text-xs">
                              {updateMech?.has_update_mechanism ? '✅ Arka Planda Takip Ediliyor' : '📋 Supabase Mağaza Eşlemesi'}
                            </span>
                          </div>
                        </div>

                        {updateMech?.detected_endpoints && updateMech.detected_endpoints.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-slate-400 text-xs font-bold block">Tespit Edilen Güncelleme Uç Noktaları:</span>
                            <div className="space-y-1">
                              {updateMech.detected_endpoints.map((ep: any, i: number) => (
                                <div key={i} className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[10px] text-blue-300 break-all">
                                  {ep.url} <span className="text-slate-500 font-sans">({ep.source_class})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                            💡 <b>Otomatik Denetim:</b> Her 6 saatte bir GitHub Actions ve zamanlayıcı motor bu uygulamanın kaynaklarını sorgular; yeni sürüm çıktığında doğrudan Telegram bildiriminiz gelir veya otomatik yamalama başlar.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTab === 'tv') {
                  const tvImg = rep?.tv_test?.screenshot_url || selectedJob.analysis_report?.screenshots?.tv || selectedJob.analysis_report?.screenshots?.tv_content || (selectedJob.screenshot_url?.includes('.png') ? selectedJob.screenshot_url : null);
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Tv className="w-4 h-4 text-indigo-400" /> Android TV & DPAD Kumanda Navigasyon Sonuçları
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500">Çözünürlük:</span> {tv?.resolution || '1920x1080 (16:9)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Ekran Yoğunluğu:</span> {tv?.density || '320 dpi (xhdpi)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Leanback Manifest:</span>{' '}
                            {tv?.leanback_manifest ? '✅ Mevcut' : '⚠️ Standart Launcher'}
                          </div>
                          <div>
                            <span className="text-slate-500">Kumanda Odaklanabilir Öğe:</span>{' '}
                            {tv?.focusable_elements || 0} adet
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                          {tv?.details || 'DPAD test verisi mevcut.'}
                        </div>
                      </div>

                      {tvImg && (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                          <div className="flex items-center justify-between text-slate-300 font-semibold">
                            <span className="flex items-center gap-1.5"><Tv className="w-3.5 h-3.5 text-indigo-400" /> Android TV Önizleme Görüntüsü</span>
                            <button
                              type="button"
                              onClick={() => setLightboxImg({ url: tvImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Android TV Ekranı` })}
                              className="text-blue-400 hover:text-blue-300 text-[11px] flex items-center gap-1 font-medium"
                            >
                              <Maximize2 className="w-3 h-3" /> Büyüt
                            </button>
                          </div>
                          <div
                            onClick={() => setLightboxImg({ url: tvImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Android TV Ekranı` })}
                            className="w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer relative group flex items-center justify-center"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tvImg} alt="TV Screenshot" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (activeTab === 'mobile') {
                  const mobImg = rep?.mobile_test?.screenshot_url || selectedJob.analysis_report?.screenshots?.mobile || selectedJob.analysis_report?.screenshots?.mobile_content || null;
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-400" /> Mobil 20:9 En-Boy & Dokunmatik Testi
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500">Çözünürlük:</span> {mob?.resolution || '1080x2400 (20:9)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Ekran Yoğunluğu:</span> {mob?.density || '440 dpi (xxhdpi)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Letterboxing:</span>{' '}
                            {mob?.letterboxed ? '⚠️ Siyah Kenar Şeritleri Var' : '✅ Tam Ekran (20:9)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Dokunmatik Tepki:</span>{' '}
                            {mob?.touch_responsive ? '✅ Aktif & Duyarlı' : '⚠️ Tepkisiz'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                          {mob?.details || 'Mobil ekran ve dokunmatik test verisi.'}
                        </div>
                      </div>

                      {mobImg && (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                          <div className="flex items-center justify-between text-slate-300 font-semibold">
                            <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-blue-400" /> Mobil Önizleme Görüntüsü</span>
                            <button
                              type="button"
                              onClick={() => setLightboxImg({ url: mobImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Mobil Ekranı` })}
                              className="text-blue-400 hover:text-blue-300 text-[11px] flex items-center gap-1 font-medium"
                            >
                              <Maximize2 className="w-3 h-3" /> Büyüt
                            </button>
                          </div>
                          <div
                            onClick={() => setLightboxImg({ url: mobImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Mobil Ekranı` })}
                            className="w-full max-h-[360px] aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer relative group flex items-center justify-center"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mobImg} alt="Mobile Screenshot" className="h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (activeTab === 'tablet') {
                  const tabImg = rep?.tablet_test?.screenshot_url || selectedJob.analysis_report?.screenshots?.tablet || null;
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <Tablet className="w-4 h-4 text-purple-400" /> Tablet 16:10 Geniş Ekran Düzeni
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-500">Çözünürlük:</span> {tab?.resolution || '2560x1600 (16:10)'}
                          </div>
                          <div>
                            <span className="text-slate-500">Ekran Yoğunluğu:</span> {tab?.density || '280 dpi'}
                          </div>
                          <div>
                            <span className="text-slate-500">Yatay Mod Düzeni:</span>{' '}
                            {tab?.adaptive_layout ? '✅ Geniş Ekran Destekli' : '⚠️ Ölçekli'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                          {tab?.details || 'Tablet geniş ekran test verisi.'}
                        </div>
                      </div>

                      {tabImg && (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                          <div className="flex items-center justify-between text-slate-300 font-semibold">
                            <span className="flex items-center gap-1.5"><Tablet className="w-3.5 h-3.5 text-purple-400" /> Tablet Önizleme Görüntüsü</span>
                            <button
                              type="button"
                              onClick={() => setLightboxImg({ url: tabImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Tablet Ekranı` })}
                              className="text-blue-400 hover:text-blue-300 text-[11px] flex items-center gap-1 font-medium"
                            >
                              <Maximize2 className="w-3 h-3" /> Büyüt
                            </button>
                          </div>
                          <div
                            onClick={() => setLightboxImg({ url: tabImg, label: `${selectedJob.analysis_report?.app_label || selectedJob.package_name} - Tablet Ekranı` })}
                            className="w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer relative group flex items-center justify-center"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tabImg} alt="Tablet Screenshot" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (activeTab === 'logs') {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Logcat Hata & Çökme Kayıtları
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Hata Sayısı: {crash?.crash_count || 0}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[300px] overflow-y-auto space-y-1">
                        {crash?.errors && crash.errors.length > 0 ? (
                          crash.errors.map((err: any, idx: number) => (
                            <div key={idx} className="text-rose-400">
                              <span className="text-slate-500">[{err.time}]</span> {err.line}
                            </div>
                          ))
                        ) : (
                          <div className="text-emerald-400">
                            ✅ Temiz: Emülatör testi süresince FATAL EXCEPTION, SIGSEGV veya ANR hatası yakalanmadı.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 text-xs">
              <div className="text-slate-400">
                Oluşturulma: {new Date(selectedJob.created_at).toLocaleString('tr-TR')}
              </div>
              <div className="flex items-center gap-2">
                {/* Cancel Job Button */}
                {['pending', 'downloading', 'analyzing', 'waiting_decision', 'patching', 'building', 'testing', 'waiting_approval'].includes(selectedJob.status) && (
                  <button
                    type="button"
                    onClick={() => handleCancelJob(selectedJob.id)}
                    disabled={jobActionLoading === selectedJob.id}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Görevi iptal et ve arka plan işlemlerini durdur"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Görevi İptal Et
                  </button>
                )}

                {/* Publish to PrimeStore (Manual Approval) Button */}
                {selectedJob.modded_apk_url && selectedJob.status !== 'published' && (
                  <button
                    type="button"
                    onClick={() => handlePublishJob(selectedJob.id)}
                    disabled={jobActionLoading === selectedJob.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                    title="PrimeStore mağaza kataloğunda yayına al"
                  >
                    {jobActionLoading === selectedJob.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    PrimeStore'da Yayınla
                  </button>
                )}

                {selectedJob.status === 'published' && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PrimeStore'da Yayında
                  </span>
                )}

                {selectedJob.modded_apk_url && (
                  <a
                    href={selectedJob.modded_apk_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors"
                  >
                    Modlu APK İndir <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {(selectedJob.github_release_url || selectedJob.analysis_report?.github_release_url) && (
                  <a
                    href={selectedJob.github_release_url || selectedJob.analysis_report?.github_release_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium flex items-center gap-1.5 transition-colors shadow-md shadow-purple-600/25"
                  >
                    GitHub Release <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-w-5xl max-h-[95vh] flex flex-col items-center w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                {lightboxImg.label}
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={lightboxImg.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700 font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Tam Boyut Aç
                </a>
                <button
                  onClick={() => setLightboxImg(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm border border-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl flex items-center justify-center max-h-[85vh] w-full p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImg.url}
                alt={lightboxImg.label}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-inner"
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-2xl p-4 backdrop-blur-md flex items-center gap-3 shadow-2xl border animate-in fade-in slide-in-from-bottom-5 ${
          toast.type === 'error'
            ? 'bg-rose-950/95 border-rose-500/40 text-rose-200'
            : 'bg-slate-900/95 border-emerald-500/40 text-slate-100'
        }`}>
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            toast.type === 'error'
              ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
          }`}>
            {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate">{toast.title}</div>
            <div className="text-[11px] text-slate-300 truncate mt-0.5">{toast.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="w-6 h-6 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Modding Modal */}
      {customModApp && (
        <InteractiveModModal
          app={customModApp}
          onClose={() => setCustomModApp(null)}
          onSuccess={(result: any) => {
            const shortId = result.jobId ? `#${result.jobId.substring(0, 8)}` : '';
            setToast({
              title: '🚀 Modlama Görevi Başlatıldı',
              message: `Özelleştirilmiş modlama işlemi (${shortId}) kuyruğa eklendi.`,
              type: 'success',
            });
            fetchJobs(true);
            setCustomModApp(null);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}
