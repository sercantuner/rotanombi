// Widget Builder - Gelişmiş widget oluşturma ve düzenleme aracı
// Veri Kaynağı seçimi ile entegre - API test yerine merkezi kaynakları kullanır

import { useState, useEffect, useMemo } from 'react';
import { useWidgetAdmin } from '@/hooks/useWidgets';
import { useDataSources, DataSource } from '@/hooks/useDataSources';
import { Widget, WidgetFormData, WidgetSize, WidgetCategory, PAGE_CATEGORIES, WIDGET_SIZES, FilterFieldConfig } from '@/lib/widgetTypes';
import {
  ChartType,
  AggregationType,
  CHART_TYPES,
  AGGREGATION_TYPES,
  DIA_MODULES,
  FORMAT_OPTIONS,
  FILTER_TYPES,
  WidgetBuilderConfig,
  WidgetFilterConfig,
  DiaApiFilter,
  DiaApiSort,
  MultiQueryConfig,
  CalculatedField,
  DateFilterConfig,
  PostFetchFilter,
  PivotConfig,
  LegendPosition,
} from '@/lib/widgetBuilderTypes';
import { DateRangeConfig, getDefaultDateFilterConfig } from './DateRangeConfig';
import { DataSourceSelector } from './DataSourceSelector';
import { MultiQueryBuilder } from './MultiQueryBuilder';
import { CalculatedFieldBuilder } from './CalculatedFieldBuilder';
import { WidgetPreviewRenderer } from './WidgetPreviewRenderer';
import { LiveWidgetPreview } from './LiveWidgetPreview';
import { WidgetTemplates, WidgetTemplate, WIDGET_TEMPLATES } from './WidgetTemplates';
import { PostFetchFilterBuilder } from './PostFetchFilterBuilder';
import { TableColumnBuilder, TableColumn } from './TableColumnBuilder';
import { PivotConfigBuilder, getDefaultPivotConfig } from './PivotConfigBuilder';
import { FieldWellBuilder, FieldWellsConfig } from './FieldWellBuilder';
import { ChartSettingsPanel, ChartSettingsData, getDefaultChartSettings, PaletteKey } from './ChartSettingsPanel';
import { WidgetSizeSelector } from './WidgetSizeSelector';
import { WidgetPageSelector } from './WidgetPageSelector';
import { WidgetFilterFieldsBuilder } from './WidgetFilterFieldsBuilder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Wand2, BarChart3, Settings2, Save, 
  Hash, TrendingUp, Activity, PieChart, Circle, Table, List, LayoutGrid, CheckCircle, Edit,
  Database, Calculator, Sparkles, Calendar, Zap, Info, Filter, Eye, Layers, Code, Copy, Check
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Genişletilmiş ikon listesi - 50+ ikon
const AVAILABLE_ICONS = [
  // Finans/Para
  'Wallet', 'CreditCard', 'DollarSign', 'Coins', 'Banknote', 'PiggyBank', 'Receipt', 'Scale',
  // Grafikler
  'BarChart', 'BarChart2', 'BarChart3', 'LineChart', 'PieChart', 'TrendingUp', 'TrendingDown', 'Activity',
  // Kullanıcı/İş
  'Users', 'User', 'UserCheck', 'Building', 'Building2', 'Briefcase', 'Award', 'Target',
  // Alışveriş
  'ShoppingCart', 'ShoppingBag', 'Package', 'Box', 'Truck', 'Store',
  // Belgeler
  'FileText', 'Files', 'FolderOpen', 'ClipboardList', 'ClipboardCheck',
  // Zaman
  'Clock', 'Calendar', 'CalendarDays', 'Timer', 'History',
  // Durum
  'CheckCircle', 'XCircle', 'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle',
  // Diğer
  'Hash', 'Percent', 'Database', 'Server', 'Globe', 'Map', 'MapPin', 'Layers', 'LayoutGrid', 'Grid3x3',
  'ArrowUpRight', 'ArrowDownRight', 'Zap', 'Sparkles', 'Star', 'Heart', 'Bookmark', 'Eye', 'Search',
  'Settings', 'Gauge', 'Compass', 'Flag', 'Bell', 'Phone', 'Mail', 'MessageSquare',
];

interface WidgetBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
  editWidget?: Widget | null;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

const getEmptyConfig = (): WidgetBuilderConfig => ({
  diaApi: {
    module: 'scf',
    method: 'carikart_listele',
    parameters: {
      limit: 1000,
    },
  },
  visualization: {
    type: 'kpi',
    kpi: {
      valueField: 'toplambakiye',
      aggregation: 'sum',
      format: 'currency',
    },
  },
});

export function WidgetBuilder({ open, onOpenChange, onSave, editWidget }: WidgetBuilderProps) {
  const { createWidget, updateWidget, isLoading } = useWidgetAdmin();
  const { activeDataSources, getDataSourceById } = useDataSources();
  const isEditMode = !!editWidget;
  const [activeTab, setActiveTab] = useState(isEditMode ? 'api' : 'templates');
  
  // Widget temel bilgileri
  const [widgetKey, setWidgetKey] = useState('');
  const [widgetName, setWidgetName] = useState('');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetIcon, setWidgetIcon] = useState('BarChart3');
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('md');
  const [availableSizes, setAvailableSizes] = useState<WidgetSize[]>(['md']);
  const [defaultPage, setDefaultPage] = useState<WidgetCategory>('dashboard');
  const [targetPages, setTargetPages] = useState<WidgetCategory[]>(['dashboard']);
  
  // Widget filtre alanları
  const [filterFields, setFilterFields] = useState<FilterFieldConfig[]>([]);
  
  // Builder config
  const [config, setConfig] = useState<WidgetBuilderConfig>(getEmptyConfig());
  
  // Seçili veri kaynağı
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null);
  const selectedDataSource = selectedDataSourceId ? getDataSourceById(selectedDataSourceId) : null;
  
  // Chart axis/series config
  const [xAxisField, setXAxisField] = useState('');
  const [yAxisField, setYAxisField] = useState('');
  const [legendField, setLegendField] = useState('');
  const [tooltipFields, setTooltipFields] = useState('');
  
  // Widget filtreleri
  const [widgetFilters, setWidgetFilters] = useState<WidgetFilterConfig[]>([]);
  
  // Post-fetch filtreler
  const [postFetchFilters, setPostFetchFilters] = useState<PostFetchFilter[]>([]);
  
  // Tablo kolonları
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  
  // Pivot config
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>(getDefaultPivotConfig());
  
  // Varsayılan widget
  const [isDefaultWidget, setIsDefaultWidget] = useState(false);
  
  // Aktif hedef alan (alan eşleme için)
  const [activeTarget, setActiveTarget] = useState<'xAxis' | 'yAxis' | 'legend' | 'value' | 'tooltip' | null>(null);
  
  // Çoklu sorgu ve hesaplama alanları
  const [multiQuery, setMultiQuery] = useState<MultiQueryConfig | null>(null);
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([]);
  
  // Tarih filtresi
  const [dateFilterConfig, setDateFilterConfig] = useState<DateFilterConfig>(getDefaultDateFilterConfig());
  
  // Şablon seçimi
  const [selectedTemplate, setSelectedTemplate] = useState<WidgetTemplate | null>(null);
  
  // Power BI tarzı Field Wells ve Chart Settings
  const [fieldWells, setFieldWells] = useState<FieldWellsConfig>({});
  const [chartSettings, setChartSettings] = useState<ChartSettingsData>(getDefaultChartSettings());
  
  // Kod görüntüleme
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  
  // Görselleştirme için kullanılabilir alanlar (veri kaynağından)
  const availableFieldsForVisualization = useMemo(() => {
    const baseFields = selectedDataSource?.last_fields || 
                       selectedDataSource?.selected_columns || 
                       [];
    
    const calculatedFieldNames = calculatedFields.map(cf => cf.name);
    return [...baseFields, ...calculatedFieldNames];
  }, [selectedDataSource, calculatedFields]);
  
  // Sayısal alanlar 
  const numericFieldsForVisualization = useMemo(() => {
    return availableFieldsForVisualization.filter(f => {
      if (calculatedFields.some(cf => cf.name === f)) return true;
      const numericPatterns = ['toplam', 'tutar', 'bakiye', 'miktar', 'adet', 'fiyat', 'oran', 'count', 'sum', 'avg'];
      return numericPatterns.some(p => f.toLowerCase().includes(p));
    });
  }, [availableFieldsForVisualization, calculatedFields]);
  
  // Düzenleme modunda widget verilerini yükle
  useEffect(() => {
    if (editWidget && open) {
      setWidgetKey(editWidget.widget_key);
      setWidgetName(editWidget.name);
      setWidgetDescription(editWidget.description || '');
      setWidgetIcon(editWidget.icon || 'BarChart3');
      setWidgetSize(editWidget.size);
      setDefaultPage(editWidget.default_page);
      setActiveTab('api');
      
      if (editWidget.builder_config) {
        const bc = editWidget.builder_config;
        setConfig(bc);
        
        // Veri kaynağı ID'sini yükle
        if (bc.dataSourceId) {
          setSelectedDataSourceId(bc.dataSourceId);
        }
        
        // Chart ayarlarını yükle
        if (bc.visualization.chart) {
          setXAxisField(bc.visualization.chart.xAxis?.field || '');
          setYAxisField(bc.visualization.chart.yAxis?.field || bc.visualization.chart.valueField || '');
          setLegendField(bc.visualization.chart.legendField || '');
          setTooltipFields(bc.visualization.chart.tooltipFields?.join(', ') || '');
        }
        
        // FieldWells yükle
        if (bc.fieldWells) {
          setFieldWells(bc.fieldWells as FieldWellsConfig);
        }
        
        // ChartSettings yükle
        if (bc.chartSettings) {
          const defaults = getDefaultChartSettings();
          setChartSettings({
            ...defaults,
            colorPalette: (bc.chartSettings.colorPalette as PaletteKey) || defaults.colorPalette,
            showLegend: bc.chartSettings.showLegend ?? defaults.showLegend,
            legendPosition: (bc.chartSettings.legendPosition as LegendPosition) || defaults.legendPosition,
            showGrid: bc.chartSettings.showGrid ?? defaults.showGrid,
            stacked: bc.chartSettings.stacked ?? defaults.stacked,
            displayLimit: bc.chartSettings.displayLimit ?? defaults.displayLimit,
            showTrendLine: bc.chartSettings.showTrendLine ?? defaults.showTrendLine,
            showAverageLine: bc.chartSettings.showAverageLine ?? defaults.showAverageLine,
            showMinMaxMarkers: bc.chartSettings.showMinMaxMarkers ?? defaults.showMinMaxMarkers,
            trendLineColor: bc.chartSettings.trendLineColor ?? defaults.trendLineColor,
            averageLineColor: bc.chartSettings.averageLineColor ?? defaults.averageLineColor,
          });
        }
        
        if (bc.dateFilter) {
          setDateFilterConfig(bc.dateFilter);
        }
        
        if (bc.multiQuery) {
          setMultiQuery(bc.multiQuery);
        }
        
        if (bc.calculatedFields) {
          setCalculatedFields(bc.calculatedFields);
        }
        
        // Post-fetch filtrelerini yükle
        if (bc.postFetchFilters && Array.isArray(bc.postFetchFilters)) {
          setPostFetchFilters(bc.postFetchFilters);
        }
        
        // Tablo kolonlarını yükle
        if (bc.tableColumns && Array.isArray(bc.tableColumns)) {
          setTableColumns(bc.tableColumns);
        }
        
        // Pivot config yükle
        if (bc.pivot) {
          setPivotConfig(bc.pivot);
        }
        
        // Varsayılan widget durumunu yükle
        setIsDefaultWidget(editWidget.is_default === true);
      }
    } else if (!open) {
      resetForm();
    }
  }, [editWidget, open]);

  const resetForm = () => {
    setWidgetKey('');
    setWidgetName('');
    setWidgetDescription('');
    setWidgetIcon('BarChart3');
    setWidgetSize('md');
    setAvailableSizes(['md']);
    setDefaultPage('dashboard');
    setTargetPages(['dashboard']);
    setFilterFields([]);
    setConfig(getEmptyConfig());
    setSelectedDataSourceId(null);
    setXAxisField('');
    setYAxisField('');
    setLegendField('');
    setTooltipFields('');
    setWidgetFilters([]);
    setActiveTab('templates');
    setActiveTarget(null);
    setMultiQuery(null);
    setCalculatedFields([]);
    setDateFilterConfig(getDefaultDateFilterConfig());
    setSelectedTemplate(null);
    setPostFetchFilters([]);
    setTableColumns([]);
    setPivotConfig(getDefaultPivotConfig());
    setIsDefaultWidget(false);
    setFieldWells({});
    setChartSettings(getDefaultChartSettings());
  };
  
  // Şablon uygulama
  const handleApplyTemplate = (template: WidgetTemplate) => {
    setSelectedTemplate(template);
    setWidgetKey(template.suggestedKey);
    setWidgetName(template.suggestedName);
    setWidgetDescription(template.description);
    setWidgetIcon(template.icon);
    
    if (template.config.diaApi) {
      setConfig(prev => ({
        ...prev,
        diaApi: {
          ...prev.diaApi,
          module: template.config.diaApi!.module,
          method: template.config.diaApi!.method,
          parameters: template.config.diaApi!.parameters || { limit: 0 },
        },
        visualization: template.config.visualization || prev.visualization,
      }));
    }
    
    if (template.config.visualization?.chart) {
      const chart = template.config.visualization.chart;
      if (chart.xAxis?.field) setXAxisField(chart.xAxis.field);
      if (chart.yAxis?.field) setYAxisField(chart.yAxis.field);
      if (chart.legendField) setLegendField(chart.legendField);
    }
    
    if (template.category === 'cari') setDefaultPage('cari');
    else if (template.category === 'finans') setDefaultPage('finans');
    else if (template.category === 'satis') setDefaultPage('satis');
    else setDefaultPage('dashboard');
    
    toast.success(`"${template.name}" şablonu uygulandı!`);
  };

  const handleChartTypeChange = (chartType: ChartType) => {
    setConfig(prev => ({
      ...prev,
      visualization: {
        ...prev.visualization,
        type: chartType,
        kpi: chartType === 'kpi' ? {
          valueField: '',
          aggregation: 'sum',
          format: 'currency',
        } : undefined,
        chart: chartType !== 'kpi' && chartType !== 'table' && chartType !== 'list' ? {
          chartType,
          showLegend: true,
          showGrid: true,
        } : undefined,
        table: chartType === 'table' ? {
          columns: [],
          pagination: true,
          pageSize: 10,
        } : undefined,
      },
    }));
  };

  const handleKpiConfigChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      visualization: {
        ...prev.visualization,
        kpi: {
          ...prev.visualization.kpi!,
          [key]: value,
        },
      },
    }));
  };

  const handleChartConfigChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      visualization: {
        ...prev.visualization,
        chart: {
          ...prev.visualization.chart!,
          [key]: value,
        },
      },
    }));
  };
  
  // Veri kaynağı seçildiğinde config'i güncelle
  const handleDataSourceSelect = (dataSource: DataSource | null) => {
    if (dataSource) {
      setSelectedDataSourceId(dataSource.id);
      // Config'i veri kaynağından güncelle
      setConfig(prev => ({
        ...prev,
        dataSourceId: dataSource.id,
        dataSourceSlug: dataSource.slug,
        diaApi: {
          module: dataSource.module as any,
          method: dataSource.method,
          parameters: {
            filters: dataSource.filters as DiaApiFilter[],
            sorts: dataSource.sorts as DiaApiSort[],
            selectedcolumns: dataSource.selected_columns || undefined,
            limit: dataSource.limit_count || 0,
          },
        },
      }));
      toast.success(`"${dataSource.name}" veri kaynağı seçildi`);
    } else {
      setSelectedDataSourceId(null);
      setConfig(prev => ({
        ...prev,
        dataSourceId: undefined,
        dataSourceSlug: undefined,
      }));
    }
  };
  
  // Alan tıklama ile hedef alana atama
  const handleFieldClick = (fieldName: string) => {
    if (activeTarget) {
      switch (activeTarget) {
        case 'xAxis':
          setXAxisField(fieldName);
          break;
        case 'yAxis':
        case 'value':
          setYAxisField(fieldName);
          if (config.visualization.type === 'kpi') {
            handleKpiConfigChange('valueField', fieldName);
          }
          break;
        case 'legend':
          setLegendField(fieldName);
          break;
        case 'tooltip':
          setTooltipFields(prev => prev ? `${prev}, ${fieldName}` : fieldName);
          break;
      }
      toast.success(`"${fieldName}" → ${activeTarget} alanına atandı`);
      setActiveTarget(null);
    } else {
      navigator.clipboard.writeText(fieldName);
      toast.success(`"${fieldName}" kopyalandı`);
    }
  };

  // Oluşturulan kodu üret (builder config'den)
  const generateBuilderCode = () => {
    const vizType = config.visualization.type;
    const lines: string[] = [
      '// Widget Builder tarafından üretilen yapılandırma',
      '// Bu kodu özelleştirmek için "Hardcode Widget" moduna geçebilirsiniz',
      '',
      'function Widget({ data }) {',
      '  if (!data || data.length === 0) {',
      '    return React.createElement("div",',
      '      { className: "flex items-center justify-center h-48 text-muted-foreground" },',
      '      "Veri bulunamadı"',
      '    );',
      '  }',
      '',
    ];

    if (vizType === 'kpi') {
      const kpi = config.visualization.kpi;
      lines.push(
        `  // KPI: ${kpi?.valueField || 'N/A'} (${kpi?.aggregation || 'sum'})`,
        `  var total = data.reduce(function(acc, item) {`,
        `    return acc + (parseFloat(item['${kpi?.valueField}']) || 0);`,
        `  }, 0);`,
        '',
        `  var formatValue = function(value) {`,
        `    if (Math.abs(value) >= 1000000) return '₺' + (value / 1000000).toFixed(1) + 'M';`,
        `    if (Math.abs(value) >= 1000) return '₺' + (value / 1000).toFixed(0) + 'K';`,
        `    return '₺' + value.toLocaleString('tr-TR');`,
        `  };`,
        '',
        `  return React.createElement('div', { className: 'p-4' },`,
        `    React.createElement('div', { className: 'text-2xl font-bold text-primary' }, formatValue(total)),`,
        `    React.createElement('div', { className: 'text-sm text-muted-foreground mt-1' }, data.length + ' kayıt')`,
        `  );`,
      );
    } else if (['bar', 'line', 'area'].includes(vizType)) {
      const xField = (fieldWells.xAxis?.[0]?.field) || xAxisField || 'kategori';
      const yField = (fieldWells.yAxis?.[0]?.field) || yAxisField || 'deger';
      lines.push(
        `  // Chart: ${vizType} - X: ${xField}, Y: ${yField}`,
        `  var chartData = data.slice(0, ${chartSettings.displayLimit || 10}).map(function(item) {`,
        `    return {`,
        `      name: item['${xField}'] || 'N/A',`,
        `      value: parseFloat(item['${yField}']) || 0`,
        `    };`,
        `  });`,
        '',
        `  return React.createElement(ResponsiveContainer, { width: '100%', height: 300 },`,
        `    React.createElement(${vizType === 'bar' ? 'BarChart' : vizType === 'line' ? 'LineChart' : 'AreaChart'}, { data: chartData },`,
        `      React.createElement(CartesianGrid, { strokeDasharray: '3 3', className: 'stroke-border' }),`,
        `      React.createElement(XAxis, { dataKey: 'name', className: 'text-xs fill-muted-foreground' }),`,
        `      React.createElement(YAxis, { className: 'text-xs fill-muted-foreground' }),`,
        `      React.createElement(Tooltip),`,
        `      React.createElement(${vizType === 'bar' ? 'Bar' : vizType === 'line' ? 'Line' : 'Area'}, {`,
        `        dataKey: 'value',`,
        `        fill: 'hsl(var(--primary))',`,
        `        stroke: 'hsl(var(--primary))'`,
        `      })`,
        `    )`,
        `  );`,
      );
    } else if (['pie', 'donut'].includes(vizType)) {
      const nameField = (fieldWells.xAxis?.[0]?.field) || xAxisField || 'kategori';
      const valueField = (fieldWells.yAxis?.[0]?.field) || yAxisField || 'deger';
      lines.push(
        `  // Chart: ${vizType} - Name: ${nameField}, Value: ${valueField}`,
        `  var COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];`,
        `  var chartData = data.slice(0, ${chartSettings.displayLimit || 10}).map(function(item) {`,
        `    return {`,
        `      name: item['${nameField}'] || 'N/A',`,
        `      value: parseFloat(item['${valueField}']) || 0`,
        `    };`,
        `  });`,
        '',
        `  return React.createElement(ResponsiveContainer, { width: '100%', height: 300 },`,
        `    React.createElement(PieChart, {},`,
        `      React.createElement(Pie, {`,
        `        data: chartData,`,
        `        cx: '50%',`,
        `        cy: '50%',`,
        `        ${vizType === 'donut' ? "innerRadius: 60," : ""}`,
        `        outerRadius: 100,`,
        `        fill: 'hsl(var(--primary))',`,
        `        dataKey: 'value'`,
        `      },`,
        `        chartData.map(function(entry, index) {`,
        `          return React.createElement(Cell, { key: 'cell-' + index, fill: COLORS[index % COLORS.length] });`,
        `        })`,
        `      ),`,
        `      React.createElement(Tooltip)`,
        `    )`,
        `  );`,
      );
    } else {
      lines.push(
        `  // Table/List: Basit tablo görünümü`,
        `  return React.createElement('div', { className: 'overflow-auto max-h-64' },`,
        `    React.createElement('table', { className: 'w-full text-sm' },`,
        `      React.createElement('tbody', {},`,
        `        data.slice(0, 10).map(function(item, idx) {`,
        `          return React.createElement('tr', { key: idx, className: 'border-b border-border' },`,
        `            Object.keys(item).slice(0, 3).map(function(key) {`,
        `              return React.createElement('td', { key: key, className: 'p-2' }, String(item[key] || '-'));`,
        `            })`,
        `          );`,
        `        })`,
        `      )`,
        `    )`,
        `  );`,
      );
    }

    lines.push('}', '', 'return Widget;');
    return lines.join('\n');
  };

  // Kodu kopyala
  const copyGeneratedCode = () => {
    const code = generateBuilderCode();
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast.success('Kod kopyalandı');
  };

  const handleSave = async () => {
    if (!widgetKey || !widgetName) {
      toast.error('Widget key ve adı zorunludur');
      return;
    }

    if (!selectedDataSourceId && !multiQuery) {
      toast.error('Bir veri kaynağı seçmelisiniz');
      return;
    }

    const builderConfig: WidgetBuilderConfig = {
      dataSourceId: selectedDataSourceId || undefined,
      dataSourceSlug: selectedDataSource?.slug,
      diaApi: config.diaApi,
      multiQuery: multiQuery || undefined,
      calculatedFields: calculatedFields.length > 0 ? calculatedFields : undefined,
      dateFilter: dateFilterConfig.enabled ? dateFilterConfig : undefined,
      // Post-fetch filtreleri ekle
      postFetchFilters: postFetchFilters.length > 0 ? postFetchFilters : undefined,
      // Tablo kolonlarını ekle
      tableColumns: tableColumns.length > 0 ? tableColumns : undefined,
      // Pivot config ekle (pivot tipi seçiliyse)
      pivot: config.visualization.type === 'pivot' ? pivotConfig : undefined,
      // Field Wells yapılandırması (Power BI tarzı)
      fieldWells: Object.keys(fieldWells).length > 0 ? fieldWells : undefined,
      // Chart ayarları (renk paleti, legend, grid vb.)
      chartSettings: {
        colorPalette: chartSettings.colorPalette,
        showLegend: chartSettings.showLegend,
        legendPosition: chartSettings.legendPosition,
        showGrid: chartSettings.showGrid,
        stacked: chartSettings.stacked,
        displayLimit: chartSettings.displayLimit,
        showTrendLine: chartSettings.showTrendLine,
        showAverageLine: chartSettings.showAverageLine,
        showMinMaxMarkers: chartSettings.showMinMaxMarkers,
        trendLineColor: chartSettings.trendLineColor,
        averageLineColor: chartSettings.averageLineColor,
      },
      visualization: {
        ...config.visualization,
        chart: config.visualization.chart ? {
          ...config.visualization.chart,
          xAxis: xAxisField ? { field: xAxisField } : undefined,
          yAxis: yAxisField ? { field: yAxisField } : undefined,
          legendField: legendField || undefined,
          tooltipFields: tooltipFields.split(',').map(f => f.trim()).filter(f => f) || undefined,
        } : undefined,
      },
    };

    const formData: WidgetFormData = {
      widget_key: widgetKey,
      name: widgetName,
      description: widgetDescription,
      category: defaultPage,
      type: config.visualization.type === 'kpi' ? 'kpi' : 
            config.visualization.type === 'table' ? 'table' :
            config.visualization.type === 'list' ? 'list' : 'chart',
      data_source: config.diaApi.module === 'scf' ? 'genel' : 
                   config.diaApi.module === 'fat' ? 'satis' : 'finans',
      size: widgetSize,
      icon: widgetIcon,
      default_page: defaultPage,
      default_visible: true,
      available_filters: [],
      default_filters: {},
      min_height: '',
      grid_cols: null,
      is_active: true,
      is_default: isDefaultWidget,
      sort_order: editWidget?.sort_order || 100,
      builder_config: builderConfig,
    };

    let success = false;
    
    if (isEditMode && editWidget) {
      success = await updateWidget(editWidget.id, formData);
      if (success) {
        toast.success('Widget güncellendi!');
      }
    } else {
      success = await createWidget(formData);
      if (success) {
        toast.success('Widget oluşturuldu!');
      }
    }

    if (success) {
      onSave?.();
      onOpenChange(false);
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] flex flex-col overflow-hidden p-3 md:p-6">
        <DialogHeader className="pb-2 md:pb-4">
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            {isEditMode ? (
              <Edit className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            ) : (
              <Wand2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            )}
            {isEditMode ? 'Widget Düzenle' : 'Widget Builder'}
            {isEditMode && (
              <Badge variant="secondary" className="ml-2 text-xs">{editWidget?.name}</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm hidden md:block">
            {isEditMode 
              ? 'Mevcut widget yapılandırmasını düzenleyin ve güncelleyin'
              : 'Merkezi veri kaynaklarından widget oluşturun'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile: Scrollable tabs */}
          <div className="w-full overflow-x-auto md:hidden">
            <TabsList className="inline-flex w-max gap-1 p-1">
              {!isEditMode && (
                <TabsTrigger value="templates" className="gap-1 text-xs px-2 py-1.5">
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden xs:inline">Şablon</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="api" className="gap-1 text-xs px-2 py-1.5">
                <Database className="h-3 w-3" />
                Veri
              </TabsTrigger>
              <TabsTrigger value="merge" className="gap-1 text-xs px-2 py-1.5">
                <Database className="h-3 w-3" />
                Birleştir
              </TabsTrigger>
              <TabsTrigger value="calculation" className="gap-1 text-xs px-2 py-1.5">
                <Calculator className="h-3 w-3" />
                Hesap
              </TabsTrigger>
              <TabsTrigger value="filter" className="gap-1 text-xs px-2 py-1.5">
                <Filter className="h-3 w-3" />
                Filtre
              </TabsTrigger>
              <TabsTrigger value="date" className="gap-1 text-xs px-2 py-1.5">
                <Calendar className="h-3 w-3" />
                Tarih
              </TabsTrigger>
              <TabsTrigger value="visualization" className="gap-1 text-xs px-2 py-1.5">
                <BarChart3 className="h-3 w-3" />
                Görsel
              </TabsTrigger>
              <TabsTrigger value="widgetfilters" className="gap-1 text-xs px-2 py-1.5">
                <Filter className="h-3 w-3" />
                W.Filtre
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-1 text-xs px-2 py-1.5">
                <Code className="h-3 w-3" />
                Kod
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1 text-xs px-2 py-1.5">
                <Eye className="h-3 w-3" />
                Önizle
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Desktop: Grid tabs */}
          <TabsList className={cn("hidden md:grid w-full", isEditMode ? "grid-cols-9" : "grid-cols-10")}>
            {!isEditMode && (
              <TabsTrigger value="templates" className="gap-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Şablonlar
              </TabsTrigger>
            )}
            <TabsTrigger value="api" className="gap-1 text-xs">
              <Database className="h-3.5 w-3.5" />
              Veri
            </TabsTrigger>
            <TabsTrigger value="merge" className="gap-1 text-xs">
              <Database className="h-3.5 w-3.5" />
              Birleştir
            </TabsTrigger>
            <TabsTrigger value="calculation" className="gap-1 text-xs">
              <Calculator className="h-3.5 w-3.5" />
              Hesapla
            </TabsTrigger>
            <TabsTrigger value="filter" className="gap-1 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filtrele
            </TabsTrigger>
            <TabsTrigger value="date" className="gap-1 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Tarih
            </TabsTrigger>
            <TabsTrigger value="visualization" className="gap-1 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Görsel
            </TabsTrigger>
            <TabsTrigger value="widgetfilters" className="gap-1 text-xs">
              <Filter className="h-3.5 w-3.5" />
              W.Filtreler
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1 text-xs">
              <Code className="h-3.5 w-3.5" />
              Kod
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Önizleme
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-4" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {/* ŞABLONLAR */}
            <TabsContent value="templates" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Hazır Widget Şablonları
                  </CardTitle>
                  <CardDescription>
                    Hızlıca widget oluşturmak için hazır şablonlardan birini seçin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WidgetTemplates
                    onSelectTemplate={handleApplyTemplate}
                    selectedTemplateId={selectedTemplate?.id}
                  />
                  
                  {selectedTemplate && (
                    <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">"{selectedTemplate.name}" şablonu seçildi</p>
                            <p className="text-xs text-muted-foreground">
                              Şimdi bir veri kaynağı seçmeniz gerekiyor
                            </p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab('api')}>
                          Veri Kaynağı Seç
                          <TrendingUp className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* VERİ KAYNAĞI SEÇİMİ */}
            <TabsContent value="api" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Veri Kaynağı Seçimi
                  </CardTitle>
                  <CardDescription>
                    Merkezi veri kaynaklarından birini seçerek widget'ınız için veri sağlayın
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Widget İsim ve Açıklama */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Widget Key *</Label>
                      <Input
                        value={widgetKey}
                        onChange={(e) => setWidgetKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                        placeholder="toplam_alacak"
                      />
                      <p className="text-xs text-muted-foreground">Benzersiz teknik isim (a-z, 0-9, _)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Widget Adı *</Label>
                      <Input
                        value={widgetName}
                        onChange={(e) => setWidgetName(e.target.value)}
                        placeholder="Toplam Alacak"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Açıklama</Label>
                    <Input
                      value={widgetDescription}
                      onChange={(e) => setWidgetDescription(e.target.value)}
                      placeholder="Widget açıklaması..."
                    />
                  </div>
                  
                  <Separator />
                  
                  <DataSourceSelector
                    selectedId={selectedDataSourceId}
                    onSelect={handleDataSourceSelect}
                    showDetails={true}
                  />
                  
                  {/* Seçili kaynak yoksa bilgi */}
                  {!selectedDataSourceId && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-700">Veri Kaynağı Gerekli</p>
                          <p className="text-xs text-amber-600 mt-1">
                            Widget oluşturmak için önce Super Admin → Veri Kaynakları bölümünden 
                            bir veri kaynağı tanımlamanız gerekmektedir.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* VERİ BİRLEŞTİRME */}
            <TabsContent value="merge" className="m-0 space-y-4">
              <MultiQueryBuilder
                multiQuery={multiQuery}
                onChange={setMultiQuery}
              />
            </TabsContent>

            {/* HESAPLAMA ALANLARI */}
            <TabsContent value="calculation" className="m-0 space-y-4">
              <CalculatedFieldBuilder
                calculatedFields={calculatedFields}
                onChange={setCalculatedFields}
                availableFields={availableFieldsForVisualization}
                fieldTypes={{}}
                sampleData={[]}
              />
              
              {calculatedFields.length > 0 && (
                <Card className="bg-green-500/5 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{calculatedFields.length} hesaplama alanı tanımlandı - Görselleştirme sekmesinde kullanılabilir</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TARİH FİLTRELEME */}
            <TabsContent value="date" className="m-0 space-y-4">
              <DateRangeConfig
                config={dateFilterConfig}
                onChange={setDateFilterConfig}
                availableDateFields={availableFieldsForVisualization}
                selectedAxisField={fieldWells?.xAxis?.field}
              />
            </TabsContent>

            {/* POST-FETCH VERİ FİLTRELEME */}
            <TabsContent value="filter" className="m-0 space-y-4">
              <PostFetchFilterBuilder
                filters={postFetchFilters}
                onChange={setPostFetchFilters}
                availableFields={availableFieldsForVisualization}
                sampleData={selectedDataSource?.last_sample_data as any[] || []}
              />
            </TabsContent>

            {/* GÖRSELLEŞTİRME */}
            <TabsContent value="visualization" className="m-0 overflow-hidden">
              <ScrollArea className="h-[calc(90vh-220px)]">
                <div className="space-y-4 pr-4">
                  {/* Grafik Tipi Seçici */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Görselleştirme Tipi</CardTitle>
                      <CardDescription>Widget'ın nasıl görüntüleneceğini seçin</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                        {CHART_TYPES.filter(ct => ['kpi', 'bar', 'line', 'area', 'pie', 'donut', 'table', 'list', 'pivot'].includes(ct.id)).map(type => (
                          <Button
                            key={type.id}
                            variant={config.visualization.type === type.id ? 'default' : 'outline'}
                            className="h-auto py-2 md:py-3 flex-col gap-1"
                            onClick={() => handleChartTypeChange(type.id)}
                          >
                            <DynamicIcon iconName={type.icon} className="h-4 w-4 md:h-5 md:w-5" />
                            <span className="text-[10px] md:text-xs">{type.name}</span>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Power BI Tarzı Field Wells - Grafikler için */}
                  {['bar', 'line', 'area', 'pie', 'donut', 'kpi'].includes(config.visualization.type) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Veri Alanları
                        </CardTitle>
                        <CardDescription>
                          Alanları tıklayarak grafik bölgelerine atayın
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <FieldWellBuilder
                          chartType={config.visualization.type}
                          availableFields={availableFieldsForVisualization}
                          numericFields={numericFieldsForVisualization}
                          fieldWells={fieldWells}
                          onChange={setFieldWells}
                          sampleData={selectedDataSource?.last_sample_data as any[] || []}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Grafik Görünüm Ayarları */}
                  {['bar', 'line', 'area', 'pie', 'donut'].includes(config.visualization.type) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          Görünüm Ayarları
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartSettingsPanel
                          chartType={config.visualization.type}
                          settings={chartSettings}
                          onChange={setChartSettings}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Tablo/Liste/Pivot kolon ayarları */}
                  {['table', 'list', 'pivot'].includes(config.visualization.type) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Kolon Ayarları</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TableColumnBuilder
                          columns={tableColumns}
                          onChange={setTableColumns}
                          availableFields={availableFieldsForVisualization}
                          visualizationType={config.visualization.type as 'table' | 'list' | 'pivot'}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Pivot özel ayarları */}
                  {config.visualization.type === 'pivot' && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pivot Ayarları</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PivotConfigBuilder
                          config={pivotConfig}
                          onChange={setPivotConfig}
                          availableFields={availableFieldsForVisualization}
                          numericFields={numericFieldsForVisualization}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* WİDGET FİLTRELERİ - Yeni sekme */}
            <TabsContent value="widgetfilters" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-5 w-5 text-primary" />
                    Widget Filtreleme Alanları
                  </CardTitle>
                  <CardDescription>
                    Bu widget'ın hangi alanlara göre filtrelenebileceğini belirleyin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WidgetFilterFieldsBuilder
                    availableFields={availableFieldsForVisualization}
                    selectedFields={filterFields}
                    onChange={setFilterFields}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* KOD GÖRÜNTÜLEME */}
            <TabsContent value="code" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-2 md:pb-3">
                  <CardTitle className="text-sm md:text-base flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      <span>Üretilen Kod</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={copyGeneratedCode} className="h-7 text-xs self-start md:self-auto">
                      {codeCopied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {codeCopied ? 'Kopyalandı' : 'Kopyala'}
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Bu yapılandırmadan üretilen React kodu. Özelleştirmek için "Hardcode Widget" moduna geçebilirsiniz.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 md:p-6 pt-0">
                  <div className="relative">
                    <ScrollArea className="max-h-[35vh] md:max-h-[400px] border rounded-lg">
                      <pre className="p-2 md:p-4 bg-muted/50 text-[10px] md:text-xs font-mono whitespace-pre-wrap break-all">
                        {generateBuilderCode()}
                      </pre>
                    </ScrollArea>
                  </div>
                  
                  <div className="mt-3 md:mt-4 p-2 md:p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-[10px] md:text-sm text-muted-foreground">
                      <strong className="text-foreground">İpucu:</strong> Bu kodu kopyalayıp "Hardcode Widget Builder" ile daha detaylı özelleştirmeler yapabilirsiniz.
                      <span className="hidden md:inline"> Hardcode modunda AI desteği ile kodu geliştirebilir veya manuel değişiklikler yapabilirsiniz.</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CANLI ÖNİZLEME - EN SON SEKME */}
            <TabsContent value="preview" className="m-0 space-y-4">
              <LiveWidgetPreview
                config={config}
                widgetName={widgetName}
                widgetIcon={widgetIcon}
                xAxisField={xAxisField}
                yAxisField={yAxisField}
                legendField={legendField}
                calculatedFields={calculatedFields}
                postFetchFilters={postFetchFilters}
                tableColumns={tableColumns}
                pivotConfig={pivotConfig}
                dataSourceId={selectedDataSourceId}
                fieldWells={fieldWells}
                chartSettings={chartSettings}
                dateFilterConfig={dateFilterConfig}
                onNameChange={setWidgetName}
                onIconChange={setWidgetIcon}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Gelişmiş Footer - Boyut, Sayfa, İkon ve Kaydet */}
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Üst Satır: Boyut ve Sayfa Seçiciler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Boyut Seçici */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Boyutlar</Label>
              <WidgetSizeSelector
                selectedSizes={availableSizes}
                defaultSize={widgetSize}
                onChange={(sizes, def) => {
                  setAvailableSizes(sizes);
                  setWidgetSize(def);
                }}
              />
            </div>
            
            {/* Sayfa Seçici */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sayfalar</Label>
              <WidgetPageSelector
                selectedPages={targetPages}
                defaultPage={defaultPage}
                onChange={(pages, def) => {
                  setTargetPages(pages);
                  setDefaultPage(def);
                }}
              />
            </div>
          </div>

          {/* Alt Satır: İkon, Varsayılan ve Butonlar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {/* İkon Seçici */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <DynamicIcon iconName={widgetIcon} className="h-4 w-4" />
                    <span className="hidden sm:inline">İkon</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-2">
                    <Label className="text-sm">İkon Seç</Label>
                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                      {AVAILABLE_ICONS.map(icon => (
                        <Button
                          key={icon}
                          variant={widgetIcon === icon ? 'default' : 'ghost'}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setWidgetIcon(icon)}
                          title={icon}
                        >
                          <DynamicIcon iconName={icon} className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Varsayılan Widget */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
                <Label className="text-xs cursor-pointer" htmlFor="default-widget-toggle">
                  Varsayılan
                </Label>
                <Switch
                  id="default-widget-toggle"
                  checked={isDefaultWidget}
                  onCheckedChange={setIsDefaultWidget}
                  className="scale-75"
                />
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isEditMode ? 'Güncelle' : 'Oluştur'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
