// BuilderWidgetRenderer - Widget Builder ile oluşturulan widget'ları render eder (Drill-down destekli)

import React, { useState, useMemo, Component, ErrorInfo, ReactNode, useRef, useEffect } from 'react';
import { WidgetBuilderConfig, AggregationType, DatePeriod } from '@/lib/widgetBuilderTypes';
import { useDynamicWidgetData } from '@/hooks/useDynamicWidgetData';
import { useChartColorPalette } from '@/hooks/useChartColorPalette';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { DrillDownModal } from './DrillDownModal';
import { WidgetDateFilter, getDateRangeForPeriod } from './WidgetDateFilter';
import { WidgetFeedbackButton } from './WidgetFeedbackButton';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, Hash, MousePointerClick, Calendar, AlertTriangle, Code } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';
import { 
  COLOR_PALETTES as CHART_UTILS_PALETTES, 
  PaletteKey, 
  isDateField, 
  detectDateGroupingType, 
  groupDataForChartWithDates,
  generateGradientColors 
} from '@/lib/chartUtils';

// Recharts bileşenlerini scope'a ekle (customCode için)
const RechartsScope = {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart: RechartsPieChart, Pie, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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

// Agregasyon hesaplamaları (pivot için)
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
interface BuilderWidgetRendererProps {
  widgetId: string;
  widgetName: string;
  widgetIcon?: string;
  builderConfig: WidgetBuilderConfig;
  className?: string;
}

// Pie/Donut Chart ile Collapsible Legend - sığmazsa legend gizlenir, ok ile açılır
interface PieDonutChartProps {
  data: any;
  vizType: string;
  builderConfig: WidgetBuilderConfig;
  xAxisLabel: string;
  yAxisLabel: string;
  activeColors: string[];
  displayLimit: number;
  isolatedClassName: string;
  handleDrillDown: (value: string, field: string) => void;
  drillDownOpen: boolean;
  setDrillDownOpen: (open: boolean) => void;
  drillDownTitle: string;
  drillDownData: any[];
  yAxisField: string;
  fieldWells: any;
  ChartHeader: React.FC<{ icon: string }>;
}

function PieDonutChartWithResponsiveLegend({
  data,
  vizType,
  builderConfig,
  xAxisLabel,
  yAxisLabel,
  activeColors,
  displayLimit,
  isolatedClassName,
  handleDrillDown,
  drillDownOpen,
  setDrillDownOpen,
  drillDownTitle,
  drillDownData,
  yAxisField,
  fieldWells,
  ChartHeader,
}: PieDonutChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [hasEnoughSpace, setHasEnoughSpace] = useState(false);
  
  // Container yüksekliğini kontrol et - legend için yeterli alan var mı?
  useEffect(() => {
    const checkHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        // 350px üstünde legend için yer var demek
        setHasEnoughSpace(containerHeight >= 350);
      }
    };
    
    // İlk render sonrası ölçüm için kısa gecikme
    const timer = setTimeout(checkHeight, 100);
    
    // ResizeObserver ile dinamik kontrol
    const resizeObserver = new ResizeObserver(checkHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, []);

  const isDonut = vizType === 'donut';
  const legendField = fieldWells?.category?.field || builderConfig.visualization.chart?.legendField || '';
  const chartDataTotal = data.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
  
  // Legend'ı göster: ya yeterli yer varsa ya da kullanıcı manuel açtıysa
  const showLegend = hasEnoughSpace || legendExpanded;
  
  return (
    <>
      <Card ref={containerRef} className={cn(isolatedClassName, 'overflow-hidden h-full flex flex-col')}>
        <ChartHeader icon="PieChart" />
        <CardContent className="flex-1 flex flex-col items-center py-2 min-h-0 overflow-hidden">
          {/* Grafik alanı - flex-1 ile kalan alanı doldur, min yükseklik garantili */}
          <div className="w-full max-w-[280px] mx-auto relative flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={data.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={isDonut ? '40%' : 0}
                  outerRadius="75%"
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={isDonut ? 2 : 1}
                  className="cursor-pointer"
                  onClick={(entry) => entry && handleDrillDown(entry.name, legendField)}
                >
                  {data.chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      const percentage = chartDataTotal > 0 ? ((item.value / chartDataTotal) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-card border border-border rounded-lg shadow-lg p-3" style={{ zIndex: 9999 }}>
                          <p className="font-bold text-sm text-foreground mb-1">{item.name}</p>
                          <p className="text-lg font-bold text-primary">
                            {item.value.toLocaleString('tr-TR')} {yAxisLabel}
                          </p>
                          <p className="text-md font-semibold" style={{ color: activeColors[0] }}>
                            %{percentage}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  wrapperStyle={{ zIndex: 9999 }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            {/* Donut merkez metin */}
            {isDonut && (
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ zIndex: 10 }}
              >
                <span className="text-xl font-bold">{data.chartData.length}</span>
                <span className="text-[10px] text-muted-foreground">{xAxisLabel}</span>
              </div>
            )}
          </div>
          
          {/* Legend toggle butonu - yer yoksa göster */}
          {!hasEnoughSpace && (
            <button
              onClick={() => setLegendExpanded(!legendExpanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50"
            >
              <span>{legendExpanded ? 'Gizle' : 'Detaylar'}</span>
              <LucideIcons.ChevronDown 
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  legendExpanded && "rotate-180"
                )} 
              />
            </button>
          )}
          
          {/* Legend - gösterilecekse */}
          {showLegend && (
            <div className={cn(
              "grid grid-cols-2 gap-x-3 gap-y-0.5 w-full max-w-[380px] flex-shrink-0",
              !hasEnoughSpace && "mt-2 pt-2 border-t border-border"
            )}>
              {data.chartData.slice(0, displayLimit).map((item: any, index: number) => {
                const percent = chartDataTotal > 0 ? ((item.value / chartDataTotal) * 100).toFixed(1) : '0';
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                    onClick={() => handleDrillDown(item.name, legendField)}
                  >
                    <div 
                      className="w-2 h-2 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: activeColors[index % activeColors.length] }}
                    />
                    <span className="truncate flex-1" title={item.name}>
                      {String(item.name).slice(0, 12)}
                    </span>
                    <span className="text-muted-foreground">{percent}%</span>
                  </div>
                );
              })}
              {data.chartData.length > displayLimit && (
                <span className="text-[10px] text-muted-foreground col-span-2 text-center">
                  +{data.chartData.length - displayLimit} daha...
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <DrillDownModal
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownTitle}
        data={drillDownData}
        valueField={builderConfig.visualization.chart?.valueField || yAxisField}
      />
    </>
  );
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
  
  // Widget bazında kullanıcı renk paleti - widgetId ile çağırarak widget-specific override desteklenir
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

  // Chart ayarlarını al - önce chartSettings, yoksa visualization.chart
  const chartSettings = builderConfig.chartSettings || {};
  const vizChart = builderConfig.visualization?.chart;
  const fieldWells = builderConfig.fieldWells;
  
  // Renk paleti - kullanıcının seçtiği palet öncelikli, yoksa widget-level palet
  const showGrid = chartSettings.showGrid !== false;
  const legendPosition = chartSettings.legendPosition || 'bottom';
  const displayLimit = chartSettings.displayLimit || 10;
  const showTrendLine = chartSettings.showTrendLine || false;
  const showAverageLine = chartSettings.showAverageLine || false;
  
  // Aktif renk paleti - kullanıcının tercih ettiği palet kullanılır
  const activeColors = userColors;
  
  // X ve Y ekseni alanlarını belirle - fieldWells öncelikli
  const xAxisField = fieldWells?.xAxis?.field || vizChart?.xAxis?.field || '';
  const yAxisField = fieldWells?.yAxis?.[0]?.field || vizChart?.yAxis?.field || vizChart?.valueField || '';
  const yAxisAggregation = fieldWells?.yAxis?.[0]?.aggregation || vizChart?.yAxis?.aggregation || 'sum';
  
  // Dinamik etiketler - fieldWells'den veya config'den al, anlamlı fallback ile
  const getSmartLabel = (type: 'y' | 'x') => {
    if (type === 'y') {
      // Y ekseni / değer etiketi
      if (fieldWells?.yAxis?.[0]?.label) return fieldWells.yAxis[0].label;
      if (fieldWells?.value?.label) return fieldWells.value.label;
      if (vizChart?.yAxis?.label) return vizChart.yAxis.label;
      // Fallback: aggregation tipine göre anlamlı isim
      const agg = fieldWells?.yAxis?.[0]?.aggregation || fieldWells?.value?.aggregation || vizChart?.yAxis?.aggregation;
      if (agg === 'count' || agg === 'count_distinct') return 'Kayıt Sayısı';
      if (agg === 'sum') return 'Toplam';
      if (agg === 'avg') return 'Ortalama';
      return 'Değer';
    } else {
      // X ekseni / kategori etiketi
      if (fieldWells?.xAxis?.label) return fieldWells.xAxis.label;
      if (fieldWells?.category?.label) return fieldWells.category.label;
      if (vizChart?.xAxis?.label) return vizChart.xAxis.label;
      if (vizChart?.legendField) return 'Kategori';
      return 'Kategori';
    }
  };
  
  const yAxisLabel = getSmartLabel('y');
  const xAxisLabel = getSmartLabel('x');
  
  // X ekseni tarih mi kontrol et
  const isXAxisDate = useMemo(() => {
    return xAxisField && rawData.length > 0 && isDateField(xAxisField, rawData);
  }, [xAxisField, rawData]);
  
  // Tarih filtresine göre veri filtrele
  const filteredData = useMemo(() => {
    if (!rawData || rawData.length === 0) return rawData;
    if (selectedDatePeriod === 'all') return rawData;
    
    const dateField = builderConfig.dateFilter?.dateField || xAxisField;
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
  }, [rawData, selectedDatePeriod, customDateRange, builderConfig.dateFilter?.dateField, xAxisField]);
  
  // Grafik verisini hesapla (tarih boşluk doldurma ile)
  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    if (!xAxisField || !yAxisField) return data?.chartData || [];
    
    const aggregation = yAxisAggregation;
    const groupingType = isXAxisDate ? detectDateGroupingType(filteredData, xAxisField) : undefined;
    
    return groupDataForChartWithDates(
      filteredData,
      xAxisField,
      yAxisField,
      aggregation,
      displayLimit,
      isXAxisDate,
      groupingType,
      isXAxisDate // tarih ise boşlukları doldur
    );
  }, [filteredData, xAxisField, yAxisField, chartSettings, isXAxisDate, displayLimit, data?.chartData]);

  // Tarih periyodu değişikliği
  const handleDatePeriodChange = (period: DatePeriod, dateRange?: { start: Date; end: Date }) => {
    setSelectedDatePeriod(period);
    if (period === 'custom' && dateRange) {
      setCustomDateRange(dateRange);
    } else {
      setCustomDateRange(null);
    }
  };

  // Drill-down işleyicisi
  const handleDrillDown = (clickedName: string, groupField: string) => {
    const filteredItems = filteredData.filter(item => 
      String(item[groupField] || 'Belirsiz') === clickedName
    );
    setDrillDownTitle(`${widgetName} - ${clickedName}`);
    setDrillDownData(filteredItems);
    setDrillDownOpen(true);
  };

  // KPI drill-down (tüm veriyi göster)
  const handleKpiDrillDown = () => {
    setDrillDownTitle(`${widgetName} - Detaylar`);
    setDrillDownData(filteredData);
    setDrillDownOpen(true);
  };

  if (isLoading) {
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

  // Header bileşeni (tarih seçici ile)
  const ChartHeader = ({ icon }: { icon: string }) => (
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2 flex-1 min-w-0">
          <DynamicIcon iconName={widgetIcon || icon} className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{widgetName}</span>
          <MousePointerClick className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        </CardTitle>
        <div className="flex items-center gap-1">
          <WidgetFeedbackButton widgetId={widgetId} widgetName={widgetName} />
          {showDateFilter && (
            <WidgetDateFilter
              config={dateFilterConfig!}
              currentPeriod={selectedDatePeriod}
              onPeriodChange={handleDatePeriodChange}
              compact
            />
          )}
        </div>
      </div>
    </CardHeader>
  );

  // KPI Widget (drill-down destekli)
  if (vizType === 'kpi' && data) {
    const IconComponent = widgetIcon ? (LucideIcons as any)[widgetIcon] || Hash : Hash;
    return (
      <>
        <div 
          className="cursor-pointer group relative"
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
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </div>
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

  // Custom Code Widget - colors prop'u ile palet desteği
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
        customCode
      );
      
      // Custom widget'a colors ve filters prop'ları geç
      const WidgetComponent = fn(React, filteredData, LucideIcons, RechartsScope, userColors, filters);
      
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
        <Card className={cn(isolatedClassName, 'h-full flex flex-col')}>
          <ChartHeader icon="Code" />
          <CardContent className="flex-1 flex flex-col min-h-0 p-4">
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

  // Bar Chart (drill-down destekli, tarih ve renk desteği)
  if (vizType === 'bar' && (chartData.length > 0 || data?.chartData)) {
    const displayData = chartData.length > 0 ? chartData : data?.chartData || [];
    const useGradient = isXAxisDate && displayData.length > 10;
    const gradientColors = useGradient ? generateGradientColors(displayData, activeColors[0]) : [];
    
    return (
      <>
        <Card className={isolatedClassName}>
          <ChartHeader icon="BarChart3" />
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayData}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval={displayData.length > 15 ? Math.floor(displayData.length / 10) : 0}
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? "end" : "middle"}
                  height={displayData.length > 10 ? 60 : 30}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                />
                {legendPosition !== 'hidden' && <Legend verticalAlign={legendPosition === 'top' ? 'top' : 'bottom'} />}
                <Bar 
                  dataKey="value" 
                  name={yAxisLabel}
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={(entry) => entry && handleDrillDown(entry.name, xAxisField)}
                >
                  {displayData.map((_: any, index: number) => {
                    if (useGradient) {
                      return <Cell key={`cell-${index}`} fill={gradientColors[index] || activeColors[0]} />;
                    }
                    return <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          title={drillDownTitle}
          data={drillDownData}
          valueField={yAxisField}
        />
      </>
    );
  }

  // Line Chart (drill-down destekli, tarih ve renk desteği)
  if (vizType === 'line' && (chartData.length > 0 || data?.chartData)) {
    const displayData = chartData.length > 0 ? chartData : data?.chartData || [];
    
    return (
      <>
        <Card className={isolatedClassName}>
          <ChartHeader icon="TrendingUp" />
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={displayData}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval={displayData.length > 15 ? Math.floor(displayData.length / 10) : 0}
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? "end" : "middle"}
                  height={displayData.length > 10 ? 60 : 30}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                />
                {legendPosition !== 'hidden' && <Legend verticalAlign={legendPosition === 'top' ? 'top' : 'bottom'} />}
                <Line 
                  type="monotone" 
                  dataKey="value"
                  name={yAxisLabel}
                  stroke={activeColors[0]}
                  strokeWidth={2}
                  dot={{ fill: activeColors[0], r: 3, cursor: 'pointer' }}
                  activeDot={{ 
                    r: 6, 
                    cursor: 'pointer',
                    onClick: (e: any) => e?.payload && handleDrillDown(e.payload.name, xAxisField)
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          title={drillDownTitle}
          data={drillDownData}
          valueField={yAxisField}
        />
      </>
    );
  }

  // Area Chart (drill-down destekli, tarih ve renk desteği)
  if (vizType === 'area' && (chartData.length > 0 || data?.chartData)) {
    const displayData = chartData.length > 0 ? chartData : data?.chartData || [];
    
    return (
      <>
        <Card className={isolatedClassName}>
          <ChartHeader icon="Activity" />
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={displayData}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval={displayData.length > 15 ? Math.floor(displayData.length / 10) : 0}
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? "end" : "middle"}
                  height={displayData.length > 10 ? 60 : 30}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                />
                {legendPosition !== 'hidden' && <Legend verticalAlign={legendPosition === 'top' ? 'top' : 'bottom'} />}
                <Area 
                  type="monotone" 
                  dataKey="value"
                  name={yAxisLabel}
                  stroke={activeColors[0]}
                  fill={`${activeColors[0]}40`}
                  strokeWidth={2}
                  activeDot={{ 
                    r: 6, 
                    cursor: 'pointer',
                    onClick: (e: any) => e?.payload && handleDrillDown(e.payload.name, xAxisField)
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          title={drillDownTitle}
          data={drillDownData}
          valueField={yAxisField}
        />
      </>
    );
  }

  // Pie/Donut Chart (drill-down destekli) - Önizleme ile uyumlu
  // Legend sığmazsa gizlenecek (responsive davranış)
  if (['pie', 'donut'].includes(vizType) && data?.chartData) {
    return (
      <PieDonutChartWithResponsiveLegend
        data={data}
        vizType={vizType}
        builderConfig={builderConfig}
        xAxisLabel={xAxisLabel}
        yAxisLabel={yAxisLabel}
        activeColors={activeColors}
        displayLimit={displayLimit}
        isolatedClassName={isolatedClassName}
        handleDrillDown={handleDrillDown}
        drillDownOpen={drillDownOpen}
        setDrillDownOpen={setDrillDownOpen}
        drillDownTitle={drillDownTitle}
        drillDownData={drillDownData}
        yAxisField={yAxisField}
        fieldWells={fieldWells}
        ChartHeader={ChartHeader}
      />
    );
  }

  // Table (zaten detay gösteriyor)
  if (vizType === 'table' && data?.tableData) {
    return (
      <Card className={isolatedClassName}>
        <ChartHeader icon="Table" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {data.columns?.map((col: any) => (
                    <th key={col.field} className="text-left py-2 px-3 font-medium">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tableData.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                    {data.columns?.map((col: any) => (
                      <td key={col.field} className="py-2 px-3">
                        {row[col.field] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pivot Table
  if (vizType === 'pivot' && filteredData.length > 0) {
    const pivotConfig = builderConfig.visualization.pivot;
    const rowField = pivotConfig?.rowFields?.[0] || '';
    const columnField = pivotConfig?.columnField || '';
    const valueField = pivotConfig?.valueField || '';
    const aggregation = pivotConfig?.aggregation || 'sum';

    // Pivot veri hesaplama
    const rowValues = [...new Set(filteredData.map(item => String(item[rowField] || 'Belirsiz')))];
    const columnValues = columnField 
      ? [...new Set(filteredData.map(item => String(item[columnField] || 'Belirsiz')))]
      : [];

    // Pivot tablo verisi oluştur
    const pivotData = rowValues.map(rowVal => {
      const rowItems = filteredData.filter(item => String(item[rowField] || 'Belirsiz') === rowVal);
      const row: any = { _rowLabel: rowVal };
      
      if (columnField && columnValues.length > 0) {
        columnValues.forEach(colVal => {
          const cellItems = rowItems.filter(item => String(item[columnField] || 'Belirsiz') === colVal);
          row[colVal] = calculateAggregation(cellItems, valueField, aggregation);
        });
        row._rowTotal = calculateAggregation(rowItems, valueField, aggregation);
      } else {
        row._value = calculateAggregation(rowItems, valueField, aggregation);
      }
      
      return row;
    });

    // Sütun toplamları
    const columnTotals: any = { _rowLabel: 'Toplam' };
    if (columnField && columnValues.length > 0) {
      columnValues.forEach(colVal => {
        const colItems = filteredData.filter(item => String(item[columnField] || 'Belirsiz') === colVal);
        columnTotals[colVal] = calculateAggregation(colItems, valueField, aggregation);
      });
      columnTotals._rowTotal = calculateAggregation(filteredData, valueField, aggregation);
    } else {
      columnTotals._value = calculateAggregation(filteredData, valueField, aggregation);
    }

    const formatPivotValue = (val: number) => {
      if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
      return val.toLocaleString('tr-TR');
    };

    return (
      <Card className={isolatedClassName}>
        <ChartHeader icon="Grid3x3" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium border-b">{rowField}</th>
                  {columnField && columnValues.length > 0 ? (
                    <>
                      {columnValues.map(col => (
                        <th key={col} className="text-right py-2 px-3 font-medium border-b">{col}</th>
                      ))}
                      {pivotConfig?.showRowTotals !== false && (
                        <th className="text-right py-2 px-3 font-medium border-b bg-primary/10">Toplam</th>
                      )}
                    </>
                  ) : (
                    <th className="text-right py-2 px-3 font-medium border-b">{valueField}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pivotData.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{row._rowLabel}</td>
                    {columnField && columnValues.length > 0 ? (
                      <>
                        {columnValues.map(col => (
                          <td key={col} className="py-2 px-3 text-right">{formatPivotValue(row[col] || 0)}</td>
                        ))}
                        {pivotConfig?.showRowTotals !== false && (
                          <td className="py-2 px-3 text-right font-medium bg-primary/5">{formatPivotValue(row._rowTotal || 0)}</td>
                        )}
                      </>
                    ) : (
                      <td className="py-2 px-3 text-right">{formatPivotValue(row._value || 0)}</td>
                    )}
                  </tr>
                ))}
                {pivotConfig?.showColumnTotals !== false && (
                  <tr className="bg-muted/50 font-medium">
                    <td className="py-2 px-3">Toplam</td>
                    {columnField && columnValues.length > 0 ? (
                      <>
                        {columnValues.map(col => (
                          <td key={col} className="py-2 px-3 text-right">{formatPivotValue(columnTotals[col] || 0)}</td>
                        ))}
                        {pivotConfig?.showRowTotals !== false && (
                          <td className="py-2 px-3 text-right bg-primary/10">{formatPivotValue(columnTotals._rowTotal || 0)}</td>
                        )}
                      </>
                    ) : (
                      <td className="py-2 px-3 text-right">{formatPivotValue(columnTotals._value || 0)}</td>
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // List
  if (vizType === 'list' && data?.listData) {
    const listConfig = data.listConfig || {};
    const titleField = listConfig.titleField || Object.keys(data.listData[0] || {})[0] || 'name';
    const subtitleField = listConfig.subtitleField;
    const valueField = listConfig.valueField;
    const format = listConfig.format;
    
    const formatListValue = (val: any) => {
      if (val === null || val === undefined) return '-';
      if (format === 'currency') {
        const num = typeof val === 'number' ? val : parseFloat(val) || 0;
        if (Math.abs(num) >= 1_000_000) return `₺${(num / 1_000_000).toFixed(1)}M`;
        if (Math.abs(num) >= 1_000) return `₺${(num / 1_000).toFixed(0)}K`;
        return `₺${num.toLocaleString('tr-TR')}`;
      }
      return String(val);
    };
    
    return (
      <Card className={isolatedClassName}>
        <ChartHeader icon="List" />
        <CardContent>
          <ul className="space-y-2">
            {data.listData.map((item: any, idx: number) => (
              <li key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded hover:bg-muted transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item[titleField] || '-'}</p>
                  {subtitleField && (
                    <p className="text-xs text-muted-foreground truncate">{item[subtitleField] || ''}</p>
                  )}
                </div>
                {valueField && (
                  <span className="text-sm font-semibold ml-2 whitespace-nowrap">
                    {formatListValue(item[valueField])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  // Fallback
  return (
    <Card className={isolatedClassName}>
      <CardContent className="py-8 text-center text-muted-foreground">
        <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">{widgetName}</p>
        <p className="text-xs">Görselleştirme yüklenemedi</p>
      </CardContent>
    </Card>
  );
}
