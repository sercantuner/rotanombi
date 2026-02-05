// DataSourceManager - Merkezi Veri Kaynakları Yönetimi

import { useState } from 'react';
import { useDataSources, DataSourceFormData } from '@/hooks/useDataSources';
import { testDiaApi, DiaApiTestResponse } from '@/lib/diaApiTest';
import { DiaApiFilter, DiaApiSort, DIA_MODULES, PeriodConfig, getDefaultPeriodConfig } from '@/lib/widgetBuilderTypes';
import { CompactFilterBuilder } from './CompactFilterBuilder';
import { CompactSortBuilder } from './CompactSortBuilder';
import { CompactColumnSelector } from './CompactColumnSelector';
import { FullscreenColumnSelector } from './FullscreenColumnSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Database, Plus, Edit, Trash2, Play, RefreshCw, Clock, Check, AlertCircle, 
  Share2, CheckCircle, XCircle, Loader2, CalendarClock, History, Globe, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function DataSourceManager() {
  const { 
    dataSources, 
    activeDataSources,
    isLoading, 
    createDataSource, 
    updateDataSource, 
    deleteDataSource, 
    updateLastFetch,
    isCreating,
    isUpdating,
    isDeleting
  } = useDataSources();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DiaApiTestResponse | null>(null);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  
  // Manuel mod
  const [manualModuleMode, setManualModuleMode] = useState(false);
  const [manualMethodMode, setManualMethodMode] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<DataSourceFormData>({
    name: '',
    slug: '',
    description: '',
    module: 'scf',
    method: 'carikart_listele',
    filters: [],
    sorts: [],
    selected_columns: [],
    limit_count: 0,
    cache_ttl: 300,
    is_shared: false,
    auto_refresh: false,
    refresh_schedule: null,
    is_active: true,
    is_period_independent: false,
    is_non_dia: false,
  });
  
  // Filtre/Sort state
  const [apiFilters, setApiFilters] = useState<DiaApiFilter[]>([]);
  const [apiSorts, setApiSorts] = useState<DiaApiSort[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  
  // Dönem ayarları state
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig>(getDefaultPeriodConfig());
  
  // Hızlı test sonucu state
  const [quickTestResult, setQuickTestResult] = useState<{
    sourceId: string;
    recordCount: number;
  } | null>(null);
  
  const currentModule = DIA_MODULES.find(m => m.id === formData.module);
  
  // Formu aç
  const openForm = (sourceId?: string) => {
    if (sourceId) {
      const source = dataSources.find(s => s.id === sourceId);
      if (source) {
        setEditingSourceId(sourceId);
        setFormData({
          name: source.name,
          slug: source.slug,
          description: source.description || '',
          module: source.module,
          method: source.method,
          filters: source.filters || [],
          sorts: source.sorts || [],
          selected_columns: source.selected_columns || [],
          limit_count: source.limit_count || 0,
          cache_ttl: source.cache_ttl || 300,
          is_shared: source.is_shared || false,
          auto_refresh: source.auto_refresh || false,
          refresh_schedule: source.refresh_schedule || null,
          is_active: source.is_active ?? true,
          is_period_independent: source.is_period_independent ?? false,
          is_non_dia: source.is_non_dia ?? false,
        });
        setApiFilters((source.filters as DiaApiFilter[]) || []);
        setApiSorts((source.sorts as DiaApiSort[]) || []);
        setSelectedColumns(source.selected_columns || []);
        
        // Dönem ayarlarını yükle
        if (source.period_config) {
          setPeriodConfig(source.period_config as PeriodConfig);
        } else {
          setPeriodConfig(getDefaultPeriodConfig());
        }
        
        // Kayıtlı sampleData varsa, testResult'a yükle (akıllı filtre önerileri için)
        if (source.last_sample_data && Array.isArray(source.last_sample_data) && source.last_sample_data.length > 0) {
          setTestResult({
            success: true,
            recordCount: source.last_record_count || 0,
            sampleFields: (source.last_fields as string[]) || [],
            sampleData: source.last_sample_data as any[],
          });
        } else {
          setTestResult(null);
        }
      }
    } else {
      setEditingSourceId(null);
      setFormData({
        name: '',
        slug: '',
        description: '',
        module: 'scf',
        method: 'carikart_listele',
        filters: [],
        sorts: [],
        selected_columns: [],
        limit_count: 0,
        cache_ttl: 300,
        is_shared: false,
        auto_refresh: false,
        refresh_schedule: null,
        is_active: true,
        is_period_independent: false,
        is_non_dia: false,
      });
      setApiFilters([]);
      setApiSorts([]);
      setSelectedColumns([]);
      setPeriodConfig(getDefaultPeriodConfig());
      setTestResult(null);
    }
    setIsFormOpen(true);
  };
  
  // API testi
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testDiaApi({
        module: formData.module,
        method: formData.method,
        filters: apiFilters.length > 0 ? apiFilters : undefined,
        sorts: apiSorts.length > 0 ? apiSorts : undefined,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
        limit: formData.limit_count || 0,
        // Dönem ayarlarını ekle
        periodConfig: periodConfig.enabled ? periodConfig : undefined,
        // Filtre önerileri için tüm veriyi çek
        returnAllSampleData: true,
      });
      
      setTestResult(result);
      
      if (result.success) {
        const periodInfo = periodConfig.enabled && periodConfig.fetchHistorical 
          ? ` (${periodConfig.historicalCount} dönem tarandı)` 
          : '';
        toast.success(`API testi başarılı! ${result.recordCount} kayıt bulundu${periodInfo}.`);
        
        // Eğer mevcut bir kaynak düzenleniyorsa, sampleData'yı kaydet
        if (editingSourceId && result.sampleData) {
          await updateLastFetch(
            editingSourceId,
            result.recordCount || 0,
            result.sampleFields || [],
            result.sampleData
          );
        }
      } else {
        toast.error(`API hatası: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Beklenmeyen hata';
      toast.error(`Test başarısız: ${errorMessage}`);
      setTestResult({ success: false, error: errorMessage });
    } finally {
      setIsTesting(false);
    }
  };
  
  // Kaynak testi (listeden)
  const handleTestSource = async (sourceId: string) => {
    const source = dataSources.find(s => s.id === sourceId);
    if (!source) return;
    
    setTestingSourceId(sourceId);
    
    try {
      // Source'un period_config'ini al (eğer varsa)
      const sourcePeriodConfig = source.period_config as typeof periodConfig | undefined;
      
      const result = await testDiaApi({
        module: source.module,
        method: source.method,
        filters: (source.filters as DiaApiFilter[]) || undefined,
        sorts: (source.sorts as DiaApiSort[]) || undefined,
        selectedColumns: source.selected_columns || undefined,
        limit: source.limit_count || 0,
        // Dönem ayarlarını ekle
        periodConfig: sourcePeriodConfig?.enabled ? sourcePeriodConfig : undefined,
      });
      
      if (result.success) {
        // Son çekme bilgilerini güncelle (örnek veri dahil)
        await updateLastFetch(
          sourceId, 
          result.recordCount || 0, 
          result.sampleFields || [],
          result.sampleData || [] // Filtreleme için örnek veri
        );
        // Hızlı test sonucunu göster
        setQuickTestResult({ sourceId, recordCount: result.recordCount || 0 });
        setTimeout(() => setQuickTestResult(null), 5000);
        
        const periodInfo = sourcePeriodConfig?.enabled && sourcePeriodConfig?.fetchHistorical 
          ? ` (${sourcePeriodConfig.historicalCount} dönem)` 
          : '';
        toast.success(`${source.name}: ${result.recordCount} kayıt${periodInfo}`);
      } else {
        toast.error(`${source.name}: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Test başarısız`);
    } finally {
      setTestingSourceId(null);
    }
  };
  
  // Kaydet
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Kaynak adı zorunludur');
      return;
    }
    
    // Slug otomatik oluştur
    const slug = formData.slug || formData.name.toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const dataToSave: DataSourceFormData = {
      ...formData,
      slug,
      filters: apiFilters,
      sorts: apiSorts,
      selected_columns: selectedColumns,
      period_config: periodConfig.enabled ? periodConfig : undefined,
      // Dönem bağımsızlık: periodConfig kapalıysa veya açıkça işaretlenmişse
      is_period_independent: !periodConfig.enabled || formData.is_period_independent,
    };
    
    let savedSourceId: string | undefined;
    
    if (editingSourceId) {
      await updateDataSource(editingSourceId, dataToSave as Partial<DataSourceFormData>);
      savedSourceId = editingSourceId;
    } else {
      const newSource = await createDataSource(dataToSave);
      savedSourceId = newSource?.id;
    }
    
    // Test sonucu varsa (yeni veya mevcut kaynak için), sampleData'yı veritabanına kaydet
    if (savedSourceId && testResult?.success && testResult?.sampleData) {
      await updateLastFetch(
        savedSourceId,
        testResult.recordCount || 0,
        testResult.sampleFields || [],
        testResult.sampleData
      );
    }
    
    setIsFormOpen(false);
  };
  
  // Sil
  const handleDelete = async (sourceId: string) => {
    if (confirm('Bu veri kaynağını silmek istediğinize emin misiniz?')) {
      await deleteDataSource(sourceId);
    }
  };
  
  const formatLastFetch = (date: string | null) => {
    if (!date) return 'Hiç çekilmedi';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Merkezi Veri Kaynakları
          </h2>
          <p className="text-sm text-muted-foreground">
            DIA web servis sorgularını merkezi olarak yönetin ve paylaşın
          </p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kaynak
        </Button>
      </div>
      
      {/* Kaynak Listesi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Veri Kaynakları</CardTitle>
          <CardDescription>
            {activeDataSources.length} aktif kaynak
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dataSources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Henüz veri kaynağı tanımlanmadı</p>
              <Button variant="link" onClick={() => openForm()}>
                İlk kaynağı oluştur
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
                {dataSources.map(source => (
                  <div 
                    key={source.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      source.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{source.name}</p>
                        {source.is_non_dia && (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            Harici
                          </Badge>
                        )}
                        {source.is_period_independent && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Dönem Bağımsız
                          </Badge>
                        )}
                        {source.is_shared && (
                          <Badge variant="secondary" className="text-xs">
                            <Share2 className="h-3 w-3 mr-1" />
                            Paylaşımlı
                          </Badge>
                        )}
                        {!source.is_active && (
                          <Badge variant="destructive" className="text-xs">Pasif</Badge>
                        )}
                        {/* Hızlı test sonucu */}
                        {quickTestResult?.sourceId === source.id && (
                          <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {quickTestResult.recordCount} kayıt
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{source.module}.{source.method}</span>
                        <span>|</span>
                        <span>{source.last_record_count || 0} kayıt</span>
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          TTL: {source.cache_ttl}s
                        </span>
                        <span>|</span>
                        <span>{formatLastFetch(source.last_fetched_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        disabled={testingSourceId === source.id}
                        onClick={() => handleTestSource(source.id)}
                        title="Test Et"
                      >
                        {testingSourceId === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openForm(source.id)}
                        title="Düzenle"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(source.id)}
                        disabled={isDeleting}
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingSourceId ? 'Veri Kaynağı Düzenle' : 'Yeni Veri Kaynağı'}
            </DialogTitle>
            <DialogDescription>
              DIA web servis sorgu yapılandırmasını tanımlayın
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Temel Bilgiler */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Temel Bilgiler</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kaynak Adı *</Label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Örn: Cari Kart Listesi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug (opsiyonel)</Label>
                    <Input
                      value={formData.slug}
                      onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="cari_kart_listesi"
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Bu veri kaynağının amacı..."
                    rows={2}
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* API Ayarları */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">DIA API Ayarları</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Modül</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => setManualModuleMode(!manualModuleMode)}
                      >
                        {manualModuleMode ? 'Listeden Seç' : 'Manuel Gir'}
                      </Button>
                    </div>
                    {manualModuleMode ? (
                      <Input
                        value={formData.module}
                        onChange={e => setFormData(prev => ({ ...prev, module: e.target.value }))}
                        placeholder="Örn: scf, bcs, fat..."
                      />
                    ) : (
                      <Select 
                        value={formData.module} 
                        onValueChange={value => setFormData(prev => ({ 
                          ...prev, 
                          module: value,
                          method: DIA_MODULES.find(m => m.id === value)?.methods[0] || ''
                        }))}
                      >
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
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Metod</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => setManualMethodMode(!manualMethodMode)}
                      >
                        {manualMethodMode ? 'Listeden Seç' : 'Manuel Gir'}
                      </Button>
                    </div>
                    {manualMethodMode ? (
                      <Input
                        value={formData.method}
                        onChange={e => setFormData(prev => ({ ...prev, method: e.target.value }))}
                        placeholder="Örn: carikart_listele..."
                      />
                    ) : (
                      <Select 
                        value={formData.method} 
                        onValueChange={value => setFormData(prev => ({ ...prev, method: value }))}
                      >
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
                    )}
                  </div>
                </div>
                
                {/* Kompakt Bileşenler */}
                <div className="space-y-2">
                  <CompactColumnSelector
                    availableFields={testResult?.sampleFields || []}
                    selectedColumns={selectedColumns}
                    onChange={setSelectedColumns}
                    fieldTypes={testResult?.fieldTypes}
                    onExpandClick={() => setIsColumnSelectorOpen(true)}
                  />
                  
                  <FullscreenColumnSelector
                    open={isColumnSelectorOpen}
                    onOpenChange={setIsColumnSelectorOpen}
                    availableFields={testResult?.sampleFields || []}
                    selectedColumns={selectedColumns}
                    onChange={setSelectedColumns}
                    fieldTypes={testResult?.fieldTypes}
                  />
                  
                  <CompactFilterBuilder
                    filters={apiFilters}
                    onChange={setApiFilters}
                    availableFields={testResult?.sampleFields || []}
                    fieldTypes={testResult?.fieldTypes}
                    sampleData={testResult?.sampleData}
                  />
                  
                  <CompactSortBuilder
                    sorts={apiSorts}
                    onChange={setApiSorts}
                    availableFields={testResult?.sampleFields || []}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limit (0 = limitsiz)</Label>
                    <Input
                      type="number"
                      value={formData.limit_count || 0}
                      onChange={e => setFormData(prev => ({ 
                        ...prev, 
                        limit_count: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cache TTL (saniye)</Label>
                    <Input
                      type="number"
                      value={formData.cache_ttl || 300}
                      onChange={e => setFormData(prev => ({ 
                        ...prev, 
                        cache_ttl: parseInt(e.target.value) || 300 
                      }))}
                    />
                  </div>
                </div>
                
              </div>
              
              <Separator />
              
              {/* Dönem Ayarları */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Dönem Ayarları
                </h3>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Dönem Bağımlı Sorgu</Label>
                    <p className="text-xs text-muted-foreground">
                      Bu sorgu belirli dönemlere göre çalışır (ör: mali dönem)
                    </p>
                  </div>
                  <Switch
                    checked={periodConfig.enabled}
                    onCheckedChange={(checked) => 
                      setPeriodConfig(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>
                
                {periodConfig.enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dönem Alanı</Label>
                        <Input
                          value={periodConfig.periodField}
                          onChange={e => setPeriodConfig(prev => ({ 
                            ...prev, 
                            periodField: e.target.value 
                          }))}
                          placeholder="donem veya donemkodu"
                        />
                        <p className="text-xs text-muted-foreground">
                          DIA API'deki dönem parametre adı
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Mevcut Dönem</Label>
                        <Input
                          type="number"
                          value={periodConfig.currentPeriod || ''}
                          onChange={e => setPeriodConfig(prev => ({ 
                            ...prev, 
                            currentPeriod: parseInt(e.target.value) || undefined 
                          }))}
                          placeholder="Örn: 1, 2, 3..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Şu anki aktif dönem numarası
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label>Eski Dönemleri de Çek</Label>
                          <p className="text-xs text-muted-foreground">
                            Geriye doğru dönemleri loop ile çeker
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={periodConfig.fetchHistorical}
                        onCheckedChange={(checked) => 
                          setPeriodConfig(prev => ({ ...prev, fetchHistorical: checked }))
                        }
                      />
                    </div>
                    
                    {periodConfig.fetchHistorical && (
                      <div className="space-y-3 p-3 border rounded-lg bg-background">
                        <Label>Kaç Dönem Geriye Git?</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[periodConfig.historicalCount]}
                            onValueChange={([val]) => 
                              setPeriodConfig(prev => ({ ...prev, historicalCount: val }))
                            }
                            min={1}
                            max={24}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-sm font-mono w-10 text-center">
                            {periodConfig.historicalCount}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {periodConfig.currentPeriod 
                            ? `Dönem ${Math.max(1, periodConfig.currentPeriod - periodConfig.historicalCount + 1)} - ${periodConfig.currentPeriod} arası çekilecek`
                            : 'Mevcut dönem belirtilmedi'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Ayarlar */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Ek Ayarlar</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Paylaşımlı Kaynak</Label>
                      <p className="text-xs text-muted-foreground">
                        Diğer kullanıcılar da kullanabilir
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_shared}
                      onCheckedChange={checked => setFormData(prev => ({ 
                        ...prev, 
                        is_shared: checked 
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label>Aktif</Label>
                      <p className="text-xs text-muted-foreground">
                        Widget'larda kullanılabilir
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={checked => setFormData(prev => ({ 
                        ...prev, 
                        is_active: checked 
                      }))}
                    />
                  </div>
                </div>
                
                {/* Kaynak Tipi Ayarları */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>Dönem Bağımsız</Label>
                        <p className="text-xs text-muted-foreground">
                          Tüm dönemlerde aynı, bir kez çekilir
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.is_period_independent || !periodConfig.enabled}
                      onCheckedChange={checked => setFormData(prev => ({ 
                        ...prev, 
                        is_period_independent: checked 
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>DIA Dışı Kaynak</Label>
                        <p className="text-xs text-muted-foreground">
                          Harici API veya sabit veri
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.is_non_dia}
                      onCheckedChange={checked => setFormData(prev => ({ 
                        ...prev, 
                        is_non_dia: checked 
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          {/* Sabit API Test Bölümü */}
          <div className="flex-shrink-0 py-3 border-t bg-background space-y-2">
            <Button onClick={handleTest} disabled={isTesting} variant="secondary" className="w-full">
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Test Ediliyor...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  API Testi Yap
                </>
              )}
            </Button>
            
            {testResult && (
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-md text-sm",
                testResult.success 
                  ? 'bg-green-500/10 text-green-600' 
                  : 'bg-destructive/10 text-destructive'
              )}>
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{testResult.recordCount} kayıt · {testResult.sampleFields?.length || 0} alan</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{testResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSourceId ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}