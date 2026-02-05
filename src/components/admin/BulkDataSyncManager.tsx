// BulkDataSyncManager - Tüm kullanıcılar için toplu veri senkronizasyonu
// Kaynak ve dönem bazlı orchestration ile detaylı ilerleme gösterimi
// Chunk-bazlı streaming ile büyük veri setleri desteklenir
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  Users, 
  Database, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play,
  AlertCircle,
  Building2,
  StopCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Calendar,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Chunk sabitleri
const CHUNK_SIZE = 1000;        // Her chunk'ta max kayıt
const CHUNK_DELAY_MS = 500;     // Chunk'lar arası bekleme (ms)
const MAX_CHUNKS = 100;         // Güvenlik limiti (max 100.000 kayıt)

interface UserWithDiaConfig {
  user_id: string;
  email: string | null;
  display_name: string | null;
  firma_adi: string | null;
  dia_sunucu_adi: string | null;
  firma_kodu: string | null;
  donem_kodu: string | null;
}

interface DataSource {
  slug: string;
  name: string;
  module: string;
  method: string;
  is_period_independent: boolean;
  is_non_dia: boolean;
}

interface Period {
  period_no: number;
  period_name: string | null;
}

interface SourcePeriodProgress {
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  recordsFetched?: number;
  error?: string;
  // Chunk ilerleme bilgisi
  chunksCompleted?: number;
  isChunking?: boolean;
}

interface SourceProgress {
  slug: string;
  name: string;
  periods: Map<number, SourcePeriodProgress>;
  isPeriodIndependent: boolean;
}

interface UserProgress {
  userId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'partial';
  sources: Map<string, SourceProgress>;
  totalRecords: number;
  errorCount: number;
  successCount: number;
}

export function BulkDataSyncManager() {
  const [users, setUsers] = useState<UserWithDiaConfig[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  
  // Sync statistics
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);
  
  // Stop flag
  const stopRequestedRef = useRef(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, firma_adi, dia_sunucu_adi, firma_kodu, donem_kodu')
      .not('dia_sunucu_adi', 'is', null)
      .not('dia_api_key', 'is', null);

    if (error) {
      console.error('Error loading users:', error);
      toast.error('Kullanıcılar yüklenemedi');
    } else {
      // Aynı sunucu/firma kombinasyonuna sahip kullanıcıları filtrele
      const seenServers = new Set<string>();
      const uniqueUsers = (data || []).filter(user => {
        const serverKey = `${user.dia_sunucu_adi}:${user.firma_kodu}`;
        if (seenServers.has(serverKey)) {
          return false;
        }
        seenServers.add(serverKey);
        return true;
      });
      
      setUsers(uniqueUsers);
      setSelectedUsers(new Set(uniqueUsers.map(u => u.user_id)));
    }
    
    setLoading(false);
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.user_id)));
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const toggleSourceExpanded = (key: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSources(newExpanded);
  };

  const fetchDataSources = async (): Promise<DataSource[]> => {
    const { data } = await supabase
      .from('data_sources')
      .select('slug, name, module, method, is_period_independent, is_non_dia')
      .eq('is_active', true);
    
    // DIA dışı kaynakları filtrele
    return (data || []).filter(ds => 
      !ds.is_non_dia && 
      !ds.slug.startsWith('_system')
    ).map(ds => ({
      ...ds,
      is_period_independent: ds.is_period_independent ?? false,
      is_non_dia: ds.is_non_dia ?? false,
    }));
  };

  const fetchPeriods = async (userId: string, sunucuAdi: string, firmaKodu: string): Promise<Period[]> => {
    // Önce veritabanından dene
    const { data: dbPeriods } = await supabase
      .from('firma_periods')
      .select('period_no, period_name')
      .eq('sunucu_adi', sunucuAdi)
      .eq('firma_kodu', firmaKodu)
      .order('period_no', { ascending: false });
    
    if (dbPeriods?.length) {
      return dbPeriods;
    }
    
    // DB'de yoksa, edge function çağrısı sırasında çekilecek
    // Şimdilik varsayılan dönem
    return [{ period_no: 1, period_name: 'Dönem 1' }];
  };

  // Chunk-bazlı senkronizasyon fonksiyonu
  const syncSourceWithChunks = async (
    userId: string,
    sourceSlug: string,
    periodNo: number,
    onProgress?: (written: number, chunksCompleted: number, hasMore: boolean) => void
  ): Promise<{ success: boolean; totalWritten: number; error?: string }> => {
    let offset = 0;
    let totalWritten = 0;
    let chunkCount = 0;
    
    console.log(`[ChunkSync] Starting: ${sourceSlug}, period=${periodNo}`);
    
    while (chunkCount < MAX_CHUNKS) {
      // Durdurma kontrolü
      if (stopRequestedRef.current) {
        console.log(`[ChunkSync] Stop requested, returning partial result`);
        return { success: true, totalWritten, error: 'İptal edildi' };
      }
      
      try {
        const response = await supabase.functions.invoke('dia-data-sync', {
          body: {
            action: 'syncChunk',
            targetUserId: userId,
            dataSourceSlug: sourceSlug,
            periodNo: periodNo,
            offset: offset,
            chunkSize: CHUNK_SIZE,
          },
        });
        
        if (response.error) {
          console.error(`[ChunkSync] Error:`, response.error);
          return { 
            success: false, 
            totalWritten, 
            error: response.error.message || 'Edge function hatası' 
          };
        }
        
        if (!response.data?.success) {
          console.error(`[ChunkSync] API Error:`, response.data?.error);
          return { 
            success: false, 
            totalWritten, 
            error: response.data?.error || 'Bilinmeyen hata' 
          };
        }
        
        totalWritten += response.data.written || 0;
        chunkCount++;
        
        console.log(`[ChunkSync] Chunk ${chunkCount}: written=${response.data.written}, total=${totalWritten}, hasMore=${response.data.hasMore}`);
        
        // Progress callback
        onProgress?.(totalWritten, chunkCount, response.data.hasMore);
        
        // Veri bittiyse çık
        if (!response.data.hasMore) {
          console.log(`[ChunkSync] Complete: ${totalWritten} records in ${chunkCount} chunks`);
          return { success: true, totalWritten };
        }
        
        // Sonraki chunk için offset güncelle
        offset = response.data.nextOffset;
        
        // Rate limiting - chunk'lar arası bekleme
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
        
      } catch (error) {
        console.error(`[ChunkSync] Exception:`, error);
        return { 
          success: false, 
          totalWritten, 
          error: error instanceof Error ? error.message : 'Bağlantı hatası' 
        };
      }
    }
    
    // MAX_CHUNKS'a ulaşıldı
    console.log(`[ChunkSync] Max chunks reached: ${totalWritten} records in ${chunkCount} chunks`);
    return { success: true, totalWritten };
  };

  const startBulkSync = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('En az bir kullanıcı seçin');
      return;
    }

    stopRequestedRef.current = false;
    setStopping(false);
    setSyncing(true);
    setCurrentUserIndex(0);
    setCurrentSourceIndex(0);
    setCurrentPeriodIndex(0);
    
    const usersToSync = users.filter(u => selectedUsers.has(u.user_id));
    const dataSources = await fetchDataSources();
    
    // Progress map'i hazırla
    const newProgress = new Map<string, UserProgress>();
    
    for (const user of usersToSync) {
      const periods = await fetchPeriods(user.user_id, user.dia_sunucu_adi!, user.firma_kodu!);
      
      const sourcesMap = new Map<string, SourceProgress>();
      for (const source of dataSources) {
        const periodsMap = new Map<number, SourcePeriodProgress>();
        
        // Dönem bağımsız kaynaklar sadece aktif dönem (en yüksek period_no) için çekilir
        const relevantPeriods = source.is_period_independent 
          ? [periods[0]] // En yüksek period_no (periods zaten DESC sıralı)
          : periods;
        
        console.log(`[BulkSync] ${source.slug}: ${
          source.is_period_independent 
            ? 'dönem bağımsız (1 dönem)' 
            : `dönem bağımlı (${relevantPeriods.length} dönem)`
        }`);
        
        for (const period of relevantPeriods) {
          periodsMap.set(period.period_no, { status: 'pending' });
        }
        sourcesMap.set(source.slug, { 
          slug: source.slug, 
          name: source.name, 
          periods: periodsMap,
          isPeriodIndependent: source.is_period_independent
        });
      }
      
      newProgress.set(user.user_id, {
        userId: user.user_id,
        status: 'pending',
        sources: sourcesMap,
        totalRecords: 0,
        errorCount: 0,
        successCount: 0
      });
    }
    
    setProgress(new Map(newProgress));

    // Kullanıcı bazlı sync
    for (let userIdx = 0; userIdx < usersToSync.length; userIdx++) {
      if (stopRequestedRef.current) break;
      
      const user = usersToSync[userIdx];
      setCurrentUserIndex(userIdx + 1);
      
      // Kullanıcıyı running yap
      const userProgress = newProgress.get(user.user_id)!;
      userProgress.status = 'running';
      setProgress(new Map(newProgress));
      setExpandedUsers(new Set([user.user_id]));
      
      // Dönemleri tekrar çek (edge function çağrısı içinde güncellenmiş olabilir)
      const periods = await fetchPeriods(user.user_id, user.dia_sunucu_adi!, user.firma_kodu!);
      
      // Her kaynak için
      for (let sourceIdx = 0; sourceIdx < dataSources.length; sourceIdx++) {
        if (stopRequestedRef.current) break;
        
        const source = dataSources[sourceIdx];
        setCurrentSourceIndex(sourceIdx + 1);
        
        const sourceProgress = userProgress.sources.get(source.slug);
        if (!sourceProgress) continue;
        
        // Dönem bağımsız kaynaklar için sadece mevcut dönemleri işle (zaten kısıtlanmış)
        // Dönem bağımlı kaynaklar için yeni dönemleri ekle
        if (!source.is_period_independent) {
          for (const period of periods) {
            if (!sourceProgress.periods.has(period.period_no)) {
              sourceProgress.periods.set(period.period_no, { status: 'pending' });
            }
          }
        }
        
        // Her dönem için
        const periodNos = Array.from(sourceProgress.periods.keys()).sort((a, b) => b - a);
        
        for (let periodIdx = 0; periodIdx < periodNos.length; periodIdx++) {
          if (stopRequestedRef.current) {
            // Kalan tümünü skipped yap
            for (let p = periodIdx; p < periodNos.length; p++) {
              sourceProgress.periods.set(periodNos[p], { status: 'skipped', error: 'İptal edildi' });
            }
            break;
          }
          
          const periodNo = periodNos[periodIdx];
          setCurrentPeriodIndex(periodIdx + 1);
          
          // Running olarak işaretle (chunk modunda)
          sourceProgress.periods.set(periodNo, { 
            status: 'running', 
            isChunking: true, 
            chunksCompleted: 0 
          });
          setProgress(new Map(newProgress));
          
          try {
            // Chunk-bazlı sync kullan
            const result = await syncSourceWithChunks(
              user.user_id,
              source.slug,
              periodNo,
              (written, chunksCompleted, hasMore) => {
                // Progress güncelle
                sourceProgress.periods.set(periodNo, { 
                  status: 'running', 
                  recordsFetched: written,
                  isChunking: true,
                  chunksCompleted
                });
                setProgress(new Map(newProgress));
              }
            );

            if (stopRequestedRef.current) {
              sourceProgress.periods.set(periodNo, { status: 'skipped', error: 'İptal edildi' });
              continue;
            }

            if (!result.success) {
              sourceProgress.periods.set(periodNo, { 
                status: 'error', 
                error: result.error || 'Bilinmeyen hata',
                recordsFetched: result.totalWritten
              });
              userProgress.errorCount++;
            } else {
              sourceProgress.periods.set(periodNo, { 
                status: 'success', 
                recordsFetched: result.totalWritten,
                isChunking: false
              });
              userProgress.totalRecords += result.totalWritten;
              userProgress.successCount++;
            }
          } catch (error) {
            sourceProgress.periods.set(periodNo, { 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Bağlantı hatası' 
            });
            userProgress.errorCount++;
          }
          
          setProgress(new Map(newProgress));
          
          // Rate limiting - dönemler arası kısa bekleme
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Kaynaklar arası bekleme
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Kullanıcı durumunu belirle
      if (stopRequestedRef.current) {
        userProgress.status = 'error';
      } else if (userProgress.errorCount === 0) {
        userProgress.status = 'success';
      } else if (userProgress.successCount > 0) {
        userProgress.status = 'partial';
      } else {
        userProgress.status = 'error';
      }
      
      setProgress(new Map(newProgress));
      
      // Kullanıcılar arası bekleme
      if (userIdx < usersToSync.length - 1 && !stopRequestedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setSyncing(false);
    setStopping(false);
    stopRequestedRef.current = false;
    
    // Sonuç özeti
    const successUsers = Array.from(newProgress.values()).filter(p => p.status === 'success').length;
    const partialUsers = Array.from(newProgress.values()).filter(p => p.status === 'partial').length;
    const errorUsers = Array.from(newProgress.values()).filter(p => p.status === 'error').length;
    const totalRecords = Array.from(newProgress.values()).reduce((sum, p) => sum + p.totalRecords, 0);
    
    if (stopRequestedRef.current) {
      toast.info('Senkronizasyon durduruldu');
    } else if (errorUsers === 0) {
      toast.success(`${successUsers} sunucu için ${totalRecords.toLocaleString()} kayıt senkronize edildi`);
    } else {
      toast.warning(`${successUsers} başarılı, ${partialUsers} kısmi, ${errorUsers} başarısız`);
    }
  };

  const stopSync = () => {
    stopRequestedRef.current = true;
    setStopping(true);
    toast.info('Senkronizasyon durduruluyor...');
  };

  const getOverallProgress = () => {
    if (!syncing) return 0;
    const total = selectedUsers.size;
    return Math.round((currentUserIndex / total) * 100);
  };

  // Hata mesajlarını kullanıcı dostu hale getir
  const getUserFriendlyError = (error: string) => {
    if (error.includes('INSUFFICIENT_PRIVILEGES')) {
      return 'DIA yetkisi eksik';
    }
    if (error.includes('Timeout') || error.includes('timeout')) {
      return 'Zaman aşımı - Veri çok büyük';
    }
    if (error.includes('INVALID_SESSION')) {
      return 'Oturum geçersiz';
    }
    if (error.includes('CREDITS_ERROR') || error.includes('limit')) {
      return 'API limiti aşıldı';
    }
    if (error.length > 50) {
      return error.substring(0, 47) + '...';
    }
    return error;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      case 'running':
        return <RefreshCw className="w-3 h-3 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-destructive" />;
      case 'partial':
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
      case 'skipped':
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Toplu Veri Senkronizasyonu
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Zap className="w-3 h-3" />
                  Chunk-bazlı streaming ile büyük veri desteği
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <Users className="w-3 h-3 mr-1" />
                  {users.length} sunucu
                </Badge>
                <Badge variant="outline">
                  {selectedUsers.size} seçili
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={startBulkSync}
                disabled={syncing || selectedUsers.size === 0}
                className="gap-2"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Senkronize ediliyor...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Senkronizasyonu Başlat
                  </>
                )}
              </Button>
              
              {syncing && (
                <Button 
                  variant="destructive" 
                  onClick={stopSync}
                  disabled={stopping}
                  className="gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  {stopping ? 'Durduruluyor...' : 'Acil Durdur'}
                </Button>
              )}
              
              <Button variant="outline" onClick={loadUsers} disabled={syncing}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Yenile
              </Button>
            </div>
            
            {syncing && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Sunucu {currentUserIndex} / {selectedUsers.size}
                    {stopping && ' (durduruluyor...)'}
                  </span>
                  <span className="font-medium">{getOverallProgress()}%</span>
                </div>
                <Progress value={getOverallProgress()} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* User List with Detailed Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">DIA Sunucuları</CardTitle>
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={syncing}>
                {selectedUsers.size === users.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-border">
                {users.map(user => {
                  const userProgress = progress.get(user.user_id);
                  const isExpanded = expandedUsers.has(user.user_id);
                  
                  return (
                    <Collapsible 
                      key={user.user_id}
                      open={isExpanded}
                      onOpenChange={() => toggleUserExpanded(user.user_id)}
                    >
                      <div className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selectedUsers.has(user.user_id)}
                            onCheckedChange={() => toggleUser(user.user_id)}
                            disabled={syncing}
                          />
                          
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-auto">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {user.display_name || user.email?.split('@')[0] || 'Bilinmeyen'}
                              </span>
                              {user.firma_adi && (
                                <Badge variant="outline" className="text-xs">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {user.firma_adi}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.dia_sunucu_adi} • Firma: {user.firma_kodu}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            {userProgress && (
                              <>
                                {getStatusIcon(userProgress.status)}
                                <span className="text-sm">
                                  {userProgress.status === 'success' && (
                                    <span className="text-green-500">
                                      {userProgress.totalRecords.toLocaleString()} kayıt
                                    </span>
                                  )}
                                  {userProgress.status === 'partial' && (
                                    <span className="text-yellow-500">
                                      {userProgress.successCount} başarılı, {userProgress.errorCount} hatalı
                                    </span>
                                  )}
                                  {userProgress.status === 'error' && (
                                    <span className="text-destructive">Başarısız</span>
                                  )}
                                  {userProgress.status === 'running' && (
                                    <span className="text-primary">Çalışıyor...</span>
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded: Source and Period Details */}
                      <CollapsibleContent>
                        {userProgress && (
                          <div className="px-4 pb-4 pl-16 space-y-2">
                            {Array.from(userProgress.sources.entries()).map(([slug, sourceProgress]) => {
                              const sourceKey = `${user.user_id}-${slug}`;
                              const isSourceExpanded = expandedSources.has(sourceKey);
                              const allSuccess = Array.from(sourceProgress.periods.values()).every(p => p.status === 'success');
                              const hasError = Array.from(sourceProgress.periods.values()).some(p => p.status === 'error');
                              const isRunning = Array.from(sourceProgress.periods.values()).some(p => p.status === 'running');
                              
                              return (
                                <Collapsible 
                                  key={sourceKey}
                                  open={isSourceExpanded}
                                  onOpenChange={() => toggleSourceExpanded(sourceKey)}
                                >
                                  <div className="flex items-center gap-2 py-1">
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="p-0 h-auto">
                                        {isSourceExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                    <FileText className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-sm">{sourceProgress.name}</span>
                                    
                                    {/* Dönem bağımsız badge */}
                                    {sourceProgress.isPeriodIndependent && (
                                      <Badge variant="outline" className="text-xs py-0 px-1.5 h-5">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        Dönem Bağımsız
                                      </Badge>
                                    )}
                                    
                                    {isRunning ? (
                                      <RefreshCw className="w-3 h-3 text-primary animate-spin ml-auto" />
                                    ) : allSuccess ? (
                                      <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />
                                    ) : hasError ? (
                                      <XCircle className="w-3 h-3 text-destructive ml-auto" />
                                    ) : null}
                                  </div>
                                  
                                  <CollapsibleContent>
                                    <div className="pl-6 space-y-1">
                                      {Array.from(sourceProgress.periods.entries())
                                        .sort((a, b) => b[0] - a[0])
                                        .map(([periodNo, periodProgress]) => (
                                          <div key={periodNo} className="flex items-center gap-2 text-xs py-0.5">
                                            {getStatusIcon(periodProgress.status)}
                                            <Layers className="w-3 h-3 text-muted-foreground" />
                                            <span>Dönem {periodNo}</span>
                                            
                                            {/* Chunk ilerleme gösterimi */}
                                            {periodProgress.isChunking && periodProgress.status === 'running' && (
                                              <Badge variant="secondary" className="text-xs py-0 px-1.5 h-5 ml-1">
                                                <Zap className="w-3 h-3 mr-1" />
                                                Chunk {periodProgress.chunksCompleted || 0}
                                                {periodProgress.recordsFetched ? ` - ${periodProgress.recordsFetched.toLocaleString()}` : ''}
                                              </Badge>
                                            )}
                                            
                                            {periodProgress.status === 'success' && (
                                              <span className="text-green-500 ml-auto">
                                                {periodProgress.recordsFetched?.toLocaleString()} kayıt
                                              </span>
                                            )}
                                            {periodProgress.status === 'error' && periodProgress.error && (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className="text-destructive ml-auto truncate max-w-[200px] cursor-help">
                                                    {getUserFriendlyError(periodProgress.error)}
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="left" className="max-w-sm">
                                                  <p className="text-xs">{periodProgress.error}</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
                
                {users.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      DIA yapılandırması olan kullanıcı bulunamadı
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
