// User License Modal - Lisans düzenleme modalı
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMonths, addYears } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, Loader2, Shield, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ImpersonatedProfile } from '@/contexts/ImpersonationContext';

interface UserLicenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ImpersonatedProfile & { roles?: { role: string }[] };
  onSave: () => void;
}

export function UserLicenseModal({ open, onOpenChange, user, onSave }: UserLicenseModalProps) {
  const [licenseType, setLicenseType] = useState(user.license_type || 'standard');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(
    user.license_expires_at ? new Date(user.license_expires_at) : undefined
  );
  const [userRole, setUserRole] = useState<string>(
    user.roles?.find(r => r.role === 'super_admin')?.role ||
    user.roles?.find(r => r.role === 'admin')?.role ||
    'user'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Profili güncelle
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          license_type: licenseType,
          license_expires_at: expiresAt?.toISOString()
        })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      // Rolü güncelle
      // Önce mevcut rolleri sil (super_admin ve admin)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.user_id)
        .in('role', ['super_admin', 'admin']);

      // Yeni rolü ekle (user hariç)
      if (userRole !== 'user') {
        await supabase
          .from('user_roles')
          .insert([{
            user_id: user.user_id,
            role: userRole as 'admin' | 'super_admin'
          }]);
      }

      toast.success('Kullanıcı bilgileri güncellendi');
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickDate = (months: number) => {
    setExpiresAt(addMonths(new Date(), months));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Kullanıcı Ayarları
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Kullanıcı Bilgisi */}
          <div className="bg-muted rounded-lg p-4">
            <p className="font-medium">{user.display_name || 'Bilinmeyen'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.firma_adi && (
              <p className="text-xs text-muted-foreground mt-1">{user.firma_adi}</p>
            )}
          </div>

          {/* Rol Seçimi */}
          <div className="space-y-2">
            <Label>Kullanıcı Rolü</Label>
            <Select value={userRole} onValueChange={setUserRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <span>Kullanıcı</span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span>Şirket Yetkilisi (Admin)</span>
                  </div>
                </SelectItem>
                <SelectItem value="super_admin">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span>Süper Admin</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lisans Tipi */}
          <div className="space-y-2">
            <Label>Lisans Tipi</Label>
            <Select value={licenseType} onValueChange={setLicenseType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo">Demo (1 Ay)</SelectItem>
                <SelectItem value="standard">Standart (1 Yıl)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bitiş Tarihi */}
          <div className="space-y-2">
            <Label>Lisans Bitiş Tarihi</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiresAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, 'PPP', { locale: tr }) : 'Tarih seçin'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Hızlı Tarih Butonları */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDate(1)}
                className="flex-1"
              >
                +1 Ay
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDate(6)}
                className="flex-1"
              >
                +6 Ay
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDate(12)}
                className="flex-1"
              >
                +1 Yıl
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
