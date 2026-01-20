// BuilderWidgetRenderer - Widget Builder ile oluşturulan widget'ları render eder (Drill-down destekli)

import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { WidgetBuilderConfig, AggregationType, DatePeriod } from '@/lib/widgetBuilderTypes';
import { useDynamicWidgetData } from '@/hooks/useDynamicWidgetData';
import { DrillDownModal } from './DrillDownModal';
import { WidgetDateFilter, getDateRangeForPeriod } from './WidgetDateFilter';
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
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';
import { 
  COLOR_PALETTES, 
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
  const { data, rawData, isLoading, error, refetch } = useDynamicWidgetData(builderConfig);
  
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
  
  // Renk paleti ve görsel ayarlar - her widget kendi ayarlarını kullanır
  const colorPalette = chartSettings.colorPalette || 'default';
  const showGrid = chartSettings.showGrid !== false;
  const legendPosition = chartSettings.legendPosition || 'bottom';
  const displayLimit = chartSettings.displayLimit || 10;
  const showTrendLine = chartSettings.showTrendLine || false;
  const showAverageLine = chartSettings.showAverageLine || false;
  
  // Aktif renk paleti - her widget kendi chartSettings.colorPalette değerini kullanır
  const activeColors = COLOR_PALETTES[colorPalette as PaletteKey] || COLOR_PALETTES.default;
  
  // X ve Y ekseni alanlarını belirle - fieldWells öncelikli
  const xAxisField = fieldWells?.xAxis?.field || vizChart?.xAxis?.field || '';
  const yAxisField = fieldWells?.yAxis?.[0]?.field || vizChart?.yAxis?.field || vizChart?.valueField || '';
  const yAxisAggregation = fieldWells?.yAxis?.[0]?.aggregation || vizChart?.yAxis?.aggregation || 'sum';
  
  // Dinamik etiketler - fieldWells'den veya config'den al
  const yAxisLabel = fieldWells?.yAxis?.[0]?.label 
    || fieldWells?.value?.label 
    || vizChart?.yAxis?.label 
    || 'Değer';
  const xAxisLabel = fieldWells?.xAxis?.label 
    || fieldWells?.category?.label 
    || vizChart?.xAxis?.label 
    || 'Kategori';
  
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
      <Card className={className}>
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
      <Card className={`${className} border-muted`}>
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
      <Card className={className}>
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
        {showDateFilter && (
          <WidgetDateFilter
            config={dateFilterConfig!}
            currentPeriod={selectedDatePeriod}
            onPeriodChange={handleDatePeriodChange}
            compact
          />
        )}
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

  // Custom Code Widget
  if (vizType === 'custom' && (builderConfig as any).customCode) {
    const customCode = (builderConfig as any).customCode;
    
    try {
      const fn = new Function(
        'React',
        'data',
        'LucideIcons',
        'Recharts',
        customCode
      );
      
      const WidgetComponent = fn(React, filteredData, LucideIcons, RechartsScope);
      
      if (typeof WidgetComponent !== 'function') {
        return (
          <Card className={className}>
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
        <Card className={className}>
          <ChartHeader icon="Code" />
          <CardContent>
            <ErrorBoundary fallback={
              <div className="text-destructive text-sm flex items-center gap-2 py-4">
                <AlertCircle className="h-4 w-4" />
                Widget render hatası
              </div>
            }>
              <WidgetComponent data={filteredData} />
            </ErrorBoundary>
          </CardContent>
        </Card>
      );
    } catch (err: any) {
      console.error('Custom widget error:', err);
      return (
        <Card className={className}>
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
        <Card className={className}>
          <ChartHeader icon="BarChart3" />
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayData}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  interval={displayData.length > 15 ? Math.floor(displayData.length / 10) : 0}
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? "end" : "middle"}
                  height={displayData.length > 10 ? 60 : 30}
                />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
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
        <Card className={className}>
          <ChartHeader icon="TrendingUp" />
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={displayData}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  interval={displayData.length > 15 ? Math.floor(displayData.length / 10) : 0}
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? "end" : "middle"}
                  height={displayData.length > 10 ? 60 : 30}
                />
                <YAxis tick={{ fontSize: 11 }} />
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
        <Card className={className}>
          <ChartHeader icon="Activity" />
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={displayData}>
                {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  interval={displayData.length > 15 ? Math.floor(displayData.length / 10) : 0}
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? "end" : "middle"}
                  height={displayData.length > 10 ? 60 : 30}
                />
                <YAxis tick={{ fontSize: 11 }} />
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
  if (['pie', 'donut'].includes(vizType) && data?.chartData) {
    const isDonut = vizType === 'donut';
    const legendField = fieldWells?.category?.field || builderConfig.visualization.chart?.legendField || '';
    const chartDataTotal = data.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
    
    return (
      <>
        <Card className={cn(className, 'overflow-visible')}>
          <ChartHeader icon="PieChart" />
          <CardContent className="flex flex-col items-center py-4">
            {/* Grafik alanı */}
            <div className="w-full max-w-[280px] mx-auto relative">
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPieChart>
                  <Pie
                    data={data.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isDonut ? 50 : 0}
                    outerRadius={85}
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
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    wrapperStyle={{ zIndex: 100 }}
                    formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
              {/* Donut merkez metin - düşük z-index */}
              {isDonut && (
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ zIndex: 10 }}
                >
                  <span className="text-2xl font-bold">{data.chartData.length}</span>
                  <span className="text-xs text-muted-foreground">{xAxisLabel}</span>
                </div>
              )}
            </div>
            
            {/* Özel Legend - 2 sütunlu grid, displayLimit kadar kategori */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full max-w-[380px]">
              {data.chartData.slice(0, displayLimit).map((item: any, index: number) => {
                const percent = chartDataTotal > 0 ? ((item.value / chartDataTotal) * 100).toFixed(1) : '0';
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                    onClick={() => handleDrillDown(item.name, legendField)}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: activeColors[index % activeColors.length] }}
                    />
                    <span className="truncate flex-1" title={item.name}>
                      {String(item.name).slice(0, 15)}
                    </span>
                    <span className="text-muted-foreground">{percent}%</span>
                  </div>
                );
              })}
              {data.chartData.length > displayLimit && (
                <span className="text-xs text-muted-foreground col-span-2 text-center mt-1">
                  +{data.chartData.length - displayLimit} daha...
                </span>
              )}
            </div>
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

  // Table (zaten detay gösteriyor)
  if (vizType === 'table' && data?.tableData) {
    return (
      <Card className={className}>
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
      <Card className={className}>
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
      <Card className={className}>
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
    <Card className={className}>
      <CardContent className="py-8 text-center text-muted-foreground">
        <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">{widgetName}</p>
        <p className="text-xs">Görselleştirme yüklenemedi</p>
      </CardContent>
    </Card>
  );
}
