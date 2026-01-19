// Widget Builder - Gelişmiş widget oluşturma aracı

import { useState, useEffect } from 'react';
import { useWidgetAdmin } from '@/hooks/useWidgets';
import { WidgetFormData, PAGE_CATEGORIES, WIDGET_SIZES } from '@/lib/widgetTypes';
import {
  ChartType,
  AggregationType,
  CHART_TYPES,
  AGGREGATION_TYPES,
  DIA_MODULES,
  FORMAT_OPTIONS,
  WidgetBuilderConfig,
} from '@/lib/widgetBuilderTypes';
import { testDiaApi, DiaApiTestResponse } from '@/lib/diaApiTest';
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
import { 
  Wand2, Code, BarChart3, Settings2, Play, Save, Plus, Trash2, 
  Hash, TrendingUp, Activity, PieChart, Circle, Table, List, Filter, LayoutGrid, Crosshair, Radar, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WidgetBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
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

export function WidgetBuilder({ open, onOpenChange, onSave }: WidgetBuilderProps) {
  const { createWidget, isLoading } = useWidgetAdmin();
  const [activeTab, setActiveTab] = useState('api');
  
  // Widget temel bilgileri
  const [widgetKey, setWidgetKey] = useState('');
  const [widgetName, setWidgetName] = useState('');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetIcon, setWidgetIcon] = useState('BarChart3');
  const [widgetSize, setWidgetSize] = useState<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');
  const [defaultPage, setDefaultPage] = useState<'dashboard' | 'satis' | 'finans' | 'cari'>('dashboard');
  
  // Builder config
  const [config, setConfig] = useState<WidgetBuilderConfig>(getEmptyConfig());
  
  // API parametreleri için ayrı state'ler
  const [customFilters, setCustomFilters] = useState('');
  const [selectedColumns, setSelectedColumns] = useState('');
  
  // Chart axis/series config
  const [xAxisField, setXAxisField] = useState('');
  const [yAxisField, setYAxisField] = useState('');
  const [legendField, setLegendField] = useState('');
  const [tooltipFields, setTooltipFields] = useState('');
  
  // Test sonucu
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

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
      // Filtre JSON'ını parse et
      let filters = {};
      if (customFilters.trim()) {
        try {
          filters = JSON.parse(customFilters);
        } catch (e) {
          toast.error('Geçersiz filtre JSON formatı');
          setIsTesting(false);
          return;
        }
      }

      // Seçili kolonları parse et
      const columns = selectedColumns
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      // Gerçek DIA API testi
      const result = await testDiaApi({
        module: config.diaApi.module,
        method: config.diaApi.method,
        limit: config.diaApi.parameters.limit || 100,
        filters,
        selectedColumns: columns.length > 0 ? columns : undefined,
        orderby: config.diaApi.parameters.orderby,
      });

      setTestResult(result);

      if (result.success) {
        toast.success(`API testi başarılı! ${result.recordCount} kayıt bulundu.`);
        
        // Alanları otomatik olarak value field seçeneklerine ekle
        if (result.sampleFields && result.sampleFields.length > 0) {
          // İlk sayısal alanı varsayılan olarak seç
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

  const handleSave = async () => {
    if (!widgetKey || !widgetName) {
      toast.error('Widget key ve adı zorunludur');
      return;
    }

    // builder_config'i oluştur
    const builderConfig: WidgetBuilderConfig = {
      diaApi: {
        ...config.diaApi,
        parameters: {
          ...config.diaApi.parameters,
          filters: customFilters.trim() ? JSON.parse(customFilters) : undefined,
          selectedcolumns: selectedColumns.trim() || undefined,
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
      sort_order: 100,
      builder_config: builderConfig, // Builder yapılandırmasını kaydet
    };

    const success = await createWidget(formData);
    if (success) {
      toast.success('Widget oluşturuldu ve kaydedildi!');
      onSave?.();
      onOpenChange(false);
      // Reset form
      setWidgetKey('');
      setWidgetName('');
      setWidgetDescription('');
      setConfig(getEmptyConfig());
      setTestResult(null);
      setCustomFilters('');
      setSelectedColumns('');
      setXAxisField('');
      setYAxisField('');
      setLegendField('');
      setTooltipFields('');
    }
  };

  const currentModule = DIA_MODULES.find(m => m.id === config.diaApi.module);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Widget Builder
          </DialogTitle>
          <DialogDescription>
            DIA web servisinden veri çekecek ve görselleştirecek özel widget oluşturun
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

          <ScrollArea className="flex-1 mt-4">
            {/* API YAPILANDIRMA */}
            <TabsContent value="api" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">DIA Web Servis Ayarları</CardTitle>
                  <CardDescription>
                    Hangi DIA modülünden hangi veriyi çekeceğinizi tanımlayın
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="space-y-2">
                    <Label>Selected Columns (Virgülle ayırın)</Label>
                    <Input
                      placeholder="carikod,cariadi,toplambakiye,sehir,ozelkod1"
                      value={selectedColumns}
                      onChange={(e) => setSelectedColumns(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Boş bırakırsanız tüm alanlar gelir
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Filtreler (JSON formatında)</Label>
                    <Textarea
                      placeholder='{"potansiyel": "H", "aktif": "E"}'
                      value={customFilters}
                      onChange={(e) => setCustomFilters(e.target.value)}
                      className="font-mono text-sm"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Limit</Label>
                      <Input
                        type="number"
                        value={config.diaApi.parameters.limit || 1000}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          diaApi: {
                            ...prev.diaApi,
                            parameters: {
                              ...prev.diaApi.parameters,
                              limit: parseInt(e.target.value) || 1000,
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
                                        // Alan adını panoya kopyala
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
            Widget Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
