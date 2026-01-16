import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { TopCustomers } from '@/components/dashboard/TopCustomers';
import { getDashboardStats } from '@/lib/api';
import { diaGetGenelRapor, diaGetFinansRapor, getDiaConnectionInfo } from '@/lib/diaClient';
import type { DashboardStats } from '@/lib/types';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  Wallet, 
  CreditCard, 
  AlertTriangle,
  DollarSign,
  PiggyBank,
  Plug,
  RefreshCw
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiaConnected, setIsDiaConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    
    try {
      // Check DIA connection
      const diaInfo = await getDiaConnectionInfo();
      setIsDiaConnected(diaInfo?.connected || false);

      if (diaInfo?.connected) {
        // Fetch real data from DIA
        const [genelResult, finansResult] = await Promise.all([
          diaGetGenelRapor(),
          diaGetFinansRapor(),
        ]);

        if (genelResult.success && genelResult.data && finansResult.success && finansResult.data) {
          const genelData = genelResult.data;
          const finansData = finansResult.data;

          setStats({
            toplamCiro: finansData.toplamNakitPozisyon + genelData.toplamAlacak,
            gunlukSatis: 0, // Will be populated from satis rapor
            toplamAlacak: genelData.toplamAlacak,
            toplamBorc: genelData.toplamBorc,
            netBakiye: genelData.netBakiye,
            vadesiGecmis: genelData.vadesiGecmis,
          });
          setLastUpdate(new Date());
          toast.success('DIA verileri güncellendi');
        } else {
          // Show error but don't fail completely
          const error = genelResult.error || finansResult.error;
          if (error?.includes('oturum')) {
            toast.error('DIA oturumu sona ermiş. Ayarlardan tekrar bağlanın.');
          } else {
            toast.error(`DIA hatası: ${error}`);
          }
          // Fall back to mock data
          await loadMockData();
        }
      } else {
        // No DIA connection, use mock data
        await loadMockData();
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      await loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = async () => {
    const result = await getDashboardStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR')}`;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Toplam Ciro"
            value={stats ? formatCurrency(stats.toplamCiro) : '—'}
            icon={TrendingUp}
            trend="up"
            trendValue={isDiaConnected ? undefined : "+12% bu ay"}
            variant="default"
          />
          <StatCard
            title="Günlük Satış"
            value={stats ? formatCurrency(stats.gunlukSatis) : '—'}
            icon={DollarSign}
            trend="up"
            trendValue={isDiaConnected ? undefined : "+8% dün"}
            variant="success"
          />
          <StatCard
            title="Toplam Alacak"
            value={stats ? formatCurrency(stats.toplamAlacak) : '—'}
            icon={Wallet}
            trend="neutral"
            variant="default"
          />
          <StatCard
            title="Toplam Borç"
            value={stats ? formatCurrency(stats.toplamBorc) : '—'}
            icon={CreditCard}
            trend="down"
            trendValue={isDiaConnected ? undefined : "-5% bu ay"}
            variant="warning"
          />
          <StatCard
            title="Net Bakiye"
            value={stats ? formatCurrency(stats.netBakiye) : '—'}
            icon={PiggyBank}
            trend="up"
            trendValue={isDiaConnected ? undefined : "+18%"}
            variant="success"
          />
          <StatCard
            title="Vadesi Geçmiş"
            value={stats ? formatCurrency(stats.vadesiGecmis) : '—'}
            icon={AlertTriangle}
            variant="destructive"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="xl:col-span-2">
            <RevenueChart />
          </div>
          <div>
            <TopCustomers />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTransactions />
          
          {/* Quick Actions */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">Hızlı İşlemler</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => navigate('/satis')}
                className="btn-secondary text-sm py-4"
              >
                <span className="block text-lg mb-1">📊</span>
                Satış Raporu
              </button>
              <button 
                onClick={() => navigate('/finans')}
                className="btn-secondary text-sm py-4"
              >
                <span className="block text-lg mb-1">💰</span>
                Finans Raporu
              </button>
              <button 
                onClick={() => navigate('/cari')}
                className="btn-secondary text-sm py-4"
              >
                <span className="block text-lg mb-1">👥</span>
                Cari Listesi
              </button>
              <button 
                onClick={() => navigate('/settings')}
                className="btn-secondary text-sm py-4"
              >
                <span className="block text-lg mb-1">⚙️</span>
                Ayarlar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
