// Impersonated Dashboard - Seçili kullanıcının dashboard görünümü
// Kullanıcının DIA bağlantısını kullanarak gerçek verileri çeker
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { DiaDataCacheProvider, useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ImpersonatedDashboardProps {
  userId: string;
}

// İç bileşen - cache context içinde çalışır
function ImpersonatedDashboardInner({ userId }: ImpersonatedDashboardProps) {
  const { impersonatedProfile, isDiaConfigured } = useImpersonation();
  const { setDiaConnected, clearAllCache, isDiaConnected } = useDiaDataCache();
  
  const [pageId, setPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaStatus, setDiaStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [diaError, setDiaError] = useState<string | null>(null);

  // DIA oturumu başlat - impersonated user'ın bilgileriyle
  const initializeDiaConnection = useCallback(async () => {
    if (!impersonatedProfile || !isDiaConfigured) {
      console.log('[ImpersonatedDashboard] DIA not configured for this user');
      setDiaStatus('idle');
      return false;
    }

    setDiaStatus('connecting');
    setDiaError(null);

    try {
      console.log('[ImpersonatedDashboard] Initializing DIA connection for:', impersonatedProfile.email);
      
      // Önce mevcut session'ı kontrol et
      const sessionExpires = impersonatedProfile.dia_session_expires 
        ? new Date(impersonatedProfile.dia_session_expires) 
        : null;
      const isSessionValid = sessionExpires && sessionExpires > new Date() && impersonatedProfile.dia_session_id;

      if (isSessionValid) {
        console.log('[ImpersonatedDashboard] Using existing valid session');
        setDiaStatus('connected');
        setDiaConnected(true);
        return true;
      }

      // Yeni login gerekiyor
      console.log('[ImpersonatedDashboard] Session expired or missing, performing fresh login');
      
      const { data: loginData, error: loginError } = await supabase.functions.invoke('dia-login', {
        body: {
          sunucuAdi: impersonatedProfile.dia_sunucu_adi,
          wsKullanici: impersonatedProfile.dia_ws_kullanici,
          wsSifre: impersonatedProfile.dia_ws_sifre,
          apiKey: impersonatedProfile.dia_api_key,
          firmaKodu: impersonatedProfile.firma_kodu,
          donemKodu: impersonatedProfile.donem_kodu,
          // Super admin olarak impersonated user için login yapıyoruz
          targetUserId: userId,
        }
      });

      if (loginError || !loginData?.success) {
        throw new Error(loginError?.message || loginData?.error || 'DIA bağlantısı kurulamadı');
      }

      console.log('[ImpersonatedDashboard] DIA login successful');
      setDiaStatus('connected');
      setDiaConnected(true);
      return true;

    } catch (error: any) {
      console.error('[ImpersonatedDashboard] DIA connection error:', error);
      setDiaError(error.message || 'DIA bağlantı hatası');
      setDiaStatus('error');
      setDiaConnected(false);
      return false;
    }
  }, [impersonatedProfile, isDiaConfigured, userId, setDiaConnected]);

  // Sayfa ve DIA bağlantısını yükle
  useEffect(() => {
    const loadUserDashboard = async () => {
      setLoading(true);
      
      // Cache'i temizle - yeni kullanıcı verisi için
      clearAllCache();
      
      // Kullanıcının main-dashboard sayfasını bul
      const { data, error } = await supabase
        .from('user_pages')
        .select('id')
        .eq('user_id', userId)
        .eq('slug', 'main-dashboard')
        .single();

      if (!error && data) {
        setPageId(data.id);
      } else {
        setPageId(null);
      }
      
      // DIA bağlantısını başlat
      await initializeDiaConnection();
      
      setLoading(false);
    };

    loadUserDashboard();
  }, [userId, clearAllCache, initializeDiaConnection]);

  // Manuel DIA bağlantı yenileme
  const handleReconnect = async () => {
    clearAllCache();
    await initializeDiaConnection();
    if (diaStatus === 'connected') {
      toast.success('DIA bağlantısı yenilendi');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Kullanıcı verileri yükleniyor...
        </p>
      </div>
    );
  }

  // DIA bağlantı durumu banner
  const renderDiaStatus = () => {
    if (!isDiaConfigured) {
      return (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              DIA Bağlantısı Yapılandırılmamış
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Bu kullanıcının DIA ERP bağlantı ayarları henüz yapılmamış.
            </p>
          </div>
        </div>
      );
    }

    if (diaStatus === 'connecting') {
      return (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            DIA bağlantısı kuruluyor...
          </p>
        </div>
      );
    }

    if (diaStatus === 'error') {
      return (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              DIA Bağlantı Hatası
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">{diaError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReconnect}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Tekrar Dene
          </Button>
        </div>
      );
    }

    if (diaStatus === 'connected') {
      return (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              DIA Bağlantısı Aktif
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {impersonatedProfile?.firma_adi || impersonatedProfile?.firma_kodu} • {impersonatedProfile?.dia_sunucu_adi}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReconnect}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    return null;
  };

  if (!pageId) {
    return (
      <div className="p-6">
        {renderDiaStatus()}
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Bu kullanıcının henüz bir dashboard sayfası bulunmuyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardFilterProvider>
      <div className="p-6 h-full overflow-auto">
        {renderDiaStatus()}
        <ContainerBasedDashboard 
          pageId={pageId} 
          widgetData={{}} 
        />
      </div>
    </DashboardFilterProvider>
  );
}

// Ana bileşen - kendi cache provider'ı ile
export function ImpersonatedDashboard({ userId }: ImpersonatedDashboardProps) {
  return (
    <DiaDataCacheProvider userId={userId}>
      <ImpersonatedDashboardInner userId={userId} />
    </DiaDataCacheProvider>
  );
}