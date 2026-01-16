import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { ay: 'Oca', satis: 85000, alacak: 25000 },
  { ay: 'Şub', satis: 92000, alacak: 28000 },
  { ay: 'Mar', satis: 78000, alacak: 22000 },
  { ay: 'Nis', satis: 105000, alacak: 35000 },
  { ay: 'May', satis: 115000, alacak: 40000 },
  { ay: 'Haz', satis: 98000, alacak: 32000 },
  { ay: 'Tem', satis: 125000, alacak: 45000 },
  { ay: 'Ağu', satis: 135000, alacak: 48000 },
  { ay: 'Eyl', satis: 142000, alacak: 52000 },
  { ay: 'Eki', satis: 128000, alacak: 46000 },
  { ay: 'Kas', satis: 138000, alacak: 50000 },
  { ay: 'Ara', satis: 155000, alacak: 55000 },
];

export function RevenueChart() {
  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Gelir Analizi</h3>
          <p className="text-sm text-muted-foreground">Son 12 aylık performans</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Satış</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-muted-foreground">Alacak</span>
          </div>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSatis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAlacak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, '']}
            />
            <Area 
              type="monotone" 
              dataKey="satis" 
              stroke="hsl(217, 91%, 60%)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorSatis)" 
            />
            <Area 
              type="monotone" 
              dataKey="alacak" 
              stroke="hsl(160, 84%, 39%)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorAlacak)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
