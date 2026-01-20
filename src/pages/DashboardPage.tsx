import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { VadeDetayListesi } from '@/components/dashboard/VadeDetayListesi';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { DashboardLoadingScreen } from '@/components/dashboard/DashboardLoadingScreen';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDataSourceLoader } from '@/hooks/useDataSourceLoader';
import { supabase } from '@/integrations/supabase/client';
import { diaGetGenelRapor, diaGetFinansRapor, getDiaConnectionInfo, DiaConnectionInfo } from '@/lib/diaClient';
import type { DiaGenelRapor, DiaFinansRapor, VadeYaslandirma, DiaCari } from '@/lib/diaClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiaQueryStats } from '@/components/dashboard/DiaQueryStats';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plug, RefreshCw, Clock, Timer, Edit, Check, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

function DashboardContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setSharedData, invalidateCache } = useDiaDataCache();
  const { refreshSettings } = useUserSettings();
  const [genelRapor, setGenelRapor] = useState<DiaGenelRapor | null>(null);
  const [finansRapor, setFinansRapor] = useState<DiaFinansRapor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [diaConnectionInfo, setDiaConnectionInfo] = useState<DiaConnectionInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dashboardPageId, setDashboardPageId] = useState<string | null>(null);
  
  // Otomatik yenileme ayarları
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60); // saniye cinsinden
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);
  
  // Widget düzenleme modu
  const [isWidgetEditMode, setIsWidgetEditMode] = useState(false);

  // Merkezi veri kaynağı loader - Sayfadaki tüm widget'ların veri kaynaklarını yükler
  const { 
    isLoading: dataSourcesLoading,
    isInitialLoad: dataSourcesInitialLoad,
    loadedSources,
    totalSources,
    loadProgress,
    refresh: refreshDataSources,
    getSourceData 
  } = useDataSourceLoader(dashboardPageId);
  // Dashboard sayfası ID'sini al veya oluştur
  useEffect(() => {
    const getOrCreateDashboardPage = async () => {
      if (!user) return;

      // Önce mevcut dashboard sayfasını ara
      const { data: existingPage } = await supabase
        .from('user_pages')
        .select('id')
        .eq('user_id', user.id)
        .eq('slug', 'main-dashboard')
        .single();

      if (existingPage) {
        setDashboardPageId(existingPage.id);
        return;
      }

      // Yoksa oluştur
      const { data: newPage, error } = await supabase
        .from('user_pages')
        .insert({
          user_id: user.id,
          name: 'Ana Dashboard',
          slug: 'main-dashboard',
          icon: 'LayoutDashboard',
          sort_order: 0,
          is_active: true,
        })
        .select('id')
        .single();

      if (newPage) {
        setDashboardPageId(newPage.id);
      }
    };

    getOrCreateDashboardPage();
  }, [user]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const diaInfo = await getDiaConnectionInfo();
      setDiaConnectionInfo(diaInfo);

      if (diaInfo?.hasCredentials) {
        const timestamp = Date.now();
        console.log(`Fetching DIA data at ${timestamp}, session valid: ${diaInfo.sessionValid}`);
        
        let dataFetched = false;

        const genelResult = await diaGetGenelRapor();

        if (genelResult.success && genelResult.data) {
          setGenelRapor(genelResult.data);
          dataFetched = true;
          
          // Cache'e cari listesini ekle - Widget'lar tekrar API çağrısı yapmasın
          if (genelResult.data.cariler && genelResult.data.cariler.length > 0) {
            setSharedData('cariListesi', genelResult.data.cariler);
            console.log(`[DIA Cache] Shared cari listesi: ${genelResult.data.cariler.length} kayıt`);
          }
        } else {
          console.error('Genel rapor error:', genelResult.error);
          const isSessionError = genelResult.error?.toLowerCase().includes('session') || 
                                  genelResult.error?.toLowerCase().includes('invalid');
          
          if (isSessionError) {
            console.log('Session error detected, retrying after delay...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const retryResult = await diaGetGenelRapor();
            if (retryResult.success && retryResult.data) {
              setGenelRapor(retryResult.data);
              dataFetched = true;
            } else {
              toast.error('DIA oturumu sona erdi. Lütfen tekrar deneyin veya Ayarlardan yeniden bağlanın.');
            }
          } else {
            toast.error(`Genel rapor hatası: ${genelResult.error}`);
          }
        }

        const finansResult = await diaGetFinansRapor();
        
        if (finansResult.success && finansResult.data) {
          setFinansRapor(finansResult.data);
          dataFetched = true;
        } else {
          console.error('Finans rapor error:', finansResult.error);
          if (!finansResult.error?.toLowerCase().includes('session')) {
            toast.error(`Finans rapor hatası: ${finansResult.error}`);
          }
        }

        if (dataFetched) {
          setLastUpdate(new Date());
          toast.success('DIA verileri güncellendi');
          const updatedInfo = await getDiaConnectionInfo();
          setDiaConnectionInfo(updatedInfo);
        }
      } else {
        toast.info('DIA bağlantı bilgileri eksik. Ayarlardan bağlantı yapın.');
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error('Veri çekme hatası');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // NOT: Kontör tasarrufu için legacy DIA rapor çekimi otomatik başlatılmıyor.
  // Dashboard verileri merkezi DataSourceLoader üzerinden bir kez yüklenir.
  // useEffect(() => {
  //   fetchData();
  // }, [fetchData]);

  // Otomatik yenileme zamanlayıcısı
  useEffect(() => {
    if (!autoRefreshEnabled) {
      setNextRefreshIn(null);
      return;
    }

    // Geri sayım başlat
    setNextRefreshIn(refreshInterval);
    
    const countdownInterval = setInterval(() => {
      setNextRefreshIn(prev => {
        if (prev === null || prev <= 1) {
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    // Yenileme zamanlayıcısı
     // NOT: Kontör tasarrufu için otomatik yenileme (DIA çağrısı) devre dışı.
     // const refreshTimer = setInterval(() => {
     //   if (!isLoading) {
     //     fetchData();
     //   }
     // }, refreshInterval * 1000);

    return () => {
      clearInterval(countdownInterval);
      // clearInterval(refreshTimer);
    };
  }, [autoRefreshEnabled, refreshInterval, fetchData, isLoading]);

  // Cariler listesi
  const cariler = useMemo<DiaCari[]>(() => {
    return genelRapor?.cariler || [];
  }, [genelRapor?.cariler]);

  // Yaslandirma data
  const yaslandirma: VadeYaslandirma = useMemo(() => {
    return genelRapor?.yaslandirma || finansRapor?.yaslandirma || {
      vade90Plus: 0,
      vade90: 0,
      vade60: 0,
      vade30: 0,
      guncel: 0,
      gelecek30: 0,
      gelecek60: 0,
      gelecek90: 0,
      gelecek90Plus: 0,
    };
  }, [genelRapor?.yaslandirma, finansRapor?.yaslandirma]);

  // Widget data object for DynamicWidgetRenderer
  const widgetData = useMemo(() => ({
    genelRapor,
    finansRapor,
    cariler,
    yaslandirma,
    bankaHesaplari: finansRapor?.bankaHesaplari || [],
    toplamBankaBakiye: finansRapor?.toplamBankaBakiyesi || 0,
  }), [genelRapor, finansRapor, cariler, yaslandirma]);

  // İlk yüklemede loading screen göster
  const showLoadingScreen = dataSourcesInitialLoad && totalSources > 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Loading Screen - İlk yükleme sırasında göster */}
      {showLoadingScreen && (
        <DashboardLoadingScreen
          progress={loadProgress}
          loadedSources={loadedSources.length}
          totalSources={totalSources}
        />
      )}
      <Header 
        title="Dashboard" 
        subtitle="Günlük özet ve kritik bilgiler"
        onRefresh={refreshDataSources}
        isRefreshing={dataSourcesLoading}
        currentPage="dashboard"
        showWidgetPicker={false}
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* DIA Connection Status */}
        {!diaConnectionInfo?.connected && (
          <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <Plug className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">
                  {diaConnectionInfo?.hasCredentials 
                    ? 'DIA oturumu sona erdi' 
                    : 'DIA ERP bağlantısı yok'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {diaConnectionInfo?.hasCredentials 
                    ? 'Yenile butonuna basarak tekrar bağlanabilirsiniz' 
                    : 'Gerçek veriler için DIA ayarlarını yapın'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {diaConnectionInfo?.hasCredentials && (
                <button 
                  onClick={refreshDataSources}
                  disabled={dataSourcesLoading}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${dataSourcesLoading ? 'animate-spin' : ''}`} />
                  Yeniden Bağlan
                </button>
              )}
              <button 
                onClick={() => navigate('/ayarlar')}
                className="btn-secondary text-sm px-4 py-2"
              >
                Ayarlar
              </button>
            </div>
          </div>
        )}

        {diaConnectionInfo?.connected && lastUpdate && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              <span>Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</span>
              <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
                DIA Bağlı
              </span>
              {/* Veri kaynakları durumu */}
              {loadedSources.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {loadedSources.length} kaynak
                </span>
              )}
              {dataSourcesLoading && (
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium animate-pulse">
                  Yükleniyor...
                </span>
              )}
              {/* Sorgu istatistikleri */}
              <DiaQueryStats />
            </div>
            
            {/* Kontroller */}
            <div className="flex items-center gap-3">
              {/* Widget Düzenleme Modu Butonu */}
              <Button
                variant={isWidgetEditMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsWidgetEditMode(!isWidgetEditMode)}
                className="h-8"
              >
                {isWidgetEditMode ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Düzenlemeyi Bitir
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Widget Düzenle
                  </>
                )}
              </Button>
              
              {autoRefreshEnabled && nextRefreshIn !== null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {nextRefreshIn}s
                </span>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <Select
                  value={refreshInterval.toString()}
                  onValueChange={(v) => setRefreshInterval(parseInt(v))}
                  disabled={!autoRefreshEnabled}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 sn</SelectItem>
                    <SelectItem value="60">1 dk</SelectItem>
                    <SelectItem value="120">2 dk</SelectItem>
                    <SelectItem value="300">5 dk</SelectItem>
                    <SelectItem value="600">10 dk</SelectItem>
                  </SelectContent>
                </Select>
                
                <button
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    autoRefreshEnabled 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Timer className="h-3 w-3" />
                  {autoRefreshEnabled ? 'Otomatik Aktif' : 'Otomatik Yenile'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Container Based Dashboard */}
        {dashboardPageId ? (
          <ContainerBasedDashboard
            pageId={dashboardPageId}
            widgetData={widgetData}
            isLoading={isLoading || dataSourcesLoading}
            isWidgetEditMode={isWidgetEditMode}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Vade Detay Listesi - Shows when a bar is clicked (cross-filtering) */}
        <div className="mt-6">
          <VadeDetayListesi 
            cariler={cariler} 
            yaslandirma={yaslandirma}
          />
        </div>
      </main>
    </div>
  );
}

export function DashboardPage() {
  return (
    <DashboardFilterProvider>
      <DashboardContent />
    </DashboardFilterProvider>
  );
}
