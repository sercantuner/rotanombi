// Data Source Editor - Tam Sayfa Veri Kaynağı Oluşturma/Düzenleme
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataSources, DataSourceFormData } from '@/hooks/useDataSources';
import { testDiaApi, DiaApiTestResponse } from '@/lib/diaApiTest';
import { DiaApiFilter, DiaApiSort, DIA_MODULES, PeriodConfig, getDefaultPeriodConfig } from '@/lib/widgetBuilderTypes';
import { CompactFilterBuilder } from '@/components/admin/CompactFilterBuilder';
import { CompactSortBuilder } from '@/components/admin/CompactSortBuilder';
import { CompactColumnSelector } from '@/components/admin/CompactColumnSelector';
import { FullscreenColumnSelector } from '@/components/admin/FullscreenColumnSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Database, ArrowLeft, Play, Clock, CheckCircle, XCircle, Loader2, 
  CalendarClock, History, Globe, Calendar, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DataSourceEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const fromParam = searchParams.get('from');

  const { 
    dataSources, 
    createDataSource, 
    updateDataSource, 
    updateLastFetch,
    isCreating,
    isUpdating
  } = useDataSources();

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DiaApiTestResponse | null>(null);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [manualModuleMode, setManualModuleMode] = useState(false);
  const [manualMethodMode, setManualMethodMode] = useState(false);

  const [formData, setFormData] = useState<DataSourceFormData>({
    name: '', slug: '', description: '', module: 'scf', method: 'carikart_listele',
    filters: [], sorts: [], selected_columns: [], limit_count: 0, cache_ttl: 300,
    is_shared: false, auto_refresh: false, refresh_schedule: null, is_active: true,
    is_period_independent: false, is_non_dia: false,
  });

  const [apiFilters, setApiFilters] = useState<DiaApiFilter[]>([]);
  const [apiSorts, setApiSorts] = useState<DiaApiSort[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig>(getDefaultPeriodConfig());

  // Edit modunda mevcut kaynağı yükle
  useEffect(() => {
    if (editId && dataSources.length > 0) {
      const source = dataSources.find(s => s.id === editId);
      if (source) {
        setFormData({
          name: source.name, slug: source.slug, description: source.description || '',
          module: source.module, method: source.method,
          filters: source.filters || [], sorts: source.sorts || [],
          selected_columns: source.selected_columns || [],
          limit_count: source.limit_count || 0, cache_ttl: source.cache_ttl || 300,
          is_shared: source.is_shared || false, auto_refresh: source.auto_refresh || false,
          refresh_schedule: source.refresh_schedule || null,
          is_active: source.is_active ?? true,
          is_period_independent: source.is_period_independent ?? false,
          is_non_dia: source.is_non_dia ?? false,
        });
        setApiFilters((source.filters as DiaApiFilter[]) || []);
        setApiSorts((source.sorts as DiaApiSort[]) || []);
        setSelectedColumns(source.selected_columns || []);
        if (source.period_config) {
          setPeriodConfig(source.period_config as PeriodConfig);
        }
        if (source.last_sample_data && Array.isArray(source.last_sample_data) && source.last_sample_data.length > 0) {
          setTestResult({
            success: true,
            recordCount: source.last_record_count || 0,
            sampleFields: (source.last_fields as string[]) || [],
            sampleData: source.last_sample_data as any[],
          });
        }
      }
    }
  }, [editId, dataSources]);

  const currentModule = DIA_MODULES.find(m => m.id === formData.module);

  const getReturnPath = () => {
    if (fromParam === 'super-admin') return '/super-admin-panel?tab=datasources';
    return '/super-admin-panel?tab=datasources';
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testDiaApi({
        module: formData.module, method: formData.method,
        filters: apiFilters.length > 0 ? apiFilters : undefined,
        sorts: apiSorts.length > 0 ? apiSorts : undefined,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
        limit: formData.limit_count || 0,
        periodConfig: periodConfig.enabled ? periodConfig : undefined,
        returnAllSampleData: true,
      });
      setTestResult(result);
      if (result.success) {
        toast.success(`API testi başarılı! ${result.recordCount} kayıt bulundu.`);
        if (editId && result.sampleData) {
          await updateLastFetch(editId, result.recordCount || 0, result.sampleFields || [], result.sampleData);
        }
      } else {
        toast.error(`API hatası: ${result.error}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Beklenmeyen hata';
      toast.error(`Test başarısız: ${msg}`);
      setTestResult({ success: false, error: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Kaynak adı zorunludur'); return; }
    const slug = formData.slug || formData.name.toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    
    const dataToSave: DataSourceFormData = {
      ...formData, slug, filters: apiFilters, sorts: apiSorts, selected_columns: selectedColumns,
      period_config: periodConfig.enabled ? periodConfig : undefined,
      is_period_independent: !periodConfig.enabled || formData.is_period_independent,
    };

    let savedId: string | undefined;
    if (editId) {
      await updateDataSource(editId, dataToSave as Partial<DataSourceFormData>);
      savedId = editId;
    } else {
      const newSource = await createDataSource(dataToSave);
      savedId = newSource?.id;
    }
    if (savedId && testResult?.success && testResult?.sampleData) {
      await updateLastFetch(savedId, testResult.recordCount || 0, testResult.sampleFields || [], testResult.sampleData);
    }
    navigate(getReturnPath());
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(getReturnPath())}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Database className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold">
                {editId ? 'Veri Kaynağı Düzenle' : 'Yeni Veri Kaynağı'}
              </h1>
              <p className="text-xs text-muted-foreground hidden md:block">
                DIA web servis sorgu yapılandırması
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
              {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Test
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editId ? 'Güncelle' : 'Oluştur'}
            </Button>
          </div>
        </div>
        {/* Test result bar */}
        {testResult && (
          <div className={cn(
            "flex items-center gap-2 px-6 py-2 text-sm border-t",
            testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
          )}>
            {testResult.success ? (
              <><CheckCircle className="h-4 w-4" /><span>{testResult.recordCount} kayıt · {testResult.sampleFields?.length || 0} alan</span></>
            ) : (
              <><XCircle className="h-4 w-4" /><span className="truncate">{testResult.error}</span></>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          {/* Temel Bilgiler */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Temel Bilgiler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kaynak Adı *</Label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Örn: Cari Kart Listesi" />
              </div>
              <div className="space-y-2">
                <Label>Slug (opsiyonel)</Label>
                <Input value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} placeholder="cari_kart_listesi" className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Bu veri kaynağının amacı..." rows={2} />
            </div>
          </div>

          <Separator />

          {/* API Ayarları */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">DIA API Ayarları</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Modül</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setManualModuleMode(!manualModuleMode)}>
                    {manualModuleMode ? 'Listeden Seç' : 'Manuel Gir'}
                  </Button>
                </div>
                {manualModuleMode ? (
                  <Input value={formData.module} onChange={e => setFormData(p => ({ ...p, module: e.target.value }))} placeholder="Örn: scf, bcs..." />
                ) : (
                  <Select value={formData.module} onValueChange={v => setFormData(p => ({ ...p, module: v, method: DIA_MODULES.find(m => m.id === v)?.methods[0] || '' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DIA_MODULES.map(mod => <SelectItem key={mod.id} value={mod.id}>{mod.name} ({mod.id})</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Metod</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setManualMethodMode(!manualMethodMode)}>
                    {manualMethodMode ? 'Listeden Seç' : 'Manuel Gir'}
                  </Button>
                </div>
                {manualMethodMode ? (
                  <Input value={formData.method} onChange={e => setFormData(p => ({ ...p, method: e.target.value }))} placeholder="Örn: carikart_listele..." />
                ) : (
                  <Select value={formData.method} onValueChange={v => setFormData(p => ({ ...p, method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{currentModule?.methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Kompakt Bileşenler */}
            <div className="space-y-2">
              <CompactColumnSelector availableFields={testResult?.sampleFields || []} selectedColumns={selectedColumns} onChange={setSelectedColumns} fieldTypes={testResult?.fieldTypes} onExpandClick={() => setIsColumnSelectorOpen(true)} />
              <FullscreenColumnSelector open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen} availableFields={testResult?.sampleFields || []} selectedColumns={selectedColumns} onChange={setSelectedColumns} fieldTypes={testResult?.fieldTypes} />
              <CompactFilterBuilder filters={apiFilters} onChange={setApiFilters} availableFields={testResult?.sampleFields || []} fieldTypes={testResult?.fieldTypes} sampleData={testResult?.sampleData} />
              <CompactSortBuilder sorts={apiSorts} onChange={setApiSorts} availableFields={testResult?.sampleFields || []} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Limit (0 = limitsiz)</Label>
                <Input type="number" value={formData.limit_count || 0} onChange={e => setFormData(p => ({ ...p, limit_count: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Cache TTL (saniye)</Label>
                <Input type="number" value={formData.cache_ttl || 300} onChange={e => setFormData(p => ({ ...p, cache_ttl: parseInt(e.target.value) || 300 }))} />
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
                <p className="text-xs text-muted-foreground">Bu sorgu belirli dönemlere göre çalışır</p>
              </div>
              <Switch checked={periodConfig.enabled} onCheckedChange={c => setPeriodConfig(p => ({ ...p, enabled: c }))} />
            </div>
            {periodConfig.enabled && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dönem Alanı</Label>
                    <Input value={periodConfig.periodField} onChange={e => setPeriodConfig(p => ({ ...p, periodField: e.target.value }))} placeholder="donem veya donemkodu" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mevcut Dönem</Label>
                    <Input type="number" value={periodConfig.currentPeriod || ''} onChange={e => setPeriodConfig(p => ({ ...p, currentPeriod: parseInt(e.target.value) || undefined }))} placeholder="Örn: 1, 2, 3..." />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label>Eski Dönemleri de Çek</Label>
                      <p className="text-xs text-muted-foreground">Geriye doğru dönemleri loop ile çeker</p>
                    </div>
                  </div>
                  <Switch checked={periodConfig.fetchHistorical} onCheckedChange={c => setPeriodConfig(p => ({ ...p, fetchHistorical: c }))} />
                </div>
                {periodConfig.fetchHistorical && (
                  <div className="space-y-3 p-3 border rounded-lg bg-background">
                    <Label>Kaç Dönem Geriye Git?</Label>
                    <div className="flex items-center gap-4">
                      <Slider value={[periodConfig.historicalCount]} onValueChange={([v]) => setPeriodConfig(p => ({ ...p, historicalCount: v }))} min={1} max={24} step={1} className="flex-1" />
                      <span className="text-sm font-mono w-10 text-center">{periodConfig.historicalCount}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Ek Ayarlar */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Ek Ayarlar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div><Label>Paylaşımlı Kaynak</Label><p className="text-xs text-muted-foreground">Diğer kullanıcılar da kullanabilir</p></div>
                <Switch checked={formData.is_shared} onCheckedChange={c => setFormData(p => ({ ...p, is_shared: c }))} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div><Label>Aktif</Label><p className="text-xs text-muted-foreground">Widget'larda kullanılabilir</p></div>
                <Switch checked={formData.is_active} onCheckedChange={c => setFormData(p => ({ ...p, is_active: c }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div><Label>Dönem Bağımsız</Label><p className="text-xs text-muted-foreground">Tüm dönemlerde aynı, bir kez çekilir</p></div>
                </div>
                <Switch checked={formData.is_period_independent || !periodConfig.enabled} onCheckedChange={c => setFormData(p => ({ ...p, is_period_independent: c }))} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div><Label>DIA Dışı Kaynak</Label><p className="text-xs text-muted-foreground">Harici API veya sabit veri</p></div>
                </div>
                <Switch checked={formData.is_non_dia} onCheckedChange={c => setFormData(p => ({ ...p, is_non_dia: c }))} />
              </div>
            </div>
          </div>
          
          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}
