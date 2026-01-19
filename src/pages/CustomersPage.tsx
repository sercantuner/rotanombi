import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { DashboardFilterProvider, useDashboardFilters } from '@/contexts/DashboardFilterContext';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DetailedFiltersPanel } from '@/components/dashboard/DetailedFiltersPanel';
import { OzelKodDonutChart } from '@/components/dashboard/OzelKodDonutChart';
import { SektorDagilimi } from '@/components/dashboard/SektorDagilimi';
import { KaynakDagilimi } from '@/components/dashboard/KaynakDagilimi';
import { LokasyonDagilimi } from '@/components/dashboard/LokasyonDagilimi';
import { CariDonusumTrend } from '@/components/dashboard/CariDonusumTrend';
import { CariListesi } from '@/components/customers/CariListesi';
import { diaGetGenelRapor, getDiaConnectionInfo, DiaConnectionInfo } from '@/lib/diaClient';
import type { DiaGenelRapor, DiaCari } from '@/lib/diaClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plug, RefreshCw, Users, Building2, TrendingUp, TrendingDown } from 'lucide-react';

function CustomersContent() {
  const navigate = useNavigate();
  const { filters, setFilterOptions } = useDashboardFilters();
  const [genelRapor, setGenelRapor] = useState<DiaGenelRapor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [diaConnectionInfo, setDiaConnectionInfo] = useState<DiaConnectionInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const diaInfo = await getDiaConnectionInfo();
      setDiaConnectionInfo(diaInfo);

      if (diaInfo?.hasCredentials) {
        const genelResult = await diaGetGenelRapor();

        if (genelResult.success && genelResult.data) {
          setGenelRapor(genelResult.data);
          setLastUpdate(new Date());
          
          const cariler = genelResult.data.cariler || [];
          setFilterOptions({
            cariKartTipleri: [...new Set(cariler.map(c => c.carikarttipi).filter(Boolean))],
            ozelkodlar1: [...new Set(cariler.map(c => c.ozelkod1kod).filter(Boolean))],
            ozelkodlar2: [...new Set(cariler.map(c => c.ozelkod2kod).filter(Boolean))],
            ozelkodlar3: [...new Set(cariler.map(c => c.ozelkod3kod).filter(Boolean))],
            sehirler: [...new Set(cariler.map(c => c.sehir).filter(Boolean))],
            satisTemsilcileri: [...new Set(cariler.map(c => c.satiselemani).filter(Boolean))],
          });
          
          toast.success('Cari veriler güncellendi');
        } else {
          console.error('Genel rapor error:', genelResult.error);
          const isSessionError = genelResult.error?.toLowerCase().includes('session') || 
                                  genelResult.error?.toLowerCase().includes('invalid');
          
          if (isSessionError) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await diaGetGenelRapor();
            if (retryResult.success && retryResult.data) {
              setGenelRapor(retryResult.data);
              setLastUpdate(new Date());
              
              const cariler = retryResult.data.cariler || [];
              setFilterOptions({
                cariKartTipleri: [...new Set(cariler.map(c => c.carikarttipi).filter(Boolean))],
                ozelkodlar1: [...new Set(cariler.map(c => c.ozelkod1kod).filter(Boolean))],
                ozelkodlar2: [...new Set(cariler.map(c => c.ozelkod2kod).filter(Boolean))],
                ozelkodlar3: [...new Set(cariler.map(c => c.ozelkod3kod).filter(Boolean))],
                sehirler: [...new Set(cariler.map(c => c.sehir).filter(Boolean))],
                satisTemsilcileri: [...new Set(cariler.map(c => c.satiselemani).filter(Boolean))],
              });
            } else {
              toast.error('DIA oturumu sona erdi.');
            }
          } else {
            toast.error(`Veri hatası: ${genelResult.error}`);
          }
        }
      } else {
        toast.info('DIA bağlantı bilgileri eksik.');
      }
    } catch (error) {
      console.error('Customers fetch error:', error);
      toast.error('Veri çekme hatası');
    } finally {
      setIsLoading(false);
    }
  }, [setFilterOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merkezi filtreleme - tüm filtreler uygulanmış cari listesi
  const filteredCariler = useMemo<DiaCari[]>(() => {
    const cariler = genelRapor?.cariler || [];
    
    return cariler.filter(cari => {
      // Görünüm modu (potansiyel/cari/hepsi)
      if (filters.gorunumModu === 'potansiyel' && !cari.potansiyel) return false;
      if (filters.gorunumModu === 'cari' && cari.potansiyel) return false;
      
      // Durum (aktif/pasif/hepsi)
      if (filters.durum === 'aktif' && cari.durum === 'P') return false;
      if (filters.durum === 'pasif' && cari.durum !== 'P') return false;
      
      // Cari kart tipi (AL/AS/ST)
      if (filters.cariKartTipi.length > 0 && !filters.cariKartTipi.includes(cari.carikarttipi)) return false;
      
      // Özel kodlar
      if (filters.ozelkod1.length > 0 && !filters.ozelkod1.includes(cari.ozelkod1kod)) return false;
      if (filters.ozelkod2.length > 0 && !filters.ozelkod2.includes(cari.ozelkod2kod)) return false;
      if (filters.ozelkod3.length > 0 && !filters.ozelkod3.includes(cari.ozelkod3kod)) return false;
      
      // Şehir
      if (filters.sehir.length > 0 && !filters.sehir.includes(cari.sehir)) return false;
      
      // Satış temsilcisi
      if (filters.satisTemsilcisi.length > 0 && !filters.satisTemsilcisi.includes(cari.satiselemani)) return false;
      
      // Arama
      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        if (!cari.cariAdi?.toLowerCase().includes(search) && 
            !cari.cariKodu?.toLowerCase().includes(search)) return false;
      }
      
      return true;
    });
  }, [genelRapor?.cariler, filters]);

  // Özet istatistikler
  const stats = useMemo(() => {
    const toplam = filteredCariler.length;
    const potansiyel = filteredCariler.filter(c => c.potansiyel).length;
    const cari = toplam - potansiyel;
    const toplamAlacak = filteredCariler.reduce((sum, c) => sum + (c.bakiye > 0 ? c.bakiye : 0), 0);
    const toplamBorc = filteredCariler.reduce((sum, c) => sum + (c.bakiye < 0 ? Math.abs(c.bakiye) : 0), 0);
    
    return { toplam, potansiyel, cari, toplamAlacak, toplamBorc };
  }, [filteredCariler]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `₺${(value / 1000000000).toFixed(2)}B`;
    }
    if (value >= 1000000) {
      return `₺${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Cari Hesaplar" 
        subtitle="Müşteri ve tedarikçi analizi"
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
                  Gerçek cari verileri için DIA ayarlarını yapın
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

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam</p>
                <p className="text-xl font-bold">{stats.toplam.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cari</p>
                <p className="text-xl font-bold">{stats.cari.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Potansiyel</p>
                <p className="text-xl font-bold">{stats.potansiyel.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Alacak</p>
                <p className="text-lg font-bold text-success">{formatCurrency(stats.toplamAlacak)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Borç</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(stats.toplamBorc)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <DashboardFilters 
          totalCustomers={genelRapor?.toplamCariSayisi || 0} 
          filteredCount={filteredCariler.length}
        />

        {/* Detailed Filters Panel */}
        <DetailedFiltersPanel cariler={genelRapor?.cariler || []} />

        {/* Donut Charts Row - Özel Kod, Sektör, Kaynak */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 mt-6">
          <OzelKodDonutChart 
            cariler={filteredCariler} 
            isLoading={isLoading} 
          />
          <SektorDagilimi 
            cariler={filteredCariler} 
            isLoading={isLoading} 
          />
          <KaynakDagilimi 
            cariler={filteredCariler} 
            isLoading={isLoading} 
          />
        </div>

        {/* Lokasyon + Cari Dönüşüm Trend */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <LokasyonDagilimi 
            cariler={filteredCariler} 
            isLoading={isLoading} 
          />
          <CariDonusumTrend 
            cariler={filteredCariler} 
            isLoading={isLoading} 
          />
        </div>

        {/* Cari Listesi */}
        <CariListesi 
          cariler={filteredCariler} 
          isLoading={isLoading} 
        />
      </main>
    </div>
  );
}

export function CustomersPage() {
  return (
    <DashboardFilterProvider>
      <CustomersContent />
    </DashboardFilterProvider>
  );
}
