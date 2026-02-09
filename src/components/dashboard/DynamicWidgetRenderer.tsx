// Dynamic Widget Renderer - Widget ID'ye göre dinamik render
import React from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { BuilderWidgetRenderer } from './BuilderWidgetRenderer';
import { FilterableStatCard } from './FilterableStatCard';
import { getWidgetById, WidgetCategory, WidgetFilter } from '@/lib/widgetRegistry';
import { Widget } from '@/lib/widgetTypes';
import { WidgetLocalFilters } from '@/hooks/useWidgetLocalFilters';

// Widget Components
import { StatCard } from './StatCard';
import { GunlukOzet } from './GunlukOzet';
import { BugununVadeleri } from './BugununVadeleri';
import { AranacakMusteriler } from './AranacakMusteriler';
import { KritikStokUyarilari } from './KritikStokUyarilari';
import { VadeYaslandirmasi } from './VadeYaslandirmasi';
import { BankaHesaplari } from './BankaHesaplari';
// Legacy chart imports removed - now using BuilderWidgetRenderer
import { SatisElemaniPerformans } from './SatisElemaniPerformans';
import { TopCustomers } from './TopCustomers';
import { CariListesi } from '@/components/customers/CariListesi';

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
  dbWidget?: Widget;
  containerWidgetId?: string;
  widgetFilters?: WidgetLocalFilters;
  onFiltersChange?: (filters: WidgetLocalFilters) => void;
  isWidgetEditMode?: boolean;
  colors?: string[];
  onDataLoaded?: (data: any[]) => void;
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
  containerWidgetId,
  widgetFilters,
  onFiltersChange,
  isWidgetEditMode = false,
  colors,
  onDataLoaded,
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
        widgetFilters={widgetFilters}
        
      />
    );
  }
  
  if (!widget) {
    console.warn(`Widget not found: ${widgetId}`);
    return null;
  }

  const { genelRapor, finansRapor, satisRapor, cariler, yaslandirma, bankaHesaplari, toplamBankaBakiye } = data;

  // Widget filtrelerine göre cari listesini filtrele
  const getFilteredCariler = () => {
    if (!widgetFilters || !cariler) return cariler || [];
    
    return cariler.filter(cari => {
      // Görünüm modu: potansiyel / cari / hepsi
      if (widgetFilters.gorunumModu === 'potansiyel' && cari.potansiyel !== 'E') return false;
      if (widgetFilters.gorunumModu === 'cari' && cari.potansiyel === 'E') return false;
      
      // Durum: aktif / pasif / hepsi
      if (widgetFilters.durum === 'aktif' && cari.aktif !== 'E') return false;
      if (widgetFilters.durum === 'pasif' && cari.aktif === 'E') return false;
      
      // Cari kart tipi: AL, AS, ST
      if ((widgetFilters.cariKartTipi || []).length > 0 && (widgetFilters.cariKartTipi || []).length < 3) {
        if (!(widgetFilters.cariKartTipi || []).includes(cari.carikarttip || 'AL')) return false;
      }
      
      // Özel kodlar
      if (widgetFilters.ozelkod1 && widgetFilters.ozelkod1.length > 0 && !widgetFilters.ozelkod1.includes(cari.ozelkod1kod)) return false;
      if (widgetFilters.ozelkod2 && widgetFilters.ozelkod2.length > 0 && !widgetFilters.ozelkod2.includes(cari.ozelkod2kod)) return false;
      if (widgetFilters.ozelkod3 && widgetFilters.ozelkod3.length > 0 && !widgetFilters.ozelkod3.includes(cari.ozelkod3kod)) return false;
      
      return true;
    });
  };

  // Filtrelenmiş carilerden KPI değerlerini hesapla
  const getFilteredKpis = () => {
    // Eğer filtre yoksa orijinal değerleri kullan
    if (!widgetFilters || !cariler) {
      return {
        toplamAlacak: genelRapor?.toplamAlacak || 0,
        toplamBorc: genelRapor?.toplamBorc || 0,
        netBakiye: genelRapor?.netBakiye || (genelRapor?.toplamAlacak || 0) - (genelRapor?.toplamBorc || 0),
        gecikimisAlacak: genelRapor?.gecikimisAlacak || genelRapor?.vadesiGecmis || 0,
        gecikimisBorc: genelRapor?.gecikimisBorc || 0,
        musteriSayisi: genelRapor?.musteriSayisi || 0,
        aktifCariSayisi: genelRapor?.aktifCariSayisi || 0,
      };
    }
    
    const filteredCariler = getFilteredCariler();
    
    let toplamAlacak = 0;
    let toplamBorc = 0;
    let gecikimisAlacak = 0;
    let gecikimisBorc = 0;
    let aktifCariSayisi = 0;
    
    filteredCariler.forEach(cari => {
      const bakiye = cari.toplambakiye || 0;
      const vadesiGecmis = cari.vadesigecentutar || 0;
      
      if (bakiye > 0) {
        toplamAlacak += bakiye;
        if (vadesiGecmis > 0) gecikimisAlacak += vadesiGecmis;
      } else if (bakiye < 0) {
        toplamBorc += Math.abs(bakiye);
        if (vadesiGecmis < 0) gecikimisBorc += Math.abs(vadesiGecmis);
      }
      
      if (cari.aktif === 'E') aktifCariSayisi++;
    });
    
    return {
      toplamAlacak,
      toplamBorc,
      netBakiye: toplamAlacak - toplamBorc,
      gecikimisAlacak,
      gecikimisBorc,
      musteriSayisi: filteredCariler.filter(c => c.potansiyel !== 'E').length,
      aktifCariSayisi,
    };
  };

  // Filtrelenmiş KPI değerlerini al
  const filteredKpis = getFilteredKpis();

  // Render widget based on ID
  const renderWidget = (): React.ReactNode => {
    switch (widgetId) {
      // ========== KPI WIDGETS ==========
      case 'kpi_toplam_alacak':
        return (
          <FilterableStatCard
            title="Toplam Alacak"
            value={formatCurrency(filteredKpis.toplamAlacak)}
            icon={Wallet}
            trend="up"
            variant="success"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );
      
      case 'kpi_gecikmis_alacak':
        return (
          <FilterableStatCard
            title="Gecikmiş Alacak"
            value={formatCurrency(filteredKpis.gecikimisAlacak)}
            icon={Clock}
            trend="neutral"
            variant="warning"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );
      
      case 'kpi_toplam_borc':
        return (
          <FilterableStatCard
            title="Toplam Borç"
            value={formatCurrency(filteredKpis.toplamBorc)}
            icon={CreditCard}
            trend="down"
            variant="destructive"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      case 'kpi_gecikmis_borc':
        return (
          <FilterableStatCard
            title="Gecikmiş Borç"
            value={formatCurrency(filteredKpis.gecikimisBorc)}
            icon={AlertTriangle}
            trend="neutral"
            variant="destructive"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );
      
      case 'kpi_net_bakiye':
        return (
          <FilterableStatCard
            title="Net Bakiye"
            value={formatCurrency(filteredKpis.netBakiye)}
            icon={Scale}
            trend={filteredKpis.netBakiye >= 0 ? "up" : "down"}
            variant={filteredKpis.netBakiye >= 0 ? "success" : "destructive"}
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );
      
      case 'kpi_musteri_sayisi':
        return (
          <FilterableStatCard
            title="Müşteri Sayısı"
            value={filteredKpis.musteriSayisi.toLocaleString('tr-TR')}
            icon={Users}
            trend="neutral"
            variant="default"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );
      
      case 'kpi_aktif_cari':
        return (
          <FilterableStatCard
            title="Aktif Cari"
            value={filteredKpis.aktifCariSayisi.toLocaleString('tr-TR')}
            icon={UserCheck}
            variant="success"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      case 'kpi_net_satis':
        return (
          <FilterableStatCard
            title="Net Satış"
            value={formatCurrency(satisRapor?.netSatis || 0)}
            icon={ShoppingCart}
            trend="up"
            variant="success"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      case 'kpi_brut_satis':
        return (
          <FilterableStatCard
            title="Brüt Satış"
            value={formatCurrency(satisRapor?.brutSatis || 0)}
            icon={TrendingUp}
            variant="default"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      case 'kpi_iade_tutari':
        return (
          <FilterableStatCard
            title="İade Tutarı"
            value={formatCurrency(satisRapor?.iadeTutari || 0)}
            icon={Package}
            variant="destructive"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      case 'kpi_fatura_sayisi':
        return (
          <FilterableStatCard
            title="Fatura Sayısı"
            value={(satisRapor?.faturaSayisi || 0).toLocaleString('tr-TR')}
            icon={FileText}
            variant="default"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      case 'kpi_banka_bakiyesi':
        return (
          <FilterableStatCard
            title="Banka Bakiyesi"
            value={formatCurrency(toplamBankaBakiye || finansRapor?.toplamBankaBakiyesi || 0)}
            icon={Landmark}
            variant="success"
            widgetId={dbWidget?.id || widgetId}
            widgetKey={widgetId}
            containerWidgetId={containerWidgetId}
            currentFilters={widgetFilters}
            onFiltersChange={onFiltersChange}
          />
        );

      // ========== SUMMARY WIDGETS ==========
      case 'ozet_gunluk':
        return <GunlukOzet isLoading={isLoading} />;

      // ========== LIST WIDGETS ==========
      case 'liste_bugun_vade':
        return <BugununVadeleri cariler={getFilteredCariler()} isLoading={isLoading} />;
      
      case 'liste_aranacak_musteriler':
        return <AranacakMusteriler cariler={getFilteredCariler()} isLoading={isLoading} />;
      
      case 'liste_kritik_stok':
        return <KritikStokUyarilari isLoading={isLoading} />;

      case 'liste_en_borclu':
        return <TopCustomers cariler={getFilteredCariler()} isLoading={isLoading} />;

      case 'liste_banka_hesaplari':
        return (
          <BankaHesaplari 
            bankaHesaplari={bankaHesaplari || []} 
            toplamBakiye={toplamBankaBakiye || 0}
            isLoading={isLoading}
            colors={colors}
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
      // NOT: Aşağıdaki grafik widget'ları artık builder_config varsa
      // üstteki BuilderWidgetRenderer bloğunda render ediliyor.
      // Bu case'ler sadece eski/legacy widget'lar için fallback olarak kalıyor.
      
      case 'grafik_vade_yaslandirma':
        // Vade yaşlandırma özel bir widget, legacy kalabilir
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
      
      // Legacy chart widgets removed - now using BuilderWidgetRenderer
      // grafik_ozelkod_dagilimi, grafik_sektor_dagilimi, grafik_kaynak_dagilimi,
      // grafik_lokasyon_dagilimi, grafik_cari_donusum_trend now render via BuilderWidgetRenderer

      // ========== CARİ LİSTE WIDGETS ==========
      case 'liste_cari':
        return (
          <CariListesi
            cariler={getFilteredCariler()}
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
