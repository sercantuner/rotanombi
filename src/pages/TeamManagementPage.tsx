// TeamManagementPage - Şirket/Takım yönetimi sayfası
// Şirket yetkilisi kendi takımındaki kullanıcıları yönetebilir

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, UserPlus, Trash2, Shield, User, Loader2 } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  is_team_admin: boolean;
}

export function TeamManagementPage() {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Check if current user is a team admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_team_admin')
        .eq('user_id', user.id)
        .single();

      setIsTeamAdmin(profile?.is_team_admin ?? true);
    };

    checkAdminStatus();
  }, [user]);

  // Load team members
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      setIsLoading(true);

      try {
        // Get team members from user_teams
        const { data: teamData, error: teamError } = await supabase
          .from('user_teams')
          .select('member_id, created_at')
          .eq('admin_id', user.id);

        if (teamError) throw teamError;

        // Get profiles for team members
        const memberIds = teamData?.map(t => t.member_id) || [];
        
        if (memberIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, email, display_name, is_team_admin, created_at')
            .in('user_id', memberIds);

          if (profileError) throw profileError;

          const members = profiles?.map(p => ({
            id: p.user_id,
            user_id: p.user_id,
            email: p.email || '',
            display_name: p.display_name || '',
            created_at: p.created_at,
            is_team_admin: p.is_team_admin ?? false,
          })) || [];

          setTeamMembers(members);
        } else {
          setTeamMembers([]);
        }
      } catch (error) {
        console.error('Error loading team members:', error);
        toast.error('Takım üyeleri yüklenemedi');
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamMembers();
  }, [user]);

  const handleCreateUser = async () => {
    if (!user || !newUserEmail || !newUserPassword) {
      toast.error('Email ve şifre gerekli');
      return;
    }

    setIsCreating(true);

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserDisplayName || newUserEmail.split('@')[0],
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Add to team
        const { error: teamError } = await supabase
          .from('user_teams')
          .insert({
            admin_id: user.id,
            member_id: authData.user.id,
          });

        if (teamError) throw teamError;

        // Update profile to mark as non-admin
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_team_admin: false })
          .eq('user_id', authData.user.id);

        if (profileError) console.error('Profile update error:', profileError);

        // Refresh team members
        const newMember: TeamMember = {
          id: authData.user.id,
          user_id: authData.user.id,
          email: newUserEmail,
          display_name: newUserDisplayName || newUserEmail.split('@')[0],
          created_at: new Date().toISOString(),
          is_team_admin: false,
        };

        setTeamMembers(prev => [...prev, newMember]);
        toast.success('Kullanıcı başarıyla oluşturuldu');
        setShowAddDialog(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserDisplayName('');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Kullanıcı oluşturulamadı');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveFromTeam = async (memberId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_teams')
        .delete()
        .eq('admin_id', user.id)
        .eq('member_id', memberId);

      if (error) throw error;

      // Update member's profile to be independent admin
      await supabase
        .from('profiles')
        .update({ is_team_admin: true })
        .eq('user_id', memberId);

      setTeamMembers(prev => prev.filter(m => m.user_id !== memberId));
      toast.success('Kullanıcı takımdan çıkarıldı');
    } catch (error) {
      console.error('Error removing from team:', error);
      toast.error('Kullanıcı çıkarılamadı');
    }
  };

  if (!isTeamAdmin) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Takım Yönetimi" subtitle="Bu sayfaya erişim yetkiniz yok" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-warning" />
                Erişim Engellendi
              </CardTitle>
              <CardDescription>
                Bu sayfayı görüntülemek için şirket yetkilisi olmanız gerekiyor.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Takım Yönetimi" 
        subtitle="Şirketinizdeki kullanıcıları yönetin"
      />

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamMembers.length}</p>
                    <p className="text-sm text-muted-foreground">Takım Üyesi</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Members Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Takım Üyeleri</CardTitle>
                <CardDescription>
                  Şirketinize bağlı kullanıcılar
                </CardDescription>
              </div>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Kullanıcı Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
                    <DialogDescription>
                      Şirketinize yeni bir kullanıcı ekleyin. Bu kullanıcı sizin widget'larınızı ve veri kaynaklarınızı görebilir ancak DIA bağlantı ayarlarını değiştiremez.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">İsim</Label>
                      <Input
                        id="displayName"
                        placeholder="Kullanıcı adı"
                        value={newUserDisplayName}
                        onChange={(e) => setNewUserDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="kullanici@sirket.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Şifre</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      İptal
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isCreating}>
                      {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Oluştur
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Henüz takım üyeniz yok</p>
                  <p className="text-sm">Yeni kullanıcı ekleyerek başlayın</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Eklenme Tarihi</TableHead>
                      <TableHead className="w-[100px]">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium">{member.display_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            Takım Üyesi
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Kullanıcıyı Çıkar</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {member.display_name} kullanıcısını takımdan çıkarmak istediğinize emin misiniz? Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveFromTeam(member.user_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Çıkar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
