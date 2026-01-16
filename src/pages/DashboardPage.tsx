import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { TopCustomers } from '@/components/dashboard/TopCustomers';
import { BankaHesaplari } from '@/components/dashboard/BankaHesaplari';
import { VadeYaslandirmasi } from '@/components/dashboard/VadeYaslandirmasi';
import { OzelkodDagilimi } from '@/components/dashboard/OzelkodDagilimi';
import { SatisElemaniPerformans } from '@/components/dashboard/SatisElemaniPerformans';
import { diaGetGenelRapor, diaGetFinansRapor, getDiaConnectionInfo } from '@/lib/diaClient';
import type { DiaGenelRapor, DiaFinansRapor, VadeYaslandirma } from '@/lib/diaClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  Wallet, 
  CreditCard, 
  AlertTriangle,
  PiggyBank,
  Plug,
  RefreshCw,
  Building
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const [genelRapor, setGenelRapor] = useState<DiaGenelRapor | null>(null);
  const [finansRapor, setFinansRapor] = useState<DiaFinansRapor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiaConnected, setIsDiaConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Check DIA connection
      const diaInfo = await getDiaConnectionInfo();
      setIsDiaConnected(diaInfo?.connected || false);

      if (diaInfo?.connected) {
        // Fetch real data from DIA with cache-busting
        const timestamp = Date.now();
        console.log(`Fetching DIA data at ${timestamp}`);
        
        const [genelResult, finansResult] = await Promise.all([
          diaGetGenelRapor(),
          diaGetFinansRapor(),
        ]);

        if (genelResult.success && genelResult.data) {
          setGenelRapor(genelResult.data);
        } else {
          console.error('Genel rapor error:', genelResult.error);
          toast.error(`Genel rapor hatası: ${genelResult.error}`);
        }

        if (finansResult.success && finansResult.data) {
          setFinansRapor(finansResult.data);
        } else {
          console.error('Finans rapor error:', finansResult.error);
          toast.error(`Finans rapor hatası: ${finansResult.error}`);
        }

        if (genelResult.success || finansResult.success) {
          setLastUpdate(new Date());
          toast.success('DIA verileri güncellendi');
        }
      } else {
        toast.info('DIA bağlantısı yok. Ayarlardan bağlanabilirsiniz.');
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

  const formatCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Calculate stats from reports
  const toplamAlacak = genelRapor?.toplamAlacak || 0;
  const toplamBorc = genelRapor?.toplamBorc || 0;
  const netBakiye = genelRapor?.netBakiye || 0;
  const vadesiGecmis = genelRapor?.vadesiGecmis || 0;
  const toplamBanka = finansRapor?.toplamBankaBakiyesi || 0;

  const yaslandirma: VadeYaslandirma = genelRapor?.yaslandirma || finansRapor?.yaslandirma || {
    guncel: 0,
    vade30: 0,
    vade60: 0,
    vade90: 0,
    vade90Plus: 0,
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
        {!isDiaConnected && (
          <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <Plug className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">DIA ERP bağlantısı yok</p>
                <p className="text-sm text-muted-foreground">Gerçek veriler için DIA'ya bağlanın</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/settings')}
              className="btn-secondary text-sm px-4 py-2"
            >
              Bağlan
            </button>
          </div>
        )}

        {isDiaConnected && lastUpdate && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
            <span>Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</span>
            <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
              DIA Bağlı
            </span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <StatCard
            title="Banka Bakiyesi"
            value={formatCurrency(toplamBanka)}
            icon={Building}
            trend="neutral"
            variant="default"
          />
          <StatCard
            title="Toplam Alacak"
            value={formatCurrency(toplamAlacak)}
            icon={Wallet}
            trend="up"
            variant="success"
          />
          <StatCard
            title="Toplam Borç"
            value={formatCurrency(toplamBorc)}
            icon={CreditCard}
            trend="down"
            variant="warning"
          />
          <StatCard
            title="Net Bakiye"
            value={formatCurrency(netBakiye)}
            icon={PiggyBank}
            trend={netBakiye >= 0 ? "up" : "down"}
            variant={netBakiye >= 0 ? "success" : "destructive"}
          />
          <StatCard
            title="Vadesi Geçmiş"
            value={formatCurrency(vadesiGecmis)}
            icon={AlertTriangle}
            variant="destructive"
          />
        </div>

        {/* Main Content Row */}
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

        {/* Yaşlandırma Row */}
        <div className="mb-6">
          <VadeYaslandirmasi 
            yaslandirma={yaslandirma} 
            isLoading={isLoading} 
          />
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OzelkodDagilimi 
            ozelkodlar={genelRapor?.ozelkodDagilimi || []} 
            isLoading={isLoading} 
          />
          <SatisElemaniPerformans 
            satisElemanlari={genelRapor?.satisElemaniDagilimi || []} 
            isLoading={isLoading} 
          />
        </div>
      </main>
    </div>
  );
}
