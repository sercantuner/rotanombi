import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { TopCustomers } from '@/components/dashboard/TopCustomers';
import { getDashboardStats } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { 
  TrendingUp, 
  Wallet, 
  CreditCard, 
  AlertTriangle,
  DollarSign,
  PiggyBank
} from 'lucide-react';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    const result = await getDashboardStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
    setIsLoading(false);
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Toplam Ciro"
            value={stats ? formatCurrency(stats.toplamCiro) : '—'}
            icon={TrendingUp}
            trend="up"
            trendValue="+12% bu ay"
            variant="default"
          />
          <StatCard
            title="Günlük Satış"
            value={stats ? formatCurrency(stats.gunlukSatis) : '—'}
            icon={DollarSign}
            trend="up"
            trendValue="+8% dün"
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
            trendValue="-5% bu ay"
            variant="warning"
          />
          <StatCard
            title="Net Bakiye"
            value={stats ? formatCurrency(stats.netBakiye) : '—'}
            icon={PiggyBank}
            trend="up"
            trendValue="+18%"
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
              <button className="btn-secondary text-sm py-4">
                <span className="block text-lg mb-1">📊</span>
                Satış Raporu
              </button>
              <button className="btn-secondary text-sm py-4">
                <span className="block text-lg mb-1">💰</span>
                Finans Raporu
              </button>
              <button className="btn-secondary text-sm py-4">
                <span className="block text-lg mb-1">👥</span>
                Cari Listesi
              </button>
              <button className="btn-secondary text-sm py-4">
                <span className="block text-lg mb-1">📄</span>
                Fatura Listesi
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
