// Super Admin Widget Manager - Widget ve kategori yönetimi
import React, { useState } from 'react';
import { useWidgets, useWidgetAdmin } from '@/hooks/useWidgets';
import { useWidgetCategories } from '@/hooks/useWidgetCategories';
import { Widget, WidgetFormData } from '@/lib/widgetTypes';
import { WidgetBuilder } from '@/components/admin/WidgetBuilder';
import { CustomCodeWidgetBuilder } from '@/components/admin/CustomCodeWidgetBuilder';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Power, 
  Filter,
  Folder,
  Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

// Dynamic icon component
function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name] || LucideIcons.Box;
  return <Icon className={className} />;
}

function getEmptyFormData(): WidgetFormData {
  return {
    name: '',
    widget_key: '',
    type: 'kpi',
    category: 'dashboard',
    data_source: 'genel',
    size: 'md',
    description: '',
    is_active: true,
    default_visible: true,
    is_default: false,
    default_page: 'dashboard',
    sort_order: 0,
    icon: 'BarChart2',
    min_height: '',
    grid_cols: null,
    available_filters: [],
    default_filters: {},
    builder_config: null
  };
}

export default function SuperAdminWidgetManager() {
  const { widgets, isLoading: loading, refetch: fetchWidgets } = useWidgets();
  const { createWidget, updateWidget, deleteWidget, activateWidget, permanentlyDeleteWidget } = useWidgetAdmin();
  const { categories } = useWidgetCategories();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [showWidgetBuilder, setShowWidgetBuilder] = useState(false);
  const [showCodeBuilder, setShowCodeBuilder] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [formData, setFormData] = useState<WidgetFormData>(getEmptyFormData());
  
  const [deleteConfirmWidget, setDeleteConfirmWidget] = useState<Widget | null>(null);

  // Filtreleme
  const filteredWidgets = widgets.filter(widget => {
    const matchesSearch = 
      widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      widget.widget_key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || widget.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && widget.is_active) ||
      (statusFilter === 'inactive' && !widget.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleCreateWidget = () => {
    setEditingWidget(null);
    setFormData(getEmptyFormData());
    setShowWidgetBuilder(true);
  };

  const handleCreateCodeWidget = () => {
    setEditingWidget(null);
    setFormData(getEmptyFormData());
    setShowCodeBuilder(true);
  };

  const handleEditWidget = (widget: Widget) => {
    setEditingWidget(widget);
    setFormData({
      name: widget.name,
      widget_key: widget.widget_key,
      type: widget.type,
      category: widget.category,
      data_source: widget.data_source,
      size: widget.size,
      description: widget.description || '',
      is_active: widget.is_active,
      default_visible: widget.default_visible,
      is_default: widget.is_default,
      default_page: widget.default_page,
      sort_order: widget.sort_order || 0,
      icon: widget.icon || 'BarChart2',
      min_height: widget.min_height || '',
      grid_cols: widget.grid_cols || null,
      available_filters: widget.available_filters || [],
      default_filters: widget.default_filters || {},
      builder_config: widget.builder_config
    });
    
    // Check if it's a custom code widget by checking builder_config structure
    const builderConfig = widget.builder_config;
    if (builderConfig && 'customCode' in builderConfig) {
      setShowCodeBuilder(true);
    } else {
      setShowWidgetBuilder(true);
    }
  };

  const handleSaveWidget = async (data: WidgetFormData) => {
    try {
      if (editingWidget) {
        await updateWidget(editingWidget.id, data);
        toast.success('Widget güncellendi');
      } else {
        await createWidget(data);
        toast.success('Widget oluşturuldu');
      }
      setShowWidgetBuilder(false);
      setShowCodeBuilder(false);
      fetchWidgets();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleToggleActive = async (widget: Widget) => {
    try {
      if (widget.is_active) {
        await deleteWidget(widget.id);
        toast.success('Widget devre dışı bırakıldı');
      } else {
        await activateWidget(widget.id);
        toast.success('Widget aktifleştirildi');
      }
      fetchWidgets();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirmWidget) return;
    
    try {
      await permanentlyDeleteWidget(deleteConfirmWidget.id);
      toast.success('Widget kalıcı olarak silindi');
      setDeleteConfirmWidget(null);
      fetchWidgets();
    } catch (error) {
      toast.error('Silme işlemi başarısız');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Widget Yönetimi</h2>
          <p className="text-muted-foreground">Tüm widget'ları oluşturun, düzenleyin ve yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreateWidget}>
            <Plus className="w-4 h-4 mr-2" />
            Widget Oluştur
          </Button>
          <Button variant="outline" onClick={handleCreateCodeWidget}>
            <Code className="w-4 h-4 mr-2" />
            Kod Widget
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Widget ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kategoriler</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Pasif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Widget List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWidgets.map(widget => (
            <Card 
              key={widget.id} 
              className={cn(
                "relative",
                !widget.is_active && "opacity-60"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      widget.is_active ? "bg-primary/10" : "bg-muted"
                    )}>
                      <DynamicIcon name={widget.icon || 'BarChart2'} className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{widget.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{widget.widget_key}</p>
                    </div>
                  </div>
                  <Badge variant={widget.is_active ? 'default' : 'secondary'}>
                    {widget.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {widget.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {widget.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="outline" className="text-xs">{widget.type}</Badge>
                  <Badge variant="outline" className="text-xs">{widget.size}</Badge>
                  <Badge variant="outline" className="text-xs">{widget.category}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleEditWidget(widget)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(widget)}
                  >
                    <Power className={cn("w-3 h-3", widget.is_active ? "text-destructive" : "text-success")} />
                  </Button>
                  {!widget.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteConfirmWidget(widget)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Widget Builder Dialog */}
      <WidgetBuilder
        open={showWidgetBuilder}
        onOpenChange={setShowWidgetBuilder}
        onSave={() => {
          fetchWidgets();
          setShowWidgetBuilder(false);
        }}
        editWidget={editingWidget || undefined}
      />

      {/* Code Widget Builder Dialog */}
      <CustomCodeWidgetBuilder
        open={showCodeBuilder}
        onOpenChange={setShowCodeBuilder}
        onSave={() => {
          fetchWidgets();
          setShowCodeBuilder(false);
        }}
        editingWidget={editingWidget || undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmWidget} onOpenChange={() => setDeleteConfirmWidget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Widget'ı Kalıcı Olarak Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteConfirmWidget?.name}" widget'ını kalıcı olarak silmek istediğinize emin misiniz? 
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kalıcı Olarak Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
