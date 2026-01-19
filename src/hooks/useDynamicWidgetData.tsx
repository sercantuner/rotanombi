// useDynamicWidgetData - Widget Builder ile oluşturulan widget'lar için dinamik veri çekme

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WidgetBuilderConfig, AggregationType } from '@/lib/widgetBuilderTypes';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface DynamicWidgetDataResult {
  data: any;
  rawData: any[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Agregasyon hesaplamaları
function calculateAggregation(data: any[], field: string, aggregation: AggregationType): number {
  if (!data || data.length === 0) return 0;

  const values = data
    .map(item => {
      const val = item[field];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    })
    .filter(v => !isNaN(v));

  switch (aggregation) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);
    case 'avg':
      return values.length > 0 ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;
    case 'count':
      return data.length;
    case 'count_distinct':
      return new Set(data.map(item => item[field])).size;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'first':
      return values[0] || 0;
    case 'last':
      return values[values.length - 1] || 0;
    default:
      return values.reduce((acc, val) => acc + val, 0);
  }
}

// Grafik verileri için gruplama
function groupDataForChart(
  data: any[], 
  groupField: string, 
  valueField: string, 
  aggregation: AggregationType = 'sum'
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
    .slice(0, 10); // İlk 10 kayıt
}

export function useDynamicWidgetData(config: WidgetBuilderConfig | null): DynamicWidgetDataResult {
  const [data, setData] = useState<any>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!config) {
      setData(null);
      setRawData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      // DIA API çağrısı
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-api-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          module: config.diaApi.module,
          method: config.diaApi.method,
          limit: config.diaApi.parameters.limit || 1000,
          filters: config.diaApi.parameters.filters,
          selectedColumns: config.diaApi.parameters.selectedcolumns?.split(',').map(c => c.trim()),
          orderby: config.diaApi.parameters.orderby,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API hatası');
      }

      const fetchedData = result.sampleData || [];
      setRawData(fetchedData);

      // Görselleştirme tipine göre veri işleme
      const vizType = config.visualization.type;
      
      if (vizType === 'kpi' && config.visualization.kpi) {
        const kpiConfig = config.visualization.kpi;
        const kpiValue = calculateAggregation(
          fetchedData, 
          kpiConfig.valueField, 
          kpiConfig.aggregation
        );
        
        setData({
          value: kpiValue,
          format: kpiConfig.format,
          prefix: kpiConfig.prefix,
          suffix: kpiConfig.suffix,
          decimals: kpiConfig.decimals,
          recordCount: fetchedData.length,
        });
      } else if (['bar', 'line', 'area'].includes(vizType) && config.visualization.chart) {
        const chartConfig = config.visualization.chart;
        const xField = chartConfig.xAxis?.field || '';
        const yField = chartConfig.yAxis?.field || chartConfig.valueField || '';
        
        const chartData = groupDataForChart(
          fetchedData, 
          xField, 
          yField, 
          chartConfig.yAxis?.aggregation || 'sum'
        );
        
        setData({
          chartData,
          xField,
          yField,
          showLegend: chartConfig.showLegend,
          showGrid: chartConfig.showGrid,
          stacked: chartConfig.stacked,
        });
      } else if (['pie', 'donut'].includes(vizType) && config.visualization.chart) {
        const chartConfig = config.visualization.chart;
        const legendField = chartConfig.legendField || '';
        const valueField = chartConfig.valueField || chartConfig.yAxis?.field || '';
        
        const pieData = groupDataForChart(
          fetchedData, 
          legendField, 
          valueField, 
          'sum'
        );
        
        setData({
          chartData: pieData,
          showLegend: chartConfig.showLegend,
        });
      } else if (vizType === 'table' && config.visualization.table) {
        setData({
          tableData: fetchedData.slice(0, config.visualization.table.pageSize || 10),
          columns: config.visualization.table.columns,
          pagination: config.visualization.table.pagination,
          pageSize: config.visualization.table.pageSize,
          searchable: config.visualization.table.searchable,
        });
      } else if (vizType === 'list') {
        setData({
          listData: fetchedData.slice(0, 10),
        });
      } else {
        // Varsayılan - ham veri
        setData({ rawData: fetchedData });
      }
    } catch (err) {
      console.error('Dynamic widget data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    rawData,
    isLoading,
    error,
    refetch: fetchData,
  };
}
