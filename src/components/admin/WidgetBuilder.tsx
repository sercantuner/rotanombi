// Widget Builder - Gelişmiş widget oluşturma ve düzenleme aracı
// Veri Kaynağı seçimi ile entegre - API test yerine merkezi kaynakları kullanır

import { useState, useEffect, useMemo } from 'react';
import { useWidgetAdmin } from '@/hooks/useWidgets';
import { useDataSources, DataSource } from '@/hooks/useDataSources';
import { Widget, WidgetFormData, PAGE_CATEGORIES, WIDGET_SIZES } from '@/lib/widgetTypes';
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
} from '@/lib/widgetBuilderTypes';
import { DateRangeConfig, getDefaultDateFilterConfig } from './DateRangeConfig';
import { DataSourceSelector } from './DataSourceSelector';
import { MultiQueryBuilder } from './MultiQueryBuilder';
import { CalculatedFieldBuilder } from './CalculatedFieldBuilder';
import { WidgetPreviewRenderer } from './WidgetPreviewRenderer';
import { WidgetTemplates, WidgetTemplate, WIDGET_TEMPLATES } from './WidgetTemplates';
import { PostFetchFilterBuilder } from './PostFetchFilterBuilder';
import { TableColumnBuilder, TableColumn } from './TableColumnBuilder';
import { PivotConfigBuilder, getDefaultPivotConfig } from './PivotConfigBuilder';
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
import { 
  Wand2, BarChart3, Settings2, Save, 
  Hash, TrendingUp, Activity, PieChart, Circle, Table, List, LayoutGrid, CheckCircle, Edit,
  Database, Calculator, Sparkles, Calendar, Zap, Info, Filter
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
  const [widgetSize, setWidgetSize] = useState<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');
  const [defaultPage, setDefaultPage] = useState<'dashboard' | 'satis' | 'finans' | 'cari'>('dashboard');
  
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
    setDefaultPage('dashboard');
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
    // Yeni state'leri sıfırla
    setPostFetchFilters([]);
    setTableColumns([]);
    setPivotConfig(getDefaultPivotConfig());
    setIsDefaultWidget(false);
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
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? (
              <Edit className="h-5 w-5 text-primary" />
            ) : (
              <Wand2 className="h-5 w-5 text-primary" />
            )}
            {isEditMode ? 'Widget Düzenle' : 'Widget Builder'}
            {isEditMode && (
              <Badge variant="secondary" className="ml-2">{editWidget?.name}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Mevcut widget yapılandırmasını düzenleyin ve güncelleyin'
              : 'Merkezi veri kaynaklarından widget oluşturun'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={cn("grid w-full", isEditMode ? "grid-cols-7" : "grid-cols-8")}>
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
            <TabsTrigger value="settings" className="gap-1 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Ayarlar
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
                  
                  {/* Mevcut alanlar */}
                  {selectedDataSource && availableFieldsForVisualization.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Mevcut Alanlar</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableFieldsForVisualization.map((field) => {
                          const isNumeric = numericFieldsForVisualization.includes(field);
                          return (
                            <Badge 
                              key={field} 
                              variant="outline" 
                              className={cn(
                                'text-xs cursor-pointer hover:opacity-80',
                                isNumeric ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' : ''
                              )}
                              onClick={() => handleFieldClick(field)}
                            >
                              {field}
                              {isNumeric && <span className="ml-1 opacity-60 text-[10px]">(num)</span>}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Alanları tıklayarak kopyalayabilir veya Görsel sekmesinde hedef alana atayabilirsiniz
                      </p>
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
              />
            </TabsContent>

            {/* POST-FETCH VERİ FİLTRELEME */}
            <TabsContent value="filter" className="m-0 space-y-4">
              <PostFetchFilterBuilder
                filters={postFetchFilters}
                onChange={setPostFetchFilters}
                availableFields={availableFieldsForVisualization}
              />
            </TabsContent>

            {/* GÖRSELLEŞTİRME */}
            <TabsContent value="visualization" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Görselleştirme Tipi</CardTitle>
                  <CardDescription>Widget'ın nasıl görüntüleneceğini seçin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-5 gap-2">
                    {CHART_TYPES.filter(ct => ['kpi', 'bar', 'line', 'area', 'pie', 'donut', 'table', 'list', 'pivot'].includes(ct.id)).map(type => (
                      <Button
                        key={type.id}
                        variant={config.visualization.type === type.id ? 'default' : 'outline'}
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => handleChartTypeChange(type.id)}
                      >
                        <DynamicIcon iconName={type.icon} className="h-5 w-5" />
                        <span className="text-xs">{type.name}</span>
                      </Button>
                    ))}
                  </div>

                  <Separator />

                  {/* KPI ayarları */}
                  {config.visualization.type === 'kpi' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Değer Alanı</Label>
                          <Select 
                            value={config.visualization.kpi?.valueField || ''} 
                            onValueChange={(v) => handleKpiConfigChange('valueField', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Alan seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFieldsForVisualization.map(field => (
                                <SelectItem key={field} value={field}>{field}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Hesaplama</Label>
                          <Select 
                            value={config.visualization.kpi?.aggregation || 'sum'} 
                            onValueChange={(v) => handleKpiConfigChange('aggregation', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AGGREGATION_TYPES.map(agg => (
                                <SelectItem key={agg.id} value={agg.id}>{agg.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Format</Label>
                          <Select 
                            value={config.visualization.kpi?.format || 'currency'} 
                            onValueChange={(v) => handleKpiConfigChange('format', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMAT_OPTIONS.map(fmt => (
                                <SelectItem key={fmt.id} value={fmt.id}>{fmt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Prefix</Label>
                          <Input
                            placeholder="₺"
                            value={config.visualization.kpi?.prefix || ''}
                            onChange={(e) => handleKpiConfigChange('prefix', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chart ayarları */}
                  {['bar', 'line', 'area'].includes(config.visualization.type) && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>X Ekseni (Kategori)</Label>
                          <Select value={xAxisField} onValueChange={setXAxisField}>
                            <SelectTrigger>
                              <SelectValue placeholder="Alan seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFieldsForVisualization.map(field => (
                                <SelectItem key={field} value={field}>{field}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Y Ekseni (Değer)</Label>
                          <Select value={yAxisField} onValueChange={setYAxisField}>
                            <SelectTrigger>
                              <SelectValue placeholder="Alan seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {numericFieldsForVisualization.map(field => (
                                <SelectItem key={field} value={field}>{field}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pie/Donut ayarları */}
                  {['pie', 'donut'].includes(config.visualization.type) && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Kategori Alanı</Label>
                          <Select value={legendField} onValueChange={setLegendField}>
                            <SelectTrigger>
                              <SelectValue placeholder="Alan seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFieldsForVisualization.map(field => (
                                <SelectItem key={field} value={field}>{field}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Değer Alanı</Label>
                          <Select value={yAxisField} onValueChange={setYAxisField}>
                            <SelectTrigger>
                              <SelectValue placeholder="Alan seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {numericFieldsForVisualization.map(field => (
                                <SelectItem key={field} value={field}>{field}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tablo/Liste/Pivot kolon ayarları */}
                  {['table', 'list', 'pivot'].includes(config.visualization.type) && (
                    <TableColumnBuilder
                      columns={tableColumns}
                      onChange={setTableColumns}
                      availableFields={availableFieldsForVisualization}
                      visualizationType={config.visualization.type as 'table' | 'list' | 'pivot'}
                    />
                  )}

                  {/* Pivot özel ayarları */}
                  {config.visualization.type === 'pivot' && (
                    <PivotConfigBuilder
                      config={pivotConfig}
                      onChange={setPivotConfig}
                      availableFields={availableFieldsForVisualization}
                      numericFields={numericFieldsForVisualization}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AYARLAR */}
            <TabsContent value="settings" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Widget Bilgileri</CardTitle>
                  <CardDescription>Widget'ın temel bilgilerini girin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>İkon</Label>
                      <Select value={widgetIcon} onValueChange={setWidgetIcon}>
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <DynamicIcon iconName={widgetIcon} className="h-4 w-4" />
                              {widgetIcon}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <div className="grid grid-cols-6 gap-1 p-2">
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
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Boyut</Label>
                      <Select value={widgetSize} onValueChange={(v: any) => setWidgetSize(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WIDGET_SIZES.map(size => (
                            <SelectItem key={size.id} value={size.id}>{size.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Varsayılan Sayfa</Label>
                      <Select value={defaultPage} onValueChange={(v: any) => setDefaultPage(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dashboard">Dashboard</SelectItem>
                          <SelectItem value="satis">Satış</SelectItem>
                          <SelectItem value="finans">Finans</SelectItem>
                          <SelectItem value="cari">Cari</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Varsayılan Widget Toggle */}
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div>
                      <Label className="text-base font-medium">Varsayılan Widget</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bu widget tüm yeni kullanıcılarda otomatik görünsün
                      </p>
                    </div>
                    <Switch 
                      checked={isDefaultWidget}
                      onCheckedChange={setIsDefaultWidget}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? 'Güncelle' : 'Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
