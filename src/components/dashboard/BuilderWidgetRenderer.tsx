 // BuilderWidgetRenderer - Widget Builder ile oluşturulan widget'ları render eder
 // v4.0 - KPI, Custom Code, Recharts, Leaflet + Nivo (Sankey, Sunburst, Chord, Radar, Choropleth) desteği

import React, { useState, useMemo, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { WidgetBuilderConfig, AggregationType, DatePeriod } from '@/lib/widgetBuilderTypes';
import { useDynamicWidgetData } from '@/hooks/useDynamicWidgetData';
import { useChartColorPalette } from '@/hooks/useChartColorPalette';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { DrillDownModal } from './DrillDownModal';
import { WidgetDateFilter, getDateRangeForPeriod } from './WidgetDateFilter';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Hash, Code, BarChart3 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  // Ek bileşenler - ComposedChart ve diğerleri
  ComposedChart,
  ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  FunnelChart, Funnel, LabelList,
  ReferenceDot, ReferenceArea,
  Treemap,
  // RadialBarChart - yeni eklendi
  RadialBarChart, RadialBar
} from 'recharts';
import { cn } from '@/lib/utils';
 
 // Nivo bileşenleri - lazy import ile yüklenir (performans optimizasyonu)
 let NivoScope: any = null;
 
 // Nivo'yu lazy olarak yükle (sadece gelişmiş grafik widget'ı kullanılırsa)
const initNivoScope = async () => {
    if (NivoScope) return NivoScope;
    
    try {
      const [
        nivoSankey, nivoSunburst, nivoChord, nivoRadar, nivoGeo, nivoFunnel,
        nivoBar, nivoLine, nivoPie, nivoScatterplot, nivoCalendar,
        nivoCirclePacking, nivoHeatmap, nivoMarimekko, nivoNetwork,
        nivoParallelCoordinates, nivoRadialBar, nivoStream, nivoSwarmplot,
        nivoTreemap, nivoVoronoi, nivoWaffle, nivoBump, nivoBullet,
        _nivoCore
      ] = await Promise.all([
        import('@nivo/sankey'),
        import('@nivo/sunburst'),
        import('@nivo/chord'),
        import('@nivo/radar'),
        import('@nivo/geo'),
        import('@nivo/funnel'),
        import('@nivo/bar'),
        import('@nivo/line'),
        import('@nivo/pie'),
        import('@nivo/scatterplot'),
        import('@nivo/calendar'),
        import('@nivo/circle-packing'),
        import('@nivo/heatmap'),
        import('@nivo/marimekko'),
        import('@nivo/network'),
        import('@nivo/parallel-coordinates'),
        import('@nivo/radial-bar'),
        import('@nivo/stream'),
        import('@nivo/swarmplot'),
        import('@nivo/treemap'),
        import('@nivo/voronoi'),
        import('@nivo/waffle'),
        import('@nivo/bump'),
        import('@nivo/bullet'),
        import('@nivo/core')
      ]);
      
      NivoScope = {
        // Mevcut bileşenler
        ResponsiveSankey: nivoSankey.ResponsiveSankey,
        ResponsiveSunburst: nivoSunburst.ResponsiveSunburst,
        ResponsiveChord: nivoChord.ResponsiveChord,
        ResponsiveRadar: nivoRadar.ResponsiveRadar,
        ResponsiveFunnel: nivoFunnel.ResponsiveFunnel,
        ResponsiveChoropleth: nivoGeo.ResponsiveChoropleth,
        ResponsiveGeoMap: nivoGeo.ResponsiveGeoMap,
        
        // Yeni bileşenler
        ResponsiveBar: nivoBar.ResponsiveBar,
        ResponsiveLine: nivoLine.ResponsiveLine,
        ResponsivePie: nivoPie.ResponsivePie,
        ResponsiveScatterPlot: nivoScatterplot.ResponsiveScatterPlot,
        ResponsiveCalendar: nivoCalendar.ResponsiveCalendar,
        ResponsiveCalendarCanvas: nivoCalendar.ResponsiveCalendarCanvas,
        ResponsiveCirclePacking: nivoCirclePacking.ResponsiveCirclePacking,
        ResponsiveCirclePackingCanvas: nivoCirclePacking.ResponsiveCirclePackingCanvas,
        ResponsiveHeatMap: nivoHeatmap.ResponsiveHeatMap,
        ResponsiveHeatMapCanvas: nivoHeatmap.ResponsiveHeatMapCanvas,
        ResponsiveMarimekko: nivoMarimekko.ResponsiveMarimekko,
        ResponsiveNetwork: nivoNetwork.ResponsiveNetwork,
        ResponsiveNetworkCanvas: nivoNetwork.ResponsiveNetworkCanvas,
        ResponsiveParallelCoordinates: nivoParallelCoordinates.ResponsiveParallelCoordinates,
        ResponsiveParallelCoordinatesCanvas: nivoParallelCoordinates.ResponsiveParallelCoordinatesCanvas,
        ResponsiveRadialBar: nivoRadialBar.ResponsiveRadialBar,
        ResponsiveStream: nivoStream.ResponsiveStream,
        ResponsiveSwarmPlot: nivoSwarmplot.ResponsiveSwarmPlot,
        ResponsiveSwarmPlotCanvas: nivoSwarmplot.ResponsiveSwarmPlotCanvas,
        ResponsiveTreeMap: nivoTreemap.ResponsiveTreeMap,
        ResponsiveTreeMapCanvas: nivoTreemap.ResponsiveTreeMapCanvas,
        ResponsiveTreeMapHtml: nivoTreemap.ResponsiveTreeMapHtml,
        ResponsiveVoronoi: nivoVoronoi.ResponsiveVoronoi,
        ResponsiveWaffle: nivoWaffle.ResponsiveWaffle,
        ResponsiveWaffleCanvas: nivoWaffle.ResponsiveWaffleCanvas,
        ResponsiveWaffleHtml: nivoWaffle.ResponsiveWaffleHtml,
        ResponsiveBump: nivoBump.ResponsiveBump,
        ResponsiveAreaBump: nivoBump.ResponsiveAreaBump,
        ResponsiveBullet: nivoBullet.ResponsiveBullet,
        
        // Tema oluşturucu (dark/light mode uyumu)
        getTheme: (isDark: boolean) => ({
          background: 'transparent',
          textColor: isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 20%)',
          fontSize: 11,
          axis: {
            domain: { line: { stroke: isDark ? 'hsl(0 0% 30%)' : 'hsl(0 0% 70%)', strokeWidth: 1 } },
            ticks: { 
              line: { stroke: isDark ? 'hsl(0 0% 30%)' : 'hsl(0 0% 70%)', strokeWidth: 1 },
              text: { fill: isDark ? 'hsl(0 0% 60%)' : 'hsl(0 0% 40%)' }
            },
            legend: { text: { fill: isDark ? 'hsl(0 0% 70%)' : 'hsl(0 0% 30%)' } }
          },
          grid: { line: { stroke: isDark ? 'hsl(0 0% 20%)' : 'hsl(0 0% 90%)', strokeWidth: 1 } },
          legends: { text: { fill: isDark ? 'hsl(0 0% 70%)' : 'hsl(0 0% 30%)' } },
          tooltip: {
            container: {
              background: isDark ? 'hsl(220 10% 15%)' : 'hsl(0 0% 100%)',
              color: isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 20%)',
              fontSize: 12,
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }
          },
          labels: { text: { fill: isDark ? 'hsl(0 0% 90%)' : 'hsl(0 0% 20%)' } }
        })
      };
      
      return NivoScope;
    } catch (e) {
      console.warn('Nivo yüklenemedi:', e);
      return null;
    }
  };
 
  // Nivo placeholder - yüklenmeden önce
  const EmptyNivoScope = {
    // Mevcut
    ResponsiveSankey: () => null,
    ResponsiveSunburst: () => null,
    ResponsiveChord: () => null,
    ResponsiveRadar: () => null,
    ResponsiveFunnel: () => null,
    ResponsiveChoropleth: () => null,
    ResponsiveGeoMap: () => null,
    
    // Yeni bileşenler
    ResponsiveBar: () => null,
    ResponsiveLine: () => null,
    ResponsivePie: () => null,
    ResponsiveScatterPlot: () => null,
    ResponsiveCalendar: () => null,
    ResponsiveCalendarCanvas: () => null,
    ResponsiveCirclePacking: () => null,
    ResponsiveCirclePackingCanvas: () => null,
    ResponsiveHeatMap: () => null,
    ResponsiveHeatMapCanvas: () => null,
    ResponsiveMarimekko: () => null,
    ResponsiveNetwork: () => null,
    ResponsiveNetworkCanvas: () => null,
    ResponsiveParallelCoordinates: () => null,
    ResponsiveParallelCoordinatesCanvas: () => null,
    ResponsiveRadialBar: () => null,
    ResponsiveStream: () => null,
    ResponsiveSwarmPlot: () => null,
    ResponsiveSwarmPlotCanvas: () => null,
    ResponsiveTreeMap: () => null,
    ResponsiveTreeMapCanvas: () => null,
    ResponsiveTreeMapHtml: () => null,
    ResponsiveVoronoi: () => null,
    ResponsiveWaffle: () => null,
    ResponsiveWaffleCanvas: () => null,
    ResponsiveWaffleHtml: () => null,
    ResponsiveBump: () => null,
    ResponsiveAreaBump: () => null,
    ResponsiveBullet: () => null,
    
    useTheme: () => ({}),
    getTheme: () => ({})
  };

// Leaflet harita bileşenleri - lazy import ile yüklenir
let MapScope: any = null;

// Leaflet'i lazy olarak yükle (sadece harita widget'ı kullanılırsa)
const initMapScope = async () => {
  if (MapScope) return MapScope;
  
  try {
    const [reactLeaflet, L] = await Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]);
    
    // Leaflet CSS
    await import('leaflet/dist/leaflet.css');
    
    // Default marker icon fix
    // @ts-ignore
    delete L.default.Icon.Default.prototype._getIconUrl;
    L.default.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    
    MapScope = {
      MapContainer: reactLeaflet.MapContainer,
      TileLayer: reactLeaflet.TileLayer,
      Marker: reactLeaflet.Marker,
      Popup: reactLeaflet.Popup,
      Tooltip: reactLeaflet.Tooltip,  // Harita tooltip'i eklendi
      CircleMarker: reactLeaflet.CircleMarker,
      Polyline: reactLeaflet.Polyline,
      Polygon: reactLeaflet.Polygon,
      Rectangle: reactLeaflet.Rectangle,
      Circle: reactLeaflet.Circle,
      // Hooks
      useMap: reactLeaflet.useMap,
      useMapEvents: reactLeaflet.useMapEvents,
      useMapEvent: reactLeaflet.useMapEvent,
      L: L.default
    };
    
    return MapScope;
  } catch (e) {
    console.warn('Leaflet yüklenemedi:', e);
    return null;
  }
};

// Map yüklenirken gösterilecek placeholder bileşen
const MapLoadingPlaceholder = ({ children, ...props }: any) => {
  return React.createElement('div', {
    style: {
      width: '100%',
      height: '100%',
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'hsl(var(--muted))',
      borderRadius: '0.5rem',
      color: 'hsl(var(--muted-foreground))',
      fontSize: '14px'
    }
  }, 'Harita yükleniyor...');
};

// Boş placeholder bileşenler
const EmptyMapComponent = ({ children }: any) => null;

// Başlangıçta loading placeholder - harita kullanılırsa yüklenir
const EmptyMapScope = {
  MapContainer: MapLoadingPlaceholder,
  TileLayer: EmptyMapComponent,
  Marker: EmptyMapComponent,
  Popup: EmptyMapComponent,
  Tooltip: EmptyMapComponent,
  CircleMarker: EmptyMapComponent,
  Polyline: EmptyMapComponent,
  Polygon: EmptyMapComponent,
  Rectangle: EmptyMapComponent,
  Circle: EmptyMapComponent,
  // Hooks - güvenli placeholder
  useMap: () => ({ setView: () => {}, getZoom: () => 10, getCenter: () => ({ lat: 39, lng: 35 }) }),
  useMapEvents: () => null,
  useMapEvent: () => null,
  L: {
    latLng: (lat: number, lng: number) => ({ lat, lng }),
    icon: () => ({}),
  }
};

// Recharts bileşenlerini scope'a ekle (customCode için)
const RechartsScope = {
  // Temel grafikler
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart: RechartsPieChart, Pie, Cell,
  // Composed (karma) grafik
  ComposedChart,
  // Scatter (dağılım) grafik
  ScatterChart, Scatter,
  // Radar grafik
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  // Funnel (huni) grafik
  FunnelChart, Funnel, LabelList,
  // RadialBar grafik
  RadialBarChart, RadialBar,
  // Treemap
  Treemap,
  // Referans çizgileri ve işaretleyiciler
  ReferenceLine, ReferenceDot, ReferenceArea,
  // Ortak bileşenler
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
};

// MapScope artık lazy olarak yukarıda tanımlandı - buradaki eski tanım kaldırıldı

// Custom widget'lar için UI scope (portal/modal gibi bileşenler)
const UIScope = {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
};

// Error Boundary bileşeni
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Widget render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Agregasyon hesaplamaları (custom code içinde kullanılabilir)
function calculateAggregation(data: any[], field: string, aggregation: AggregationType): number {
  if (!data || data.length === 0) return 0;
  const values = data.map(item => {
    const val = item[field];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
    return 0;
  }).filter(v => !isNaN(v));

  switch (aggregation) {
    case 'sum': return values.reduce((acc, val) => acc + val, 0);
    case 'avg': return values.length > 0 ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;
    case 'count': return data.length;
    case 'count_distinct': return new Set(data.map(item => item[field])).size;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((acc, val) => acc + val, 0);
  }
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <BarChart3 className={className} />;
  return <Icon className={className} />;
};

// Değer formatlama
function formatValue(value: number, format?: string, prefix?: string, suffix?: string): string {
  let formatted = '';
  
  switch (format) {
    case 'currency':
      if (Math.abs(value) >= 1_000_000_000) {
        formatted = `${(value / 1_000_000_000).toFixed(1)}B`;
      } else if (Math.abs(value) >= 1_000_000) {
        formatted = `${(value / 1_000_000).toFixed(1)}M`;
      } else if (Math.abs(value) >= 1_000) {
        formatted = `${(value / 1_000).toFixed(0)}K`;
      } else {
        formatted = value.toLocaleString('tr-TR');
      }
      return `${prefix || '₺'}${formatted}${suffix || ''}`;
    case 'percentage':
      return `%${value.toFixed(1)}${suffix || ''}`;
    case 'number':
      return `${prefix || ''}${value.toLocaleString('tr-TR')}${suffix || ''}`;
    case 'count':
      return `${prefix || ''}${Math.round(value).toLocaleString('tr-TR')}${suffix || ''}`;
    default:
      return `${prefix || ''}${value.toLocaleString('tr-TR')}${suffix || ''}`;
  }
}

interface BuilderWidgetRendererProps {
  widgetId: string;
  widgetName: string;
  widgetIcon?: string;
  builderConfig: WidgetBuilderConfig;
  className?: string;
}

export function BuilderWidgetRenderer({
  widgetId,
  widgetName,
  widgetIcon,
  builderConfig,
  className = '',
}: BuilderWidgetRendererProps) {
  // CSS izolasyonu - konteyner stillerinin widget'ı etkilememesi için
  const isolatedClassName = cn(className, 'isolate overflow-visible');
  // Global filtreler - widget verilerini filtrelemek için
  const { filters, crossFilter, setCrossFilter, clearCrossFilter } = useGlobalFilters();
  
  // Veri çekme - global filtreler ile
  const { data, rawData, multiQueryData, isLoading, error, refetch } = useDynamicWidgetData(builderConfig, filters);
  
  // DEBUG: Widget veri durumu - SADECE development modunda
  if (process.env.NODE_ENV === 'development') {
    console.log(`[BuilderWidgetRenderer] ${widgetName} (${widgetId})`, {
      hasData: !!data,
      rawDataLength: rawData?.length || 0,
      isLoading,
      error,
      dataSourceId: builderConfig?.dataSourceId,
      vizType: builderConfig?.visualization?.type,
    });
  }
  
  // Widget bazında kullanıcı renk paleti
  const { colors: userColors } = useChartColorPalette({ widgetId });

  // Custom code (opsiyonel) + Map kullanımı tespiti (hook'lar koşulsuz çağrılmalı)
  const customCode = (builderConfig as any).customCode as string | undefined;
  const needsMap = useMemo(() => {
    if (!customCode) return false;
    return /(^|[^a-zA-Z0-9_])Map\./.test(customCode);
  }, [customCode]);

   // Nivo kullanımı tespiti
   const needsNivo = useMemo(() => {
     if (!customCode) return false;
     return /(^|[^a-zA-Z0-9_])Nivo\./.test(customCode);
   }, [customCode]);
 
  // Harita scope'u: ihtiyaç varsa lazy yükle, yoksa boş scope kullan
  const [mapScope, setMapScope] = useState<any>(() => MapScope || EmptyMapScope);
   // Nivo scope'u: ihtiyaç varsa lazy yükle
   const [nivoScope, setNivoScope] = useState<any>(() => NivoScope || EmptyNivoScope);
 

  useEffect(() => {
    let cancelled = false;

    if (!needsMap) {
      setMapScope(EmptyMapScope);
      return;
    }

    initMapScope().then((scope) => {
      if (cancelled) return;
      setMapScope(scope || EmptyMapScope);
    });

    return () => {
      cancelled = true;
    };
  }, [needsMap]);
   
   // Nivo lazy loading
   useEffect(() => {
     let cancelled = false;
 
     if (!needsNivo) {
       setNivoScope(EmptyNivoScope);
       return;
     }
 
     initNivoScope().then((scope) => {
       if (cancelled) return;
       setNivoScope(scope || EmptyNivoScope);
     });
 
     return () => {
       cancelled = true;
     };
   }, [needsNivo]);
  
  // Tarih filtresi state
  const [selectedDatePeriod, setSelectedDatePeriod] = useState<DatePeriod>(
    builderConfig.dateFilter?.defaultPeriod || 'all'
  );
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  
  // Drill-down state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownData, setDrillDownData] = useState<any[]>([]);

  // Tarih filtresine göre veri filtrele
  // ÖNEMLİ: Bu hook koşullu return'lardan ÖNCE çağrılmalı (React hook kuralı)
  const filteredData = useMemo(() => {
    if (!rawData || rawData.length === 0) return rawData;
    if (selectedDatePeriod === 'all') return rawData;
    
    const dateField = builderConfig.dateFilter?.dateField;
    if (!dateField) return rawData;
    
    let dateRange = customDateRange;
    if (!dateRange && selectedDatePeriod !== 'custom') {
      dateRange = getDateRangeForPeriod(selectedDatePeriod);
    }
    
    if (!dateRange) return rawData;
    
    return rawData.filter(item => {
      const dateValue = item[dateField];
      if (!dateValue) return false;
      
      const itemDate = new Date(dateValue);
      return itemDate >= dateRange!.start && itemDate <= dateRange!.end;
    });
  }, [rawData, selectedDatePeriod, customDateRange, builderConfig.dateFilter?.dateField]);

  // Tarih periyodu değişikliği - useCallback ile stabilize et
  const handleDatePeriodChange = useCallback((period: DatePeriod, dateRange?: { start: Date; end: Date }) => {
    setSelectedDatePeriod(period);
    if (period === 'custom' && dateRange) {
      setCustomDateRange(dateRange);
    } else {
      setCustomDateRange(null);
    }
  }, []);

  // Cross-filter handler (Power BI tarzı widget tıklaması)
  // ÖNEMLİ: Bu hook koşullu return'lardan ÖNCE çağrılmalı
  const handleCrossFilter = useCallback((field: string, value: string | string[], label?: string) => {
    // Aynı widget'tan aynı değer tıklanırsa filtreyi temizle
    if (crossFilter?.sourceWidgetId === widgetId && 
        JSON.stringify(crossFilter.value) === JSON.stringify(value)) {
      clearCrossFilter();
    } else {
      setCrossFilter({
        sourceWidgetId: widgetId,
        field,
        value,
        label,
      });
    }
  }, [widgetId, crossFilter, setCrossFilter, clearCrossFilter]);

  // KPI drill-down handler - useCallback ile stabilize et
  const handleKpiDrillDown = useCallback(() => {
    setDrillDownTitle(`${widgetName} - Detaylar`);
    setDrillDownData(filteredData || []);
    setDrillDownOpen(true);
  }, [widgetName, filteredData]);

  // === KOŞULLU RETURN'LAR - TÜM HOOK'LARDAN SONRA ===
  
  // Sadece İLK yüklemede VE veri yoksa skeleton göster
  // Cache'den gelen veri varsa (stale bile olsa) skeleton gösterme - flicker önleme
  if (isLoading && (!data || (Array.isArray(data) && data.length === 0))) {
    return (
      <Card className={isolatedClassName}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn(isolatedClassName, 'border-muted')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 py-4 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">{error}</span>
        </CardContent>
      </Card>
    );
  }

  // Veri yok durumu
  if (!data && !isLoading) {
    return (
      <Card className={isolatedClassName}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4 text-muted-foreground">
          <span className="text-sm">Veri bulunamadı</span>
        </CardContent>
      </Card>
    );
  }

  const vizType = builderConfig.visualization.type;
  const dateFilterConfig = builderConfig.dateFilter;
  const showDateFilter = dateFilterConfig?.enabled && dateFilterConfig?.showInWidget;

  // Header bileşeni - sadece tarih seçici (widget ismi gizli, feedback butonu ContainerRenderer'da)
  const ChartHeader = () => {
    // Sadece tarih filtresi varsa header göster, yoksa null döndür
    if (!showDateFilter) return null;
    
    return (
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-end">
          <WidgetDateFilter
            config={dateFilterConfig!}
            currentPeriod={selectedDatePeriod}
            onPeriodChange={handleDatePeriodChange}
            compact
          />
        </div>
      </CardHeader>
    );
  };

  // KPI Widget (drill-down destekli) - feedback butonu ContainerRenderer'dan gelecek
  if (vizType === 'kpi' && data) {
    const IconComponent = widgetIcon ? (LucideIcons as any)[widgetIcon] || Hash : Hash;
    return (
      <>
        <div 
          className="cursor-pointer group relative h-full"
          onClick={handleKpiDrillDown}
          title="Detayları görmek için tıklayın"
        >
          <StatCard
            title={widgetName}
            value={formatValue(
              data.value || 0,
              data.format,
              data.prefix,
              data.suffix
            )}
            icon={IconComponent}
            variant="default"
          />
        </div>
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          title={drillDownTitle}
          subtitle={`${data.recordCount || filteredData.length} kayıt`}
          data={drillDownData}
          valueField={builderConfig.visualization.kpi?.valueField}
        />
      </>
    );
  }

  // Custom Code Widget - Tüm grafik/tablo widget'ları artık burada render ediliyor
  if (vizType === 'custom' && customCode) {
    
    try {
      const fn = new Function(
        'React',
        'data',
        'LucideIcons',
        'Recharts',
        'colors',
        'filters',  // Global filtreler - widget'lar aktif filtreleri görebilir
        'UI',       // UI bileşenleri (Dialog vb.)
        'Map',      // Leaflet harita bileşenleri
        'crossFilter', // Aktif çapraz filtre state'i
        'onCrossFilter', // Çapraz filtre oluşturma callback'i
        'multiData', // Multi-query ham sonuçları (query sırası ile)
        'Nivo',     // Nivo bileşenleri (Sankey, Sunburst, Chord, Radar, Geo, Funnel)
        customCode
      );
      
      // Custom widget'a colors, filters, crossFilter ve onCrossFilter prop'ları geç
        const WidgetComponent = fn(React, filteredData, LucideIcons, RechartsScope, userColors, filters, UIScope, mapScope, crossFilter, handleCrossFilter, multiQueryData, nivoScope);
      
      if (typeof WidgetComponent !== 'function') {
        return (
          <Card className={isolatedClassName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <Code className="h-4 w-4" />
                {widgetName}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Widget fonksiyonu bulunamadı
            </CardContent>
          </Card>
        );
      }
      
      return (
        <Card className={cn(isolatedClassName, 'h-full flex flex-col !border-0')}>
          <ChartHeader />
          <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-3">
            <ErrorBoundary fallback={
              <div className="text-destructive text-sm flex items-center gap-2 py-4">
                <AlertCircle className="h-4 w-4" />
                Widget render hatası
              </div>
            }>
              {/* Custom widget'a data, colors ve filters prop'ları geçirilir - Leaflet için min-h zorunlu */}
              <div className="flex-1 h-full min-h-0 flex flex-col [&_.leaflet-container]:min-h-[350px]">
                <WidgetComponent 
                  data={filteredData} 
                  colors={userColors} 
                  filters={filters} 
                  crossFilter={crossFilter}
                  onCrossFilter={handleCrossFilter}
                  multiData={multiQueryData}
                />
              </div>
            </ErrorBoundary>
          </CardContent>
        </Card>
      );
    } catch (err: any) {
      console.error('Custom widget error:', err);
      return (
        <Card className={isolatedClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {widgetName}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{err.message}</p>
          </CardContent>
        </Card>
      );
    }
  }

  // Fallback - desteklenmeyen widget türleri için
  return (
    <Card className={isolatedClassName}>
      <CardContent className="py-8 text-center text-muted-foreground">
        <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">{widgetName}</p>
        <p className="text-xs mt-1">
          Bu widget türü artık desteklenmiyor. 
          <br />
          Lütfen widget'ı Custom Code olarak yeniden oluşturun.
        </p>
      </CardContent>
    </Card>
  );
}

// Helper fonksiyonları export et (custom code içinde kullanılabilir)
export { calculateAggregation, formatValue };
