// Super Admin Data Management - Kullanıcı bazında gelişmiş veri yönetimi
// DataManagementTab'ın tüm özelliklerini kullanıcı seçimli olarak sunar
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDataSources } from '@/hooks/useDataSources';
import { 
  Database, HardDrive, Users, Search, User, Trash2, 
  Loader2, RefreshCw, AlertCircle, CheckCircle2, BarChart3,
  Clock, Calendar, ChevronDown, ChevronRight, Layers, Ban, Undo2, Zap, Link2
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
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
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
  const [userProfile, setUserProfile] = useState<{ firma_kodu: string; dia_sunucu_adi: string } | null>(null);

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.firma_adi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Henüz sync yok';
    try { return formatDistanceToNow(new Date(time), { addSuffix: true, locale: tr }); }
    catch { return 'Bilinmiyor'; }
  };

  const loadUserData = useCallback(async (user: UserProfile) => {
    if (!user.dia_sunucu_adi) {
      setStats([]); setAllDataSources([]); setPeriods([]); setSyncHistory([]); setWidgetUsage({});
      return;
    }

    setLoading(true);
    try {
      // 1. Profil bilgisi
      const { data: profile } = await supabase
        .from('profiles')
        .select('firma_kodu, dia_sunucu_adi')
        .eq('user_id', user.user_id)
        .single();

      if (!profile?.firma_kodu || !profile?.dia_sunucu_adi) {
        setStats([]); setLoading(false); return;
      }
      setUserProfile(profile);

      // 2. Paralel veri çekme
      const [cacheRes, periodsRes, syncRes, excludedRes, widgetRes, allDsRes] = await Promise.all([
        // Cache kayıt sayıları
        supabase.rpc('get_cache_record_counts', {
          p_sunucu_adi: profile.dia_sunucu_adi,
          p_firma_kodu: profile.firma_kodu,
        }),
        // Dönemler
        supabase.from('firma_periods')
          .select('period_no, period_name, is_current')
          .eq('sunucu_adi', profile.dia_sunucu_adi)
          .eq('firma_kodu', profile.firma_kodu)
          .order('period_no', { ascending: true }),
        // Sync geçmişi
        supabase.from('sync_history')
          .select('*')
          .eq('sunucu_adi', profile.dia_sunucu_adi)
          .eq('firma_kodu', profile.firma_kodu)
          .order('started_at', { ascending: false })
          .limit(30),
        // Hariç tutulan dönemler
        supabase.from('excluded_periods')
          .select('donem_kodu, data_source_slug')
          .eq('sunucu_adi', profile.dia_sunucu_adi)
          .eq('firma_kodu', profile.firma_kodu),
        // Widget kullanım sayıları
        supabase.from('widgets')
          .select('data_source, builder_config')
          .eq('is_active', true),
        // Tüm veri kaynakları (kullanıcıya ait)
        supabase.from('data_sources')
          .select('slug, name, module, method, is_period_independent, last_fetched_at, is_active')
          .eq('user_id', user.user_id),
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

      // Tüm veri kaynakları (cache'de verisi olmayanlar dahil)
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

      // Dönemler
      setPeriods(periodsRes.data || []);

      // Sync geçmişi
      setSyncHistory(syncRes.data || []);

      // Excluded periods
      setExcludedPeriods((excludedRes.data || []).map((e: any) => ({
        donem_kodu: e.donem_kodu,
        data_source_slug: e.data_source_slug,
      })));

      // Widget kullanım sayıları
      const usage: WidgetUsage = {};
      (widgetRes.data || []).forEach((w: any) => {
        if (w.data_source) {
          // data_source slug ile eşleştir
          const ds = dataSources.find(d => d.id === w.data_source || d.slug === w.data_source);
          const slug = ds?.slug || w.data_source;
          usage[slug] = (usage[slug] || 0) + 1;
        }
        // builder_config içindeki dataSourceId'leri de say
        if (w.builder_config?.dataSourceId) {
          const ds = dataSources.find(d => d.id === w.builder_config.dataSourceId);
          if (ds) usage[ds.slug] = (usage[ds.slug] || 0) + 1;
        }
        // multi-query
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

      // Dönem bazlı dağılım (veri olan kaynaklar için)
      const distributions: Record<string, PeriodDistribution> = {};
      for (const s of result) {
        const { data: distData } = await supabase
          .from('company_data_cache')
          .select('donem_kodu')
          .eq('sunucu_adi', profile.dia_sunucu_adi)
          .eq('firma_kodu', profile.firma_kodu)
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
      console.error('Error loading user data:', err);
      toast.error('Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [dataSources]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setSearchOpen(false);
    setExpandedDistributions({});
    loadUserData(user);
  };

  const handleDeleteDataSource = async () => {
    if (!selectedUser || !deleteTarget || !userProfile) return;
    setDeleting(true);
    try {
      await supabase.from('company_data_cache').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu)
        .eq('data_source_slug', deleteTarget.slug);
      
      await supabase.from('period_sync_status').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu)
        .eq('data_source_slug', deleteTarget.slug);

      toast.success(`${deleteTarget.name} verileri silindi`);
      setDeleteTarget(null);
      loadUserData(selectedUser);
    } catch (err) {
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!selectedUser || !userProfile) return;
    setDeleting(true);
    try {
      await supabase.from('company_data_cache').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu);
      await supabase.from('period_sync_status').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu);
      await supabase.from('sync_history').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu);

      toast.success('Tüm veriler silindi');
      setDeleteAllConfirm(false);
      loadUserData(selectedUser);
    } catch (err) {
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleting(false);
    }
  };

  const handleExcludePeriod = async (donemKodu: number, dataSourceSlug: string) => {
    if (!userProfile || !selectedUser) return;
    try {
      // Insert exclusion
      await supabase.from('excluded_periods').insert({
        sunucu_adi: userProfile.dia_sunucu_adi,
        firma_kodu: userProfile.firma_kodu,
        donem_kodu: donemKodu,
        data_source_slug: dataSourceSlug,
        excluded_by: selectedUser.user_id,
      });
      // Delete data for this period
      await supabase.from('company_data_cache').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu)
        .eq('data_source_slug', dataSourceSlug)
        .eq('donem_kodu', donemKodu);
      
      toast.success(`Dönem ${donemKodu} hariç tutuldu`);
      loadUserData(selectedUser);
    } catch (err) {
      toast.error('İşlem başarısız');
    }
  };

  const handleIncludePeriod = async (donemKodu: number, dataSourceSlug: string) => {
    if (!userProfile || !selectedUser) return;
    try {
      await supabase.from('excluded_periods').delete()
        .eq('sunucu_adi', userProfile.dia_sunucu_adi)
        .eq('firma_kodu', userProfile.firma_kodu)
        .eq('donem_kodu', donemKodu)
        .eq('data_source_slug', dataSourceSlug);
      
      toast.success(`Dönem ${donemKodu} dahil edildi`);
      loadUserData(selectedUser);
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
      {/* User Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Kullanıcı Seçimi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start h-10">
                <Search className="w-4 h-4 mr-2 shrink-0" />
                {selectedUser ? (
                  <span className="truncate">
                    {selectedUser.display_name || selectedUser.email} 
                    {selectedUser.firma_adi && ` — ${selectedUser.firma_adi}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Kullanıcı seçin...</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="İsim, e-posta veya firma ara..." value={searchTerm} onValueChange={setSearchTerm} />
                <CommandList>
                  <CommandEmpty>Kullanıcı bulunamadı</CommandEmpty>
                  <CommandGroup>
                    {filteredUsers.slice(0, 15).map(user => (
                      <CommandItem
                        key={user.user_id}
                        value={`${user.display_name} ${user.email} ${user.firma_adi}`}
                        onSelect={() => handleSelectUser(user)}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.display_name || user.email?.split('@')[0]}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email} {user.firma_adi && `• ${user.firma_adi}`}</p>
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

      {/* User Data */}
      {selectedUser && (
        <>
          {!selectedUser.dia_sunucu_adi ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">DIA Bağlantısı Yok</h3>
                <p className="text-sm text-muted-foreground">Bu kullanıcının DIA bağlantısı yapılandırılmamış.</p>
              </CardContent>
            </Card>
          ) : loading ? (
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
                      <Button size="sm" variant="outline" onClick={() => loadUserData(selectedUser)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteAllConfirm(true)} disabled={totalRecords === 0}>
                        Tümünü Sil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* All Data Sources with Widget Usage */}
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
                      <p>Bu kullanıcı için veri kaynağı bulunamadı</p>
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
                                  {/* Widget kullanım sayısı */}
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

                              {/* Dönem Dağılımı */}
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

                                  {/* Hariç tutulan dönemler */}
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
              "{deleteTarget?.name}" verileri <strong>{selectedUser?.display_name || selectedUser?.email}</strong> için kalıcı olarak silinecek.
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
              <strong>{selectedUser?.display_name || selectedUser?.email}</strong> kullanıcısına ait {totalRecords.toLocaleString('tr-TR')} kayıt kalıcı olarak silinecek.
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
