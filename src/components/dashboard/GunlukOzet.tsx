import React, { useMemo } from 'react';
import { TrendingUp, Banknote, CreditCard, ArrowUpRight, ArrowDownRight, Minus, FlaskConical } from 'lucide-react';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { getMockGunlukOzet } from '@/lib/mockData';

interface Props {
  isLoading?: boolean;
  // Gerçek veriler DIA'dan geldiğinde kullanılacak
  satisVerisi?: {
    bugun: number;
    dun: number;
  };
  tahsilatVerisi?: {
    bugun: number;
    dun: number;
  };
  odemeVerisi?: {
    bugun: number;
    dun: number;
  };
}

export function GunlukOzet({ isLoading, satisVerisi, tahsilatVerisi, odemeVerisi }: Props) {
  const { useMockData } = useUserSettings();
  
  // Mock data'yı useMemo ile sakla (her renderda değişmesin)
  const mockData = useMemo(() => {
    if (useMockData) {
      return getMockGunlukOzet();
    }
    return {
      bugunSatis: 85420,
      dunSatis: 72150,
      bugunTahsilat: 42800,
      dunTahsilat: 38500,
      bugunOdeme: 18200,
      dunOdeme: 24600,
    };
  }, [useMockData]);

  // Veri kaynağı: prop > mock data
  const satis = satisVerisi || { bugun: mockData.bugunSatis, dun: mockData.dunSatis };
  const tahsilat = tahsilatVerisi || { bugun: mockData.bugunTahsilat, dun: mockData.dunTahsilat };
  const odeme = odemeVerisi || { bugun: mockData.bugunOdeme, dun: mockData.dunOdeme };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `₺${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₺${(value / 1000).toFixed(0)}K`;
    }
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  const calculateChange = (bugun: number, dun: number) => {
    if (dun === 0) return 0;
    return ((bugun - dun) / dun) * 100;
  };

  const getTrendIcon = (change: number, inverse = false) => {
    if (Math.abs(change) < 1) {
      return <Minus className="w-3 h-3" />;
    }
    if (inverse) {
      return change > 0 
        ? <ArrowUpRight className="w-3 h-3 text-destructive" />
        : <ArrowDownRight className="w-3 h-3 text-success" />;
    }
    return change > 0 
      ? <ArrowUpRight className="w-3 h-3 text-success" />
      : <ArrowDownRight className="w-3 h-3 text-destructive" />;
  };

  const getTrendColor = (change: number, inverse = false) => {
    if (Math.abs(change) < 1) return 'text-muted-foreground';
    if (inverse) {
      return change > 0 ? 'text-destructive' : 'text-success';
    }
    return change > 0 ? 'text-success' : 'text-destructive';
  };

  const satisChange = calculateChange(satis.bugun, satis.dun);
  const tahsilatChange = calculateChange(tahsilat.bugun, tahsilat.dun);
  const odemeChange = calculateChange(odeme.bugun, odeme.dun);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-muted rounded w-32 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Günlük Özet</h3>
          {useMockData && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-500 font-medium flex items-center gap-1">
              <FlaskConical className="w-3 h-3" />
              Demo
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Satış */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Günlük Satış</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(satis.bugun)}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(satisChange)}`}>
            {getTrendIcon(satisChange)}
            <span>{Math.abs(satisChange).toFixed(1)}% düne göre</span>
          </div>
        </div>

        {/* Tahsilat */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-success/20 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-success" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Tahsilat</span>
          </div>
          <p className="text-xl font-bold text-success">{formatCurrency(tahsilat.bugun)}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(tahsilatChange)}`}>
            {getTrendIcon(tahsilatChange)}
            <span>{Math.abs(tahsilatChange).toFixed(1)}% düne göre</span>
          </div>
        </div>

        {/* Ödeme */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-destructive/20 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-destructive" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Ödeme</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(odeme.bugun)}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(odemeChange, true)}`}>
            {getTrendIcon(odemeChange, true)}
            <span>{Math.abs(odemeChange).toFixed(1)}% düne göre</span>
          </div>
        </div>
      </div>

      {/* Net Position */}
      <div className="mt-4 p-3 rounded-lg bg-secondary/50 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Net Nakit Akışı (Bugün)</span>
        <span className={`text-lg font-bold ${
          (tahsilat.bugun - odeme.bugun) >= 0 ? 'text-success' : 'text-destructive'
        }`}>
          {(tahsilat.bugun - odeme.bugun) >= 0 ? '+' : ''}{formatCurrency(tahsilat.bugun - odeme.bugun)}
        </span>
      </div>
    </div>
  );
}
