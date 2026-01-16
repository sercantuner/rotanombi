import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calendar, Download, AlertCircle, CheckCircle, Clock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const cashFlowData = [
  { tarih: '01/01', giris: 45000, cikis: 32000 },
  { tarih: '05/01', giris: 52000, cikis: 28000 },
  { tarih: '10/01', giris: 38000, cikis: 41000 },
  { tarih: '15/01', giris: 65000, cikis: 35000 },
  { tarih: '20/01', giris: 48000, cikis: 52000 },
  { tarih: '25/01', giris: 72000, cikis: 45000 },
  { tarih: '30/01', giris: 58000, cikis: 38000 },
];

const debtData = [
  { cari: 'ABC Ticaret Ltd.', tutar: 85000, vade: '2024-01-20', durum: 'normal' },
  { cari: 'XYZ Sanayi A.Ş.', tutar: 125000, vade: '2024-01-15', durum: 'gecikmiş' },
  { cari: 'Demo İnşaat', tutar: 42000, vade: '2024-01-25', durum: 'normal' },
  { cari: 'Test Mühendislik', tutar: 18000, vade: '2024-01-10', durum: 'gecikmiş' },
  { cari: 'Örnek Holding', tutar: 95000, vade: '2024-02-01', durum: 'normal' },
];

export function FinancePage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const totalAlacak = 380000;
  const totalBorc = 125000;
  const vadesiGecmis = 143000;
  const bugunVade = 42000;

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Finans Raporu" 
        subtitle="Nakit akışı ve vade analizi"
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Toplam Alacak</p>
                <p className="metric-value text-success">₺{totalAlacak.toLocaleString('tr-TR')}</p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-success" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Toplam Borç</p>
                <p className="metric-value text-destructive">₺{totalBorc.toLocaleString('tr-TR')}</p>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Vadesi Geçmiş</p>
                <p className="metric-value text-warning">₺{vadesiGecmis.toLocaleString('tr-TR')}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-warning" />
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Bugün Vadeli</p>
                <p className="metric-value text-primary">₺{bugunVade.toLocaleString('tr-TR')}</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Cash Flow Chart */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Nakit Akışı</h3>
                <p className="text-sm text-muted-foreground">Giriş ve çıkış analizi</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-muted-foreground">Giriş</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Çıkış</span>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorGiris" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCikis" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis 
                    dataKey="tarih" 
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
                    formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, '']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="giris" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={2}
                    fill="url(#colorGiris)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cikis" 
                    stroke="hsl(0, 84%, 60%)" 
                    strokeWidth={2}
                    fill="url(#colorCikis)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Balance Summary */}
          <div className="glass-card rounded-xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold mb-4">Bakiye Özeti</h3>
            
            <div className="space-y-4">
              {/* Net Balance */}
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Net Bakiye</span>
                  <span className="text-2xl font-bold text-success">
                    ₺{(totalAlacak - totalBorc).toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full"
                    style={{ width: `${(totalAlacak / (totalAlacak + totalBorc)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Alacak: %{((totalAlacak / (totalAlacak + totalBorc)) * 100).toFixed(1)}</span>
                  <span>Borç: %{((totalBorc / (totalAlacak + totalBorc)) * 100).toFixed(1)}</span>
                </div>
              </div>

              {/* Risk Analysis */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle className="w-5 h-5 text-success mb-2" />
                  <p className="text-sm text-muted-foreground">Vadesi Gelmemiş</p>
                  <p className="text-lg font-semibold text-success">
                    ₺{(totalAlacak - vadesiGecmis - bugunVade).toLocaleString('tr-TR')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertCircle className="w-5 h-5 text-warning mb-2" />
                  <p className="text-sm text-muted-foreground">Risk Altında</p>
                  <p className="text-lg font-semibold text-warning">
                    ₺{(vadesiGecmis + bugunVade).toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debt Table */}
        <div className="glass-card rounded-xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Alacak Detayları</h3>
              <p className="text-sm text-muted-foreground">Vade bazlı alacak listesi</p>
            </div>
            <button className="btn-primary flex items-center gap-2 text-sm py-2">
              <Download className="w-4 h-4" />
              Dışa Aktar
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cari Hesap</th>
                  <th className="text-right">Tutar</th>
                  <th>Vade Tarihi</th>
                  <th>Durum</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {debtData.map((item, index) => (
                  <tr key={index}>
                    <td className="font-medium">{item.cari}</td>
                    <td className="text-right font-semibold">₺{item.tutar.toLocaleString('tr-TR')}</td>
                    <td>{new Date(item.vade).toLocaleDateString('tr-TR')}</td>
                    <td>
                      <span className={`badge ${item.durum === 'gecikmiş' ? 'badge-destructive' : 'badge-success'}`}>
                        {item.durum === 'gecikmiş' ? 'Gecikmiş' : 'Normal'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="text-sm text-primary hover:underline">Detay</button>
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
