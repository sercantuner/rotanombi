// Super Admin Data Management - Sunucu bazında gelişmiş veri yönetimi
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDataSources } from '@/hooks/useDataSources';
import { useSyncOrchestratorContext } from '@/contexts/SyncOrchestratorContext';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { 
  Database, HardDrive, Server, Search, Trash2, 
  Loader2, RefreshCw, AlertCircle, CheckCircle2, BarChart3,
  Clock, Calendar, ChevronDown, ChevronRight, Ban, Undo2, Zap, Link2,
  StopCircle, ArrowDownToLine, ArrowUpFromLine, Layers, SkipForward
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  dia_sunucu_adi: string | null;
  firma_adi: string | null;
  firma_kodu?: string | null;
  donem_kodu?: string | null;
  donem_yili?: string | null;
  roles?: { role: string; user_id: string }[];
}

interface Props {
  users: UserProfile[];
}

interface ServerOption {
  sunucu_adi: string;
  firma_kodu: string;
  firma_adi: string | null;
  userCount: number;
  userEmails: string[];
}

interface DataSourceStats {
  slug: string;
  name: string;
  count: number;
  module?: string;
  method?: string;
  isPeriodIndependent?: boolean;
  lastFetched?: string | null;
}

interface PeriodInfo {
  period_no: number;
  period_name: string | null;
  is_current: boolean | null;
}

interface PeriodDistribution {
  total: number;
  byPeriod: Record<number, number>;
}

interface SyncHistoryItem {
  id: string;
  data_source_slug: string;
  sync_type: string;
  status: string;
  records_fetched: number | null;
  records_inserted: number | null;
  records_updated: number | null;
  records_deleted: number | null;
  started_at: string;
  error: string | null;
}

interface WidgetUsage {
  [dataSourceSlug: string]: number;
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    case 'running': return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />;
    case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
    case 'skipped': return <SkipForward className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  }
}

function TaskTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'full': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1"><Layers className="w-2.5 h-2.5" />Tam</Badge>;
    case 'incremental': return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1"><Zap className="w-2.5 h-2.5" />Artımlı</Badge>;
    case 'reconcile': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-orange-500/30 text-orange-600"><Trash2 className="w-2.5 h-2.5" />Kontrol</Badge>;
    default: return null;
  }
}

export default function SuperAdminDataManagement({ users }: Props) {
  const { dataSources } = useDataSources();
  const { progress, startFullOrchestration, quickSync, abort } = useSyncOrchestratorContext();
  const diaProfile = useDiaProfile();
  const [selectedServer, setSelectedServer] = useState<ServerOption | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<DataSourceStats[]>([]);
  const [allDataSources, setAllDataSources] = useState<DataSourceStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [periodDistributions, setPeriodDistributions] = useState<Record<string, PeriodDistribution>>({});
  const [expandedDistributions, setExpandedDistributions] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState(true);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [widgetUsage, setWidgetUsage] = useState<WidgetUsage>({});
  const [excludedPeriods, setExcludedPeriods] = useState<{ donem_kodu: number; data_source_slug: string | null }[]>([]);
  const [diaRecordCounts, setDiaRecordCounts] = useState<Record<string, Record<number, number>>>({});
  const [loadingDiaCounts, setLoadingDiaCounts] = useState<Record<string, boolean>>({});

  // Seçili sunucunun sahibi kullanıcıyı bul (sync için targetUserId olarak kullanılacak)
  const getTargetUserId = useCallback((): string | undefined => {
    if (!selectedServer) return undefined;
    const ownerUser = users.find(u => u.dia_sunucu_adi === selectedServer.sunucu_adi && u.firma_kodu === selectedServer.firma_kodu);
    return ownerUser?.user_id;
  }, [selectedServer, users]);

  const targetUserId = selectedServer ? getTargetUserId() : undefined;

  // Sunucu listesini kullanıcılardan derle
  const serverOptions: ServerOption[] = React.useMemo(() => {
    const map = new Map<string, ServerOption>();
    users.forEach(u => {
      if (!u.dia_sunucu_adi || !u.firma_kodu) return;
      const key = `${u.dia_sunucu_adi}::${u.firma_kodu}`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.userCount++;
        if (u.email) existing.userEmails.push(u.email);
        if (!existing.firma_adi && u.firma_adi) existing.firma_adi = u.firma_adi;
      } else {
        map.set(key, {
          sunucu_adi: u.dia_sunucu_adi,
          firma_kodu: u.firma_kodu,
          firma_adi: u.firma_adi || null,
          userCount: 1,
          userEmails: u.email ? [u.email] : [],
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.sunucu_adi.localeCompare(b.sunucu_adi));
  }, [users]);

  const filteredServers = serverOptions.filter(s =>
    s.sunucu_adi.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.firma_kodu.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.firma_adi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.userEmails.some(e => e.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Henüz sync yok';
    try { return formatDistanceToNow(new Date(time), { addSuffix: true, locale: tr }); }
    catch { return 'Bilinmiyor'; }
  };

  const loadServerData = useCallback(async (server: ServerOption) => {
    setLoading(true);
    try {
      const sunucuAdi = server.sunucu_adi;
      const firmaKodu = server.firma_kodu;

      const [cacheRes, periodsRes, syncRes, excludedRes, widgetRes, allDsRes] = await Promise.all([
        supabase.rpc('get_cache_record_counts', {
          p_sunucu_adi: sunucuAdi,
          p_firma_kodu: firmaKodu,
        }),
        supabase.from('firma_periods')
          .select('period_no, period_name, is_current')
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .order('period_no', { ascending: true }),
        supabase.from('sync_history')
          .select('*')
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .order('started_at', { ascending: false })
          .limit(30),
        supabase.from('excluded_periods')
          .select('donem_kodu, data_source_slug')
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu),
        supabase.from('widgets')
          .select('data_source, builder_config, name')
          .eq('is_active', true),
        supabase.from('data_sources')
          .select('id, slug, name, module, method, is_period_independent, last_fetched_at, is_active')
          .eq('is_active', true),
      ]);

      // Cache stats
      const cacheData = cacheRes.data || [];
      const cacheMap = new Map<string, number>();
      cacheData.forEach((d: any) => cacheMap.set(d.data_source_slug, d.record_count));

      const result: DataSourceStats[] = cacheData.map((d: any) => {
        const ds = (allDsRes.data || []).find((s: any) => s.slug === d.data_source_slug) || dataSources.find(s => s.slug === d.data_source_slug);
        return {
          slug: d.data_source_slug,
          name: ds?.name || d.data_source_slug,
          count: d.record_count,
          module: ds?.module,
          method: ds?.method,
          isPeriodIndependent: ds?.is_period_independent || false,
          lastFetched: ds?.last_fetched_at,
        };
      });
      setStats(result.sort((a, b) => b.count - a.count));

      const allDs: DataSourceStats[] = (allDsRes.data || []).map((ds: any) => ({
        slug: ds.slug,
        name: ds.name,
        count: cacheMap.get(ds.slug) || 0,
        module: ds.module,
        method: ds.method,
        isPeriodIndependent: ds.is_period_independent,
        lastFetched: ds.last_fetched_at,
      }));
      setAllDataSources(allDs.sort((a, b) => b.count - a.count));

      setPeriods(periodsRes.data || []);
      setSyncHistory(syncRes.data || []);
      setExcludedPeriods((excludedRes.data || []).map((e: any) => ({
        donem_kodu: e.donem_kodu,
        data_source_slug: e.data_source_slug,
      })));

      // Widget usage
      const allDsList = allDsRes.data || [];
      const dsIdToSlug = new Map<string, string>();
      allDsList.forEach((ds: any) => {
        dsIdToSlug.set(ds.id, ds.slug);
        dsIdToSlug.set(ds.slug, ds.slug);
      });
      dataSources.forEach(ds => {
        dsIdToSlug.set(ds.id, ds.slug);
        dsIdToSlug.set(ds.slug, ds.slug);
      });

      const usage: WidgetUsage = {};
      (widgetRes.data || []).forEach((w: any) => {
        if (w.data_source) {
          const slug = dsIdToSlug.get(w.data_source) || w.data_source;
          usage[slug] = (usage[slug] || 0) + 1;
        }
        if (w.builder_config?.dataSourceId) {
          const slug = dsIdToSlug.get(w.builder_config.dataSourceId);
          if (slug) usage[slug] = (usage[slug] || 0) + 1;
        }
        if (w.builder_config?.multiQuery?.queries) {
          w.builder_config.multiQuery.queries.forEach((q: any) => {
            if (q.dataSourceId) {
              const slug = dsIdToSlug.get(q.dataSourceId);
              if (slug) usage[slug] = (usage[slug] || 0) + 1;
            }
          });
        }
      });
      setWidgetUsage(usage);

      // Period distributions via RPC (no row limit, bypasses RLS)
      const distributions: Record<string, PeriodDistribution> = {};
      const distPromises = result.map(async (s) => {
        const { data: distData } = await supabase.rpc('get_period_distribution', {
          p_sunucu_adi: sunucuAdi,
          p_firma_kodu: firmaKodu,
          p_data_source_slug: s.slug,
        });
        if (distData && distData.length > 0) {
          const byPeriod: Record<number, number> = {};
          let total = 0;
          distData.forEach((row: any) => {
            byPeriod[row.donem_kodu] = Number(row.record_count);
            total += Number(row.record_count);
          });
          distributions[s.slug] = { total, byPeriod };
        }
      });
      await Promise.all(distPromises);
      setPeriodDistributions(distributions);
    } catch (err) {
      console.error('Error loading server data:', err);
      toast.error('Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [dataSources, users]);

  const handleSelectServer = (server: ServerOption) => {
    setSelectedServer(server);
    setSearchOpen(false);
    setExpandedDistributions({});
    loadServerData(server);
  };

  const handleDeleteDataSource = async () => {
    if (!selectedServer || !deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('company_data_cache').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu)
        .eq('data_source_slug', deleteTarget.slug);
      await supabase.from('period_sync_status').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu)
        .eq('data_source_slug', deleteTarget.slug);
      toast.success(`${deleteTarget.name} verileri silindi`);
      setDeleteTarget(null);
      loadServerData(selectedServer);
    } catch (err) {
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!selectedServer) return;
    setDeleting(true);
    try {
      await supabase.from('company_data_cache').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu);
      await supabase.from('period_sync_status').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu);
      await supabase.from('sync_history').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu);
      toast.success('Tüm veriler silindi');
      setDeleteAllConfirm(false);
      loadServerData(selectedServer);
    } catch (err) {
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleting(false);
    }
  };

  const handleExcludePeriod = async (donemKodu: number, dataSourceSlug: string) => {
    if (!selectedServer) return;
    try {
      const ownerUser = users.find(u => u.dia_sunucu_adi === selectedServer.sunucu_adi && u.firma_kodu === selectedServer.firma_kodu);
      await supabase.from('excluded_periods').insert({
        sunucu_adi: selectedServer.sunucu_adi,
        firma_kodu: selectedServer.firma_kodu,
        donem_kodu: donemKodu,
        data_source_slug: dataSourceSlug,
        excluded_by: ownerUser?.user_id || '',
      });
      await supabase.from('company_data_cache').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu)
        .eq('data_source_slug', dataSourceSlug)
        .eq('donem_kodu', donemKodu);
      toast.success(`Dönem ${donemKodu} hariç tutuldu`);
      loadServerData(selectedServer);
    } catch (err) {
      toast.error('İşlem başarısız');
    }
  };

  const handleIncludePeriod = async (donemKodu: number, dataSourceSlug: string) => {
    if (!selectedServer) return;
    try {
      await supabase.from('excluded_periods').delete()
        .eq('sunucu_adi', selectedServer.sunucu_adi)
        .eq('firma_kodu', selectedServer.firma_kodu)
        .eq('donem_kodu', donemKodu)
        .eq('data_source_slug', dataSourceSlug);
      toast.success(`Dönem ${donemKodu} dahil edildi`);
      loadServerData(selectedServer);
    } catch (err) {
      toast.error('İşlem başarısız');
    }
  };

  const isExcluded = (donemKodu: number, slug: string) =>
    excludedPeriods.some(e => e.donem_kodu === donemKodu && (e.data_source_slug === slug || e.data_source_slug === null));

  // DIA'dan anlık kayıt sayısı çek (sadece _key ile)
  const fetchDiaRecordCount = async (dsSlug: string) => {
    if (!selectedServer || !targetUserId || periods.length === 0) return;
    setLoadingDiaCounts(prev => ({ ...prev, [dsSlug]: true }));
    try {
      const sources = periods.map(p => ({ slug: dsSlug, periodNo: p.period_no }));
      const { data, error } = await supabase.functions.invoke('dia-data-sync', {
        body: {
          action: 'getRecordCounts',
          sources,
          targetUserId,
        },
      });
      if (error) throw error;
      if (data?.success && data.counts) {
        const byPeriod: Record<number, number> = {};
        for (const p of periods) {
          const key = `${dsSlug}_${p.period_no}`;
          byPeriod[p.period_no] = data.counts[key] || 0;
        }
        setDiaRecordCounts(prev => ({ ...prev, [dsSlug]: byPeriod }));
        const total = Object.values(byPeriod).reduce((s, c) => s + c, 0);
        toast.success(`${dsSlug}: DIA'da toplam ${total.toLocaleString('tr-TR')} kayıt`);
      }
    } catch (err) {
      console.error('DIA record count error:', err);
      toast.error('DIA kayıt sayısı alınamadı');
    } finally {
      setLoadingDiaCounts(prev => ({ ...prev, [dsSlug]: false }));
    }
  };

  const totalRecords = stats.reduce((sum, s) => sum + s.count, 0);
  const currentPeriod = periods.find(p => p.is_current);

  const completedTasks = progress.tasks.filter(t => t.status === 'completed');
  const failedTasks = progress.tasks.filter(t => t.status === 'failed');
  const skippedTasks = progress.tasks.filter(t => t.status === 'skipped');
  const runningTask = progress.tasks.find(t => t.status === 'running');
  const activeTasks = progress.tasks.filter(t => t.status !== 'skipped');

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Server Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />
            Sunucu Seçimi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start h-10">
                <Search className="w-4 h-4 mr-2 shrink-0" />
                {selectedServer ? (
                  <span className="truncate">
                    {selectedServer.sunucu_adi} — Firma: {selectedServer.firma_kodu}
                    {selectedServer.firma_adi && ` (${selectedServer.firma_adi})`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sunucu seçin...</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Sunucu, firma veya e-posta ara..." value={searchTerm} onValueChange={setSearchTerm} />
                <CommandList>
                  <CommandEmpty>Sunucu bulunamadı</CommandEmpty>
                  <CommandGroup>
                    {filteredServers.slice(0, 20).map(server => (
                      <CommandItem
                        key={`${server.sunucu_adi}::${server.firma_kodu}`}
                        value={`${server.sunucu_adi} ${server.firma_kodu} ${server.firma_adi} ${server.userEmails.join(' ')}`}
                        onSelect={() => handleSelectServer(server)}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Server className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {server.sunucu_adi}
                            <span className="text-muted-foreground font-normal"> — Firma {server.firma_kodu}</span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {server.firma_adi && `${server.firma_adi} • `}
                            {server.userCount} kullanıcı
                            {server.userEmails.length > 0 && ` • ${server.userEmails[0]}`}
                            {server.userEmails.length > 1 && ` +${server.userEmails.length - 1}`}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Server Data */}
      {selectedServer && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Sync Controls */}
              {targetUserId && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Veri Senkronizasyonu</h3>
                          <p className="text-xs text-muted-foreground">
                            DIA'dan çekilen veriler yerel veritabanında saklanır
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {progress.isRunning ? (
                          <Button onClick={abort} variant="destructive" size="sm" className="gap-2">
                            <StopCircle className="h-4 w-4" />
                            Durdur
                          </Button>
                        ) : (
                          <Button onClick={() => startFullOrchestration(false, targetUserId)} disabled={progress.isRunning} size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Tümünü Senkronize Et
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Orchestrator Progress */}
                    {progress.isRunning && (
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            {runningTask ? (
                              <>
                                {runningTask.name}
                                <Badge variant="outline" className="text-[10px]">D{runningTask.periodNo}</Badge>
                                <TaskTypeBadge type={runningTask.type} />
                              </>
                            ) : 'Hazırlanıyor...'}
                          </span>
                          <span className="text-sm font-mono text-muted-foreground">%{progress.overallPercent}</span>
                        </div>
                        
                        <Progress value={progress.overallPercent} className="h-2" />
                        
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ArrowDownToLine className="h-3 w-3" />
                            {progress.totalFetched.toLocaleString('tr-TR')}{progress.totalExpected > 0 ? ` / ${progress.totalExpected.toLocaleString('tr-TR')}` : ''} çekildi
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowUpFromLine className="h-3 w-3" />
                            {progress.totalWritten.toLocaleString('tr-TR')} yazıldı
                          </span>
                          {progress.totalDeleted > 0 && (
                            <span className="flex items-center gap-1 text-orange-500">
                              <Trash2 className="h-3 w-3" />
                              {progress.totalDeleted.toLocaleString('tr-TR')} silindi
                            </span>
                          )}
                          <span className="ml-auto">
                            {completedTasks.length}/{activeTasks.length} görev
                          </span>
                        </div>

                        {/* Running task chunk detail */}
                        {runningTask && (runningTask.fetched > 0 || runningTask.expectedRecords > 0) && (
                          <div className="p-2 rounded bg-secondary/40 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {runningTask.name} • Dönem {runningTask.periodNo}
                                {runningTask.localRecords > 0 && runningTask.localRecords < runningTask.expectedRecords && (
                                  <span className="text-primary/70 ml-1">(kaldığı yerden devam)</span>
                                )}
                              </span>
                              <span className="text-muted-foreground font-mono">
                                {(runningTask.localRecords + runningTask.fetched).toLocaleString('tr-TR')}{runningTask.expectedRecords > 0 ? ` / ${runningTask.expectedRecords.toLocaleString('tr-TR')}` : ''} kayıt
                              </span>
                            </div>
                            {runningTask.expectedRecords > 0 && (
                              <Progress value={Math.min(100, Math.round(((runningTask.localRecords + runningTask.fetched) / runningTask.expectedRecords) * 100))} className="h-1" />
                            )}
                          </div>
                        )}

                        {/* Collapsible task list */}
                        <div>
                          <button
                            onClick={() => setExpandedTasks(!expandedTasks)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {expandedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Tüm görevler ({activeTasks.length})
                          </button>

                          {expandedTasks && (
                            <ScrollArea className="max-h-48 mt-2">
                              <div className="space-y-1">
                                {progress.tasks.map((task, idx) => (
                                  <div
                                    key={`${task.slug}-${task.periodNo}-${idx}`}
                                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors ${
                                      task.status === 'running' ? 'bg-primary/10 border border-primary/20' :
                                      task.status === 'completed' ? 'bg-green-500/5' :
                                      task.status === 'failed' ? 'bg-destructive/5' :
                                      task.status === 'skipped' ? 'opacity-50' : ''
                                    }`}
                                  >
                                    <TaskStatusIcon status={task.status} />
                                    <span className="truncate flex-1 font-medium">{task.name}</span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">D{task.periodNo}</Badge>
                                    <TaskTypeBadge type={task.type} />
                                    
                                    {(task.status === 'completed' || task.status === 'running') && task.fetched > 0 && (
                                      <span className="text-muted-foreground font-mono shrink-0 flex items-center gap-1.5">
                                        <span className="flex items-center gap-0.5">
                                          <ArrowDownToLine className="h-2.5 w-2.5" />{task.fetched}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                          <ArrowUpFromLine className="h-2.5 w-2.5" />{task.written}
                                        </span>
                                        {task.deleted > 0 && (
                                          <span className="flex items-center gap-0.5 text-orange-500">
                                            <Trash2 className="h-2.5 w-2.5" />{task.deleted}
                                          </span>
                                        )}
                                      </span>
                                    )}

                                    {task.status === 'failed' && task.error && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <p className="text-xs">{task.error}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}

                                    {task.status === 'skipped' && (
                                      <span className="text-yellow-600 text-[10px]">Atlandı</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Completed summary */}
                    {!progress.isRunning && progress.tasks.length > 0 && progress.overallPercent === 100 && (
                      <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Senkronizasyon Tamamlandı
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>✅ {completedTasks.length} başarılı</span>
                          {failedTasks.length > 0 && <span className="text-destructive">❌ {failedTasks.length} başarısız</span>}
                          {skippedTasks.length > 0 && <span className="text-yellow-600">⏭ {skippedTasks.length} atlandı</span>}
                          <span>📥 {progress.totalFetched.toLocaleString('tr-TR')} çekildi</span>
                          <span>📤 {progress.totalWritten.toLocaleString('tr-TR')} yazıldı</span>
                          {progress.totalDeleted > 0 && <span>🗑 {progress.totalDeleted.toLocaleString('tr-TR')} silindi</span>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* No DIA user notice */}
              {!targetUserId && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Bu sunucuya ait DIA bağlantısı olan kullanıcı bulunamadı. Senkronizasyon yapılamaz.
                </div>
              )}

              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <HardDrive className="h-4 w-4" />
                      <span className="text-xs">Veri Kaynakları</span>
                    </div>
                    <p className="text-2xl font-bold">{allDataSources.length}</p>
                    <p className="text-xs text-muted-foreground">{allDataSources.filter(d => d.count > 0).length} veri çekmiş</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Link2 className="h-4 w-4" />
                      <span className="text-xs">Widget Kullanan</span>
                    </div>
                    <p className="text-2xl font-bold">{allDataSources.filter(d => (widgetUsage[d.slug] || 0) > 0).length}</p>
                    <p className="text-xs text-muted-foreground">{allDataSources.filter(d => (widgetUsage[d.slug] || 0) === 0).length} kullanılmıyor</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs">Toplam Kayıt</span>
                    </div>
                    <p className="text-2xl font-bold">{totalRecords.toLocaleString('tr-TR')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Aktif Dönem</span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {currentPeriod ? currentPeriod.period_name || `D${currentPeriod.period_no}` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">{periods.length} dönem</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 flex flex-col">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Trash2 className="h-4 w-4" />
                      <span className="text-xs">İşlemler</span>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <Button size="sm" variant="outline" onClick={() => loadServerData(selectedServer)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteAllConfirm(true)} disabled={totalRecords === 0}>
                        Tümünü Sil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* All Data Sources */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Tüm Veri Kaynakları ({allDataSources.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {allDataSources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>Bu sunucu için veri kaynağı bulunamadı</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                        {allDataSources.map(ds => {
                          const distribution = periodDistributions[ds.slug];
                          const isExpanded = expandedDistributions[ds.slug];
                          const widgetCount = widgetUsage[ds.slug] || 0;
                          const isCurrentlySyncing = progress.isRunning && progress.tasks.some(t => t.slug === ds.slug && t.status === 'running');

                          return (
                            <div key={ds.slug} className="space-y-1">
                              <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                isCurrentlySyncing ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30 hover:bg-secondary/50'
                              }`}>
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className={`p-1.5 rounded ${ds.count > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
                                    {isCurrentlySyncing ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    ) : ds.count > 0 ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate text-sm">{ds.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{ds.module}/{ds.method}</span>
                                      {ds.isPeriodIndependent && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">Dönem Bağımsız</Badge>
                                      )}
                                      {ds.lastFetched && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <span className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              {formatSyncTime(ds.lastFetched)}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {format(new Date(ds.lastFetched), 'dd MMM yyyy HH:mm', { locale: tr })}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant={widgetCount > 0 ? 'default' : 'outline'} className="text-[10px] gap-1">
                                        <Link2 className="h-2.5 w-2.5" />
                                        {widgetCount} widget
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>Bu kaynağı kullanan widget sayısı</TooltipContent>
                                  </Tooltip>

                                  <Badge variant="outline" className="font-mono text-xs">
                                    {ds.count.toLocaleString('tr-TR')} kayıt
                                  </Badge>
                                  {diaRecordCounts[ds.slug] && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge 
                                          variant={Object.values(diaRecordCounts[ds.slug]).reduce((s, c) => s + c, 0) !== ds.count ? 'destructive' : 'secondary'} 
                                          className="font-mono text-[10px]"
                                        >
                                          DIA: {Object.values(diaRecordCounts[ds.slug]).reduce((s, c) => s + c, 0).toLocaleString('tr-TR')}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {Object.values(diaRecordCounts[ds.slug]).reduce((s, c) => s + c, 0) === ds.count
                                          ? 'DIA ile eşleşiyor ✓'
                                          : `Fark: ${(Object.values(diaRecordCounts[ds.slug]).reduce((s, c) => s + c, 0) - ds.count).toLocaleString('tr-TR')}`
                                        }
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {distribution && distribution.total > 0 && (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                      onClick={() => setExpandedDistributions(prev => ({ ...prev, [ds.slug]: !prev[ds.slug] }))}
                                    >
                                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                  )}

                                  {/* Quick sync button */}
                                  {targetUserId && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const pn = currentPeriod?.period_no || 0;
                                            if (pn) quickSync(ds.slug, pn, targetUserId);
                                          }}
                                          disabled={isCurrentlySyncing || progress.isRunning}
                                          className="h-8 w-8 p-0"
                                        >
                                          {isCurrentlySyncing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Zap className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Hızlı artımlı güncelleme</TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* DIA record count button */}
                                  {targetUserId && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => fetchDiaRecordCount(ds.slug)}
                                          disabled={loadingDiaCounts[ds.slug] || progress.isRunning}
                                          className="h-8 w-8 p-0"
                                        >
                                          {loadingDiaCounts[ds.slug] ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Search className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>DIA'dan anlık kayıt sayısı çek</TooltipContent>
                                    </Tooltip>
                                  )}

                                  <Button size="sm" variant="ghost"
                                    className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                    onClick={() => setDeleteTarget({ slug: ds.slug, name: ds.name })}
                                    disabled={ds.count === 0}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* Period Distribution */}
                              {isExpanded && distribution && distribution.total > 0 && (
                                <div className="ml-3 p-3 rounded-lg bg-secondary/20 border border-secondary/40">
                                  <div className="flex items-center gap-2 mb-2">
                                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground">Dönem Bazlı Dağılım</span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      Toplam: {distribution.total.toLocaleString('tr-TR')} kayıt
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {Object.entries(distribution.byPeriod)
                                      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                                      .map(([periodNo, count]) => {
                                        const period = periods.find(p => p.period_no === parseInt(periodNo));
                                        const percent = (count / distribution.total) * 100;
                                        const periodNum = parseInt(periodNo);
                                        const excluded = isExcluded(periodNum, ds.slug);
                                        return (
                                          <div key={periodNo} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className="text-muted-foreground">
                                                {period?.period_name || `D${periodNo}`}
                                              </span>
                                              <div className="flex items-center gap-0.5">
                                                <span className="font-mono font-semibold">
                                                  {count.toLocaleString('tr-TR')}
                                                </span>
                                                {diaRecordCounts[ds.slug]?.[periodNum] !== undefined && (
                                                  <Tooltip>
                                                    <TooltipTrigger>
                                                      <Badge variant={diaRecordCounts[ds.slug][periodNum] !== count ? 'destructive' : 'secondary'} className="text-[9px] px-1 py-0 font-mono ml-1">
                                                        DIA: {diaRecordCounts[ds.slug][periodNum].toLocaleString('tr-TR')}
                                                      </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      {diaRecordCounts[ds.slug][periodNum] === count
                                                        ? 'DIA ile eşleşiyor ✓'
                                                        : `Fark: ${(diaRecordCounts[ds.slug][periodNum] - count).toLocaleString('tr-TR')} kayıt`
                                                      }
                                                    </TooltipContent>
                                                  </Tooltip>
                                                )}
                                                {/* Per-period refresh */}
                                                {targetUserId && (
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 w-5 p-0 text-primary/70 hover:text-primary"
                                                        disabled={progress.isRunning}
                                                        onClick={() => quickSync(ds.slug, periodNum, targetUserId)}
                                                      >
                                                        {progress.isRunning && progress.tasks.some(t => t.slug === ds.slug && t.periodNo === periodNum && t.status === 'running') ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          <RefreshCw className="h-3 w-3" />
                                                        )}
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Bu dönemi güncelle</TooltipContent>
                                                  </Tooltip>
                                                )}
                                                <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive/70 hover:text-destructive">
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                      <AlertDialogTitle>Dönem Verilerini Sil</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                        <strong>{ds.name}</strong> kaynağının <strong>Dönem {periodNo}</strong> verilerini ({count.toLocaleString('tr-TR')} kayıt) silmek istediğinize emin misiniz?
                                                      </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                      <AlertDialogCancel>İptal</AlertDialogCancel>
                                                      <AlertDialogAction
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        onClick={() => handleExcludePeriod(periodNum, ds.slug)}
                                                      >
                                                        Sil ve Hariç Tut
                                                      </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                  </AlertDialogContent>
                                                </AlertDialog>
                                              </div>
                                            </div>
                                            <Progress value={percent} className="h-1.5" />
                                            <div className="text-[10px] text-muted-foreground text-right">
                                              {percent.toFixed(1)}%
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>

                                  {/* Excluded periods */}
                                  {(() => {
                                    const excludedForSource = excludedPeriods
                                      .filter(e => e.data_source_slug === ds.slug || e.data_source_slug === null)
                                      .map(e => e.donem_kodu)
                                      .filter(pn => !distribution.byPeriod[pn]);
                                    if (excludedForSource.length === 0) return null;
                                    return (
                                      <div className="mt-3 pt-3 border-t border-secondary/40">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Ban className="h-3 w-3 text-destructive/60" />
                                          <span className="text-[11px] text-destructive/80 font-medium">Hariç Tutulan Dönemler</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {excludedForSource.map(pn => {
                                            const period = periods.find(p => p.period_no === pn);
                                            return (
                                              <Badge key={pn} variant="outline" className="text-[10px] gap-1 border-destructive/30 text-destructive/80">
                                                <Ban className="h-2.5 w-2.5" />
                                                {period?.period_name || `D${pn}`}
                                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-0.5"
                                                  onClick={() => handleIncludePeriod(pn, ds.slug)}
                                                >
                                                  <Undo2 className="h-2.5 w-2.5" />
                                                </Button>
                                              </Badge>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sync History */}
              {syncHistory.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Son Senkronizasyonlar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {syncHistory.map((h) => (
                        <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 text-sm">
                          <div className="flex items-center gap-2">
                            {h.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : h.status === 'failed' ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            <span className="font-medium text-xs truncate max-w-[200px]">{h.data_source_slug}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {h.sync_type === 'incremental' ? (
                                <><Zap className="w-3 h-3 mr-1" />Artımlı</>
                              ) : h.sync_type === 'full' ? 'Tam' : h.sync_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-xs">
                            <span>+{h.records_inserted || 0} / ~{h.records_updated || 0}</span>
                            {(h.records_deleted || 0) > 0 && (
                              <span className="text-orange-500">-{h.records_deleted}</span>
                            )}
                            <span>{formatSyncTime(h.started_at)}</span>
                            {h.error && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs"><p className="text-xs">{h.error}</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sync Architecture Info Box */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h4 className="font-medium text-primary mb-2">Senkronizasyon Mimarisi</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Chunk bazlı:</strong> Her kaynak 300'er kayıtlık parçalar halinde çekilir, timeout önlenir</li>
                  <li>• <strong>İlk çekme:</strong> Tüm veriler tam sync ile çekilir, tamamlandığında dönem kilitlenir</li>
                  <li>• <strong>Artımlı güncelleme:</strong> Sadece yeni ve değişen kayıtlar çekilir (⚡ hızlı)</li>
                  <li>• <strong>Silinen kayıt tespiti:</strong> Her sync sonrası reconcileKeys ile DIA'da silinen kayıtlar tespit edilir</li>
                  <li>• <strong>Otomatik:</strong> Her gece 03:00'te tüm sunucularda otomatik çalışır</li>
                </ul>
              </div>
            </>
          )}
        </>
      )}

      {/* Delete Dialogs */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Veri Kaynağını Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" verileri <strong>{selectedServer?.sunucu_adi} / {selectedServer?.firma_kodu}</strong> için kalıcı olarak silinecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDataSource} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm Verileri Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedServer?.sunucu_adi} / {selectedServer?.firma_kodu}</strong> sunucusuna ait {totalRecords.toLocaleString('tr-TR')} kayıt kalıcı olarak silinecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllData} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Tümünü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
