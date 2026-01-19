// BuilderWidgetRenderer - Widget Builder ile oluşturulan widget'ları render eder

import React from 'react';
import { WidgetBuilderConfig } from '@/lib/widgetBuilderTypes';
import { useDynamicWidgetData } from '@/hooks/useDynamicWidgetData';
import { StatCard } from './StatCard';
import { WidgetWrapper } from './WidgetWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, PieChart, TrendingUp, Activity, Table, List, Hash } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Renk paleti
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 60%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(35, 80%, 50%)',
  'hsl(340, 70%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(60, 70%, 50%)',
  'hsl(240, 60%, 55%)',
];

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
  const { data, isLoading, error } = useDynamicWidgetData(builderConfig);

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
      <Card className={`${className} border-destructive/50`}>
        <CardContent className="flex items-center gap-2 py-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </CardContent>
      </Card>
    );
  }

  const vizType = builderConfig.visualization.type;

  // KPI Widget
  if (vizType === 'kpi' && data) {
    const IconComponent = widgetIcon ? (LucideIcons as any)[widgetIcon] || Hash : Hash;
    return (
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
    );
  }

  // Bar Chart
  if (vizType === 'bar' && data?.chartData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.chartData}>
              {data.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              {data.showLegend && <Legend />}
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Line Chart
  if (vizType === 'line' && data?.chartData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'TrendingUp'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.chartData}>
              {data.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              {data.showLegend && <Legend />}
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Area Chart
  if (vizType === 'area' && data?.chartData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'Activity'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.chartData}>
              {data.showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              {data.showLegend && <Legend />}
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary) / 0.3)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Pie/Donut Chart
  if (['pie', 'donut'].includes(vizType) && data?.chartData) {
    const isDonut = vizType === 'donut';
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'PieChart'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPieChart>
              <Pie
                data={data.chartData}
                cx="50%"
                cy="50%"
                innerRadius={isDonut ? 50 : 0}
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              {data.showLegend && <Legend />}
            </RechartsPieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Table
  if (vizType === 'table' && data?.tableData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'Table'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
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
                  <tr key={idx} className="border-b last:border-0">
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

  // List
  if (vizType === 'list' && data?.listData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'List'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.listData.map((item: any, idx: number) => (
              <li key={idx} className="text-sm p-2 bg-muted/50 rounded">
                {JSON.stringify(item).slice(0, 100)}...
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
