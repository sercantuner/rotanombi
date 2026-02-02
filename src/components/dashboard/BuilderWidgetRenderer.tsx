// BuilderWidgetRenderer - Widget Builder ile oluşturulan widget'ları render eder
// v3.0 - Sadece KPI ve Custom Code destekli (tüm standart grafikler kaldırıldı)

import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { WidgetBuilderConfig, AggregationType, DatePeriod } from '@/lib/widgetBuilderTypes';
import { useDynamicWidgetData } from '@/hooks/useDynamicWidgetData';
import { useChartColorPalette } from '@/hooks/useChartColorPalette';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { DrillDownModal } from './DrillDownModal';
import { WidgetDateFilter, getDateRangeForPeriod } from './WidgetDateFilter';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Hash, Code, BarChart3 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

// Recharts bileşenlerini scope'a ekle (customCode için)
const RechartsScope = {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart: RechartsPieChart, Pie, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
};

// Custom widget'lar için UI scope (portal/modal gibi bileşenler)
const UIScope = {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  const { filters } = useGlobalFilters();
  
  // Veri çekme - global filtreler ile
  const { data, rawData, isLoading, error, refetch } = useDynamicWidgetData(builderConfig, filters);
  
  // DEBUG: Widget veri durumu
  console.log(`[BuilderWidgetRenderer] ${widgetName} (${widgetId})`, {
    hasData: !!data,
    rawDataLength: rawData?.length || 0,
    isLoading,
    error,
    dataSourceId: builderConfig?.dataSourceId,
    vizType: builderConfig?.visualization?.type,
  });
  
  // Widget bazında kullanıcı renk paleti
  const { colors: userColors } = useChartColorPalette({ widgetId });
  
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

  // Tarih periyodu değişikliği
  const handleDatePeriodChange = (period: DatePeriod, dateRange?: { start: Date; end: Date }) => {
    setSelectedDatePeriod(period);
    if (period === 'custom' && dateRange) {
      setCustomDateRange(dateRange);
    } else {
      setCustomDateRange(null);
    }
  };

  // KPI drill-down (tüm veriyi göster)
  const handleKpiDrillDown = () => {
    setDrillDownTitle(`${widgetName} - Detaylar`);
    setDrillDownData(filteredData);
    setDrillDownOpen(true);
  };

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
  if (vizType === 'custom' && (builderConfig as any).customCode) {
    const customCode = (builderConfig as any).customCode;
    
    try {
      const fn = new Function(
        'React',
        'data',
        'LucideIcons',
        'Recharts',
        'colors',
        'filters',  // Global filtreler - widget'lar aktif filtreleri görebilir
        'UI',       // UI bileşenleri (Dialog vb.)
        customCode
      );
      
      // Custom widget'a colors ve filters prop'ları geç
      const WidgetComponent = fn(React, filteredData, LucideIcons, RechartsScope, userColors, filters, UIScope);
      
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
              {/* Custom widget'a data, colors ve filters prop'ları geçirilir - h-full wrapper ile */}
              <div className="flex-1 h-full min-h-0 flex flex-col">
                <WidgetComponent data={filteredData} colors={userColors} filters={filters} />
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
