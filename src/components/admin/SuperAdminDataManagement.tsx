// Super Admin Data Management - Sunucu bazında gelişmiş veri yönetimi
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDataSources } from '@/hooks/useDataSources';
import { 
  Database, HardDrive, Server, Search, Trash2, 
  Loader2, RefreshCw, AlertCircle, CheckCircle2, BarChart3,
  Clock, Calendar, ChevronDown, ChevronRight, Ban, Undo2, Zap, Link2
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

export default function SuperAdminDataManagement({ users }: Props) {
  const { dataSources } = useDataSources();
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
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [widgetUsage, setWidgetUsage] = useState<WidgetUsage>({});
  const [excludedPeriods, setExcludedPeriods] = useState<{ donem_kodu: number; data_source_slug: string | null }[]>([]);

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

      // Find a user_id for data_sources query
      const ownerUser = users.find(u => u.dia_sunucu_adi === sunucuAdi && u.firma_kodu === firmaKodu);
      const ownerUserId = ownerUser?.user_id;

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
          .select('data_source, builder_config')
          .eq('is_active', true),
        ownerUserId
          ? supabase.from('data_sources')
              .select('slug, name, module, method, is_period_independent, last_fetched_at, is_active')
              .eq('user_id', ownerUserId)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      // Cache stats
      const cacheData = cacheRes.data || [];
      const result: DataSourceStats[] = cacheData.map((d: any) => {
        const ds = dataSources.find(s => s.slug === d.data_source_slug);
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

      // All data sources
      const allDs: DataSourceStats[] = (allDsRes.data || []).map((ds: any) => ({
        slug: ds.slug,
        name: ds.name,
        count: cacheData.find((c: any) => c.data_source_slug === ds.slug)?.record_count || 0,
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
      const usage: WidgetUsage = {};
      (widgetRes.data || []).forEach((w: any) => {
        if (w.data_source) {
          const ds = dataSources.find(d => d.id === w.data_source || d.slug === w.data_source);
          const slug = ds?.slug || w.data_source;
          usage[slug] = (usage[slug] || 0) + 1;
        }
        if (w.builder_config?.dataSourceId) {
          const ds = dataSources.find(d => d.id === w.builder_config.dataSourceId);
          if (ds) usage[ds.slug] = (usage[ds.slug] || 0) + 1;
        }
        if (w.builder_config?.multiQuery?.queries) {
          w.builder_config.multiQuery.queries.forEach((q: any) => {
            if (q.dataSourceId) {
              const ds = dataSources.find(d => d.id === q.dataSourceId);
              if (ds) usage[ds.slug] = (usage[ds.slug] || 0) + 1;
            }
          });
        }
      });
      setWidgetUsage(usage);

      // Period distributions
      const distributions: Record<string, PeriodDistribution> = {};
      for (const s of result) {
        const { data: distData } = await supabase
          .from('company_data_cache')
          .select('donem_kodu')
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .eq('data_source_slug', s.slug)
          .eq('is_deleted', false);
        
        if (distData && distData.length > 0) {
          const byPeriod: Record<number, number> = {};
          distData.forEach((row: any) => {
            byPeriod[row.donem_kodu] = (byPeriod[row.donem_kodu] || 0) + 1;
          });
          distributions[s.slug] = { total: distData.length, byPeriod };
        }
      }
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

  const totalRecords = stats.reduce((sum, s) => sum + s.count, 0);
  const currentPeriod = periods.find(p => p.is_current);

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
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <HardDrive className="h-4 w-4" />
                      <span className="text-xs">Veri Kaynakları</span>
                    </div>
                    <p className="text-2xl font-bold">{allDataSources.length}</p>
                    <p className="text-xs text-muted-foreground">{stats.length} aktif veri</p>
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
                    <ScrollArea className="h-[450px]">
                      <div className="space-y-2">
                        {allDataSources.map(ds => {
                          const distribution = periodDistributions[ds.slug];
                          const isExpanded = expandedDistributions[ds.slug];
                          const widgetCount = widgetUsage[ds.slug] || 0;

                          return (
                            <div key={ds.slug} className="space-y-1">
                              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className={`p-1.5 rounded ${ds.count > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
                                    {ds.count > 0 ? (
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

                                  {distribution && distribution.total > 0 && (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                      onClick={() => setExpandedDistributions(prev => ({ ...prev, [ds.slug]: !prev[ds.slug] }))}
                                    >
                                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
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
                    </ScrollArea>
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
                    <ScrollArea className="h-[250px]">
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
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
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
