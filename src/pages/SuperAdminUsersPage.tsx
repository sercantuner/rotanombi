// Super Admin Kullanıcı Yönetimi Sayfası - Full DataGrid
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Eye, 
  Calendar,
  Shield,
  Search,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Wifi,
  WifiOff,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, differenceInDays, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UserLicenseModal } from '@/components/admin/UserLicenseModal';
import { cn } from '@/lib/utils';

interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  license_type: string | null;
  license_expires_at: string | null;
  is_team_admin: boolean | null;
  dia_sunucu_adi: string | null;
  firma_adi: string | null;
  donem_yili: string | null;
  created_at: string;
  roles?: { role: string; user_id: string }[];
}

type SortField = 'display_name' | 'email' | 'firma_adi' | 'license_expires_at' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function SuperAdminUsersPage() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: permLoading } = usePermissions();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [licenseFilter, setLicenseFilter] = useState<string>('all');
  const [diaFilter, setDiaFilter] = useState<string>('all');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Tüm kullanıcıları yükle
  useEffect(() => {
    if (!isSuperAdmin) return;

    const loadUsers = async () => {
      setLoading(true);
      
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, donem_yili, created_at')
        .order('created_at', { ascending: false });

      if (profileError) {
        console.error('Error loading profiles:', profileError);
        setLoading(false);
        return;
      }

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        roles: (rolesData || []).filter(r => r.user_id === profile.user_id)
      })) as UserProfile[];

      setUsers(usersWithRoles);
      setLoading(false);
    };

    loadUsers();
  }, [isSuperAdmin]);

  const getLicenseStatus = (user: UserProfile) => {
    if (!user.license_expires_at) {
      return { label: 'Belirsiz', variant: 'secondary' as const, days: null, status: 'unknown' };
    }
    
    const expiresAt = new Date(user.license_expires_at);
    const daysLeft = differenceInDays(expiresAt, new Date());
    
    if (isPast(expiresAt)) {
      return { label: 'Süresi Doldu', variant: 'destructive' as const, days: daysLeft, status: 'expired' };
    }
    
    if (daysLeft <= 7) {
      return { label: `${daysLeft} gün`, variant: 'destructive' as const, days: daysLeft, status: 'critical' };
    }
    
    if (daysLeft <= 30) {
      return { label: `${daysLeft} gün`, variant: 'warning' as const, days: daysLeft, status: 'warning' };
    }
    
    return { label: `${daysLeft} gün`, variant: 'success' as const, days: daysLeft, status: 'active' };
  };

  const getUserRole = (user: UserProfile) => {
    if (user.roles?.some(r => r.role === 'super_admin')) return { label: 'Süper Admin', value: 'super_admin' };
    if (user.roles?.some(r => r.role === 'admin')) return { label: 'Admin', value: 'admin' };
    if (user.is_team_admin) return { label: 'Şirket Yetkilisi', value: 'team_admin' };
    return { label: 'Kullanıcı', value: 'user' };
  };

  // Filtreleme ve sıralama
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Arama
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user => 
        user.email?.toLowerCase().includes(term) ||
        user.display_name?.toLowerCase().includes(term) ||
        user.firma_adi?.toLowerCase().includes(term)
      );
    }

    // Rol filtresi
    if (roleFilter !== 'all') {
      result = result.filter(user => {
        const role = getUserRole(user);
        return role.value === roleFilter;
      });
    }

    // Lisans filtresi
    if (licenseFilter !== 'all') {
      result = result.filter(user => {
        const license = getLicenseStatus(user);
        return license.status === licenseFilter;
      });
    }

    // DIA filtresi
    if (diaFilter !== 'all') {
      result = result.filter(user => {
        const hasDia = !!user.dia_sunucu_adi;
        return diaFilter === 'connected' ? hasDia : !hasDia;
      });
    }

    // Sıralama
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'display_name') {
        aVal = a.display_name || a.email || '';
        bVal = b.display_name || b.email || '';
      }

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchTerm, roleFilter, licenseFilter, diaFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> 
      : <ChevronDown className="w-3.5 h-3.5 ml-1" />;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setLicenseFilter('all');
    setDiaFilter('all');
  };

  const hasActiveFilters = searchTerm || roleFilter !== 'all' || licenseFilter !== 'all' || diaFilter !== 'all';

  const handleViewUser = (user: UserProfile) => {
    // Navigate to super admin panel with user selected
    navigate('/super-admin-panel', { state: { impersonateUserId: user.user_id } });
  };

  const handleEditLicense = (user: UserProfile) => {
    setSelectedUser(user);
    setShowLicenseModal(true);
  };

  const refreshUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, donem_yili, created_at')
      .order('created_at', { ascending: false });

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const usersWithRoles = (profiles || []).map(profile => ({
      ...profile,
      roles: (rolesData || []).filter(r => r.user_id === profile.user_id)
    })) as UserProfile[];

    setUsers(usersWithRoles);
  };

  // Yetki kontrolü
  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Erişim Engellendi</h3>
        <p className="text-muted-foreground max-w-md">
          Bu sayfa sadece Süper Yöneticiler için erişilebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Kullanıcı Yönetimi</h1>
              <p className="text-sm text-muted-foreground">
                {filteredAndSortedUsers.length} / {users.length} kullanıcı
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/super-admin-panel')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Süper Admin Paneli
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Kullanıcı, email veya firma ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Roller</SelectItem>
              <SelectItem value="super_admin">Süper Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="team_admin">Şirket Yetkilisi</SelectItem>
              <SelectItem value="user">Kullanıcı</SelectItem>
            </SelectContent>
          </Select>

          {/* License Filter */}
          <Select value={licenseFilter} onValueChange={setLicenseFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Lisans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Lisanslar</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="warning">Süresi Yaklaşan</SelectItem>
              <SelectItem value="critical">Kritik</SelectItem>
              <SelectItem value="expired">Süresi Dolmuş</SelectItem>
            </SelectContent>
          </Select>

          {/* DIA Filter */}
          <Select value={diaFilter} onValueChange={setDiaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="DIA Durumu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm DIA</SelectItem>
              <SelectItem value="connected">Bağlı</SelectItem>
              <SelectItem value="disconnected">Bağlı Değil</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('display_name')}
                  >
                    <div className="flex items-center">
                      Kullanıcı
                      <SortIcon field="display_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('firma_adi')}
                  >
                    <div className="flex items-center">
                      Firma
                      <SortIcon field="firma_adi" />
                    </div>
                  </TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('license_expires_at')}
                  >
                    <div className="flex items-center">
                      Lisans
                      <SortIcon field="license_expires_at" />
                    </div>
                  </TableHead>
                  <TableHead>DIA</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center">
                      Kayıt Tarihi
                      <SortIcon field="created_at" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Kullanıcı bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedUsers.map(user => {
                    const licenseStatus = getLicenseStatus(user);
                    const userRole = getUserRole(user);
                    const hasDia = !!user.dia_sunucu_adi;
                    
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {user.display_name || user.email?.split('@')[0] || 'Bilinmeyen'}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{user.firma_adi || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {userRole.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={licenseStatus.variant === 'success' ? 'default' : licenseStatus.variant === 'warning' ? 'secondary' : licenseStatus.variant}
                            className={cn(
                              "text-xs",
                              licenseStatus.variant === 'warning' && "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
                              licenseStatus.variant === 'success' && "bg-green-500/20 text-green-600 border-green-500/30"
                            )}
                          >
                            {user.license_type === 'demo' ? 'Demo' : 'Standart'} • {licenseStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasDia ? (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <Wifi className="w-4 h-4" />
                              <span className="text-xs">{user.dia_sunucu_adi}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <WifiOff className="w-4 h-4" />
                              <span className="text-xs">Bağlı Değil</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {user.created_at 
                              ? format(new Date(user.created_at), 'dd MMM yyyy', { locale: tr })
                              : '-'
                            }
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewUser(user)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Görüntüle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditLicense(user)}>
                                <Calendar className="w-4 h-4 mr-2" />
                                Lisans Düzenle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </ScrollArea>

      {/* License Modal */}
      {selectedUser && (
        <UserLicenseModal
          open={showLicenseModal}
          onOpenChange={setShowLicenseModal}
          user={{
            user_id: selectedUser.user_id,
            email: selectedUser.email,
            display_name: selectedUser.display_name,
            firma_adi: selectedUser.firma_adi,
            license_type: selectedUser.license_type,
            license_expires_at: selectedUser.license_expires_at,
            roles: selectedUser.roles,
          }}
          onSave={refreshUsers}
        />
      )}
    </div>
  );
}
