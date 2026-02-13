// CronHealthPanel - Real-time cron job health monitoring for all servers
// Uses Supabase Realtime to watch sync_history and cron_schedules changes

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Clock, Server, CheckCircle2, XCircle, AlertTriangle, Activity, 
  RefreshCw, Loader2, Zap, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ServerCronStatus {
  sunucuAdi: string;
  firmaKodu: string;
  firmaAdi?: string;
  enabledSchedules: number;
  totalSchedules: number;
  lastSyncStatus: 'success' | 'error' | 'running' | 'unknown';
  lastSyncAt: string | null;
  lastError: string | null;
  nextScheduleLabel: string | null;
  activeJobCount: number;
}

interface RecentCronRun {
  sunucuAdi: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  dataSourceSlug: string;
  error: string | null;
}

export default function CronHealthPanel() {
  const [servers, setServers] = useState<ServerCronStatus[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentCronRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    try {
      // Parallel fetch all needed data
      const [profilesRes, schedulesRes, historyRes, jobsRes] = await Promise.all([
        supabase.from('profiles')
          .select('dia_sunucu_adi, firma_kodu, firma_adi')
          .not('dia_sunucu_adi', 'is', null)
          .not('firma_kodu', 'is', null),
        supabase.from('cron_schedules')
          .select('sunucu_adi, firma_kodu, is_enabled, pg_cron_jobid, turkey_time_label'),
        supabase.from('sync_history')
          .select('sunucu_adi, firma_kodu, status, started_at, completed_at, error, data_source_slug, sync_type')
          .order('started_at', { ascending: false })
          .limit(200),
        supabase.from('sync_jobs')
          .select('sunucu_adi, firma_kodu, status')
          .eq('status', 'running'),
      ]);

      const profiles = profilesRes.data || [];
      const schedules = schedulesRes.data || [];
      const history = historyRes.data || [];
      const activeJobs = jobsRes.data || [];

      // Build unique server pairs
      const pairMap = new Map<string, ServerCronStatus>();
      for (const p of profiles) {
        const key = `${p.dia_sunucu_adi}:${p.firma_kodu}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            sunucuAdi: p.dia_sunucu_adi!,
            firmaKodu: p.firma_kodu!,
            firmaAdi: p.firma_adi || undefined,
            enabledSchedules: 0,
            totalSchedules: 0,
            lastSyncStatus: 'unknown',
            lastSyncAt: null,
            lastError: null,
            nextScheduleLabel: null,
            activeJobCount: 0,
          });
        }
      }

      // Enrich with schedule info
      for (const s of schedules) {
        const key = `${s.sunucu_adi}:${s.firma_kodu}`;
        const server = pairMap.get(key);
        if (!server) continue;
        server.totalSchedules++;
        if (s.is_enabled) {
          server.enabledSchedules++;
          // Track next schedule (simple: smallest upcoming TR hour)
          if (!server.nextScheduleLabel || (s.turkey_time_label && s.turkey_time_label > server.nextScheduleLabel)) {
            server.nextScheduleLabel = s.turkey_time_label;
          }
        }
      }

      // Enrich with last sync status
      for (const h of history) {
        const key = `${h.sunucu_adi}:${h.firma_kodu}`;
        const server = pairMap.get(key);
        if (!server || server.lastSyncAt) continue; // Take first (most recent) only
        server.lastSyncAt = h.started_at;
        if (h.status === 'completed') server.lastSyncStatus = 'success';
        else if (h.status === 'failed') {
          server.lastSyncStatus = 'error';
          server.lastError = h.error;
        } else if (h.status === 'running') {
          server.lastSyncStatus = 'running';
        }
      }

      // Enrich with active jobs
      for (const j of activeJobs) {
        const key = `${j.sunucu_adi}:${j.firma_kodu}`;
        const server = pairMap.get(key);
        if (server) {
          server.activeJobCount++;
          server.lastSyncStatus = 'running';
        }
      }

      const serverList = Array.from(pairMap.values()).sort((a, b) => {
        // Running first, then errors, then success, then unknown
        const order = { running: 0, error: 1, success: 2, unknown: 3 };
        return (order[a.lastSyncStatus] || 3) - (order[b.lastSyncStatus] || 3);
      });

      setServers(serverList);

      // Recent cron runs (last 10)
      const cronHistory = history
        .filter(h => h.sync_type === 'cron' || h.sync_type === 'full' || h.sync_type === 'incremental')
        .slice(0, 10)
        .map(h => ({
          sunucuAdi: h.sunucu_adi,
          status: h.status,
          startedAt: h.started_at,
          completedAt: h.completed_at,
          dataSourceSlug: h.data_source_slug,
          error: h.error,
        }));

      setRecentRuns(cronHistory);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[CronHealth] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Supabase Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('cron-health-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_history' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_jobs' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cron_schedules' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const statusIcon = (status: ServerCronStatus['lastSyncStatus']) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'running': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default: return <AlertTriangle className="w-4 h-4 text-muted-foreground/50" />;
    }
  };

  const statusLabel = (status: ServerCronStatus['lastSyncStatus']) => {
    switch (status) {
      case 'success': return 'Başarılı';
      case 'error': return 'Hata';
      case 'running': return 'Çalışıyor';
      default: return 'Bilinmiyor';
    }
  };

  // Summary counts
  const totalServers = servers.length;
  const healthyServers = servers.filter(s => s.lastSyncStatus === 'success').length;
  const errorServers = servers.filter(s => s.lastSyncStatus === 'error').length;
  const runningServers = servers.filter(s => s.lastSyncStatus === 'running').length;
  const noScheduleServers = servers.filter(s => s.enabledSchedules === 0).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Left: Summary KPIs + Server Grid */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Cron Sağlık Durumu
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 font-normal">
                <Zap className="w-2.5 h-2.5 mr-0.5" />
                Canlı
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {format(lastRefresh, 'HH:mm:ss')}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadData}>
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mini KPIs */}
          <div className="grid grid-cols-4 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <Server className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold leading-none">{totalServers}</p>
                <p className="text-[10px] text-muted-foreground">Sunucu</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="text-lg font-bold leading-none text-emerald-600">{healthyServers}</p>
                <p className="text-[10px] text-muted-foreground">Sağlıklı</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10">
              <XCircle className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-lg font-bold leading-none text-destructive">{errorServers}</p>
                <p className="text-[10px] text-muted-foreground">Hatalı</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10">
              <Loader2 className={cn("w-4 h-4 text-primary", runningServers > 0 && "animate-spin")} />
              <div>
                <p className="text-lg font-bold leading-none text-primary">{runningServers}</p>
                <p className="text-[10px] text-muted-foreground">Çalışıyor</p>
              </div>
            </div>
          </div>

          {/* Server Grid */}
          <ScrollArea className="max-h-[240px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {servers.map((server) => (
                <Tooltip key={`${server.sunucuAdi}:${server.firmaKodu}`}>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                      server.lastSyncStatus === 'error' && "border-destructive/30 bg-destructive/5",
                      server.lastSyncStatus === 'running' && "border-primary/30 bg-primary/5",
                      server.lastSyncStatus === 'success' && "border-border bg-card",
                      server.lastSyncStatus === 'unknown' && "border-border bg-muted/30",
                    )}>
                      {statusIcon(server.lastSyncStatus)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{server.sunucuAdi}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {server.firmaAdi || `Firma ${server.firmaKodu}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        {server.enabledSchedules > 0 ? (
                          <Badge variant="secondary" className="text-[9px] px-1 h-4">
                            <Clock className="w-2.5 h-2.5 mr-0.5" />
                            {server.enabledSchedules}/{server.totalSchedules}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 h-4 text-muted-foreground">
                            Pasif
                          </Badge>
                        )}
                        {server.lastSyncAt && (
                          <span className="text-[9px] text-muted-foreground">
                            {formatDistanceToNow(new Date(server.lastSyncAt), { addSuffix: true, locale: tr })}
                          </span>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      <p><strong>Durum:</strong> {statusLabel(server.lastSyncStatus)}</p>
                      {server.lastSyncAt && (
                        <p><strong>Son Sync:</strong> {format(new Date(server.lastSyncAt), 'dd MMM HH:mm', { locale: tr })}</p>
                      )}
                      {server.lastError && (
                        <p className="text-destructive"><strong>Hata:</strong> {server.lastError.slice(0, 100)}</p>
                      )}
                      <p><strong>Aktif Zamanlama:</strong> {server.enabledSchedules}/{server.totalSchedules}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </ScrollArea>

          {noScheduleServers > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {noScheduleServers} sunucuda aktif cron zamanlaması bulunmuyor
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Recent Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Son Aktiviteler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[340px]">
            <div className="space-y-2">
              {recentRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Henüz aktivite yok</p>
              ) : (
                recentRuns.map((run, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md border border-border text-xs">
                    {run.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    ) : run.status === 'failed' ? (
                      <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{run.sunucuAdi}</p>
                      <p className="text-muted-foreground truncate">{run.dataSourceSlug}</p>
                      {run.error && (
                        <p className="text-destructive truncate mt-0.5">{run.error.slice(0, 60)}</p>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true, locale: tr })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
