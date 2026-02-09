import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { VadeDetayListesi } from '@/components/dashboard/VadeDetayListesi';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';

// Global filtre kaldırıldı - widget-bazlı filtrelere geçildi
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDataSourceLoader } from '@/hooks/useDataSourceLoader';
import { useDiaFilterOptions } from '@/hooks/useDiaFilterOptions';
import { supabase } from '@/integrations/supabase/client';
import { diaGetGenelRapor, diaGetFinansRapor, getDiaConnectionInfo, DiaConnectionInfo } from '@/lib/diaClient';
import type { DiaGenelRapor, DiaFinansRapor, VadeYaslandirma, DiaCari } from '@/lib/diaClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plug, RefreshCw, Database, Plus, Move, Check, X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

function DashboardContent() {
  const navigate = useNavigate();
  
  // ===============================
  // HOOK CALLS - TÜM HOOK'LAR EN ÜSTTE, KONDİSYONSUZ
  // ===============================
  const { user } = useAuth();
  const { setSharedData, invalidateCache, setDiaConnected } = useDiaDataCache();
  const { refreshSettings } = useUserSettings();
  // Global filtre kaldırıldı
  const { filterOptions: diaFilterOptions, isLoading: filterOptionsLoading } = useDiaFilterOptions();
  
  // State hooks
  const [genelRapor, setGenelRapor] = useState<DiaGenelRapor | null>(null);
  const [finansRapor, setFinansRapor] = useState<DiaFinansRapor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [diaConnectionInfo, setDiaConnectionInfo] = useState<DiaConnectionInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dashboardPageId, setDashboardPageId] = useState<string | null>(null);
  
  // FloatingActions state for bottom bar
  const [floatingActionsState, setFloatingActionsState] = useState<{
    isDragMode: boolean;
    isWidgetEditMode: boolean;
    hasChanges: boolean;
    onContainerAdd: () => void;
    onDragModeToggle: () => void;
    onWidgetEditModeToggle: () => void;
    onSave: () => void;
    onCancel: () => void;
  } | null>(null);

  // DataSource loader hook - dashboardPageId null olsa bile çağrılmalı
  const dataSourceLoader = useDataSourceLoader(dashboardPageId);
  
  // Destructure after hook call to maintain consistent hook order
  // const { filters, setFilterOptions } = globalFilters; // Kaldırıldı
  const { 
    isLoading: dataSourcesLoading,
    isInitialLoad: dataSourcesInitialLoad,
    loadedSources,
    currentSourceName,
    totalSources,
    loadProgress,
    refresh: refreshDataSources,
    getSourceData 
  } = dataSourceLoader;

  // ===============================
  // EFFECTS
  // ===============================
  
  // Filtre seçeneklerini context'e aktar
  // Filtre seçeneklerini context'e aktarma kaldırıldı (global filtre yok)
  // Dashboard sayfası ID'sini al veya oluştur + DIA bağlantı durumunu kontrol et
  useEffect(() => {
    const initializeDashboard = async () => {
      if (!user) return;

      // DIA bağlantı durumunu kontrol et ve global context'e yaz
      try {
        const diaInfo = await getDiaConnectionInfo();
        setDiaConnectionInfo(diaInfo);
        setDiaConnected(diaInfo?.connected ?? false);
      } catch (error) {
        console.error('DIA connection check failed:', error);
        setDiaConnected(false);
      }

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

    initializeDashboard();
  }, [user]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const diaInfo = await getDiaConnectionInfo();
      setDiaConnectionInfo(diaInfo);
      setDiaConnected(diaInfo?.connected ?? false);

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

  // Otomatik yenileme kaldırıldı - kontör tasarrufu için

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

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex-1 flex flex-col pb-16">
        <Header 
          title="Dashboard" 
          subtitle="Günlük özet ve kritik bilgiler"
          onRefresh={refreshDataSources}
          isRefreshing={dataSourcesLoading}
          currentPage="dashboard"
          showWidgetPicker={false}
        />

        <main className="flex-1 p-2 md:p-4 overflow-auto">
            {/* Filter Side Panel kaldırıldı - widget-bazlı filtrelere geçildi */}

          {/* DIA Connection Status */}
          {!diaConnectionInfo?.connected && !dataSourcesLoading && loadedSources.length === 0 && (
            <div className="mb-2 md:mb-4 p-2 md:p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-between animate-fade-in">
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

          {/* Dashboard Status Bar - Sadece yükleniyor göster */}
          {dataSourcesLoading && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium animate-pulse">
                Yükleniyor...
              </span>
            </div>
          )}

          {/* Container Based Dashboard */}
          {dashboardPageId ? (
            <ContainerBasedDashboard
              pageId={dashboardPageId}
              widgetData={widgetData}
              isLoading={isLoading || dataSourcesLoading}
              hideFloatingActions={true}
              onFloatingActionsRender={setFloatingActionsState}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Vade Detay Listesi - Shows when a bar is clicked (cross-filtering) */}
          <div className="mt-2 md:mt-4">
            <VadeDetayListesi 
              cariler={cariler} 
              yaslandirma={yaslandirma}
            />
          </div>
        </main>

        {/* Bottom Action Bar */}
        {floatingActionsState && (
          <div 
            className="fixed bottom-0 right-0 z-40 h-14 bg-background/95 backdrop-blur-sm border-t border-border flex items-center justify-end px-4 gap-2"
            style={{ left: 'var(--main-sidebar-width, 16rem)' }}
          >
            {floatingActionsState.isDragMode ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={floatingActionsState.onCancel}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      İptal
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Değişiklikleri iptal et</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      onClick={floatingActionsState.onSave} 
                      disabled={!floatingActionsState.hasChanges}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Kaydet
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sıralamayı kaydet</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={floatingActionsState.isWidgetEditMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={floatingActionsState.onWidgetEditModeToggle}
                      className="gap-2"
                    >
                      {floatingActionsState.isWidgetEditMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                      {floatingActionsState.isWidgetEditMode ? 'Bitir' : 'Widget Düzenle'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {floatingActionsState.isWidgetEditMode ? 'Düzenlemeyi bitir' : 'Widget ekle/düzenle'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={floatingActionsState.onContainerAdd}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Container
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Yeni container ekle</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={floatingActionsState.onDragModeToggle}
                      className="gap-2"
                    >
                      <Move className="h-4 w-4" />
                      Sırala
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Container sıralamasını değiştir</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// DashboardPage artık App.tsx'teki tek GlobalFilterProvider'ı kullanıyor
// İç içe provider filtre kaybına neden oluyordu
export function DashboardPage() {
  return <DashboardContent />;
}
