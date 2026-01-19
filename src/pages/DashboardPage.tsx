import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { VadeDetayListesi } from '@/components/dashboard/VadeDetayListesi';
import { DraggableWidgetGrid } from '@/components/dashboard/DraggableWidgetGrid';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { diaGetGenelRapor, diaGetFinansRapor, getDiaConnectionInfo, DiaConnectionInfo } from '@/lib/diaClient';
import type { DiaGenelRapor, DiaFinansRapor, VadeYaslandirma, DiaCari } from '@/lib/diaClient';
import { getDefaultLayoutForPage } from '@/lib/widgetRegistry';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plug, RefreshCw } from 'lucide-react';

function DashboardContent() {
  const navigate = useNavigate();
  const { getPageLayout, updateWidgetOrder } = useUserSettings();
  const [genelRapor, setGenelRapor] = useState<DiaGenelRapor | null>(null);
  const [finansRapor, setFinansRapor] = useState<DiaFinansRapor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [diaConnectionInfo, setDiaConnectionInfo] = useState<DiaConnectionInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Get page layout
  const pageLayout = getPageLayout('dashboard');
  const defaultLayout = getDefaultLayoutForPage('dashboard');
  const widgets = pageLayout.widgets.length > 0 ? pageLayout.widgets : defaultLayout.widgets;

  // Handle widget reorder
  const handleReorder = useCallback(async (newOrder: string[]) => {
    await updateWidgetOrder('dashboard', newOrder);
  }, [updateWidgetOrder]);

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Dashboard" 
        subtitle="Günlük özet ve kritik bilgiler"
        onRefresh={fetchData}
        isRefreshing={isLoading}
        currentPage="dashboard"
        showWidgetPicker={true}
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
                  onClick={fetchData}
                  disabled={isLoading}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
            <span>Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</span>
            <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
              DIA Bağlı
            </span>
          </div>
        )}

        {/* Draggable Widget Grid */}
        <DraggableWidgetGrid
          widgets={widgets}
          currentPage="dashboard"
          data={widgetData}
          isLoading={isLoading}
          onReorder={handleReorder}
        />

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
