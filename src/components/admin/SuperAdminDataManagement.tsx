// Super Admin Data Management - Kullanıcı bazında veri yönetimi
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDataSources } from '@/hooks/useDataSources';
import { useFirmaPeriods } from '@/hooks/useFirmaPeriods';
import { 
  Database, HardDrive, Users, Search, User, Trash2, 
  Loader2, RefreshCw, AlertCircle, CheckCircle2, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  dia_sunucu_adi: string | null;
  firma_adi: string | null;
  roles?: { role: string; user_id: string }[];
}

interface Props {
  users: UserProfile[];
}

interface DataSourceStats {
  slug: string;
  name: string;
  count: number;
}

export default function SuperAdminDataManagement({ users }: Props) {
  const { dataSources } = useDataSources();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<DataSourceStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.firma_adi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadUserStats = async (user: UserProfile) => {
    if (!user.dia_sunucu_adi) {
      setStats([]);
      return;
    }

    setLoading(true);
    try {
      // Get firma_kodu from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('firma_kodu, dia_sunucu_adi')
        .eq('user_id', user.user_id)
        .single();

      if (!profile?.firma_kodu || !profile?.dia_sunucu_adi) {
        setStats([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase.rpc('get_cache_record_counts', {
        p_sunucu_adi: profile.dia_sunucu_adi,
        p_firma_kodu: profile.firma_kodu,
      });

      const result: DataSourceStats[] = (data || []).map((d: any) => {
        const ds = dataSources.find(s => s.slug === d.data_source_slug);
        return {
          slug: d.data_source_slug,
          name: ds?.name || d.data_source_slug,
          count: d.record_count,
        };
      });

      setStats(result.sort((a, b) => b.count - a.count));
    } catch (err) {
      console.error('Error loading stats:', err);
      toast.error('Veri istatistikleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setSearchOpen(false);
    loadUserStats(user);
  };

  const handleDeleteDataSource = async () => {
    if (!selectedUser || !deleteTarget) return;
    setDeleting(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('firma_kodu, dia_sunucu_adi')
        .eq('user_id', selectedUser.user_id)
        .single();

      if (!profile?.firma_kodu || !profile?.dia_sunucu_adi) return;

      const { error } = await supabase
        .from('company_data_cache')
        .delete()
        .eq('sunucu_adi', profile.dia_sunucu_adi)
        .eq('firma_kodu', profile.firma_kodu)
        .eq('data_source_slug', deleteTarget.slug);

      if (error) throw error;

      toast.success(`${deleteTarget.name} verileri silindi`);
      setDeleteTarget(null);
      loadUserStats(selectedUser);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!selectedUser) return;
    setDeleting(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('firma_kodu, dia_sunucu_adi')
        .eq('user_id', selectedUser.user_id)
        .single();

      if (!profile?.firma_kodu || !profile?.dia_sunucu_adi) return;

      const { error } = await supabase
        .from('company_data_cache')
        .delete()
        .eq('sunucu_adi', profile.dia_sunucu_adi)
        .eq('firma_kodu', profile.firma_kodu);

      if (error) throw error;

      // Also clear sync status
      await supabase
        .from('period_sync_status')
        .delete()
        .eq('sunucu_adi', profile.dia_sunucu_adi)
        .eq('firma_kodu', profile.firma_kodu);

      // Clear sync history
      await supabase
        .from('sync_history')
        .delete()
        .eq('sunucu_adi', profile.dia_sunucu_adi)
        .eq('firma_kodu', profile.firma_kodu);

      toast.success('Tüm veriler silindi');
      setDeleteAllConfirm(false);
      loadUserStats(selectedUser);
    } catch (err) {
      console.error('Delete all error:', err);
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleting(false);
    }
  };

  const totalRecords = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6" />
            Veri Yönetimi
          </h2>
          <p className="text-muted-foreground">Kullanıcı bazında veri kaynakları ve önbellek yönetimi</p>
        </div>
      </div>

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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Database className="h-4 w-4" />
                      <span className="text-xs">Veri Kaynakları</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.length}</p>
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
                  <CardContent className="pt-4 flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Trash2 className="h-4 w-4" />
                        <span className="text-xs">İşlemler</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadUserStats(selectedUser)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => setDeleteAllConfirm(true)}
                        disabled={totalRecords === 0}
                      >
                        Tümünü Sil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Data Sources List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Veri Kaynakları</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>Bu kullanıcı için önbelleklenmiş veri bulunamadı</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {stats.map(ds => (
                          <div key={ds.slug} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{ds.name}</p>
                                <p className="text-xs text-muted-foreground">{ds.slug}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant="secondary">{ds.count.toLocaleString('tr-TR')} kayıt</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                onClick={() => setDeleteTarget({ slug: ds.slug, name: ds.name })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Delete Single Data Source */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Veri Kaynağını Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" verileri <strong>{selectedUser?.display_name || selectedUser?.email}</strong> için kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDataSource} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Data */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm Verileri Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedUser?.display_name || selectedUser?.email}</strong> kullanıcısına ait {totalRecords.toLocaleString('tr-TR')} kayıt, senkronizasyon geçmişi ve dönem kilitleri kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllData} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Tümünü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
