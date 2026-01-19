import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Filter, Download, TrendingUp, Package, FileText, RotateCcw, Users } from 'lucide-react';
import { diaGetSatisRapor } from '@/lib/diaClient';
import type { DiaSatisRapor, MarkaDagilimi, SatisElemaniPerformans as SEP } from '@/lib/diaClient';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(160, 84%, 39%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 80%, 55%)',
  'hsl(0, 84%, 60%)',
  'hsl(180, 70%, 50%)',
];

export function SalesPage() {
  const [satisRapor, setSatisRapor] = useState<DiaSatisRapor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await diaGetSatisRapor();
      if (result.success && result.data) {
        setSatisRapor(result.data);
        toast.success('Satış verileri güncellendi');
      } else {
        toast.error(result.error || 'Satış raporu alınamadı');
      }
    } catch (error) {
      console.error('Satis rapor error:', error);
      toast.error('Satış raporu yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000000) {
      return `₺${(value / 1000000000).toFixed(2)}B`;
    }
    if (absValue >= 1000000) {
      return `₺${(value / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatFullCurrency = (value: number) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Marka bazlı verilerden pie chart data oluştur
  const markaPieData = (satisRapor?.markaBazli || []).slice(0, 6).map((m, i) => ({
    name: m.marka,
    value: m.netTutar,
    color: COLORS[i % COLORS.length],
  }));

  // Top ürünler
  const topProducts = satisRapor?.urunBazli?.slice(0, 5) || [];
  const maxProductTutar = topProducts[0]?.toplamTutar || 1;
  const totalProductsTutar = topProducts.reduce((sum, p) => sum + p.toplamTutar, 0);

  // Satış elemanı performansı
  const satisElemanlari = satisRapor?.satisElemaniPerformans || [];
  const maxSatisEleman = satisElemanlari[0]?.netSatis || 1;

  // Top müşteriler
  const topCariler = satisRapor?.cariBazli?.slice(0, 5) || [];
  const maxCariTutar = topCariler[0]?.toplamTutar || 1;

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Satış Raporu" 
        subtitle="Satış performansı ve ürün analizi"
        onRefresh={fetchData}
        isRefreshing={isLoading}
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* Filters */}
        <div className="glass-card rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <button 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'week' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
              onClick={() => setDateRange('week')}
            >
              Bu Hafta
            </button>
            <button 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'month' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
              onClick={() => setDateRange('month')}
            >
              Bu Ay
            </button>
            <button 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'year' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
              onClick={() => setDateRange('year')}
            >
              Bu Yıl
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2 text-sm py-2">
              <Calendar className="w-4 h-4" />
              Tarih Seç
            </button>
            <button className="btn-secondary flex items-center gap-2 text-sm py-2">
              <Filter className="w-4 h-4" />
              Filtrele
            </button>
            <button className="btn-primary flex items-center gap-2 text-sm py-2">
              <Download className="w-4 h-4" />
              Dışa Aktar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Net Satış</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="metric-value text-primary">{formatCurrency(satisRapor?.netSatis || 0)}</p>
                )}
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Brüt Satış</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="metric-value text-success">{formatCurrency(satisRapor?.brutSatis || 0)}</p>
                )}
              </div>
              <Package className="w-8 h-8 text-success" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">İade Toplamı</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="metric-value text-destructive">{formatCurrency(satisRapor?.iadeToplamı || 0)}</p>
                )}
              </div>
              <RotateCcw className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Fatura Adedi</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="metric-value text-accent">{satisRapor?.toplamFatura?.toLocaleString('tr-TR') || 0}</p>
                )}
              </div>
              <FileText className="w-8 h-8 text-accent" />
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">İade Oranı</p>
            <p className={`text-2xl font-bold ${(satisRapor?.iadeOrani || 0) > 10 ? 'text-destructive' : 'text-success'}`}>
              {isLoading ? <Skeleton className="h-8 w-16 inline-block" /> : `%${(satisRapor?.iadeOrani || 0).toFixed(1)}`}
            </p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Ortalama Sepet</p>
            <p className="text-2xl font-bold text-primary">
              {isLoading ? <Skeleton className="h-8 w-24 inline-block" /> : formatCurrency(satisRapor?.ortSepet || 0)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Aylık Satış</p>
            <p className="text-2xl font-bold text-success">
              {isLoading ? <Skeleton className="h-8 w-24 inline-block" /> : formatCurrency(satisRapor?.aylikSatis || 0)}
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Marka Dağılımı */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">Marka Dağılımı</h3>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
            ) : markaPieData.length > 0 ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={markaPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        stroke="none"
                      >
                        {markaPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatFullCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {markaPieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                      <span className="ml-auto font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Marka verisi bulunamadı
              </div>
            )}
          </div>

          {/* Satış Elemanı Performansı */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">Satış Elemanı Performansı</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : satisElemanlari.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {satisElemanlari.slice(0, 8).map((eleman, index) => (
                  <div key={eleman.eleman} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{eleman.eleman}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{eleman.faturaSayisi} fatura</span>
                        <span>•</span>
                        <span className={eleman.iadeOrani > 10 ? 'text-destructive' : 'text-success'}>
                          %{eleman.iadeOrani.toFixed(1)} iade
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{formatCurrency(eleman.netSatis)}</p>
                      <p className="text-xs text-muted-foreground">Ort: {formatCurrency(eleman.ortSepet)}</p>
                    </div>
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(eleman.netSatis / maxSatisEleman) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Satış elemanı verisi bulunamadı
              </div>
            )}
          </div>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Top Products Table */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">En Çok Satan Ürünler</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stok Kodu</th>
                      <th>Ürün Adı</th>
                      <th className="text-right">Miktar</th>
                      <th className="text-right">Tutar</th>
                      <th className="text-right">Oran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((product) => (
                      <tr key={product.stokKodu}>
                        <td className="font-mono text-sm">{product.stokKodu}</td>
                        <td className="max-w-[200px] truncate" title={product.stokAdi}>{product.stokAdi}</td>
                        <td className="text-right">{product.toplamMiktar.toLocaleString('tr-TR')}</td>
                        <td className="text-right font-medium">{formatCurrency(product.toplamTutar)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(product.toplamTutar / maxProductTutar) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {((product.toplamTutar / totalProductsTutar) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Ürün verisi bulunamadı
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">En Çok Satan Müşteriler</h3>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topCariler.length > 0 ? (
              <div className="space-y-3">
                {topCariler.map((cari, index) => (
                  <div key={cari.cariKodu} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-sm font-bold text-success">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cari.cariAdi}</p>
                      <p className="text-xs text-muted-foreground">{cari.faturaAdedi} fatura</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-success">{formatCurrency(cari.toplamTutar)}</p>
                    </div>
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-success rounded-full"
                        style={{ width: `${(cari.toplamTutar / maxCariTutar) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Müşteri verisi bulunamadı
              </div>
            )}
          </div>
        </div>

        {/* İade Analizi - Marka Bazlı */}
        <div className="glass-card rounded-xl p-6 animate-slide-up mb-6">
          <h3 className="text-lg font-semibold mb-4">Marka Bazlı Satış ve İade Analizi</h3>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (satisRapor?.markaBazli || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Marka</th>
                    <th className="text-right">Brüt Satış</th>
                    <th className="text-right">İade</th>
                    <th className="text-right">Net Satış</th>
                    <th className="text-right">İade Oranı</th>
                    <th className="text-right">Miktar</th>
                  </tr>
                </thead>
                <tbody>
                  {(satisRapor?.markaBazli || []).slice(0, 10).map((marka) => (
                    <tr key={marka.marka}>
                      <td className="font-medium">{marka.marka}</td>
                      <td className="text-right">{formatCurrency(marka.satisTutar)}</td>
                      <td className="text-right text-destructive">{formatCurrency(marka.iadeTutar)}</td>
                      <td className="text-right font-semibold text-primary">{formatCurrency(marka.netTutar)}</td>
                      <td className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          marka.iadeOrani > 15 
                            ? 'bg-destructive/20 text-destructive' 
                            : marka.iadeOrani > 5 
                            ? 'bg-warning/20 text-warning' 
                            : 'bg-success/20 text-success'
                        }`}>
                          %{marka.iadeOrani.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-right text-muted-foreground">{marka.toplamMiktar.toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              Marka analizi verisi bulunamadı
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
