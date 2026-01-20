// BuilderWidgetRenderer - Widget Builder ile oluşturulan widget'ları render eder (Drill-down destekli)

import React, { useState } from 'react';
import { WidgetBuilderConfig, AggregationType } from '@/lib/widgetBuilderTypes';
import { useDynamicWidgetData } from '@/hooks/useDynamicWidgetData';
import { DrillDownModal } from './DrillDownModal';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, Hash, MousePointerClick } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

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
  const { data, rawData, isLoading, error } = useDynamicWidgetData(builderConfig);
  
  // Drill-down state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownData, setDrillDownData] = useState<any[]>([]);

  // Drill-down işleyicisi
  const handleDrillDown = (clickedName: string, groupField: string) => {
    const filteredItems = rawData.filter(item => 
      String(item[groupField] || 'Belirsiz') === clickedName
    );
    setDrillDownTitle(`${widgetName} - ${clickedName}`);
    setDrillDownData(filteredItems);
    setDrillDownOpen(true);
  };

  // KPI drill-down (tüm veriyi göster)
  const handleKpiDrillDown = () => {
    setDrillDownTitle(`${widgetName} - Detaylar`);
    setDrillDownData(rawData);
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
          subtitle={`${data.recordCount || rawData.length} kayıt`}
          data={drillDownData}
          valueField={builderConfig.visualization.kpi?.valueField}
        />
      </>
    );
  }

  // Bar Chart (drill-down destekli)
  if (vizType === 'bar' && data?.chartData) {
    const xField = builderConfig.visualization.chart?.xAxis?.field || '';
    
    return (
      <>
        <Card className={className}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DynamicIcon iconName={widgetIcon || 'BarChart3'} className="h-4 w-4" />
              {widgetName}
              <MousePointerClick className="h-3 w-3 text-muted-foreground ml-auto" />
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
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={(entry) => entry && handleDrillDown(entry.name, xField)}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          title={drillDownTitle}
          data={drillDownData}
          valueField={builderConfig.visualization.chart?.yAxis?.field || builderConfig.visualization.chart?.valueField}
        />
      </>
    );
  }

  // Line Chart (drill-down destekli)
  if (vizType === 'line' && data?.chartData) {
    const xField = builderConfig.visualization.chart?.xAxis?.field || '';
    
    return (
      <>
        <Card className={className}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DynamicIcon iconName={widgetIcon || 'TrendingUp'} className="h-4 w-4" />
              {widgetName}
              <MousePointerClick className="h-3 w-3 text-muted-foreground ml-auto" />
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
                  dot={{ fill: 'hsl(var(--primary))', cursor: 'pointer' }}
                  activeDot={{ 
                    r: 6, 
                    cursor: 'pointer',
                    onClick: (e: any) => e?.payload && handleDrillDown(e.payload.name, xField)
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
          valueField={builderConfig.visualization.chart?.yAxis?.field || builderConfig.visualization.chart?.valueField}
        />
      </>
    );
  }

  // Area Chart (drill-down destekli)
  if (vizType === 'area' && data?.chartData) {
    const xField = builderConfig.visualization.chart?.xAxis?.field || '';
    
    return (
      <>
        <Card className={className}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DynamicIcon iconName={widgetIcon || 'Activity'} className="h-4 w-4" />
              {widgetName}
              <MousePointerClick className="h-3 w-3 text-muted-foreground ml-auto" />
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
                  activeDot={{ 
                    r: 6, 
                    cursor: 'pointer',
                    onClick: (e: any) => e?.payload && handleDrillDown(e.payload.name, xField)
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
          valueField={builderConfig.visualization.chart?.yAxis?.field || builderConfig.visualization.chart?.valueField}
        />
      </>
    );
  }

  // Pie/Donut Chart (drill-down destekli)
  if (['pie', 'donut'].includes(vizType) && data?.chartData) {
    const isDonut = vizType === 'donut';
    const legendField = builderConfig.visualization.chart?.legendField || '';
    
    return (
      <>
        <Card className={className}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DynamicIcon iconName={widgetIcon || 'PieChart'} className="h-4 w-4" />
              {widgetName}
              <MousePointerClick className="h-3 w-3 text-muted-foreground ml-auto" />
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
                  className="cursor-pointer"
                  onClick={(entry) => entry && handleDrillDown(entry.name, legendField)}
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
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          title={drillDownTitle}
          data={drillDownData}
          valueField={builderConfig.visualization.chart?.valueField || builderConfig.visualization.chart?.yAxis?.field}
        />
      </>
    );
  }

  // Table (zaten detay gösteriyor)
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
  if (vizType === 'pivot' && rawData.length > 0) {
    const pivotConfig = builderConfig.visualization.pivot;
    const rowField = pivotConfig?.rowFields?.[0] || '';
    const columnField = pivotConfig?.columnField || '';
    const valueField = pivotConfig?.valueField || '';
    const aggregation = pivotConfig?.aggregation || 'sum';

    // Pivot veri hesaplama
    const rowValues = [...new Set(rawData.map(item => String(item[rowField] || 'Belirsiz')))];
    const columnValues = columnField 
      ? [...new Set(rawData.map(item => String(item[columnField] || 'Belirsiz')))]
      : [];

    // Pivot tablo verisi oluştur
    const pivotData = rowValues.map(rowVal => {
      const rowItems = rawData.filter(item => String(item[rowField] || 'Belirsiz') === rowVal);
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
        const colItems = rawData.filter(item => String(item[columnField] || 'Belirsiz') === colVal);
        columnTotals[colVal] = calculateAggregation(colItems, valueField, aggregation);
      });
      columnTotals._rowTotal = calculateAggregation(rawData, valueField, aggregation);
    } else {
      columnTotals._value = calculateAggregation(rawData, valueField, aggregation);
    }

    const formatPivotValue = (val: number) => {
      if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
      return val.toLocaleString('tr-TR');
    };

    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'Grid3x3'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DynamicIcon iconName={widgetIcon || 'List'} className="h-4 w-4" />
            {widgetName}
          </CardTitle>
        </CardHeader>
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
