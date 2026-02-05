// Impersonated Dashboard - Seçili kullanıcının dashboard görünümü
// Kullanıcının DIA bağlantısını kullanarak gerçek verileri çeker
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { DiaDataCacheProvider, useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Loader2, AlertCircle, RefreshCw, WifiOff, CheckCircle, LayoutDashboard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface UserPage {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface ImpersonatedDashboardProps {
  userId: string;
}

// İç bileşen - cache context içinde çalışır
function ImpersonatedDashboardInner({ userId }: ImpersonatedDashboardProps) {
  const { impersonatedProfile, isDiaConfigured } = useImpersonation();
  const { setDiaConnected, clearAllCache, isDiaConnected } = useDiaDataCache();
  
  const [userPages, setUserPages] = useState<UserPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
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

      // Yeni login gerekiyor - dia-api-test kullan (diaAutoLogin otomatik session alır)
      console.log('[ImpersonatedDashboard] Session expired or missing, triggering auto-login via dia-api-test');
      
      // dia-api-test edge function'ı hedef kullanıcı için otomatik login yapar
      // Basit bir test isteği gönder - bu session'ı yenileyecek
      const { data: testData, error: testError } = await supabase.functions.invoke('dia-api-test', {
        body: {
          targetUserId: userId,
          module: 'sis',
          method: 'sube_listele',
          limit: 1, // Sadece 1 kayıt - session test için yeterli
        }
      });

      if (testError || !testData?.success) {
        throw new Error(testError?.message || testData?.error || 'DIA bağlantısı kurulamadı');
      }

      console.log('[ImpersonatedDashboard] DIA auto-login successful via dia-api-test');
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

  // Kullanıcının tüm sayfalarını yükle
  const loadUserPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_pages')
      .select('id, name, slug, icon')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setUserPages(data);
      // Varsayılan olarak main-dashboard veya ilk sayfayı seç
      const mainPage = data.find(p => p.slug === 'main-dashboard');
      setSelectedPageId(mainPage?.id || data[0]?.id || null);
    } else {
      setUserPages([]);
      setSelectedPageId(null);
    }
  }, [userId]);

  // Sayfa ve DIA bağlantısını yükle
  useEffect(() => {
    const loadUserDashboard = async () => {
      setLoading(true);
      
      // Cache'i temizle - yeni kullanıcı verisi için
      clearAllCache();
      
      // Kullanıcının tüm sayfalarını yükle
      await loadUserPages();
      
      // DIA bağlantısını başlat
      await initializeDiaConnection();
      
      setLoading(false);
    };

    loadUserDashboard();
  }, [userId, clearAllCache, initializeDiaConnection, loadUserPages]);

  // Manuel DIA bağlantı yenileme
  const handleReconnect = async () => {
    clearAllCache();
    await initializeDiaConnection();
    if (diaStatus === 'connected') {
      toast.success('DIA bağlantısı yenilendi');
    }
  };

  // Sayfa değiştir
  const handlePageChange = (pageId: string) => {
    setSelectedPageId(pageId);
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

  // Sayfa seçici render
  const renderPageSelector = () => {
    if (userPages.length <= 1) return null;

    return (
      <div className="mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <Tabs value={selectedPageId || ''} onValueChange={handlePageChange}>
            <TabsList className="inline-flex h-9 gap-1 bg-muted/50 p-1">
              {userPages.map(page => (
                <TabsTrigger 
                  key={page.id} 
                  value={page.id}
                  className="gap-1.5 text-xs px-3"
                >
                  {page.slug === 'main-dashboard' ? (
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {page.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  };

  if (userPages.length === 0) {
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
        {renderPageSelector()}
        
        {selectedPageId && (
          <ContainerBasedDashboard 
            pageId={selectedPageId} 
            widgetData={{}} 
          />
        )}
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
