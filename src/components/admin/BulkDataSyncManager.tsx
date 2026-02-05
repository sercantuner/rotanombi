// BulkDataSyncManager - Tüm kullanıcılar için toplu veri senkronizasyonu
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
  StopCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

interface UserWithDiaConfig {
  user_id: string;
  email: string | null;
  display_name: string | null;
  firma_adi: string | null;
  dia_sunucu_adi: string | null;
  firma_kodu: string | null;
  donem_kodu: string | null;
}

interface SyncProgress {
  userId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  recordsTotal?: number;
}

export function BulkDataSyncManager() {
  const [users, setUsers] = useState<UserWithDiaConfig[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<Map<string, SyncProgress>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Acil stop için abort controller
  const abortControllerRef = useRef<AbortController | null>(null);
  const [stopping, setStopping] = useState(false);

  // DIA yapılandırması olan kullanıcıları yükle
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
      setUsers(data || []);
      // Varsayılan olarak tümünü seç
      setSelectedUsers(new Set((data || []).map(u => u.user_id)));
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

  const startBulkSync = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('En az bir kullanıcı seçin');
      return;
    }

    // Yeni abort controller oluştur
    abortControllerRef.current = new AbortController();
    setStopping(false);
    setSyncing(true);
    setCurrentIndex(0);
    
    const usersToSync = users.filter(u => selectedUsers.has(u.user_id));
    const newProgress = new Map<string, SyncProgress>();
    
    // Tümünü pending olarak işaretle
    usersToSync.forEach(u => {
      newProgress.set(u.user_id, { userId: u.user_id, status: 'pending' });
    });
    setProgress(new Map(newProgress));

    // Sırayla her kullanıcı için sync yap
    for (let i = 0; i < usersToSync.length; i++) {
      // Acil stop kontrolü
      if (abortControllerRef.current?.signal.aborted) {
        // Kalan kullanıcıları "cancelled" olarak işaretle
        for (let j = i; j < usersToSync.length; j++) {
          const remainingUser = usersToSync[j];
          if (newProgress.get(remainingUser.user_id)?.status === 'pending') {
            newProgress.set(remainingUser.user_id, { 
              userId: remainingUser.user_id, 
              status: 'error',
              message: 'İptal edildi',
            });
          }
        }
        setProgress(new Map(newProgress));
        break;
      }

      const user = usersToSync[i];
      setCurrentIndex(i + 1);
      
      // Running olarak güncelle
      newProgress.set(user.user_id, { userId: user.user_id, status: 'running' });
      setProgress(new Map(newProgress));

      try {
        const response = await supabase.functions.invoke('dia-data-sync', {
          body: {
            action: 'syncAllForUser',
            targetUserId: user.user_id,
          },
        });

        // Stop sonrası response gelirse kontrol et
        if (abortControllerRef.current?.signal.aborted) {
          newProgress.set(user.user_id, { 
            userId: user.user_id, 
            status: 'error',
            message: 'İptal edildi',
          });
          setProgress(new Map(newProgress));
          continue;
        }

        if (response.error) {
          throw new Error(response.error.message);
        }

        const data = response.data;
        
        if (data.success) {
          const totalRecords = data.results?.reduce((sum: number, r: any) => sum + (r.recordsFetched || 0), 0) || 0;
          newProgress.set(user.user_id, { 
            userId: user.user_id, 
            status: 'success',
            message: `${data.totalSynced || 0} kaynak senkronize edildi`,
            recordsTotal: totalRecords,
          });
        } else {
          newProgress.set(user.user_id, { 
            userId: user.user_id, 
            status: 'error',
            message: data.error || 'Bilinmeyen hata',
          });
        }
      } catch (error) {
        newProgress.set(user.user_id, { 
          userId: user.user_id, 
          status: 'error',
          message: error instanceof Error ? error.message : 'Bağlantı hatası',
        });
      }
      
      setProgress(new Map(newProgress));
      
      // Rate limiting - her kullanıcı arasında 2 saniye bekle (stop edilmediyse)
      if (i < usersToSync.length - 1 && !abortControllerRef.current?.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setSyncing(false);
    setStopping(false);
    abortControllerRef.current = null;
    
    const successCount = Array.from(newProgress.values()).filter(p => p.status === 'success').length;
    const errorCount = Array.from(newProgress.values()).filter(p => p.status === 'error').length;
    const cancelledCount = Array.from(newProgress.values()).filter(p => p.message === 'İptal edildi').length;
    
    if (cancelledCount > 0) {
      toast.info(`Senkronizasyon durduruldu. ${successCount} başarılı, ${cancelledCount} iptal edildi`);
    } else if (errorCount === 0) {
      toast.success(`${successCount} kullanıcı için veri senkronizasyonu tamamlandı`);
    } else {
      toast.warning(`${successCount} başarılı, ${errorCount} başarısız`);
    }
  };

  const stopSync = () => {
    if (abortControllerRef.current) {
      setStopping(true);
      abortControllerRef.current.abort();
      toast.info('Senkronizasyon durduruluyor...');
    }
  };

  const getProgressPercent = () => {
    if (!syncing) return 0;
    return Math.round((currentIndex / selectedUsers.size) * 100);
  };

  const getStatusIcon = (status: SyncProgress['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
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
              <CardDescription>
                Tüm kayıtlı kullanıcılar için DIA'dan veri çekip veritabanına kaydet
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Users className="w-3 h-3 mr-1" />
                {users.length} kullanıcı
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
            
            {/* Acil Stop Butonu */}
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
              Listeyi Yenile
            </Button>
          </div>
          
          {syncing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  İlerleme {stopping && '(durduruluyor...)'}
                </span>
                <span className="font-medium">{currentIndex} / {selectedUsers.size}</span>
              </div>
              <Progress value={getProgressPercent()} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kullanıcı Listesi */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">DIA Yapılandırması Olan Kullanıcılar</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleAll} disabled={syncing}>
              {selectedUsers.size === users.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border">
              {users.map(user => {
                const userProgress = progress.get(user.user_id);
                
                return (
                  <div 
                    key={user.user_id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedUsers.has(user.user_id)}
                      onCheckedChange={() => toggleUser(user.user_id)}
                      disabled={syncing}
                    />
                    
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
                        {user.email} • {user.dia_sunucu_adi}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        Firma: {user.firma_kodu || '-'} / Dönem: {user.donem_kodu || '-'}
                      </Badge>
                      
                      {userProgress && (
                        <div className="flex items-center gap-2 min-w-[150px]">
                          {getStatusIcon(userProgress.status)}
                          <span className="text-xs text-muted-foreground truncate">
                            {userProgress.status === 'running' && 'Senkronize ediliyor...'}
                            {userProgress.status === 'success' && (
                              <span className="text-success">
                                {userProgress.recordsTotal || 0} kayıt
                              </span>
                            )}
                            {userProgress.status === 'error' && (
                              <span className="text-destructive" title={userProgress.message}>
                                Hata
                              </span>
                            )}
                            {userProgress.status === 'pending' && 'Bekliyor'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
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
  );
}
