// Dynamic Widget Renderer - Widget ID'ye göre dinamik render
import React from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { getWidgetById, WidgetCategory, WidgetFilter } from '@/lib/widgetRegistry';

// Widget Components
import { StatCard } from './StatCard';
import { GunlukOzet } from './GunlukOzet';
import { BugununVadeleri } from './BugununVadeleri';
import { AranacakMusteriler } from './AranacakMusteriler';
import { KritikStokUyarilari } from './KritikStokUyarilari';
import { VadeYaslandirmasi } from './VadeYaslandirmasi';
import { BankaHesaplari } from './BankaHesaplari';
import { OzelKodDonutChart } from './OzelKodDonutChart';
import { SektorDagilimi } from './SektorDagilimi';
import { KaynakDagilimi } from './KaynakDagilimi';
import { LokasyonDagilimi } from './LokasyonDagilimi';
import { CariDonusumTrend } from './CariDonusumTrend';
import { SatisElemaniPerformans } from './SatisElemaniPerformans';
import { TopCustomers } from './TopCustomers';

// Icons for StatCards
import { 
  TrendingUp, 
  AlertTriangle, 
  TrendingDown, 
  Scale, 
  Users, 
  UserCheck,
  ShoppingCart,
  Package
} from 'lucide-react';

interface DynamicWidgetRendererProps {
  widgetId: string;
  currentPage: WidgetCategory;
  data: {
    genelRapor?: any;
    finansRapor?: any;
    satisRapor?: any;
    cariler?: any[];
    yaslandirma?: any;
    bankaHesaplari?: any[];
    toplamBankaBakiye?: number;
  };
  filters?: WidgetFilter;
  className?: string;
  isLoading?: boolean;
}

// Format large numbers
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `₺${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (Math.abs(value) >= 1_000_000) {
    return `₺${(value / 1_000_000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1_000) {
    return `₺${(value / 1_000).toFixed(0)}K`;
  }
  return `₺${value.toLocaleString('tr-TR')}`;
}

export function DynamicWidgetRenderer({
  widgetId,
  currentPage,
  data,
  filters,
  className = '',
  isLoading = false,
}: DynamicWidgetRendererProps) {
  const widget = getWidgetById(widgetId);
  
  if (!widget) {
    console.warn(`Widget not found: ${widgetId}`);
    return null;
  }

  const { genelRapor, finansRapor, satisRapor, cariler, yaslandirma, bankaHesaplari, toplamBankaBakiye } = data;

  // Render widget based on ID
  const renderWidget = (): React.ReactNode => {
    switch (widgetId) {
      // KPI Cards
      case 'kpi_toplam_alacak':
        return (
          <StatCard
            title="Toplam Alacak"
            value={formatCurrency(finansRapor?.toplamAlacak || 0)}
            icon={TrendingUp}
            trend="up"
            trendValue="+5.2%"
            variant="default"
          />
        );
      
      case 'kpi_geciken_alacak':
        return (
          <StatCard
            title="Gecikmiş Alacak"
            value={formatCurrency(finansRapor?.gecikmisToplam || 0)}
            icon={AlertTriangle}
            trend="down"
            trendValue="-2.1%"
            variant="destructive"
          />
        );
      
      case 'kpi_toplam_borc':
        return (
          <StatCard
            title="Toplam Borç"
            value={formatCurrency(finansRapor?.toplamBorc || 0)}
            icon={TrendingDown}
            variant="warning"
          />
        );
      
      case 'kpi_net_bakiye':
        return (
          <StatCard
            title="Net Bakiye"
            value={formatCurrency((finansRapor?.toplamAlacak || 0) - (finansRapor?.toplamBorc || 0))}
            icon={Scale}
            variant="default"
          />
        );
      
      case 'kpi_musteri_sayisi':
        return (
          <StatCard
            title="Müşteri Sayısı"
            value={genelRapor?.musteriSayisi?.toString() || '0'}
            icon={Users}
            variant="success"
          />
        );
      
      case 'kpi_aktif_cari':
        return (
          <StatCard
            title="Aktif Cari"
            value={genelRapor?.aktifCariSayisi?.toString() || '0'}
            icon={UserCheck}
            variant="success"
          />
        );

      case 'kpi_gunluk_satis':
        return (
          <StatCard
            title="Günlük Satış"
            value={formatCurrency(satisRapor?.gunlukSatis || 0)}
            icon={ShoppingCart}
            trend="up"
            trendValue="+8.5%"
            variant="default"
          />
        );

      case 'kpi_iade_tutari':
        return (
          <StatCard
            title="İade Tutarı"
            value={formatCurrency(satisRapor?.iadeTutari || 0)}
            icon={Package}
            variant="destructive"
          />
        );

      // Summary widgets
      case 'liste_gunluk_ozet':
        return <GunlukOzet isLoading={isLoading} />;
      
      case 'liste_bugun_vadeler':
        return <BugununVadeleri cariler={cariler || []} isLoading={isLoading} />;
      
      case 'liste_aranacak_musteriler':
        return <AranacakMusteriler cariler={cariler || []} isLoading={isLoading} />;
      
      case 'liste_kritik_stok':
        return <KritikStokUyarilari />;

      // Chart widgets
      case 'grafik_vade_yaslandirma':
        return (
          <VadeYaslandirmasi
            yaslandirma={yaslandirma || {
              guncel: 0,
              vade30: 0,
              vade60: 0,
              vade90: 0,
              vade90Plus: 0,
              gelecek30: 0,
              gelecek60: 0,
              gelecek90: 0,
              gelecek90Plus: 0,
            }}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_banka_hesaplari':
        return (
          <BankaHesaplari 
            bankaHesaplari={bankaHesaplari || []} 
            toplamBakiye={toplamBankaBakiye || 0}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_ozelkod_dagilimi':
        return (
          <OzelKodDonutChart
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_sektor_dagilimi':
        return (
          <SektorDagilimi
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_kaynak_dagilimi':
        return (
          <KaynakDagilimi
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_lokasyon_dagilimi':
        return (
          <LokasyonDagilimi
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_cari_donusum':
        return (
          <CariDonusumTrend
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );
      
      case 'grafik_satis_elemani':
        return (
          <SatisElemaniPerformans
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );

      // List widgets
      case 'liste_top_musteriler':
        return (
          <TopCustomers
            cariler={cariler || []}
            isLoading={isLoading}
          />
        );

      default:
        console.warn(`No renderer for widget: ${widgetId}`);
        return (
          <div className="p-4 text-center text-muted-foreground glass-card rounded-xl">
            Widget mevcut değil: {widgetId}
          </div>
        );
    }
  };

  return (
    <WidgetWrapper 
      widgetId={widgetId} 
      currentPage={currentPage}
      className={className}
    >
      {renderWidget()}
    </WidgetWrapper>
  );
}
