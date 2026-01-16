import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { TopCustomers } from '@/components/dashboard/TopCustomers';
import { BankaHesaplari } from '@/components/dashboard/BankaHesaplari';
import { VadeYaslandirmasi } from '@/components/dashboard/VadeYaslandirmasi';
import { OzelKodDonutChart } from '@/components/dashboard/OzelKodDonutChart';
import { SektorDagilimi } from '@/components/dashboard/SektorDagilimi';
import { KaynakDagilimi } from '@/components/dashboard/KaynakDagilimi';
import { LokasyonDagilimi } from '@/components/dashboard/LokasyonDagilimi';
import { CariDonusumTrend } from '@/components/dashboard/CariDonusumTrend';
import { SatisElemaniPerformans } from '@/components/dashboard/SatisElemaniPerformans';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DetailedFiltersPanel } from '@/components/dashboard/DetailedFiltersPanel';
import { VadeDetayListesi } from '@/components/dashboard/VadeDetayListesi';
import { DashboardFilterProvider, useDashboardFilters } from '@/contexts/DashboardFilterContext';
import { diaGetGenelRapor, diaGetFinansRapor, getDiaConnectionInfo, DiaConnectionInfo } from '@/lib/diaClient';
import type { DiaGenelRapor, DiaFinansRapor, VadeYaslandirma } from '@/lib/diaClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Wallet, 
  CreditCard, 
  AlertTriangle,
  Scale,
  Plug,
  RefreshCw,
  Building,
  TrendingDown,
  Clock
} from 'lucide-react';

function DashboardContent() {
  const navigate = useNavigate();
  const { setFilterOptions } = useDashboardFilters();
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

      // Eğer DIA bilgileri kayıtlı ise (credentials varsa), rapor çekmeyi dene
      // Backend auto-login mekanizması session expired ise yeniden login yapacak
      if (diaInfo?.hasCredentials) {
        const timestamp = Date.now();
        console.log(`Fetching DIA data at ${timestamp}, session valid: ${diaInfo.sessionValid}`);
        
        let dataFetched = false;

        // SIRALALI ÇAĞRI: Paralel çağrı yapınca auto-login race condition oluşuyor
        // (disconnect_same_user: true olduğu için iki login aynı anda olursa biri diğerini iptal eder)
        
        // Önce genel rapor çek (bu auto-login'i tetikler)
        const genelResult = await diaGetGenelRapor();

        if (genelResult.success && genelResult.data) {
          setGenelRapor(genelResult.data);
          dataFetched = true;
          
          // Update filter options from data
          const cariler = genelResult.data.cariler || [];
          setFilterOptions({
            ozelkodlar1: [...new Set(cariler.map(c => c.ozelkod1kod).filter(Boolean))],
            ozelkodlar2: [...new Set(cariler.map(c => c.ozelkod2kod).filter(Boolean))],
            ozelkodlar3: [...new Set(cariler.map(c => c.ozelkod3kod).filter(Boolean))],
            sehirler: [...new Set(cariler.map(c => c.sehir).filter(Boolean))],
            satisTemsilcileri: [...new Set(cariler.map(c => c.satiselemani).filter(Boolean))],
          });
        } else {
          console.error('Genel rapor error:', genelResult.error);
          const isSessionError = genelResult.error?.toLowerCase().includes('session') || 
                                  genelResult.error?.toLowerCase().includes('invalid');
          
          if (isSessionError) {
            // Session hatası - retry with delay (auto-login'in tamamlanması için bekle)
            console.log('Session error detected, retrying after delay...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const retryResult = await diaGetGenelRapor();
            if (retryResult.success && retryResult.data) {
              setGenelRapor(retryResult.data);
              dataFetched = true;
              
              const cariler = retryResult.data.cariler || [];
              setFilterOptions({
                ozelkodlar1: [...new Set(cariler.map(c => c.ozelkod1kod).filter(Boolean))],
                ozelkodlar2: [...new Set(cariler.map(c => c.ozelkod2kod).filter(Boolean))],
                ozelkodlar3: [...new Set(cariler.map(c => c.ozelkod3kod).filter(Boolean))],
                sehirler: [...new Set(cariler.map(c => c.sehir).filter(Boolean))],
                satisTemsilcileri: [...new Set(cariler.map(c => c.satiselemani).filter(Boolean))],
              });
            } else {
              toast.error('DIA oturumu sona erdi. Lütfen tekrar deneyin veya Ayarlardan yeniden bağlanın.');
            }
          } else {
            toast.error(`Genel rapor hatası: ${genelResult.error}`);
          }
        }

        // Sonra finans rapor çek (session artık geçerli olmalı)
        const finansResult = await diaGetFinansRapor();
        
        if (finansResult.success && finansResult.data) {
          setFinansRapor(finansResult.data);
          dataFetched = true;
        } else {
          console.error('Finans rapor error:', finansResult.error);
          // Finans hatası için session error kontrolü yapma, genel rapor zaten denerdi
          if (!finansResult.error?.toLowerCase().includes('session')) {
            toast.error(`Finans rapor hatası: ${finansResult.error}`);
          }
        }

        if (dataFetched) {
          setLastUpdate(new Date());
          toast.success('DIA verileri güncellendi');
          // Connection info'yu güncelle (backend auto-login yapmış olabilir)
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
  }, [setFilterOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Büyük rakamlar için akıllı kısaltma (999.000.000 TL'ye kadar)
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000000) {
      return `₺${(value / 1000000000).toFixed(2)}B`;
    }
    if (absValue >= 1000000) {
      return `₺${(value / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 100000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // KPI Değerleri
  const toplamAlacak = genelRapor?.toplamAlacak || 0;
  const toplamBorc = genelRapor?.toplamBorc || 0;
  const netBakiye = genelRapor?.netBakiye || 0;
  const vadesiGecmis = genelRapor?.vadesiGecmis || 0;
  const toplamBanka = finansRapor?.toplamBankaBakiyesi || 0;
  
  // Gecikmiş alacak ve borç - backend'den geliyor
  const gecikimisAlacak = genelRapor?.gecikimisAlacak || vadesiGecmis;
  const gecikimisBorc = genelRapor?.gecikimisBorc || 0;

  const yaslandirma: VadeYaslandirma = genelRapor?.yaslandirma || finansRapor?.yaslandirma || {
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

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Dashboard" 
        subtitle="Genel bakış ve özet bilgiler"
        onRefresh={fetchData}
        isRefreshing={isLoading}
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

        {/* Quick Filters - Müşteri sayısı: potansiyel = false olan tüm cariler */}
        <DashboardFilters totalCustomers={genelRapor?.cariler?.filter(c => !c.potansiyel).length || 0} />

        {/* Detailed Filters Panel */}
        <DetailedFiltersPanel cariler={genelRapor?.cariler || []} />

        {/* KPI Stats Grid - 5 KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <StatCard
            title="Toplam Alacak"
            value={formatCurrency(toplamAlacak)}
            icon={Wallet}
            trend="up"
            variant="success"
          />
          <StatCard
            title="Gecikmiş Alacak"
            value={formatCurrency(gecikimisAlacak)}
            icon={Clock}
            trend="neutral"
            variant="warning"
          />
          <StatCard
            title="Toplam Borç"
            value={formatCurrency(toplamBorc)}
            icon={CreditCard}
            trend="down"
            variant="destructive"
          />
          <StatCard
            title="Gecikmiş Borç"
            value={formatCurrency(gecikimisBorc)}
            icon={AlertTriangle}
            trend="neutral"
            variant="destructive"
          />
          <StatCard
            title="Net Bakiye"
            value={formatCurrency(netBakiye)}
            icon={Scale}
            trend={netBakiye >= 0 ? "up" : "down"}
            variant={netBakiye >= 0 ? "success" : "destructive"}
          />
        </div>

        {/* Nakit Akış Projeksiyonu */}
        <div className="mb-6">
          <VadeYaslandirmasi 
            yaslandirma={yaslandirma} 
            isLoading={isLoading} 
          />
        </div>

        {/* Vade Detay Listesi - Shows when a bar is clicked */}
        <VadeDetayListesi 
          cariler={genelRapor?.cariler || []} 
          yaslandirma={yaslandirma}
        />

        {/* Donut Charts Row - Özel Kod, Sektör, Kaynak */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 mt-6">
          <OzelKodDonutChart 
            cariler={genelRapor?.cariler || []} 
            isLoading={isLoading} 
          />
          <SektorDagilimi 
            cariler={genelRapor?.cariler || []} 
            isLoading={isLoading} 
          />
          <KaynakDagilimi 
            cariler={genelRapor?.cariler || []} 
            isLoading={isLoading} 
          />
        </div>

        {/* Lokasyon + Cari Dönüşüm Trend */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <LokasyonDagilimi 
            cariler={genelRapor?.cariler || []} 
            isLoading={isLoading} 
          />
          <CariDonusumTrend 
            cariler={genelRapor?.cariler || []} 
            isLoading={isLoading} 
          />
        </div>

        {/* Top Customers + Banka Hesapları */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <TopCustomers 
            cariler={genelRapor?.cariler || []} 
            isLoading={isLoading} 
          />
          <BankaHesaplari 
            bankaHesaplari={finansRapor?.bankaHesaplari || []} 
            toplamBakiye={toplamBanka}
            isLoading={isLoading} 
          />
        </div>

        {/* Satış Elemanı Performans */}
        <div className="mb-6">
          <SatisElemaniPerformans 
            satisElemanlari={genelRapor?.satisElemaniDagilimi || []} 
            isLoading={isLoading} 
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
