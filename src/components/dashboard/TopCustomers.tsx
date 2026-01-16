import React from 'react';
import { Building2 } from 'lucide-react';

const mockCustomers = [
  { id: 1, adi: 'ABC Ticaret Ltd.', ciro: 450000, bakiye: 85000, risk: 'düşük' },
  { id: 2, adi: 'XYZ Sanayi A.Ş.', ciro: 380000, bakiye: 42000, risk: 'orta' },
  { id: 3, adi: 'Demo İnşaat', ciro: 295000, bakiye: 15000, risk: 'düşük' },
  { id: 4, adi: 'Test Mühendislik', ciro: 220000, bakiye: -5000, risk: 'düşük' },
  { id: 5, adi: 'Örnek Holding', ciro: 185000, bakiye: 125000, risk: 'yüksek' },
];

const riskBadges: Record<string, string> = {
  'düşük': 'badge-success',
  'orta': 'badge-warning',
  'yüksek': 'badge-destructive',
};

export function TopCustomers() {
  const maxCiro = Math.max(...mockCustomers.map(c => c.ciro));

  return (
    <div className="glass-card rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">En İyi Müşteriler</h3>
          <p className="text-sm text-muted-foreground">Ciro bazlı sıralama</p>
        </div>
      </div>

      <div className="space-y-4">
        {mockCustomers.map((customer, index) => (
          <div key={customer.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{customer.adi}</p>
                  <p className="text-xs text-muted-foreground">
                    Bakiye: <span className={customer.bakiye >= 0 ? 'text-success' : 'text-destructive'}>
                      ₺{customer.bakiye.toLocaleString('tr-TR')}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">₺{customer.ciro.toLocaleString('tr-TR')}</p>
                <span className={`badge ${riskBadges[customer.risk]}`}>{customer.risk}</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(customer.ciro / maxCiro) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
