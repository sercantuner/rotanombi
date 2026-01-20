// LiveWidgetPreview - Widget Builder'da gerçek verilerle çalışan canlı önizleme

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WidgetBuilderConfig, CalculatedField, AggregationType, PostFetchFilter, PivotConfig } from '@/lib/widgetBuilderTypes';
import { TableColumn } from './TableColumnBuilder';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, RefreshCw, Eye, AlertCircle, CheckCircle2, Hash, 
  BarChart3, TrendingUp, PieChart, Activity, Table, List, Loader2 
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Renk paleti
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 60%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(35, 80%, 50%)',
  'hsl(340, 70%, 55%)',
];

interface LiveWidgetPreviewProps {
  config: WidgetBuilderConfig;
  widgetName: string;
  widgetIcon: string;
  xAxisField: string;
  yAxisField: string;
  legendField: string;
  calculatedFields: CalculatedField[];
  postFetchFilters: PostFetchFilter[];
  tableColumns: TableColumn[];
  pivotConfig: PivotConfig;
  dataSourceId: string | null;
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
    case 'count':
      return `${prefix || ''}${Math.round(value).toLocaleString('tr-TR')}${suffix || ''}`;
    default:
      return `${prefix || ''}${value.toLocaleString('tr-TR')}${suffix || ''}`;
  }
}

// Agregasyon hesaplama
function calculateAggregation(data: any[], field: string, aggregation: AggregationType): number {
  if (!data || data.length === 0) return 0;
  
  const values = data.map(item => {
    const val = item[field];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
    return 0;
  }).filter(v => !isNaN(v));
  
  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'count': return data.length;
    case 'count_distinct': return new Set(data.map(item => item[field])).size;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

// Grafik verileri için gruplama
function groupDataForChart(
  data: any[], 
  groupField: string, 
  valueField: string, 
  aggregation: AggregationType = 'sum',
  displayLimit: number = 10
): { name: string; value: number }[] {
  if (!data || data.length === 0) return [];

  const groups: Record<string, any[]> = {};
  
  data.forEach(item => {
    const key = String(item[groupField] || 'Belirsiz');
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return Object.entries(groups)
    .map(([name, items]) => ({
      name,
      value: calculateAggregation(items, valueField, aggregation),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, displayLimit);
}

// Post-fetch filtreleme
function applyPostFetchFilters(data: any[], filters: PostFetchFilter[]): any[] {
  if (!filters || filters.length === 0) return data;

  return data.filter(row => {
    let result = true;
    let currentLogical: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const fieldValue = row[filter.field];
      let matches = false;

      const strValue = String(fieldValue ?? '').toLowerCase();
      const filterValue = filter.value.toLowerCase();
      const numValue = parseFloat(String(fieldValue).replace(/[^\d.-]/g, '')) || 0;
      const filterNumValue = parseFloat(filter.value) || 0;
      const filterNumValue2 = parseFloat(filter.value2 || '') || 0;

      switch (filter.operator) {
        case '=': matches = strValue === filterValue; break;
        case '!=': matches = strValue !== filterValue; break;
        case '>': matches = numValue > filterNumValue; break;
        case '<': matches = numValue < filterNumValue; break;
        case '>=': matches = numValue >= filterNumValue; break;
        case '<=': matches = numValue <= filterNumValue; break;
        case 'IN':
          const inValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = inValues.includes(strValue);
          break;
        case 'NOT IN':
          const notInValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = !notInValues.includes(strValue);
          break;
        case 'contains': matches = strValue.includes(filterValue); break;
        case 'not_contains': matches = !strValue.includes(filterValue); break;
        case 'starts_with': matches = strValue.startsWith(filterValue); break;
        case 'ends_with': matches = strValue.endsWith(filterValue); break;
        case 'is_null': matches = fieldValue === null || fieldValue === undefined || fieldValue === ''; break;
        case 'is_not_null': matches = fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; break;
        case 'between': matches = numValue >= filterNumValue && numValue <= filterNumValue2; break;
        default: matches = true;
      }

      if (i === 0) {
        result = matches;
      } else {
        if (currentLogical === 'AND') {
          result = result && matches;
        } else {
          result = result || matches;
        }
      }

      currentLogical = filter.logicalOperator;
    }

    return result;
  });
}

// Hesaplama alanları uygula
function applyCalculatedFields(data: any[], calculatedFields: CalculatedField[]): any[] {
  if (!calculatedFields || calculatedFields.length === 0) return data;
  
  return data.map(row => {
    const newRow = { ...row };
    calculatedFields.forEach(cf => {
      newRow[cf.name] = evaluateExpression(cf.expression, row);
    });
    return newRow;
  });
}

function evaluateExpression(expr: any, row: Record<string, any>): number {
  if (!expr) return 0;
  
  switch (expr.type) {
    case 'field':
      const val = row[expr.field];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    case 'constant':
      return expr.value ?? 0;
    case 'operation':
      const left = evaluateExpression(expr.left, row);
      const right = evaluateExpression(expr.right, row);
      switch (expr.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '%': return left % right;
        default: return 0;
      }
    case 'function':
      const args = expr.arguments?.map((a: any) => evaluateExpression(a, row)) || [];
      switch (expr.functionName) {
        case 'abs': return Math.abs(args[0] || 0);
        case 'round': return Math.round(args[0] || 0);
        case 'floor': return Math.floor(args[0] || 0);
        case 'ceil': return Math.ceil(args[0] || 0);
        case 'sqrt': return Math.sqrt(args[0] || 0);
        case 'pow': return Math.pow(args[0] || 0, args[1] || 0);
        case 'min': return Math.min(...args);
        case 'max': return Math.max(...args);
        default: return 0;
      }
    default:
      return 0;
  }
}

export function LiveWidgetPreview({
  config,
  widgetName,
  widgetIcon,
  xAxisField,
  yAxisField,
  legendField,
  calculatedFields,
  postFetchFilters,
  tableColumns,
  pivotConfig,
  dataSourceId,
}: LiveWidgetPreviewProps) {
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  
  // Anlık görsel tip değiştirme
  const [previewVizType, setPreviewVizType] = useState<string>(config.visualization.type);
  
  // Config değişince preview tipini güncelle
  useEffect(() => {
    setPreviewVizType(config.visualization.type);
  }, [config.visualization.type]);

  // Veri çek
  const fetchPreviewData = useCallback(async () => {
    if (!dataSourceId && !config.diaApi?.method) {
      setError('Veri kaynağı seçilmedi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-api-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          module: config.diaApi.module,
          method: config.diaApi.method,
          ...(config.diaApi.parameters.limit && config.diaApi.parameters.limit > 0 && { limit: config.diaApi.parameters.limit }),
          filters: config.diaApi.parameters.filters,
          selectedColumns: config.diaApi.parameters.selectedcolumns,
          sorts: config.diaApi.parameters.sorts,
          returnAllData: true,
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API hatası');
      }

      setRawData(result.sampleData || []);
      setRecordCount(result.recordCount || result.sampleData?.length || 0);
      setLastFetched(new Date());
      toast.success(`${result.recordCount || 0} kayıt yüklendi`);
    } catch (err: any) {
      setError(err.message || 'Veri çekilemedi');
      toast.error(err.message || 'Veri çekilemedi');
    } finally {
      setIsLoading(false);
    }
  }, [config, dataSourceId]);

  // İşlenmiş veri (filtreler + hesaplamalar uygulanmış)
  const processedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    
    // 1. Hesaplama alanlarını uygula
    let data = applyCalculatedFields(rawData, calculatedFields);
    
    // 2. Post-fetch filtreleri uygula
    data = applyPostFetchFilters(data, postFetchFilters);
    
    return data;
  }, [rawData, calculatedFields, postFetchFilters]);

  // Görselleştirme verisi - previewVizType kullanarak dinamik
  const visualizationData = useMemo(() => {
    if (!processedData || processedData.length === 0) return null;
    
    // KPI için özel hesaplama
    const kpiData = (() => {
      const valueField = config.visualization.kpi?.valueField || yAxisField || '';
      const aggregation = (config.visualization.kpi?.aggregation || 'count') as AggregationType;
      return {
        value: valueField ? calculateAggregation(processedData, valueField, aggregation) : processedData.length,
        format: config.visualization.kpi?.format,
        prefix: config.visualization.kpi?.prefix,
        suffix: config.visualization.kpi?.suffix,
        recordCount: processedData.length,
      };
    })();
    
    // Chart data için ortak hesaplama
    const chartData = (() => {
      const groupField = legendField || xAxisField || config.visualization.chart?.xAxis?.field || '';
      const valueField = yAxisField || config.visualization.chart?.yAxis?.field || config.visualization.chart?.valueField || '';
      const aggregation = ((config.visualization.chart as any)?.aggregation || 'count') as AggregationType;
      
      if (!groupField) {
        // Grup alanı yoksa ilk string alanı bul
        const firstRow = processedData[0];
        if (firstRow) {
          const stringField = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string' && k !== 'id');
          if (stringField) {
            return groupDataForChart(processedData, stringField, valueField || 'toplambakiye', aggregation);
          }
        }
        return [];
      }
      
      return groupDataForChart(processedData, groupField, valueField || 'toplambakiye', aggregation);
    })();
    
    // Table data
    const tableData = {
      rows: processedData.slice(0, 10),
      columns: tableColumns.length > 0 
        ? tableColumns 
        : Object.keys(processedData[0] || {}).slice(0, 6).map(f => ({ field: f, header: f })),
    };
    
    return {
      kpiData,
      chartData,
      tableData,
      showLegend: config.visualization.chart?.showLegend !== false,
      showGrid: config.visualization.chart?.showGrid !== false,
    };
  }, [processedData, config, xAxisField, yAxisField, legendField, tableColumns]);

  // Kullanılabilir görsel tipler
  const availableVizTypes = [
    { id: 'kpi', label: 'KPI', icon: Hash },
    { id: 'bar', label: 'Çubuk', icon: BarChart3 },
    { id: 'line', label: 'Çizgi', icon: TrendingUp },
    { id: 'area', label: 'Alan', icon: Activity },
    { id: 'pie', label: 'Pasta', icon: PieChart },
    { id: 'donut', label: 'Simit', icon: PieChart },
    { id: 'table', label: 'Tablo', icon: Table },
  ];

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Canlı Önizleme</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {lastFetched && (
              <Badge variant="outline" className="text-xs">
                {recordCount} kayıt
              </Badge>
            )}
            <Button 
              size="sm" 
              onClick={fetchPreviewData} 
              disabled={isLoading}
              className="gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isLoading ? 'Yükleniyor...' : 'Veri Çek'}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Gerçek verilerle widget'ın nasıl görüneceğini test edin
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !rawData.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Veri bekleniyor</p>
            <p className="text-xs mt-1">"Veri Çek" butonuna tıklayarak gerçek veriyi yükleyin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* İstatistikler */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Ham: {rawData.length} kayıt
              </Badge>
              {postFetchFilters.length > 0 && (
                <Badge className="text-xs bg-green-600">
                  Filtrelenmiş: {processedData.length} kayıt
                </Badge>
              )}
              {calculatedFields.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{calculatedFields.length} hesaplanan alan
                </Badge>
              )}
            </div>

            {/* Görsel Tip Değiştirici */}
            <div className="flex flex-wrap gap-1 p-2 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground mr-2 self-center">Görsel:</span>
              {availableVizTypes.map(vt => {
                const Icon = vt.icon;
                return (
                  <Button
                    key={vt.id}
                    variant={previewVizType === vt.id ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setPreviewVizType(vt.id)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {vt.label}
                  </Button>
                );
              })}
            </div>

            <Separator />

            {/* Widget Önizleme */}
            <div className="bg-card rounded-lg border p-4 min-h-[280px]">
              {/* KPI */}
              {previewVizType === 'kpi' && visualizationData && (
                <div className="text-center py-4">
                  <DynamicIcon iconName={widgetIcon || 'Hash'} className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <p className="text-5xl font-bold">
                    {formatValue(
                      visualizationData.kpiData.value || 0,
                      visualizationData.kpiData.format,
                      visualizationData.kpiData.prefix,
                      visualizationData.kpiData.suffix
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3">
                    {widgetName || 'KPI Widget'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {processedData.length} kayıt üzerinden hesaplandı
                  </p>
                </div>
              )}

              {/* Bar Chart */}
              {previewVizType === 'bar' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {widgetName || 'Çubuk Grafik'}
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={visualizationData.chartData}>
                      {visualizationData.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                        formatter={(value: number) => [value.toLocaleString('tr-TR'), 'Değer']}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Line Chart */}
              {previewVizType === 'line' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {widgetName || 'Çizgi Grafik'}
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={visualizationData.chartData}>
                      {visualizationData.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                        formatter={(value: number) => [value.toLocaleString('tr-TR'), 'Değer']}
                      />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Area Chart */}
              {previewVizType === 'area' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {widgetName || 'Alan Grafik'}
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={visualizationData.chartData}>
                      {visualizationData.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                        formatter={(value: number) => [value.toLocaleString('tr-TR'), 'Değer']}
                      />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pie Chart */}
              {previewVizType === 'pie' && visualizationData?.chartData && visualizationData.chartData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium mb-4 flex items-center gap-2 self-start">
                    <PieChart className="h-4 w-4" />
                    {widgetName || 'Pasta Grafik'}
                  </p>
                  <div className="w-full max-w-[280px] mx-auto">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={visualizationData.chartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={1}
                        >
                          {visualizationData.chartData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px'
                          }}
                          formatter={(value: number) => [value.toLocaleString('tr-TR'), 'Değer']}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full max-w-[380px]">
                    {visualizationData.chartData.slice(0, 8).map((item: any, index: number) => {
                      const total = visualizationData.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="truncate flex-1" title={item.name}>
                            {String(item.name).slice(0, 15)}
                          </span>
                          <span className="text-muted-foreground">{percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Donut Chart */}
              {previewVizType === 'donut' && visualizationData?.chartData && visualizationData.chartData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium mb-4 flex items-center gap-2 self-start">
                    <PieChart className="h-4 w-4" />
                    {widgetName || 'Simit Grafik'}
                  </p>
                  <div className="w-full max-w-[280px] mx-auto relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={visualizationData.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={2}
                        >
                          {visualizationData.chartData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px'
                          }}
                          formatter={(value: number) => [value.toLocaleString('tr-TR'), 'Değer']}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold">{processedData.length}</span>
                      <span className="text-xs text-muted-foreground">Kayıt</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full max-w-[380px]">
                    {visualizationData.chartData.slice(0, 8).map((item: any, index: number) => {
                      const total = visualizationData.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="truncate flex-1" title={item.name}>
                            {String(item.name).slice(0, 15)}
                          </span>
                          <span className="text-muted-foreground">{percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Table */}
              {previewVizType === 'table' && visualizationData?.tableData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    {widgetName || 'Tablo'}
                  </p>
                  <ScrollArea className="h-[220px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {visualizationData.tableData.columns.slice(0, 5).map((col: any) => (
                            <th key={col.field} className="text-left py-2 px-2 font-medium">
                              {col.header || col.field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visualizationData.tableData.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                            {visualizationData.tableData.columns.slice(0, 5).map((col: any) => (
                              <td key={col.field} className="py-2 px-2 truncate max-w-[150px]">
                                {String(row[col.field] ?? '-').slice(0, 30)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}

              {/* Fallback - veri var ama chart data yok */}
              {!visualizationData?.chartData?.length && !['kpi', 'table'].includes(previewVizType) && rawData.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{widgetName || 'Widget'}</p>
                  <p className="text-xs mt-1">Gruplama alanı (X Ekseni) seçerek grafik oluşturun</p>
                </div>
              )}
            </div>

            {/* Son güncelleme */}
            {lastFetched && (
              <p className="text-xs text-muted-foreground text-center">
                Son güncelleme: {lastFetched.toLocaleTimeString('tr-TR')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
