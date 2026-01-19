// Widget Yetkilendirme Paneli - Kullanıcılara widget bazlı yetki atama

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWidgets } from '@/hooks/useWidgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, LayoutGrid, Eye, Plus, Check, X, Users } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Widget, PAGE_CATEGORIES, WIDGET_TYPES } from '@/lib/widgetTypes';

interface UserOption {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
}

interface WidgetPermission {
  id: string;
  user_id: string;
  widget_id: string;
  can_view: boolean;
  can_add: boolean;
}

// Kategori renkleri
const categoryColors: Record<string, string> = {
  dashboard: 'bg-blue-500/10 text-blue-500',
  satis: 'bg-green-500/10 text-green-500',
  finans: 'bg-amber-500/10 text-amber-500',
  cari: 'bg-purple-500/10 text-purple-500',
};

export function WidgetPermissionsPanel() {
  const { user } = useAuth();
  const { widgets, isLoading: widgetsLoading } = useWidgets();
  
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permissions, setPermissions] = useState<WidgetPermission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Kullanıcıları yükle
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, email, display_name')
          .neq('user_id', user?.id || '');
        
        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, [user]);

  // Seçili kullanıcının izinlerini yükle
  useEffect(() => {
    if (!selectedUserId) {
      setPermissions([]);
      return;
    }

    const loadPermissions = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('widget_permissions')
          .select('*')
          .eq('user_id', selectedUserId);
        
        if (error) throw error;
        setPermissions((data as unknown as WidgetPermission[]) || []);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPermissions();
  }, [selectedUserId]);

  // Filtrelenmiş widget'lar
  const filteredWidgets = useMemo(() => {
    return widgets.filter(widget => {
      if (!widget.is_active) return false;
      const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (widget.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [widgets, searchTerm, selectedCategory]);

  // Widget için izin durumunu al
  const getPermission = (widgetId: string) => {
    return permissions.find(p => p.widget_id === widgetId);
  };

  // İzni güncelle
  const updatePermission = async (widgetId: string, field: 'can_view' | 'can_add', value: boolean) => {
    if (!selectedUserId) return;

    setIsSaving(true);
    try {
      const existing = getPermission(widgetId);
      
      if (existing) {
        // Güncelle
        const { error } = await supabase
          .from('widget_permissions')
          .update({ [field]: value })
          .eq('id', existing.id);
        
        if (error) throw error;
        
        setPermissions(prev => prev.map(p => 
          p.id === existing.id ? { ...p, [field]: value } : p
        ));
      } else {
        // Yeni ekle
        const { data, error } = await supabase
          .from('widget_permissions')
          .insert({
            user_id: selectedUserId,
            widget_id: widgetId,
            can_view: field === 'can_view' ? value : false,
            can_add: field === 'can_add' ? value : false,
            granted_by: user?.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        setPermissions(prev => [...prev, data as unknown as WidgetPermission]);
      }
      
      toast.success('İzin güncellendi');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('İzin güncellenirken hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  // Tüm widget'ları seç/kaldır
  const toggleAllWidgets = async (field: 'can_view' | 'can_add', value: boolean) => {
    if (!selectedUserId) return;

    setIsSaving(true);
    try {
      for (const widget of filteredWidgets) {
        const existing = getPermission(widget.id);
        
        if (existing) {
          await supabase
            .from('widget_permissions')
            .update({ [field]: value })
            .eq('id', existing.id);
        } else if (value) {
          await supabase
            .from('widget_permissions')
            .insert({
              user_id: selectedUserId,
              widget_id: widget.id,
              can_view: field === 'can_view' ? value : false,
              can_add: field === 'can_add' ? value : false,
              granted_by: user?.id,
            });
        }
      }

      // İzinleri yeniden yükle
      const { data } = await supabase
        .from('widget_permissions')
        .select('*')
        .eq('user_id', selectedUserId);
      
      setPermissions((data as unknown as WidgetPermission[]) || []);
      toast.success(`Tüm ${field === 'can_view' ? 'görüntüleme' : 'ekleme'} izinleri güncellendi`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('İzinler güncellenirken hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          Widget Yetkilendirme
        </CardTitle>
        <CardDescription>
          Kullanıcılara widget bazlı görüntüleme ve ekleme izinleri tanımlayın
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Kullanıcı Seçimi */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Kullanıcı seçin..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{u.display_name || u.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedUser && (
            <Badge variant="outline">
              {selectedUser.email}
            </Badge>
          )}
        </div>

        {selectedUserId && (
          <>
            {/* Arama ve Filtreler */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Widget ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList>
                  <TabsTrigger value="all">Tümü</TabsTrigger>
                  {PAGE_CATEGORIES.map(cat => (
                    <TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Toplu İşlemler */}
            <div className="flex items-center gap-2 border-b pb-4">
              <span className="text-sm text-muted-foreground mr-2">Toplu:</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleAllWidgets('can_view', true)}
                disabled={isSaving}
              >
                <Eye className="h-4 w-4 mr-1" />
                Tümünü Görüntüle
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleAllWidgets('can_add', true)}
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-1" />
                Tümünü Ekle
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => toggleAllWidgets('can_view', false)}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Tümünü Kaldır
              </Button>
            </div>

            {/* Widget Listesi */}
            <ScrollArea className="h-[400px]">
              {isLoading || widgetsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredWidgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium">Widget bulunamadı</h3>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredWidgets.map((widget) => {
                    const Icon = (LucideIcons as any)[widget.icon || 'LayoutGrid'] || LucideIcons.LayoutGrid;
                    const perm = getPermission(widget.id);
                    
                    return (
                      <div
                        key={widget.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{widget.name}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="secondary" className={`text-xs ${categoryColors[widget.category] || ''}`}>
                                {PAGE_CATEGORIES.find(c => c.id === widget.category)?.name}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {WIDGET_TYPES.find(t => t.id === widget.type)?.name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Görüntüle</span>
                            <Switch
                              checked={perm?.can_view ?? false}
                              onCheckedChange={(checked) => updatePermission(widget.id, 'can_view', checked)}
                              disabled={isSaving}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Ekle</span>
                            <Switch
                              checked={perm?.can_add ?? false}
                              onCheckedChange={(checked) => updatePermission(widget.id, 'can_add', checked)}
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer Stats */}
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>
                {permissions.filter(p => p.can_view).length} / {widgets.filter(w => w.is_active).length} widget görüntüleme izni
              </span>
              <span>
                {permissions.filter(p => p.can_add).length} / {widgets.filter(w => w.is_active).length} widget ekleme izni
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
