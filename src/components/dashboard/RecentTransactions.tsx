import React from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const mockTransactions = [
  { id: 1, cari: 'ABC Ticaret Ltd.', tip: 'tahsilat', tutar: 15000, tarih: '2024-01-15', saat: '14:32' },
  { id: 2, cari: 'XYZ Sanayi A.Ş.', tip: 'fatura', tutar: 28500, tarih: '2024-01-15', saat: '11:45' },
  { id: 3, cari: 'Demo İnşaat', tip: 'tahsilat', tutar: 42000, tarih: '2024-01-14', saat: '16:20' },
  { id: 4, cari: 'Test Mühendislik', tip: 'fatura', tutar: 18750, tarih: '2024-01-14', saat: '09:15' },
  { id: 5, cari: 'Örnek Holding', tip: 'tahsilat', tutar: 75000, tarih: '2024-01-13', saat: '15:00' },
];

export function RecentTransactions() {
  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Son İşlemler</h3>
          <p className="text-sm text-muted-foreground">Güncel hareket listesi</p>
        </div>
        <button className="text-sm text-primary hover:underline">
          Tümünü Gör
        </button>
      </div>

      <div className="space-y-3">
        {mockTransactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${tx.tip === 'tahsilat' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'}`}>
                {tx.tip === 'tahsilat' ? (
                  <ArrowDownLeft className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{tx.cari}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.tarih} • {tx.saat}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${tx.tip === 'tahsilat' ? 'text-success' : 'text-foreground'}`}>
                {tx.tip === 'tahsilat' ? '+' : ''}₺{tx.tutar.toLocaleString('tr-TR')}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{tx.tip}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
