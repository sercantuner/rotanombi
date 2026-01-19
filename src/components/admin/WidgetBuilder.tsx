// Widget Builder - Gelişmiş widget oluşturma ve düzenleme aracı

import { useState, useEffect } from 'react';
import { useWidgetAdmin } from '@/hooks/useWidgets';
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
} from '@/lib/widgetBuilderTypes';
import { testDiaApi, DiaApiTestResponse, FieldStat } from '@/lib/diaApiTest';
import { FilterBuilder } from './FilterBuilder';
import { SortBuilder } from './SortBuilder';
import { ColumnSelector } from './ColumnSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Wand2, Code, BarChart3, Settings2, Play, Save, Plus, Trash2, 
  Hash, TrendingUp, Activity, PieChart, Circle, Table, List, Filter, LayoutGrid, Crosshair, Radar, CheckCircle, XCircle, AlertCircle, Edit,
  FileJson, MousePointer, Target, Columns
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WidgetBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
  // Düzenleme modu için
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

const RAW_JSON_TEMPLATE = `{
  "scf_carikart_listele": {
    "session_id": "{session_id}",
    "firma_kodu": {firma_kodu},
    "donem_kodu": {donem_kodu},
    "filters": "",
    "sorts": "",
    "params": "",
    "limit": 100,
    "offset": 0
  }
}`;

export function WidgetBuilder({ open, onOpenChange, onSave, editWidget }: WidgetBuilderProps) {
  const { createWidget, updateWidget, isLoading } = useWidgetAdmin();
  const [activeTab, setActiveTab] = useState('api');
  const [apiMode, setApiMode] = useState<'normal' | 'raw'>('normal');
  
  // Düzenleme modu
  const isEditMode = !!editWidget;
  
  // Widget temel bilgileri
  const [widgetKey, setWidgetKey] = useState('');
  const [widgetName, setWidgetName] = useState('');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetIcon, setWidgetIcon] = useState('BarChart3');
  const [widgetSize, setWidgetSize] = useState<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');
  const [defaultPage, setDefaultPage] = useState<'dashboard' | 'satis' | 'finans' | 'cari'>('dashboard');
  
  // Builder config
  const [config, setConfig] = useState<WidgetBuilderConfig>(getEmptyConfig());
  
  // API parametreleri için ayrı state'ler (no-code arrays)
  const [apiFilters, setApiFilters] = useState<DiaApiFilter[]>([]);
  const [apiSorts, setApiSorts] = useState<DiaApiSort[]>([]);
  const [selectedColumnsArray, setSelectedColumnsArray] = useState<string[]>([]);
  const [rawPayload, setRawPayload] = useState(RAW_JSON_TEMPLATE);
  
  // Chart axis/series config
  const [xAxisField, setXAxisField] = useState('');
  const [yAxisField, setYAxisField] = useState('');
  const [legendField, setLegendField] = useState('');
  const [tooltipFields, setTooltipFields] = useState('');
  
  // Widget filtreleri
  const [widgetFilters, setWidgetFilters] = useState<WidgetFilterConfig[]>([]);
  
  // Test sonucu
  const [testResult, setTestResult] = useState<DiaApiTestResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  // Aktif hedef alan (alan eşleme için)
  const [activeTarget, setActiveTarget] = useState<'xAxis' | 'yAxis' | 'legend' | 'value' | 'tooltip' | null>(null);
  
  // Düzenleme modunda widget verilerini yükle
  useEffect(() => {
    if (editWidget && open) {
      setWidgetKey(editWidget.widget_key);
      setWidgetName(editWidget.name);
      setWidgetDescription(editWidget.description || '');
      setWidgetIcon(editWidget.icon || 'BarChart3');
      setWidgetSize(editWidget.size);
      setDefaultPage(editWidget.default_page);
      
      // builder_config varsa yükle
      if (editWidget.builder_config) {
        const bc = editWidget.builder_config;
        setConfig(bc);
        
        // API parametrelerini ayarla (yeni format)
        if (bc.diaApi.parameters.filters) {
          if (Array.isArray(bc.diaApi.parameters.filters)) {
            setApiFilters(bc.diaApi.parameters.filters);
          }
        }
        if (bc.diaApi.parameters.sorts) {
          setApiSorts(bc.diaApi.parameters.sorts);
        }
        if (bc.diaApi.parameters.selectedcolumns) {
          if (Array.isArray(bc.diaApi.parameters.selectedcolumns)) {
            setSelectedColumnsArray(bc.diaApi.parameters.selectedcolumns);
          } else if (typeof bc.diaApi.parameters.selectedcolumns === 'string') {
            setSelectedColumnsArray(bc.diaApi.parameters.selectedcolumns.split(',').map(c => c.trim()).filter(c => c));
          }
        }
        
        // Chart ayarlarını yükle
        if (bc.visualization.chart) {
          setXAxisField(bc.visualization.chart.xAxis?.field || '');
          setYAxisField(bc.visualization.chart.yAxis?.field || bc.visualization.chart.valueField || '');
          setLegendField(bc.visualization.chart.legendField || '');
          setTooltipFields(bc.visualization.chart.tooltipFields?.join(', ') || '');
        }
      }
    } else if (!open) {
      // Modal kapandığında formu temizle
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
    setApiFilters([]);
    setApiSorts([]);
    setSelectedColumnsArray([]);
    setRawPayload(RAW_JSON_TEMPLATE);
    setXAxisField('');
    setYAxisField('');
    setLegendField('');
    setTooltipFields('');
    setWidgetFilters([]);
    setTestResult(null);
    setActiveTab('api');
    setApiMode('normal');
    setActiveTarget(null);
  };

  const handleModuleChange = (module: string) => {
    setConfig(prev => ({
      ...prev,
      diaApi: {
        ...prev.diaApi,
        module: module as any,
        method: DIA_MODULES.find(m => m.id === module)?.methods[0] || '',
      },
    }));
  };

  const handleMethodChange = (method: string) => {
    setConfig(prev => ({
      ...prev,
      diaApi: {
        ...prev.diaApi,
        method,
      },
    }));
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

  const handleTestApi = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      let result: DiaApiTestResponse;
      
      if (apiMode === 'raw') {
        // Raw mode - tam JSON payload
        result = await testDiaApi({
          module: 'scf',
          method: 'carikart_listele',
          rawMode: true,
          rawPayload: rawPayload,
        });
      } else {
        // Normal mode - no-code filters
        result = await testDiaApi({
          module: config.diaApi.module,
          method: config.diaApi.method,
          limit: config.diaApi.parameters.limit || 0, // 0 = limitsiz
          filters: apiFilters.length > 0 ? apiFilters : undefined,
          selectedColumns: selectedColumnsArray.length > 0 ? selectedColumnsArray : undefined,
          sorts: apiSorts.length > 0 ? apiSorts : undefined,
          orderby: config.diaApi.parameters.orderby,
        });
      }

      setTestResult(result);

      if (result.success) {
        toast.success(`API testi başarılı! ${result.recordCount} kayıt bulundu.`);
        
        // Alanları otomatik olarak value field seçeneklerine ekle
        if (result.sampleFields && result.sampleFields.length > 0) {
          const numericField = result.sampleFields.find(f => 
            result.fieldTypes?.[f] === 'number' || result.fieldTypes?.[f] === 'number-string'
          );
          if (numericField && config.visualization.type === 'kpi' && !config.visualization.kpi?.valueField) {
            handleKpiConfigChange('valueField', numericField);
          }
        }
      } else {
        toast.error(`API hatası: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Beklenmeyen hata';
      toast.error(`API testi başarısız: ${errorMessage}`);
      setTestResult({ success: false, error: errorMessage });
    } finally {
      setIsTesting(false);
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

    // builder_config'i oluştur - no-code arrays kullan
    const builderConfig: WidgetBuilderConfig = {
      diaApi: {
        ...config.diaApi,
        parameters: {
          ...config.diaApi.parameters,
          filters: apiFilters.length > 0 ? apiFilters : undefined,
          sorts: apiSorts.length > 0 ? apiSorts : undefined,
          selectedcolumns: selectedColumnsArray.length > 0 ? selectedColumnsArray : undefined,
        },
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
      sort_order: editWidget?.sort_order || 100,
      builder_config: builderConfig,
    };

    let success = false;
    
    if (isEditMode && editWidget) {
      // Güncelleme modu
      success = await updateWidget(editWidget.id, formData);
      if (success) {
        toast.success('Widget güncellendi!');
      }
    } else {
      // Oluşturma modu
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

  const currentModule = DIA_MODULES.find(m => m.id === config.diaApi.module);

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
              : 'DIA web servisinden veri çekecek ve görselleştirecek özel widget oluşturun'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api" className="gap-2">
              <Code className="h-4 w-4" />
              API Yapılandırma
            </TabsTrigger>
            <TabsTrigger value="visualization" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Görselleştirme
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Widget Ayarları
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Play className="h-4 w-4" />
              Önizleme
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-4" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {/* API YAPILANDIRMA */}
            <TabsContent value="api" className="m-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">DIA Web Servis Ayarları</CardTitle>
                      <CardDescription>
                        {apiMode === 'raw' ? 'Tam JSON payload ile API çağrısı' : 'Modül/metod seçerek veri çekin'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                      <Button
                        size="sm"
                        variant={apiMode === 'normal' ? 'default' : 'ghost'}
                        className="h-7 px-3"
                        onClick={() => setApiMode('normal')}
                      >
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        Normal
                      </Button>
                      <Button
                        size="sm"
                        variant={apiMode === 'raw' ? 'default' : 'ghost'}
                        className="h-7 px-3"
                        onClick={() => setApiMode('raw')}
                      >
                        <FileJson className="h-3.5 w-3.5 mr-1" />
                        Raw JSON
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {apiMode === 'raw' ? (
                    /* RAW JSON MODE */
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>JSON Payload</Label>
                        <Textarea
                          value={rawPayload}
                          onChange={(e) => setRawPayload(e.target.value)}
                          className="font-mono text-sm min-h-[200px]"
                          placeholder={RAW_JSON_TEMPLATE}
                        />
                        <p className="text-xs text-muted-foreground">
                          <code>{'{session_id}'}</code>, <code>{'{firma_kodu}'}</code>, <code>{'{donem_kodu}'}</code> otomatik değiştirilir
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* NORMAL MODE */
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Modül</Label>
                          <Select value={config.diaApi.module} onValueChange={handleModuleChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DIA_MODULES.map(mod => (
                                <SelectItem key={mod.id} value={mod.id}>
                                  {mod.name} ({mod.id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Metod</Label>
                          <Select value={config.diaApi.method} onValueChange={handleMethodChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {currentModule?.methods.map(method => (
                                <SelectItem key={method} value={method}>
                                  {method}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                  {/* No-Code Column Selector */}
                  <ColumnSelector
                    availableFields={testResult?.sampleFields || []}
                    selectedColumns={selectedColumnsArray}
                    onChange={setSelectedColumnsArray}
                    fieldTypes={testResult?.fieldTypes}
                  />

                  {/* No-Code Filter Builder */}
                  <FilterBuilder
                    filters={apiFilters}
                    onChange={setApiFilters}
                    availableFields={testResult?.sampleFields || []}
                    fieldTypes={testResult?.fieldTypes}
                  />

                  {/* No-Code Sort Builder */}
                  <SortBuilder
                    sorts={apiSorts}
                    onChange={setApiSorts}
                    availableFields={testResult?.sampleFields || []}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Limit (0 = limitsiz)</Label>
                      <Input
                        type="number"
                        value={config.diaApi.parameters.limit || 0}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          diaApi: {
                            ...prev.diaApi,
                            parameters: {
                              ...prev.diaApi.parameters,
                              limit: parseInt(e.target.value) || 0,
                            },
                          },
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sıralama</Label>
                      <Input
                        placeholder="toplambakiye DESC"
                        value={config.diaApi.parameters.orderby || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          diaApi: {
                            ...prev.diaApi,
                            parameters: {
                              ...prev.diaApi.parameters,
                              orderby: e.target.value,
                            },
                          },
                        }))}
                      />
                    </div>
                      </div>
                    </>
                  )}

                  <Button onClick={handleTestApi} disabled={isTesting} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    {isTesting ? 'Test Ediliyor...' : 'API Testi Yap'}
                  </Button>

                  {testResult && (
                    <Card className={cn(
                      'mt-4',
                      testResult.success ? 'border-green-500/50 bg-green-500/5' : 'border-destructive/50 bg-destructive/5'
                    )}>
                      <CardContent className="pt-4">
                        {testResult.success ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <p className="text-sm font-medium text-green-600">
                                {testResult.recordCount} kayıt bulundu
                              </p>
                            </div>
                            
                            {/* Alanlar ve Tipleri */}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Mevcut Alanlar:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {testResult.sampleFields?.map((field: string) => {
                                  const fieldType = testResult.fieldTypes?.[field] || 'unknown';
                                  const typeColor = 
                                    fieldType === 'number' || fieldType === 'number-string' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                                    fieldType === 'date' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                                    fieldType === 'boolean' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                                    'bg-muted text-muted-foreground';
                                  
                                  return (
                                    <Badge 
                                      key={field} 
                                      variant="outline" 
                                      className={cn('text-xs cursor-pointer hover:opacity-80', typeColor)}
                                      onClick={() => {
                                        navigator.clipboard.writeText(field);
                                        toast.success(`"${field}" kopyalandı`);
                                      }}
                                    >
                                      {field}
                                      <span className="ml-1 opacity-60 text-[10px]">
                                        ({fieldType === 'number-string' ? 'num' : fieldType.slice(0, 3)})
                                      </span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Örnek Veri */}
                            {testResult.sampleData && testResult.sampleData.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Örnek Veri (ilk {testResult.sampleData.length} kayıt):</p>
                                <div className="max-h-40 overflow-auto rounded border">
                                  <pre className="p-2 text-xs font-mono bg-muted/30">
                                    {JSON.stringify(testResult.sampleData, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-destructive" />
                            <p className="text-sm text-destructive">{testResult.error}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* GÖRSELLEŞTİRME */}
            <TabsContent value="visualization" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grafik Tipi Seçin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    {CHART_TYPES.map(chart => (
                      <button
                        key={chart.id}
                        onClick={() => handleChartTypeChange(chart.id)}
                        className={cn(
                          'p-4 rounded-lg border-2 text-left transition-all',
                          config.visualization.type === chart.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <DynamicIcon iconName={chart.icon} className="h-6 w-6 mb-2" />
                        <p className="font-medium text-sm">{chart.name}</p>
                        <p className="text-xs text-muted-foreground">{chart.description}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* KPI Yapılandırması */}
              {config.visualization.type === 'kpi' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">KPI Ayarları</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Değer Alanı</Label>
                        <Input
                          placeholder="toplambakiye"
                          value={config.visualization.kpi?.valueField || ''}
                          onChange={(e) => handleKpiConfigChange('valueField', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Agregasyon</Label>
                        <Select 
                          value={config.visualization.kpi?.aggregation || 'sum'}
                          onValueChange={(v) => handleKpiConfigChange('aggregation', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AGGREGATION_TYPES.map(agg => (
                              <SelectItem key={agg.id} value={agg.id}>
                                {agg.name} - {agg.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
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
                              <SelectItem key={fmt.id} value={fmt.id}>
                                {fmt.name} ({fmt.example})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Önek</Label>
                        <Input
                          placeholder="₺"
                          value={config.visualization.kpi?.prefix || ''}
                          onChange={(e) => handleKpiConfigChange('prefix', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sonek</Label>
                        <Input
                          placeholder="TL"
                          value={config.visualization.kpi?.suffix || ''}
                          onChange={(e) => handleKpiConfigChange('suffix', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Grafik Yapılandırması */}
              {config.visualization.type !== 'kpi' && 
               config.visualization.type !== 'table' && 
               config.visualization.type !== 'list' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Grafik Ayarları</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Bar, Line, Area için X ve Y ekseni */}
                    {['bar', 'line', 'area', 'scatter'].includes(config.visualization.type) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>X Ekseni Alanı</Label>
                          <Input
                            placeholder="sehir, tarih, ozelkod1..."
                            value={xAxisField}
                            onChange={(e) => setXAxisField(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Y Ekseni Alanı</Label>
                          <Input
                            placeholder="toplambakiye, adet..."
                            value={yAxisField}
                            onChange={(e) => setYAxisField(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Pie, Donut için Legend ve Value */}
                    {['pie', 'donut'].includes(config.visualization.type) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Legend Alanı (Dilimler)</Label>
                          <Input
                            placeholder="sektor, kaynak, ozelkod1..."
                            value={legendField}
                            onChange={(e) => setLegendField(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Değer Alanı</Label>
                          <Input
                            placeholder="toplambakiye, adet..."
                            value={yAxisField}
                            onChange={(e) => setYAxisField(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Tooltip Alanları (Virgülle ayırın)</Label>
                      <Input
                        placeholder="cariadi, telefon, email"
                        value={tooltipFields}
                        onChange={(e) => setTooltipFields(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.visualization.chart?.showLegend ?? true}
                          onCheckedChange={(v) => handleChartConfigChange('showLegend', v)}
                        />
                        <Label>Legend Göster</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.visualization.chart?.showGrid ?? true}
                          onCheckedChange={(v) => handleChartConfigChange('showGrid', v)}
                        />
                        <Label>Grid Göster</Label>
                      </div>
                      {['bar', 'area'].includes(config.visualization.type) && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={config.visualization.chart?.stacked ?? false}
                            onCheckedChange={(v) => handleChartConfigChange('stacked', v)}
                          />
                          <Label>Yığılmış</Label>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* WIDGET AYARLARI */}
            <TabsContent value="settings" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Widget Bilgileri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Widget Key *</Label>
                      <Input
                        placeholder="custom_widget_key"
                        value={widgetKey}
                        onChange={(e) => setWidgetKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Benzersiz tanımlayıcı (snake_case)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Widget Adı *</Label>
                      <Input
                        placeholder="Özel Widget Adı"
                        value={widgetName}
                        onChange={(e) => setWidgetName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Açıklama</Label>
                    <Textarea
                      placeholder="Widget açıklaması..."
                      value={widgetDescription}
                      onChange={(e) => setWidgetDescription(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>İkon</Label>
                      <Select value={widgetIcon} onValueChange={setWidgetIcon}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['BarChart3', 'TrendingUp', 'PieChart', 'Activity', 'Hash', 'DollarSign', 'Users', 'Package', 'ShoppingCart', 'Wallet'].map(icon => (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                <DynamicIcon iconName={icon} className="h-4 w-4" />
                                {icon}
                              </div>
                            </SelectItem>
                          ))}
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
                            <SelectItem key={size.id} value={size.id}>
                              {size.name} ({size.cols} sütun)
                            </SelectItem>
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
                          {PAGE_CATEGORIES.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ÖNİZLEME */}
            <TabsContent value="preview" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Widget Önizleme</CardTitle>
                  <CardDescription>
                    Widget'ın nasıl görüneceğinin tahmini gösterimi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-6 bg-muted/20 min-h-[200px] flex items-center justify-center">
                    {config.visualization.type === 'kpi' ? (
                      <div className="text-center">
                        <DynamicIcon iconName={widgetIcon} className="h-8 w-8 mx-auto mb-2 text-primary" />
                        <p className="text-3xl font-bold">
                          {config.visualization.kpi?.prefix || '₺'}1.234.567
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {widgetName || 'Widget Adı'}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <DynamicIcon iconName={CHART_TYPES.find(c => c.id === config.visualization.type)?.icon || 'BarChart3'} className="h-16 w-16 mx-auto mb-4" />
                        <p className="font-medium">{widgetName || 'Widget Adı'}</p>
                        <p className="text-sm">
                          {CHART_TYPES.find(c => c.id === config.visualization.type)?.name} görünümü
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Config özeti */}
                  <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium">Yapılandırma Özeti:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>API: <code>{config.diaApi.module}/{config.diaApi.method}</code></div>
                      <div>Tip: <Badge variant="outline">{config.visualization.type}</Badge></div>
                      <div>Boyut: <Badge variant="secondary">{widgetSize}</Badge></div>
                      <div>Sayfa: <Badge variant="secondary">{defaultPage}</Badge></div>
                    </div>
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
          <Button onClick={handleSave} disabled={isLoading || !widgetKey || !widgetName}>
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? 'Güncelle' : 'Widget Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
