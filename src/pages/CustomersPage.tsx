import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Search, Filter, Plus, MoreVertical, Building2, Phone, Mail, MapPin } from 'lucide-react';

const mockCustomers = [
  { 
    id: 1, 
    kod: 'CRI001', 
    adi: 'ABC Ticaret Ltd. Şti.', 
    tip: 'Müşteri',
    bakiye: 85000, 
    telefon: '0212 555 1234',
    email: 'info@abcticaret.com',
    adres: 'İstanbul, Kadıköy',
    sonIslem: '2024-01-15'
  },
  { 
    id: 2, 
    kod: 'CRI002', 
    adi: 'XYZ Sanayi A.Ş.', 
    tip: 'Müşteri',
    bakiye: -42000, 
    telefon: '0216 444 5678',
    email: 'satis@xyzsanayi.com',
    adres: 'İstanbul, Ümraniye',
    sonIslem: '2024-01-14'
  },
  { 
    id: 3, 
    kod: 'CRI003', 
    adi: 'Demo İnşaat ve Taahhüt', 
    tip: 'Tedarikçi',
    bakiye: 125000, 
    telefon: '0312 333 9012',
    email: 'muhasebe@demoinsaat.com',
    adres: 'Ankara, Çankaya',
    sonIslem: '2024-01-12'
  },
  { 
    id: 4, 
    kod: 'CRI004', 
    adi: 'Test Mühendislik Hizmetleri', 
    tip: 'Müşteri',
    bakiye: 18750, 
    telefon: '0232 222 3456',
    email: 'info@testmuhendislik.com',
    adres: 'İzmir, Konak',
    sonIslem: '2024-01-10'
  },
  { 
    id: 5, 
    kod: 'CRI005', 
    adi: 'Örnek Holding A.Ş.', 
    tip: 'Müşteri',
    bakiye: 275000, 
    telefon: '0216 111 7890',
    email: 'finans@ornekholding.com',
    adres: 'İstanbul, Beşiktaş',
    sonIslem: '2024-01-08'
  },
];

export function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'müşteri' | 'tedarikçi'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const filteredCustomers = mockCustomers.filter(customer => {
    const matchesSearch = customer.adi.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.kod.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || customer.tip.toLowerCase() === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Cari Hesaplar" 
        subtitle="Müşteri ve tedarikçi yönetimi"
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <main className="flex-1 p-6 overflow-auto">
        {/* Toolbar */}
        <div className="glass-card rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
          {/* Search */}
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kodu veya adı ile ara..."
              className="input-field pl-10 py-2"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-secondary rounded-lg p-1">
              <button 
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setFilterType('all')}
              >
                Tümü
              </button>
              <button 
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === 'müşteri' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setFilterType('müşteri')}
              >
                Müşteriler
              </button>
              <button 
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === 'tedarikçi' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setFilterType('tedarikçi')}
              >
                Tedarikçiler
              </button>
            </div>
            
            <button className="btn-primary flex items-center gap-2 text-sm py-2">
              <Plus className="w-4 h-4" />
              Yeni Cari
            </button>
          </div>
        </div>

        {/* Customer Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="glass-card rounded-xl p-5 animate-slide-up hover:glow-border transition-all duration-300">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{customer.adi}</h3>
                    <p className="text-sm text-muted-foreground">{customer.kod}</p>
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-secondary">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Balance */}
              <div className="p-3 rounded-lg bg-secondary/50 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Bakiye</p>
                <p className={`text-xl font-bold ${customer.bakiye >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {customer.bakiye >= 0 ? '+' : ''}₺{customer.bakiye.toLocaleString('tr-TR')}
                </p>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{customer.telefon}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{customer.adres}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className={`badge ${customer.tip === 'Müşteri' ? 'badge-success' : 'badge-warning'}`}>
                  {customer.tip}
                </span>
                <span className="text-xs text-muted-foreground">
                  Son işlem: {new Date(customer.sonIslem).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Cari bulunamadı</h3>
            <p className="text-muted-foreground">Arama kriterlerinize uygun cari hesap bulunamadı.</p>
          </div>
        )}
      </main>
    </div>
  );
}
