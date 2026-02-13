import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Clock, Server, Plus, Trash2, Save, RefreshCw, CheckCircle2, XCircle, 
  AlertTriangle, Filter, ChevronDown, ChevronUp, Loader2, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ServerPair {
  sunucu_adi: string;
  firma_kodu: string;
  firma_adi?: string;
  user_ids: string[];
}

interface CronSchedule {
  id?: string;
  sunucu_adi: string;
  firma_kodu: string;
  schedule_name: string;
  cron_expression: string;
  turkey_time_label: string;
  is_enabled: boolean;
  pg_cron_jobid?: number | null;
}

interface SyncHistoryItem {
  id: string;
  data_source_slug: string;
  donem_kodu: number;
  status: string;
  sync_type: string;
  triggered_by: string | null;
  started_at: string;
  completed_at: string | null;
  records_fetched: number | null;
  records_inserted: number | null;
  records_updated: number | null;
  records_deleted: number | null;
  error: string | null;
}

interface CronRunItem {
  jobid: number;
  job_name: string;
  status: string;
  start_time: string;
  end_time: string | null;
  return_message: string | null;
}

// TR saat -> UTC cron expression
function trHourToUTC(trHour: number): number {
  return ((trHour - 3) + 24) % 24;
}

function trHourToCron(trHour: number, trMinute: number = 0): string {
  const utcHour = trHourToUTC(trHour);
  return `${trMinute} ${utcHour} * * *`;
}

// Default schedules are automatically created when a new server is first encountered
// Times: 07:00, 12:00, 17:00, 22:00 Turkey time
// Triggered by: INSERT on firma_periods or company_data_cache tables

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}));

export default function CronManagement() {
  const [servers, setServers] = useState<ServerPair[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerPair | null>(null);
  const [schedules, setSchedules] = useState<CronSchedule[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [cronRuns, setCronRuns] = useState<CronRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'errors' | 'cron'>('all');
  const [lastSyncStatus, setLastSyncStatus] = useState<Record<string, 'success' | 'error' | 'unknown'>>({});
  const [serverSearch, setServerSearch] = useState('');

  // Load servers
  useEffect(() => {
    loadServers();
    loadCronRuns();
  }, []);

  const loadServers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, dia_sunucu_adi, firma_kodu, firma_adi')
      .not('dia_sunucu_adi', 'is', null)
      .not('firma_kodu', 'is', null);

    if (!profiles) { setLoading(false); return; }

    const pairMap = new Map<string, ServerPair>();
    for (const p of profiles) {
      const key = `${p.dia_sunucu_adi}:${p.firma_kodu}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          sunucu_adi: p.dia_sunucu_adi!,
          firma_kodu: p.firma_kodu!,
          firma_adi: p.firma_adi || undefined,
          user_ids: [],
        });
      }
      pairMap.get(key)!.user_ids.push(p.user_id);
    }

    const serverList = Array.from(pairMap.values());
    setServers(serverList);

    // Load last sync status per server
    const statusMap: Record<string, 'success' | 'error' | 'unknown'> = {};
    for (const s of serverList) {
      const { data: lastSync } = await supabase
        .from('sync_history')
        .select('status')
        .eq('sunucu_adi', s.sunucu_adi)
        .eq('firma_kodu', s.firma_kodu)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      statusMap[`${s.sunucu_adi}:${s.firma_kodu}`] = lastSync?.status === 'completed' ? 'success' : lastSync?.status === 'failed' ? 'error' : 'unknown';
    }
    setLastSyncStatus(statusMap);

    if (serverList.length > 0 && !selectedServer) {
      setSelectedServer(serverList[0]);
    }
    setLoading(false);
  };

  const loadServerData = useCallback(async (server: ServerPair) => {
    // Load schedules
    const { data: sched } = await supabase
      .from('cron_schedules')
      .select('*')
      .eq('sunucu_adi', server.sunucu_adi)
      .eq('firma_kodu', server.firma_kodu)
      .order('schedule_name');

    setSchedules((sched as CronSchedule[]) || []);

    // Load sync history
    const { data: hist } = await supabase
      .from('sync_history')
      .select('*')
      .eq('sunucu_adi', server.sunucu_adi)
      .eq('firma_kodu', server.firma_kodu)
      .order('started_at', { ascending: false })
      .limit(50);

    setSyncHistory(hist || []);
  }, []);

  const loadCronRuns = async () => {
    try {
      const { data, error } = await supabase.rpc('get_cron_run_history', { p_limit: 20 });
      if (!error && data) setCronRuns(data as CronRunItem[]);
    } catch (e) {
      console.log('Cron run history not available:', e);
    }
  };

  useEffect(() => {
    if (selectedServer) loadServerData(selectedServer);
  }, [selectedServer, loadServerData]);

  // Default schedules are auto-created via DB trigger when new server is added

  const saveSchedulesToPgCron = async (scheds: CronSchedule[]) => {
    if (!selectedServer) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('dia-data-sync', {
        body: {
          action: 'manageCronSchedules',
          schedules: scheds,
          sunucuAdi: selectedServer.sunucu_adi,
          firmaKodu: selectedServer.firma_kodu,
        },
      });

      if (response.error) {
        console.error('manageCronSchedules error:', response.error);
        toast.error('pg_cron güncellemesi başarısız');
      }
    } catch (e) {
      console.error('pg_cron update error:', e);
    }
  };

  const handleSaveSchedules = async () => {
    if (!selectedServer) return;
    setSaving(true);

    // Save to cron_schedules table
    for (const s of schedules) {
      if (s.id) {
        await supabase.from('cron_schedules').update({
          cron_expression: s.cron_expression,
          turkey_time_label: s.turkey_time_label,
          is_enabled: s.is_enabled,
        }).eq('id', s.id);
      } else {
        await supabase.from('cron_schedules').upsert({
          sunucu_adi: s.sunucu_adi,
          firma_kodu: s.firma_kodu,
          schedule_name: s.schedule_name,
          cron_expression: s.cron_expression,
          turkey_time_label: s.turkey_time_label,
          is_enabled: s.is_enabled,
        }, { onConflict: 'sunucu_adi,firma_kodu,schedule_name' });
      }
    }

    // Sync with pg_cron
    await saveSchedulesToPgCron(schedules);
    toast.success('Zamanlamalar kaydedildi');
    await loadServerData(selectedServer);
    setSaving(false);
  };

  const addSchedule = () => {
    if (!selectedServer) return;
    const nextIdx = schedules.length + 1;
    setSchedules(prev => [...prev, {
      sunucu_adi: selectedServer.sunucu_adi,
      firma_kodu: selectedServer.firma_kodu,
      schedule_name: `sync-${nextIdx}`,
      cron_expression: '0 3 * * *', // Default 06:00 TR
      turkey_time_label: '06:00',
      is_enabled: true,
    }]);
  };

  const removeSchedule = async (index: number) => {
    const sched = schedules[index];
    if (sched.id) {
      await supabase.from('cron_schedules').delete().eq('id', sched.id);
      // Unschedule from pg_cron
      try {
        await supabase.functions.invoke('dia-data-sync', {
          body: {
            action: 'manageCronSchedules',
            removeSchedules: [sched],
            sunucuAdi: selectedServer?.sunucu_adi,
            firmaKodu: selectedServer?.firma_kodu,
          },
        });
      } catch (e) { console.error(e); }
    }
    setSchedules(prev => prev.filter((_, i) => i !== index));
    toast.success('Zamanlama silindi');
  };

  const updateScheduleTime = (index: number, hour: string) => {
    const h = parseInt(hour);
    setSchedules(prev => prev.map((s, i) => {
      if (i !== index) return s;
      return {
        ...s,
        cron_expression: trHourToCron(h, 0),
        turkey_time_label: `${String(h).padStart(2, '0')}:00`,
      };
    }));
  };

  const toggleSchedule = (index: number) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== index) return s;
      return { ...s, is_enabled: !s.is_enabled };
    }));
  };

  const filteredHistory = syncHistory.filter(h => {
    if (historyFilter === 'errors') return h.status === 'failed';
    if (historyFilter === 'cron') return h.sync_type === 'cron' || h.triggered_by === 'cron';
    return true;
  });

  const filteredServers = servers.filter(server =>
    server.sunucu_adi.toLowerCase().includes(serverSearch.toLowerCase()) ||
    server.firma_adi?.toLowerCase().includes(serverSearch.toLowerCase()) ||
    server.firma_kodu.toLowerCase().includes(serverSearch.toLowerCase())
  );

  const getServerScheduleCount = (server: ServerPair) => {
    // We need to query this but for performance, just show from loaded data if selected
    if (selectedServer?.sunucu_adi === server.sunucu_adi && selectedServer?.firma_kodu === server.firma_kodu) {
      return schedules.filter(s => s.is_enabled).length;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Server List */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Server className="w-4 h-4" />
            Sunucular
          </h3>
          <Input
            placeholder="Sunucu ara..."
            value={serverSearch}
            onChange={(e) => setServerSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredServers.map(server => {
              const key = `${server.sunucu_adi}:${server.firma_kodu}`;
              const isSelected = selectedServer?.sunucu_adi === server.sunucu_adi && selectedServer?.firma_kodu === server.firma_kodu;
              const status = lastSyncStatus[key] || 'unknown';
              const schedCount = getServerScheduleCount(server);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedServer(server)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md transition-colors text-sm',
                    isSelected
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{server.sunucu_adi}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Firma: {server.firma_adi || server.firma_kodu}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      {schedCount !== null && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                          {schedCount}
                        </Badge>
                      )}
                      <div className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        status === 'success' && 'bg-emerald-500',
                        status === 'error' && 'bg-destructive',
                        status === 'unknown' && 'bg-muted-foreground/30',
                      )} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Selected Server Details */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!selectedServer ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Bir sunucu seçin</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedServer.sunucu_adi}</h2>
                <p className="text-sm text-muted-foreground">
                  Firma: {selectedServer.firma_adi || selectedServer.firma_kodu} · {selectedServer.user_ids.length} kullanıcı
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { loadServerData(selectedServer); loadCronRuns(); }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Yenile
              </Button>
            </div>

            <Tabs defaultValue="schedules">
              <TabsList>
                <TabsTrigger value="schedules">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Zamanlamalar
                </TabsTrigger>
                <TabsTrigger value="history">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Çalışma Geçmişi
                </TabsTrigger>
                <TabsTrigger value="cron-runs">
                  <Server className="w-3.5 h-3.5 mr-1.5" />
                  Cron Durumu
                </TabsTrigger>
              </TabsList>

              {/* Schedules Tab */}
              <TabsContent value="schedules">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Cron Zamanlamaları (TR Saati)</CardTitle>
                      <Button size="sm" variant="outline" onClick={addSchedule}>
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Ekle
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {schedules.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Henüz zamanlama tanımlanmamış</p>
                        <p className="text-xs mt-1">Yeni sunucu eklendiğinde 4 varsayılan zamanlama otomatik oluşturulur</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {schedules.map((sched, idx) => (
                          <div key={sched.id || idx} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                            <Switch
                              checked={sched.is_enabled}
                              onCheckedChange={() => toggleSchedule(idx)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={sched.turkey_time_label?.split(':')[0]?.replace(/^0/, '') || '3'}
                                  onValueChange={(v) => updateScheduleTime(idx, v)}
                                >
                                  <SelectTrigger className="w-20 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {HOUR_OPTIONS.map(h => (
                                      <SelectItem key={h.value} value={h.value}>
                                        {h.label}:00
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-xs text-muted-foreground">TR</span>
                                <span className="text-xs text-muted-foreground">→</span>
                                <code className="text-xs bg-muted px-2 py-0.5 rounded">{sched.cron_expression}</code>
                                <span className="text-xs text-muted-foreground">UTC</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{sched.schedule_name}</p>
                            </div>
                            <Badge variant={sched.is_enabled ? 'default' : 'secondary'} className="text-[10px]">
                              {sched.is_enabled ? 'Aktif' : 'Pasif'}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSchedule(idx)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}

                        <div className="flex justify-end pt-2">
                          <Button size="sm" onClick={handleSaveSchedules} disabled={saving}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                            Kaydet & pg_cron Güncelle
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Son Çalışma Geçmişi</CardTitle>
                      <div className="flex gap-1">
                        {(['all', 'cron', 'errors'] as const).map(f => (
                          <Button
                            key={f}
                            size="sm"
                            variant={historyFilter === f ? 'default' : 'outline'}
                            className="h-7 text-xs"
                            onClick={() => setHistoryFilter(f)}
                          >
                            {f === 'all' ? 'Tümü' : f === 'cron' ? 'Cron' : 'Hatalar'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Tarih</TableHead>
                            <TableHead>Veri Kaynağı</TableHead>
                            <TableHead className="w-[60px]">Dönem</TableHead>
                            <TableHead className="w-[80px]">Tip</TableHead>
                            <TableHead className="w-[80px]">Durum</TableHead>
                            <TableHead className="w-[100px] text-right">Kayıtlar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredHistory.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Kayıt bulunamadı
                              </TableCell>
                            </TableRow>
                          ) : filteredHistory.map(h => (
                            <TableRow key={h.id} className={cn(h.status === 'failed' && 'bg-destructive/5')}>
                              <TableCell className="text-xs">
                                {format(new Date(h.started_at), 'dd MMM HH:mm', { locale: tr })}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{h.data_source_slug}</TableCell>
                              <TableCell className="text-xs">{h.donem_kodu}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {h.sync_type === 'incremental' ? 'Artımlı' : h.sync_type === 'single' ? 'Tekil' : h.sync_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {h.status === 'completed' ? (
                                  <Badge variant="default" className="text-[10px] bg-emerald-600">
                                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                    OK
                                  </Badge>
                                ) : h.status === 'failed' ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="destructive" className="text-[10px]">
                                        <XCircle className="w-3 h-3 mr-0.5" />
                                        Hata
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-xs">{h.error || 'Bilinmeyen hata'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    <Loader2 className="w-3 h-3 mr-0.5 animate-spin" />
                                    {h.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-right tabular-nums">
                                {h.records_fetched != null ? (
                                  <span>{h.records_fetched} / {h.records_inserted ?? 0}</span>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cron Runs Tab */}
              <TabsContent value="cron-runs">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">pg_cron Çalışma Durumu (Son 20)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cronRuns.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Cron çalışma geçmişi bulunamadı</p>
                        <p className="text-xs mt-1">pg_cron job'ları henüz çalışmamış olabilir</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Başlangıç</TableHead>
                            <TableHead>Job Adı</TableHead>
                            <TableHead className="w-[80px]">Durum</TableHead>
                            <TableHead className="w-[100px]">Süre</TableHead>
                            <TableHead>Mesaj</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cronRuns.map((r, i) => (
                            <TableRow key={i} className={cn(r.status === 'failed' && 'bg-destructive/5')}>
                              <TableCell className="text-xs">
                                {format(new Date(r.start_time), 'dd MMM HH:mm', { locale: tr })}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{r.job_name}</TableCell>
                              <TableCell>
                                <Badge variant={r.status === 'succeeded' ? 'default' : 'destructive'} className="text-[10px]">
                                  {r.status === 'succeeded' ? (
                                    <><CheckCircle2 className="w-3 h-3 mr-0.5" /> OK</>
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-0.5" /> Hata</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {r.end_time && r.start_time ? `${Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 1000)}s` : '-'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {r.return_message || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
