import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Filter, Download, TrendingUp, Package, FileText } from 'lucide-react';

const monthlyData = [
  { ay: 'Oca', satis: 85000 },
  { ay: 'Şub', satis: 92000 },
  { ay: 'Mar', satis: 78000 },
  { ay: 'Nis', satis: 105000 },
  { ay: 'May', satis: 115000 },
  { ay: 'Haz', satis: 98000 },
  { ay: 'Tem', satis: 125000 },
  { ay: 'Ağu', satis: 135000 },
  { ay: 'Eyl', satis: 142000 },
  { ay: 'Eki', satis: 128000 },
  { ay: 'Kas', satis: 138000 },
  { ay: 'Ara', satis: 155000 },
];

const categoryData = [
  { name: 'Elektronik', value: 35, color: 'hsl(217, 91%, 60%)' },
  { name: 'Gıda', value: 25, color: 'hsl(160, 84%, 39%)' },
  { name: 'Tekstil', value: 20, color: 'hsl(38, 92%, 50%)' },
  { name: 'Mobilya', value: 12, color: 'hsl(280, 80%, 55%)' },
  { name: 'Diğer', value: 8, color: 'hsl(0, 0%, 50%)' },
];

const topProducts = [
  { kod: 'STK001', adi: 'Laptop HP ProBook', miktar: 156, tutar: 312000 },
  { kod: 'STK002', adi: 'Monitor Dell 27"', miktar: 234, tutar: 187200 },
  { kod: 'STK003', adi: 'Klavye Logitech MX', miktar: 412, tutar: 123600 },
  { kod: 'STK004', adi: 'Mouse Razer Pro', miktar: 328, tutar: 98400 },
  { kod: 'STK005', adi: 'Webcam Logitech C920', miktar: 189, tutar: 75600 },
];

export function SalesPage() {
  const [dateRange, setDateRange] = useState('month');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Satış Raporu" 
        subtitle="Satış performansı ve ürün analizi"
        onRefresh={handleRefresh}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Toplam Satış</p>
                <p className="metric-value text-primary">₺1,396,000</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Satılan Ürün</p>
                <p className="metric-value text-success">3,842</p>
              </div>
              <Package className="w-8 h-8 text-success" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Kesilen Fatura</p>
                <p className="metric-value text-accent">892</p>
              </div>
              <FileText className="w-8 h-8 text-accent" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Monthly Sales Chart */}
          <div className="xl:col-span-2 glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">Aylık Satış Grafiği</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis 
                    dataKey="ay" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(222, 47%, 14%)', 
                      border: '1px solid hsl(217, 33%, 25%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 40%, 98%)'
                    }}
                    formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, 'Satış']}
                  />
                  <Bar 
                    dataKey="satis" 
                    fill="hsl(217, 91%, 60%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">Kategori Dağılımı</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                  <span className="ml-auto font-medium">%{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products Table */}
        <div className="glass-card rounded-xl p-6 animate-slide-up">
          <h3 className="text-lg font-semibold mb-4">En Çok Satan Ürünler</h3>
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
                {topProducts.map((product, index) => (
                  <tr key={product.kod}>
                    <td className="font-mono text-sm">{product.kod}</td>
                    <td>{product.adi}</td>
                    <td className="text-right">{product.miktar.toLocaleString('tr-TR')}</td>
                    <td className="text-right font-medium">₺{product.tutar.toLocaleString('tr-TR')}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${((product.tutar / topProducts[0].tutar) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {((product.tutar / 796800) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
