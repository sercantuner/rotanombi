// Dynamic Widget Renderer - Widget ID'ye göre dinamik render
import React from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { BuilderWidgetRenderer } from './BuilderWidgetRenderer';
import { getWidgetById, WidgetCategory, WidgetFilter } from '@/lib/widgetRegistry';
import { Widget } from '@/lib/widgetTypes';

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
  Package,
  Wallet,
  Clock,
  CreditCard,
  FileText,
  Landmark
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
  // Veritabanından gelen widget bilgisi (builder_config için)
  dbWidget?: Widget;
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
  dbWidget,
}: DynamicWidgetRendererProps) {
  const widget = getWidgetById(widgetId);
  
  // Eğer dbWidget var ve builder_config içeriyorsa, BuilderWidgetRenderer kullan
  if (dbWidget?.builder_config) {
    return (
      <BuilderWidgetRenderer
        widgetId={dbWidget.id}
        widgetName={dbWidget.name}
        widgetIcon={dbWidget.icon || undefined}
        builderConfig={dbWidget.builder_config}
        className={className}
      />
    );
  }
  
  if (!widget) {
    console.warn(`Widget not found: ${widgetId}`);
    return null;
  }

  const { genelRapor, finansRapor, satisRapor, cariler, yaslandirma, bankaHesaplari, toplamBankaBakiye } = data;

  // Calculate derived values
  const toplamAlacak = genelRapor?.toplamAlacak || 0;
  const toplamBorc = genelRapor?.toplamBorc || 0;
  const netBakiye = genelRapor?.netBakiye || (toplamAlacak - toplamBorc);
  const gecikimisAlacak = genelRapor?.gecikimisAlacak || genelRapor?.vadesiGecmis || 0;
  const gecikimisBorc = genelRapor?.gecikimisBorc || 0;

  // Render widget based on ID
  const renderWidget = (): React.ReactNode => {
    switch (widgetId) {
      // ========== KPI WIDGETS ==========
      case 'kpi_toplam_alacak':
        return (
          <StatCard
            title="Toplam Alacak"
            value={formatCurrency(toplamAlacak)}
            icon={Wallet}
            trend="up"
            variant="success"
          />
        );
      
      case 'kpi_gecikmis_alacak':
        return (
          <StatCard
            title="Gecikmiş Alacak"
            value={formatCurrency(gecikimisAlacak)}
            icon={Clock}
            trend="neutral"
            variant="warning"
          />
        );
      
      case 'kpi_toplam_borc':
        return (
          <StatCard
            title="Toplam Borç"
            value={formatCurrency(toplamBorc)}
            icon={CreditCard}
            trend="down"
            variant="destructive"
          />
        );

      case 'kpi_gecikmis_borc':
        return (
          <StatCard
            title="Gecikmiş Borç"
            value={formatCurrency(gecikimisBorc)}
            icon={AlertTriangle}
            trend="neutral"
            variant="destructive"
          />
        );
      
      case 'kpi_net_bakiye':
        return (
          <StatCard
            title="Net Bakiye"
            value={formatCurrency(netBakiye)}
            icon={Scale}
            trend={netBakiye >= 0 ? "up" : "down"}
            variant={netBakiye >= 0 ? "success" : "destructive"}
          />
        );
      
      case 'kpi_musteri_sayisi':
        return (
          <StatCard
            title="Müşteri Sayısı"
            value={(genelRapor?.musteriSayisi || 0).toLocaleString('tr-TR')}
            icon={Users}
            trend="neutral"
            variant="default"
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

      case 'kpi_net_satis':
        return (
          <StatCard
            title="Net Satış"
            value={formatCurrency(satisRapor?.netSatis || 0)}
            icon={ShoppingCart}
            trend="up"
            variant="success"
          />
        );

      case 'kpi_brut_satis':
        return (
          <StatCard
            title="Brüt Satış"
            value={formatCurrency(satisRapor?.brutSatis || 0)}
            icon={TrendingUp}
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

      case 'kpi_fatura_sayisi':
        return (
          <StatCard
            title="Fatura Sayısı"
            value={(satisRapor?.faturaSayisi || 0).toLocaleString('tr-TR')}
            icon={FileText}
            variant="default"
          />
        );

      case 'kpi_banka_bakiyesi':
        return (
          <StatCard
            title="Banka Bakiyesi"
            value={formatCurrency(toplamBankaBakiye || finansRapor?.toplamBankaBakiyesi || 0)}
            icon={Landmark}
            variant="success"
          />
        );

      // ========== SUMMARY WIDGETS ==========
      case 'ozet_gunluk':
        return <GunlukOzet isLoading={isLoading} />;

      // ========== LIST WIDGETS ==========
      case 'liste_bugun_vade':
        return <BugununVadeleri cariler={cariler || []} isLoading={isLoading} />;
      
      case 'liste_aranacak_musteriler':
        return <AranacakMusteriler cariler={cariler || []} isLoading={isLoading} />;
      
      case 'liste_kritik_stok':
        return <KritikStokUyarilari isLoading={isLoading} />;

      case 'liste_en_borclu':
        return <TopCustomers cariler={cariler || []} isLoading={isLoading} />;

      case 'liste_banka_hesaplari':
        return (
          <BankaHesaplari 
            bankaHesaplari={bankaHesaplari || []} 
            toplamBakiye={toplamBankaBakiye || 0}
            isLoading={isLoading}
          />
        );
      
      case 'liste_satis_elemani_performans':
        return (
          <SatisElemaniPerformans
            satisElemanlari={genelRapor?.satisElemaniDagilimi || []}
            isLoading={isLoading}
          />
        );

      // ========== CHART WIDGETS ==========
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
      
      case 'grafik_cari_donusum_trend':
        return (
          <CariDonusumTrend
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

  // KPI widgets don't need wrapper (rendered directly)
  if (widget.type === 'kpi') {
    return renderWidget();
  }

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
