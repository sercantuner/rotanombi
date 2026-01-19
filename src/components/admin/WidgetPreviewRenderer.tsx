// WidgetPreviewRenderer - Widget Builder için gerçek zamanlı önizleme

import React, { useMemo } from 'react';
import { WidgetBuilderConfig, CalculatedField, CHART_TYPES } from '@/lib/widgetBuilderTypes';
import { DiaApiTestResponse, FieldStat } from '@/lib/diaApiTest';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, Hash, TrendingUp, PieChart, Activity, RefreshCw, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

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
];

interface WidgetPreviewRendererProps {
  config: WidgetBuilderConfig;
  testResult: DiaApiTestResponse | null;
  widgetName: string;
  widgetIcon: string;
  xAxisField: string;
  yAxisField: string;
  legendField: string;
  calculatedFields: CalculatedField[];
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

// Aggregation hesaplama
function calculateAggregation(
  data: any[], 
  field: string, 
  aggregation: string,
  fieldStats?: Record<string, FieldStat>,
  recordCount?: number
): number {
  // fieldStats varsa ve gerçek istatistikler mevcutsa kullan
  if (fieldStats && fieldStats[field]) {
    const stats = fieldStats[field];
    switch (aggregation) {
      case 'sum': return stats.sum || 0;
      case 'avg': return stats.sum && recordCount ? stats.sum / recordCount : 0;
      case 'min': return stats.min || 0;
      case 'max': return stats.max || 0;
      case 'count': return recordCount || data.length;
    }
  }
  
  // Fallback: sample data üzerinden hesapla
  if (!data || data.length === 0) return 0;
  
  const values = data.map(item => {
    const val = item[field];
    return typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  });
  
  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return recordCount || data.length;
    case 'distinct': return new Set(data.map(item => item[field])).size;
    default: return values.reduce((a, b) => a + b, 0);
  }
}

// Chart data oluşturma
function buildChartData(data: any[], xField: string, yField: string, aggregation: string): any[] {
  if (!data || data.length === 0 || !xField) return [];
  
  const grouped = new Map<string, number[]>();
  
  data.forEach(item => {
    const key = String(item[xField] || 'Belirsiz');
    const value = typeof item[yField] === 'number' 
      ? item[yField] 
      : parseFloat(String(item[yField]).replace(/[^0-9.-]/g, '')) || 0;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(value);
  });
  
  return Array.from(grouped.entries())
    .map(([name, values]) => {
      let value = 0;
      switch (aggregation) {
        case 'sum': value = values.reduce((a, b) => a + b, 0); break;
        case 'avg': value = values.reduce((a, b) => a + b, 0) / values.length; break;
        case 'count': value = values.length; break;
        case 'min': value = Math.min(...values); break;
        case 'max': value = Math.max(...values); break;
        default: value = values.reduce((a, b) => a + b, 0);
      }
      return { name, value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export function WidgetPreviewRenderer({
  config,
  testResult,
  widgetName,
  widgetIcon,
  xAxisField,
  yAxisField,
  legendField,
  calculatedFields,
}: WidgetPreviewRendererProps) {
  const vizType = config.visualization.type;
  const hasData = testResult?.success && testResult.sampleData && testResult.sampleData.length > 0;
  
  // KPI değeri hesapla
  const kpiValue = useMemo(() => {
    if (vizType !== 'kpi' || !hasData) return null;
    
    const valueField = config.visualization.kpi?.valueField || '';
    const aggregation = config.visualization.kpi?.aggregation || 'sum';
    
    if (!valueField) return null;
    
    return calculateAggregation(
      testResult!.sampleData!, 
      valueField, 
      aggregation,
      testResult!.fieldStats,
      testResult!.recordCount
    );
  }, [vizType, hasData, config.visualization.kpi, testResult]);
  
  // Chart data hesapla
  const chartData = useMemo(() => {
    if (!['bar', 'line', 'area', 'pie', 'donut'].includes(vizType) || !hasData) return [];
    
    const xField = xAxisField || config.visualization.chart?.xAxis?.field || '';
    const yField = yAxisField || config.visualization.chart?.yAxis?.field || config.visualization.chart?.valueField || '';
    const aggregation = (config.visualization.chart as any)?.aggregation || 'sum';
    
    if (!xField) return [];
    
    return buildChartData(testResult!.sampleData!, xField, yField, aggregation);
  }, [vizType, hasData, xAxisField, yAxisField, config.visualization.chart, testResult]);

  // Veri yoksa placeholder göster
  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Gerçek Zamanlı Önizleme
          </CardTitle>
          <CardDescription className="text-xs">
            Önizleme için API testi yapın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Veri bekleniyor...</p>
            <p className="text-xs mt-1">API sekmesinde test yaparak veri çekin</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // KPI Önizleme
  if (vizType === 'kpi') {
    const IconComponent = widgetIcon ? (LucideIcons as any)[widgetIcon] || Hash : Hash;
    const formattedValue = kpiValue !== null 
      ? formatValue(
          kpiValue,
          config.visualization.kpi?.format,
          config.visualization.kpi?.prefix,
          config.visualization.kpi?.suffix
        )
      : '--';
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              KPI Önizleme
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {testResult.recordCount} kayıt
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-6 text-center">
            <IconComponent className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold text-foreground">
              {formattedValue}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {widgetName || 'Widget Adı'}
            </p>
            {config.visualization.kpi?.valueField && (
              <Badge variant="secondary" className="mt-2 text-[10px]">
                {config.visualization.kpi.aggregation || 'sum'} → {config.visualization.kpi.valueField}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Bar Chart Önizleme
  if (vizType === 'bar' && chartData.length > 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              {widgetName || 'Bar Chart'}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {chartData.length} grup
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Line Chart Önizleme
  if (vizType === 'line' && chartData.length > 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              {widgetName || 'Line Chart'}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {chartData.length} nokta
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Area Chart Önizleme
  if (vizType === 'area' && chartData.length > 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {widgetName || 'Area Chart'}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {chartData.length} nokta
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Pie/Donut Chart Önizleme
  if (['pie', 'donut'].includes(vizType) && chartData.length > 0) {
    const isDonut = vizType === 'donut';
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              {widgetName || (isDonut ? 'Donut Chart' : 'Pie Chart')}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {chartData.length} dilim
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={isDonut ? 40 : 0}
                outerRadius={70}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${String(name).slice(0, 8)} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Table/List Önizleme
  if (['table', 'list'].includes(vizType)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <DynamicIcon iconName={widgetIcon || 'Table'} className="h-4 w-4 text-muted-foreground" />
              {widgetName || (vizType === 'table' ? 'Tablo' : 'Liste')}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {testResult.recordCount} kayıt
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[200px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  {testResult.sampleFields?.slice(0, 5).map(field => (
                    <th key={field} className="text-left py-1.5 px-2 font-medium text-muted-foreground">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testResult.sampleData?.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                    {testResult.sampleFields?.slice(0, 5).map(field => (
                      <td key={field} className="py-1.5 px-2 truncate max-w-[120px]">
                        {String(row[field] ?? '-').slice(0, 20)}
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

  // Fallback
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Önizleme
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4 text-muted-foreground">
          <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{widgetName || 'Widget'}</p>
          <p className="text-xs mt-1">
            {CHART_TYPES.find(c => c.id === vizType)?.name} görünümü
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
