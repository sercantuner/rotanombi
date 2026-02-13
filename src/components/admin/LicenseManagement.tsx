// Super Admin License Management - Tüm kullanıcıların lisans yönetimi
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, Crown, Search, User, Calendar, Loader2, 
  CheckCircle2, AlertCircle, Clock, Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { UserLicenseModal } from '@/components/admin/UserLicenseModal';
import { differenceInDays, isPast, format } from 'date-fns';
import { tr } from 'date-fns/locale';
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
  roles?: { role: string; user_id: string }[];
}

interface Props {
  users: UserProfile[];
  onRefresh: () => void;
}

export default function LicenseManagement({ users, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'expired' | 'expiring' | 'active'>('all');

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
      return { label: `${daysLeft} gün`, variant: 'destructive' as const, days: daysLeft, status: 'expiring' };
    }
    if (daysLeft <= 30) {
      return { label: `${daysLeft} gün`, variant: 'secondary' as const, days: daysLeft, status: 'expiring' };
    }
    return { label: `${daysLeft} gün`, variant: 'default' as const, days: daysLeft, status: 'active' };
  };

  const getUserRole = (user: UserProfile) => {
    if (user.roles?.some(r => r.role === 'super_admin')) return 'Süper Admin';
    if (user.roles?.some(r => r.role === 'admin')) return 'Admin';
    if (user.is_team_admin) return 'Şirket Yetkilisi';
    return 'Kullanıcı';
  };

  const filtered = users.filter(u => {
    const matchesSearch = 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firma_adi?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterStatus === 'all') return true;
    
    const status = getLicenseStatus(u);
    return status.status === filterStatus;
  });

  // Summary counts
  const expiredCount = users.filter(u => getLicenseStatus(u).status === 'expired').length;
  const expiringCount = users.filter(u => getLicenseStatus(u).status === 'expiring').length;
  const activeCount = users.filter(u => getLicenseStatus(u).status === 'active').length;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={cn("cursor-pointer transition-colors", filterStatus === 'all' && "ring-2 ring-primary")}
            onClick={() => setFilterStatus('all')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Shield className="h-4 w-4" />
                <span className="text-xs">Toplam</span>
              </div>
              <p className="text-2xl font-bold">{users.length}</p>
            </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-colors", filterStatus === 'active' && "ring-2 ring-primary")}
            onClick={() => setFilterStatus('active')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">Aktif</span>
              </div>
              <p className="text-2xl font-bold">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-colors", filterStatus === 'expiring' && "ring-2 ring-primary")}
            onClick={() => setFilterStatus('expiring')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Süresi Dolacak</span>
              </div>
              <p className="text-2xl font-bold">{expiringCount}</p>
            </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-colors", filterStatus === 'expired' && "ring-2 ring-primary")}
            onClick={() => setFilterStatus('expired')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">Süresi Dolmuş</span>
              </div>
              <p className="text-2xl font-bold">{expiredCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kullanıcı, e-posta veya firma ara..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* User List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Lisans Listesi ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filtered.map(user => {
                  const license = getLicenseStatus(user);
                  return (
                    <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {user.display_name || user.email?.split('@')[0] || 'Bilinmeyen'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                            {user.firma_adi && ` • ${user.firma_adi}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role */}
                        <Badge variant="outline" className="text-[10px]">
                          {getUserRole(user)}
                        </Badge>

                        {/* License Type */}
                        <Badge variant="secondary" className="text-[10px]">
                          {user.license_type === 'demo' ? 'Demo' : 'Standart'}
                        </Badge>

                        {/* License Status */}
                        <Badge variant={license.variant} className="text-[10px] min-w-[70px] justify-center">
                          {license.label}
                        </Badge>

                        {/* Expiry Date */}
                        {user.license_expires_at && (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(user.license_expires_at), 'dd MMM yyyy', { locale: tr })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Lisans Bitiş Tarihi</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Edit Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => { setSelectedUser(user); setShowModal(true); }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* License Modal */}
        {selectedUser && (
          <UserLicenseModal
            open={showModal}
            onOpenChange={setShowModal}
            user={selectedUser}
            onSave={onRefresh}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
