// Category Manager - Widget kategorilerini yönetme paneli
import React, { useState } from 'react';
import { useWidgetCategories, WidgetCategory, WidgetCategoryFormData } from '@/hooks/useWidgetCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical,
  Folder,
  LayoutGrid,
  ShoppingCart,
  Wallet,
  Users,
  Package,
  BarChart3,
  FileText,
  Settings,
  Star,
  Tag,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

// Kullanılabilir ikonlar
const AVAILABLE_ICONS = [
  { id: 'Folder', icon: Folder, label: 'Klasör' },
  { id: 'LayoutGrid', icon: LayoutGrid, label: 'Grid' },
  { id: 'ShoppingCart', icon: ShoppingCart, label: 'Sepet' },
  { id: 'Wallet', icon: Wallet, label: 'Cüzdan' },
  { id: 'Users', icon: Users, label: 'Kullanıcılar' },
  { id: 'Package', icon: Package, label: 'Paket' },
  { id: 'BarChart3', icon: BarChart3, label: 'Grafik' },
  { id: 'FileText', icon: FileText, label: 'Döküman' },
  { id: 'Settings', icon: Settings, label: 'Ayarlar' },
  { id: 'Star', icon: Star, label: 'Yıldız' },
  { id: 'Tag', icon: Tag, label: 'Etiket' },
  { id: 'Layers', icon: Layers, label: 'Katmanlar' },
];

// Kullanılabilir renkler
const AVAILABLE_COLORS = [
  { id: 'blue', label: 'Mavi', class: 'bg-blue-500' },
  { id: 'green', label: 'Yeşil', class: 'bg-green-500' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { id: 'purple', label: 'Mor', class: 'bg-purple-500' },
  { id: 'red', label: 'Kırmızı', class: 'bg-red-500' },
  { id: 'pink', label: 'Pembe', class: 'bg-pink-500' },
  { id: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { id: 'orange', label: 'Turuncu', class: 'bg-orange-500' },
];

// İkon render helper
function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const iconData = AVAILABLE_ICONS.find(i => i.id === name);
  if (iconData) {
    const IconComponent = iconData.icon;
    return <IconComponent className={className} />;
  }
  return <Folder className={className} />;
}

// Form varsayılanları
const getEmptyForm = (): WidgetCategoryFormData => ({
  slug: '',
  name: '',
  description: '',
  icon: 'Folder',
  color: 'blue',
  sort_order: 0,
  is_active: true,
});

export function CategoryManager() {
  const { 
    categories, 
    isLoading, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    isCreating,
    isUpdating,
    isDeleting 
  } = useWidgetCategories();

  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<WidgetCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<WidgetCategory | null>(null);
  const [formData, setFormData] = useState<WidgetCategoryFormData>(getEmptyForm());

  // Yeni kategori oluştur
  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      ...getEmptyForm(),
      sort_order: categories.length,
    });
    setShowDialog(true);
  };

  // Kategori düzenle
  const handleEdit = (category: WidgetCategory) => {
    setEditingCategory(category);
    setFormData({
      slug: category.slug,
      name: category.name,
      description: category.description || '',
      icon: category.icon,
      color: category.color || 'blue',
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setShowDialog(true);
  };

  // Silme onayı
  const handleDeleteClick = (category: WidgetCategory) => {
    setDeletingCategory(category);
    setShowDeleteDialog(true);
  };

  // Kategori sil
  const handleDelete = async () => {
    if (!deletingCategory) return;
    
    try {
      await deleteCategory(deletingCategory.id);
      setShowDeleteDialog(false);
      setDeletingCategory(null);
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  // Kaydet
  const handleSave = async () => {
    if (!formData.slug || !formData.name) {
      toast.error('Slug ve isim zorunludur');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        await createCategory(formData);
      }
      setShowDialog(false);
      setEditingCategory(null);
      setFormData(getEmptyForm());
    } catch (error) {
      console.error('Kaydetme hatası:', error);
    }
  };

  // Aktif/Pasif toggle
  const handleToggleActive = async (category: WidgetCategory) => {
    try {
      await updateCategory(category.id, { is_active: !category.is_active });
    } catch (error) {
      console.error('Güncelleme hatası:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kategori Yönetimi</h2>
          <p className="text-muted-foreground">Widget kategorilerini oluşturun ve düzenleyin</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Kategori
        </Button>
      </div>

      {/* Kategori Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kategoriler ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Sıra</TableHead>
                <TableHead className="w-12">İkon</TableHead>
                <TableHead>İsim</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="w-24">Durum</TableHead>
                <TableHead className="w-32 text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Henüz kategori oluşturulmamış
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                        {category.sort_order}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div 
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          category.color ? `bg-${category.color}-500/20 text-${category.color}-500` : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <DynamicIcon name={category.icon} className="w-4 h-4" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{category.slug}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(category)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(category)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Oluştur/Düzenle Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* İsim */}
            <div className="space-y-2">
              <Label htmlFor="name">İsim *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn: Dashboard"
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug * (URL dostu)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') 
                })}
                placeholder="Örn: dashboard"
                disabled={!!editingCategory}
              />
              {editingCategory && (
                <p className="text-xs text-muted-foreground">Slug düzenlenemez</p>
              )}
            </div>

            {/* Açıklama */}
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kısa açıklama..."
              />
            </div>

            {/* İkon ve Renk */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>İkon</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <DynamicIcon name={formData.icon || 'Folder'} className="w-4 h-4" />
                        {AVAILABLE_ICONS.find(i => i.id === formData.icon)?.label || 'Seçin'}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon.id} value={icon.id}>
                        <div className="flex items-center gap-2">
                          <icon.icon className="w-4 h-4" />
                          {icon.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Renk</Label>
                <Select
                  value={formData.color || 'blue'}
                  onValueChange={(value) => setFormData({ ...formData, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${AVAILABLE_COLORS.find(c => c.id === formData.color)?.class || 'bg-blue-500'}`} />
                        {AVAILABLE_COLORS.find(c => c.id === formData.color)?.label || 'Seçin'}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.id} value={color.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sıra ve Aktiflik */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sıra</Label>
                <Input
                  id="sort_order"
                  type="number"
                  min={0}
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Durum</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <span className="text-sm">{formData.is_active ? 'Aktif' : 'Pasif'}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategori Silinecek</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingCategory?.name}</strong> kategorisini silmek istediğinizden emin misiniz?
              Bu işlem geri alınamaz ve bu kategoriye bağlı widget'lar etkilenebilir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Siliniyor...' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
