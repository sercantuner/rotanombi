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

  // Görselleştirme verisi
  const visualizationData = useMemo(() => {
    const vizType = config.visualization.type;
    
    if (vizType === 'kpi') {
      const valueField = config.visualization.kpi?.valueField || '';
      const aggregation = (config.visualization.kpi?.aggregation || 'sum') as AggregationType;
      if (!valueField) return null;
      
      return {
        value: calculateAggregation(processedData, valueField, aggregation),
        format: config.visualization.kpi?.format,
        prefix: config.visualization.kpi?.prefix,
        suffix: config.visualization.kpi?.suffix,
        recordCount: processedData.length,
      };
    }
    
    if (['bar', 'line', 'area'].includes(vizType)) {
      const xField = xAxisField || config.visualization.chart?.xAxis?.field || '';
      const yField = yAxisField || config.visualization.chart?.yAxis?.field || '';
      const aggregation = ((config.visualization.chart as any)?.aggregation || 'sum') as AggregationType;
      
      if (!xField) return null;
      
      return {
        chartData: groupDataForChart(processedData, xField, yField || 'toplambakiye', aggregation),
        showLegend: config.visualization.chart?.showLegend !== false,
        showGrid: config.visualization.chart?.showGrid !== false,
      };
    }
    
    if (['pie', 'donut'].includes(vizType)) {
      const groupField = legendField || xAxisField || config.visualization.chart?.legendField || '';
      const valueField = yAxisField || config.visualization.chart?.valueField || '';
      const aggregation = ((config.visualization.chart as any)?.aggregation || 'sum') as AggregationType;
      
      if (!groupField) return null;
      
      return {
        chartData: groupDataForChart(processedData, groupField, valueField || 'toplambakiye', aggregation),
        showLegend: config.visualization.chart?.showLegend !== false,
      };
    }
    
    if (['table', 'list'].includes(vizType)) {
      return {
        tableData: processedData.slice(0, 10),
        columns: tableColumns.length > 0 
          ? tableColumns 
          : Object.keys(processedData[0] || {}).slice(0, 6).map(f => ({ field: f, header: f })),
      };
    }
    
    if (vizType === 'pivot') {
      const rowField = pivotConfig?.rowFields?.[0] || '';
      const columnField = pivotConfig?.columnField || '';
      const valueField = pivotConfig?.valueField || '';
      const aggregation = (pivotConfig?.aggregation || 'sum') as AggregationType;
      
      if (!rowField || !valueField) return null;
      
      const rowValues = [...new Set(processedData.map(item => String(item[rowField] || 'Belirsiz')))];
      const columnValues = columnField 
        ? [...new Set(processedData.map(item => String(item[columnField] || 'Belirsiz')))]
        : [];
      
      const pivotData = rowValues.slice(0, 10).map(rowVal => {
        const rowItems = processedData.filter(item => String(item[rowField] || 'Belirsiz') === rowVal);
        const row: any = { _rowLabel: rowVal };
        
        if (columnField && columnValues.length > 0) {
          columnValues.slice(0, 5).forEach(colVal => {
            const cellItems = rowItems.filter(item => String(item[columnField] || 'Belirsiz') === colVal);
            row[colVal] = calculateAggregation(cellItems, valueField, aggregation);
          });
          row._rowTotal = calculateAggregation(rowItems, valueField, aggregation);
        } else {
          row._value = calculateAggregation(rowItems, valueField, aggregation);
        }
        
        return row;
      });
      
      return { pivotData, columnValues: columnValues.slice(0, 5), rowField, columnField, valueField };
    }
    
    return null;
  }, [processedData, config, xAxisField, yAxisField, legendField, tableColumns, pivotConfig]);

  const vizType = config.visualization.type;

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
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                Ham: {rawData.length} kayıt
              </Badge>
              {postFetchFilters.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Filtrelenmiş: {processedData.length} kayıt
                </Badge>
              )}
              {calculatedFields.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{calculatedFields.length} hesaplanan alan
                </Badge>
              )}
            </div>

            <Separator />

            {/* Widget Önizleme */}
            <div className="bg-card rounded-lg border p-4">
              {/* KPI */}
              {vizType === 'kpi' && visualizationData && (
                <div className="text-center">
                  <DynamicIcon iconName={widgetIcon || 'Hash'} className="h-10 w-10 mx-auto mb-3 text-primary" />
                  <p className="text-4xl font-bold">
                    {formatValue(
                      visualizationData.value || 0,
                      visualizationData.format,
                      visualizationData.prefix,
                      visualizationData.suffix
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {widgetName || 'KPI Widget'}
                  </p>
                </div>
              )}

              {/* Bar Chart */}
              {vizType === 'bar' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {widgetName || 'Bar Chart'}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={visualizationData.chartData}>
                      {visualizationData.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                      />
                      {visualizationData.showLegend && <Legend />}
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Line Chart */}
              {vizType === 'line' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {widgetName || 'Line Chart'}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={visualizationData.chartData}>
                      {visualizationData.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                      />
                      {visualizationData.showLegend && <Legend />}
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Area Chart */}
              {vizType === 'area' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {widgetName || 'Area Chart'}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={visualizationData.chartData}>
                      {visualizationData.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                      />
                      {visualizationData.showLegend && <Legend />}
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pie/Donut Chart - Düzgün boyutlandırma */}
              {['pie', 'donut'].includes(vizType) && visualizationData?.chartData && (
                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium mb-4 flex items-center gap-2 self-start">
                    <PieChart className="h-4 w-4" />
                    {widgetName || (vizType === 'donut' ? 'Donut Chart' : 'Pie Chart')}
                  </p>
                  <div className="w-full max-w-[320px] mx-auto">
                    <ResponsiveContainer width="100%" height={220}>
                      <RechartsPieChart>
                        <Pie
                          data={visualizationData.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={vizType === 'donut' ? 45 : 0}
                          outerRadius={80}
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
                  </div>
                  {/* Legend ayrı grid olarak */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 w-full max-w-[400px]">
                    {visualizationData.chartData.slice(0, 10).map((item: any, index: number) => {
                      const total = visualizationData.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-3 h-3 rounded-sm flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="truncate flex-1" title={item.name}>
                            {String(item.name).slice(0, 18)}
                          </span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {percent}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {visualizationData.chartData.length > 10 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      +{visualizationData.chartData.length - 10} daha...
                    </p>
                  )}
                </div>
              )}

              {/* Table/List */}
              {['table', 'list'].includes(vizType) && visualizationData?.tableData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    {vizType === 'table' ? <Table className="h-4 w-4" /> : <List className="h-4 w-4" />}
                    {widgetName || (vizType === 'table' ? 'Tablo' : 'Liste')}
                  </p>
                  <ScrollArea className="h-[200px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {visualizationData.columns.slice(0, 5).map((col: any) => (
                            <th key={col.field} className="text-left py-2 px-2 font-medium">
                              {col.header || col.field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visualizationData.tableData.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                            {visualizationData.columns.slice(0, 5).map((col: any) => (
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

              {/* Pivot Table */}
              {vizType === 'pivot' && visualizationData?.pivotData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {widgetName || 'Pivot Tablo'}
                  </p>
                  <ScrollArea className="h-[200px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="text-left py-2 px-2 font-medium">
                            {visualizationData.rowField}
                          </th>
                          {visualizationData.columnField ? (
                            <>
                              {visualizationData.columnValues.map((col: string) => (
                                <th key={col} className="text-right py-2 px-2 font-medium">
                                  {col}
                                </th>
                              ))}
                              <th className="text-right py-2 px-2 font-medium bg-primary/10">
                                Toplam
                              </th>
                            </>
                          ) : (
                            <th className="text-right py-2 px-2 font-medium">
                              {visualizationData.valueField}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {visualizationData.pivotData.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium">{row._rowLabel}</td>
                            {visualizationData.columnField ? (
                              <>
                                {visualizationData.columnValues.map((col: string) => (
                                  <td key={col} className="text-right py-2 px-2">
                                    {formatValue(row[col] || 0, 'number')}
                                  </td>
                                ))}
                                <td className="text-right py-2 px-2 font-medium bg-primary/5">
                                  {formatValue(row._rowTotal || 0, 'number')}
                                </td>
                              </>
                            ) : (
                              <td className="text-right py-2 px-2">
                                {formatValue(row._value || 0, 'number')}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}

              {/* Fallback */}
              {!visualizationData && rawData.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{widgetName || 'Widget'}</p>
                  <p className="text-xs mt-1">Görselleştirme ayarlarını tamamlayın</p>
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
