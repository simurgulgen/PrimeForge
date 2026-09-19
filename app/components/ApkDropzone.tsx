'use client';

import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCheck,
  AlertTriangle,
  Zap,
  Shield,
  Tv,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Cloud,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface ApkDropzoneProps {
  onJobStarted?: (jobId: string) => void;
}

export default function ApkDropzone({ onJobStarted }: ApkDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedData, setUploadedData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modding options
  const [runnerType, setRunnerType] = useState<'local' | 'cloud'>('local');
  const [enableTvDpad, setEnableTvDpad] = useState(false);
  const [enableAdBlocker, setEnableAdBlocker] = useState(true);
  const [enableSelfHealing, setEnableSelfHealing] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apk')) {
      setErrorMsg('Lütfen geçerli bir .apk dosyası seçin.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(50);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(85);
      const data = await res.json();

      if (res.ok && data.success) {
        setUploadProgress(100);
        setUploadedData(data);
        // If app doesn't have leanback, suggest enabling TV DPAD converter
        if (data.pre_audit?.tv_compatibility?.is_tv_ready === false) {
          setEnableTvDpad(true);
        }
      } else {
        setErrorMsg(data.error || 'Yükleme başarısız oldu.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Dosya yükleme hatası oluştu.');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleStartPipeline = async (action: string) => {
    if (!uploadedData) return;
    setActionLoading(true);
    setErrorMsg(null);

    const audit = uploadedData.pre_audit || {};
    const payload = {
      apk_url: uploadedData.apk_path,
      action: action,
      package_name: uploadedData.pre_audit?.package_name || '',
      app_name: uploadedData.file_name?.replace('.apk', ''),
      version_name: uploadedData.pre_audit?.version_name || '1.0.0',
      runner_type: runnerType,
      mod_options: {
        enable_tv_dpad_converter: enableTvDpad,
        enable_universal_ad_blocker: enableAdBlocker,
        enable_self_healing: enableSelfHealing,
      },
    };

    try {
      const res = await fetch('/api/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(
          runnerType === 'local'
            ? `✅ Yerel Windows Motoru Başlatıldı (#${data.job_id?.substring(0, 8)})`
            : `☁️ GitHub Actions Kuyruğuna Eklendi (#${data.job_id?.substring(0, 8)})`
        );
        if (onJobStarted) onJobStarted(data.job_id);
      } else {
        setErrorMsg(data.error || 'Görev tetiklenemedi.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Görev başlatma hatası.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full mb-8">
      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".apk"
        className="hidden"
      />

      {/* Drag & Drop or Click Area */}
      {!uploadedData && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-purple-500 bg-purple-950/30 scale-[1.01] shadow-2xl shadow-purple-500/20'
              : 'border-slate-700 bg-slate-900/50 hover:border-purple-500/60 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-blue-600/30 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                APK Dosyasını Buraya Sürükleyin veya <span className="text-purple-400 underline decoration-purple-400/50 underline-offset-4">Dosya Seçin</span>
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Bilgisayarınızdaki herhangi bir Android APK'sını anında yükleyin, hafif ön analizini çıkarın ve tek tıkla modlayın.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Hafif Ön Tarama (50ms)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Virüs/Reklam Tespiti
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Tv className="w-3.5 h-3.5 text-blue-400" /> Android TV Uyumlulaştırma
              </span>
            </div>

            {uploading && (
              <div className="w-full max-w-xs mt-4">
                <div className="flex justify-between text-xs text-purple-300 mb-1">
                  <span>Yükleniyor & Taranıyor...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uploaded File Inspection & Quick Action Card */}
      {uploadedData && (
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-6 shadow-2xl shadow-purple-950/40 relative overflow-hidden backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-600/30">
                <FileCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {uploadedData.file_name}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                    {uploadedData.file_size_mb} MB
                  </span>
                  {uploadedData.has_existing_profile && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Kayıtlı Rehber Var
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Paket: <span className="text-slate-300">{uploadedData.pre_audit?.package_name}</span> | Sürüm:{' '}
                  <span className="text-slate-300">{uploadedData.pre_audit?.version_name}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setUploadedData(null);
                setSuccessMsg(null);
                setErrorMsg(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition"
            >
              Farklı APK Seç
            </button>
          </div>

          {/* Quick Metrics & Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">Tehlikeli İzinler</span>
              <span className="text-base font-bold text-amber-400">
                {uploadedData.pre_audit?.permissions?.dangerous?.length || 0} Adet
              </span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">Reklam Ağları</span>
              <span className="text-base font-bold text-rose-400">
                {uploadedData.pre_audit?.detected_features?.ad_networks?.length || 0} Ağ
              </span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">IAP / Satın Alma</span>
              <span className="text-base font-bold text-blue-400">
                {uploadedData.pre_audit?.detected_features?.has_billing ? 'Tespit Edildi' : 'Yok'}
              </span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">TV / DPAD Durumu</span>
              <span className={`text-base font-bold ${uploadedData.pre_audit?.tv_compatibility?.is_tv_ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                {uploadedData.pre_audit?.tv_compatibility?.is_tv_ready ? 'TV Hazır' : 'Mobil Odaklı'}
              </span>
            </div>
          </div>

          {/* Configuration Options */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
              <span className="text-xs font-semibold text-slate-300">Çalıştırıcı Ortamı (Runner):</span>
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700/60 text-xs">
                <button
                  type="button"
                  onClick={() => setRunnerType('local')}
                  className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
                    runnerType === 'local'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" /> Lokal Windows (Hızlı / ADB)
                </button>
                <button
                  type="button"
                  onClick={() => setRunnerType('cloud')}
                  className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
                    runnerType === 'cloud'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" /> GitHub Actions (Bulut)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 transition">
                <input
                  type="checkbox"
                  checked={enableTvDpad}
                  onChange={(e) => setEnableTvDpad(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="flex items-center gap-1">
                  <Tv className="w-3.5 h-3.5 text-blue-400" /> Android TV (DPAD) Enjektörü
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 transition">
                <input
                  type="checkbox"
                  checked={enableAdBlocker}
                  onChange={(e) => setEnableAdBlocker(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> Evrensel Ağ Reklam Hook'u
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 transition">
                <input
                  type="checkbox"
                  checked={enableSelfHealing}
                  onChange={(e) => setEnableSelfHealing(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Self-Healing AI Onarım
                </span>
              </label>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {uploadedData.has_existing_profile && (
              <button
                disabled={actionLoading}
                onClick={() => handleStartPipeline('autonomous_from_guide')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 flex items-center gap-2 disabled:opacity-50 transition"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                Kayıtlı Rehberden Otonom Modla
              </button>
            )}

            <button
              disabled={actionLoading}
              onClick={() => handleStartPipeline('full_mod')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 flex items-center gap-2 disabled:opacity-50 transition"
            >
              {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Tam Modlama & İmzala
            </button>

            <button
              disabled={actionLoading}
              onClick={() => handleStartPipeline('sanitize_only')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 disabled:opacity-50 transition"
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              Sadece İzin & Reklam Temizliği
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
