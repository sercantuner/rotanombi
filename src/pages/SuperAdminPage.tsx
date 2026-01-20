// Super Admin Page - Widget CRUD ve yönetim paneli

import { useState, useEffect } from 'react';
import { useWidgets, useWidgetAdmin } from '@/hooks/useWidgets';
import { usePermissions } from '@/hooks/usePermissions';
import { useWidgetCategories, WidgetCategoryFormData } from '@/hooks/useWidgetCategories';
import { Widget, WidgetFormData, PAGE_CATEGORIES, WIDGET_TYPES, WIDGET_SIZES, DATA_SOURCES, AVAILABLE_FILTERS, WidgetCategory, WidgetType, WidgetSize, DataSource } from '@/lib/widgetTypes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, LayoutGrid, Search, Shield, AlertTriangle, Wand2, Database, Tags, Loader2, Code } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetBuilder } from '@/components/admin/WidgetBuilder';
import { CustomCodeWidgetBuilder } from '@/components/admin/CustomCodeWidgetBuilder';
import { DataSourceManager } from '@/components/admin/DataSourceManager';
import * as LucideIcons from 'lucide-react';

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

// Widget form başlangıç değerleri
const getEmptyFormData = (): WidgetFormData => ({
  widget_key: '',
  name: '',
  description: '',
  category: 'dashboard',
  type: 'kpi',
  data_source: 'genel',
  size: 'md',
  icon: 'LayoutGrid',
  default_page: 'dashboard',
  default_visible: true,
  available_filters: [],
  default_filters: {},
  min_height: '',
  grid_cols: null,
  is_active: true,
  sort_order: 0,
});

export default function SuperAdminPage() {
  const { widgets, isLoading, refetch } = useWidgets();
  const { createWidget, updateWidget, deleteWidget, activateWidget, permanentlyDeleteWidget } = useWidgetAdmin();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const { 
    categories, 
    activeCategories,
    isLoading: categoriesLoading, 
    refetch: refetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    isCreating: isCategoryCreating,
    isUpdating: isCategoryUpdating,
    isDeleting: isCategoryDeleting
  } = useWidgetCategories();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isCustomCodeBuilderOpen, setIsCustomCodeBuilderOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [builderEditWidget, setBuilderEditWidget] = useState<Widget | null>(null);
  const [editingCustomCodeWidget, setEditingCustomCodeWidget] = useState<Widget | null>(null);
  const [formData, setFormData] = useState<WidgetFormData>(getEmptyFormData());
  const [deleteConfirmWidget, setDeleteConfirmWidget] = useState<Widget | null>(null);
  
  // Kategori form state
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<WidgetCategoryFormData>({
    slug: '',
    name: '',
    description: '',
    icon: 'Folder',
    color: '',
    sort_order: 0,
    is_active: true,
  });

  // Erişim kontrolü
  if (permissionsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Erişim Engellendi</h1>
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  // Filtrelenmiş widget listesi
  const filteredWidgets = widgets.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         w.widget_key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || w.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && w.is_active) ||
                         (filterStatus === 'inactive' && !w.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Form aç
  const openForm = (widget?: Widget) => {
    if (widget) {
      setEditingWidget(widget);
      setFormData({
        widget_key: widget.widget_key,
        name: widget.name,
        description: widget.description || '',
        category: widget.category,
        type: widget.type,
        data_source: widget.data_source,
        size: widget.size,
        icon: widget.icon || 'LayoutGrid',
        default_page: widget.default_page,
        default_visible: widget.default_visible,
        available_filters: widget.available_filters,
        default_filters: widget.default_filters,
        min_height: widget.min_height || '',
        grid_cols: widget.grid_cols,
        is_active: widget.is_active,
        sort_order: widget.sort_order,
      });
    } else {
      setEditingWidget(null);
      setFormData(getEmptyFormData());
    }
    setIsFormOpen(true);
  };

  // Form kaydet
  const handleSave = async () => {
    if (editingWidget) {
      const success = await updateWidget(editingWidget.id, formData);
      if (success) {
        setIsFormOpen(false);
        refetch();
      }
    } else {
      const success = await createWidget(formData);
      if (success) {
        setIsFormOpen(false);
        refetch();
      }
    }
  };

  // Widget sil/deaktif et
  const handleDelete = async (widget: Widget) => {
    if (widget.is_active) {
      await deleteWidget(widget.id);
    } else {
      await activateWidget(widget.id);
    }
    refetch();
  };

  // Widget kalıcı sil
  const handlePermanentDelete = async () => {
    if (!deleteConfirmWidget) return;
    await permanentlyDeleteWidget(deleteConfirmWidget.id);
    setDeleteConfirmWidget(null);
    refetch();
  };

  // Filter toggle
  const toggleFilter = (filterId: string) => {
    setFormData(prev => ({
      ...prev,
      available_filters: prev.available_filters.includes(filterId)
        ? prev.available_filters.filter(f => f !== filterId)
        : [...prev.available_filters, filterId],
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="widgets" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Sistem Yönetimi
            </h1>
            <p className="text-muted-foreground">Widget'ları ve veri kaynaklarını yönetin</p>
          </div>
          <TabsList>
            <TabsTrigger value="widgets" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Widget Yönetimi
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tags className="h-4 w-4" />
              Kategoriler
            </TabsTrigger>
            <TabsTrigger value="datasources" className="gap-2">
              <Database className="h-4 w-4" />
              Veri Kaynakları
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="widgets" className="space-y-6 mt-0">
          {/* Header */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
            <Button variant="outline" onClick={() => setIsCustomCodeBuilderOpen(true)}>
              <Code className="h-4 w-4 mr-2" />
              Hardcode Widget
            </Button>
            <Button onClick={() => {
              setBuilderEditWidget(null);
              setIsBuilderOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Widget
            </Button>
          </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Widget ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {PAGE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Widget Table */}
      <Card>
        <CardHeader>
          <CardTitle>Widget Listesi</CardTitle>
          <CardDescription>Toplam {filteredWidgets.length} widget</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">İkon</TableHead>
                    <TableHead>Widget Key</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Boyut</TableHead>
                    <TableHead>Varsayılan Sayfa</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWidgets.map((widget) => (
                    <TableRow key={widget.id} className={!widget.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <DynamicIcon iconName={widget.icon || 'LayoutGrid'} className="h-5 w-5" />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{widget.widget_key}</TableCell>
                      <TableCell className="font-medium">{widget.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {PAGE_CATEGORIES.find(c => c.id === widget.category)?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {WIDGET_TYPES.find(t => t.id === widget.type)?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>{WIDGET_SIZES.find(s => s.id === widget.size)?.name}</TableCell>
                      <TableCell>
                        {PAGE_CATEGORIES.find(c => c.id === widget.default_page)?.name}
                      </TableCell>
                      <TableCell>
                        {widget.is_active ? (
                          <Badge className="bg-green-500/20 text-green-600">Aktif</Badge>
                        ) : (
                          <Badge variant="destructive">Pasif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              // Hardcode widget mi kontrol et
                              const config = widget.builder_config as any;
                              const isHardcodeWidget = config?.visualization?.isCustomCode === true || 
                                                       config?.visualization?.type === 'custom' ||
                                                       config?.customCode !== undefined;
                              
                              if (isHardcodeWidget) {
                                setEditingCustomCodeWidget(widget);
                                setIsCustomCodeBuilderOpen(true);
                              } else {
                                setBuilderEditWidget(widget);
                                setIsBuilderOpen(true);
                              }
                            }}
                            title="Widget Düzenle"
                          >
                            <Wand2 className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(widget)}
                            title={widget.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                          >
                            {widget.is_active ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmWidget(widget)}
                            title="Kalıcı Sil"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Widget Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWidget ? 'Widget Düzenle' : 'Yeni Widget Oluştur'}</DialogTitle>
            <DialogDescription>
              Widget özelliklerini tanımlayın. Widget key benzersiz olmalıdır.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
              <TabsTrigger value="display">Görünüm</TabsTrigger>
              <TabsTrigger value="filters">Filtreler</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="widget_key">Widget Key *</Label>
                  <Input
                    id="widget_key"
                    placeholder="ornek_widget_key"
                    value={formData.widget_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, widget_key: e.target.value }))}
                    disabled={!!editingWidget}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Widget Adı *</Label>
                  <Input
                    id="name"
                    placeholder="Widget Adı"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Açıklama</Label>
                <Textarea
                  id="description"
                  placeholder="Widget açıklaması..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: WidgetCategory) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Widget Tipi</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: WidgetType) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDGET_TYPES.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veri Kaynağı</Label>
                  <Select
                    value={formData.data_source}
                    onValueChange={(value: DataSource) => setFormData(prev => ({ ...prev, data_source: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_SOURCES.map(src => (
                        <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sıra Numarası</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Boyut</Label>
                  <Select
                    value={formData.size}
                    onValueChange={(value: WidgetSize) => setFormData(prev => ({ ...prev, size: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDGET_SIZES.map(size => (
                        <SelectItem key={size.id} value={size.id}>{size.name} ({size.cols} sütun)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Varsayılan Sayfa</Label>
                  <Select
                    value={formData.default_page}
                    onValueChange={(value: WidgetCategory) => setFormData(prev => ({ ...prev, default_page: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">İkon Adı (Lucide)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="icon"
                      placeholder="LayoutGrid"
                      value={formData.icon}
                      onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    />
                    <div className="flex items-center justify-center w-10 h-10 border rounded-md">
                      <DynamicIcon iconName={formData.icon} className="h-5 w-5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_height">Minimum Yükseklik</Label>
                  <Input
                    id="min_height"
                    placeholder="250px"
                    value={formData.min_height}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_height: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="default_visible"
                    checked={formData.default_visible}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, default_visible: checked }))}
                  />
                  <Label htmlFor="default_visible">Varsayılan Görünür</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Aktif</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="filters" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Kullanılabilir Filtreler</Label>
                <p className="text-sm text-muted-foreground">
                  Bu widget'ta kullanılabilecek filtreleri seçin
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {AVAILABLE_FILTERS.map(filter => (
                    <div key={filter.id} className="flex items-center gap-2">
                      <Checkbox
                        id={filter.id}
                        checked={formData.available_filters.includes(filter.id)}
                        onCheckedChange={() => toggleFilter(filter.id)}
                      />
                      <Label htmlFor={filter.id} className="font-normal cursor-pointer">
                        {filter.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline">İptal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={!formData.widget_key || !formData.name}>
              {editingWidget ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Widget Builder */}
      <WidgetBuilder
        open={isBuilderOpen}
        onOpenChange={(open) => {
          setIsBuilderOpen(open);
          if (!open) setBuilderEditWidget(null);
        }}
        onSave={() => refetch()}
        editWidget={builderEditWidget}
      />
        </TabsContent>

        {/* Kategoriler Tab */}
        <TabsContent value="categories" className="space-y-6 mt-0">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => refetchCategories()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
            <Button onClick={() => {
              setEditingCategory(null);
              setCategoryFormData({
                slug: '',
                name: '',
                description: '',
                icon: 'Folder',
                color: '',
                sort_order: categories.length,
                is_active: true,
              });
              setIsCategoryFormOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Kategori
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kategori Listesi</CardTitle>
              <CardDescription>Widget kategorilerini yönetin</CardDescription>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tags className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Henüz kategori tanımlanmadı</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">İkon</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead>Açıklama</TableHead>
                      <TableHead>Sıra</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id} className={!cat.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <DynamicIcon iconName={cat.icon || 'Folder'} className="h-5 w-5" />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{cat.slug}</TableCell>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {cat.description || '-'}
                        </TableCell>
                        <TableCell>{cat.sort_order}</TableCell>
                        <TableCell>
                          {cat.is_active ? (
                            <Badge className="bg-green-500/20 text-green-600">Aktif</Badge>
                          ) : (
                            <Badge variant="destructive">Pasif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingCategory(cat.id);
                                setCategoryFormData({
                                  slug: cat.slug,
                                  name: cat.name,
                                  description: cat.description || '',
                                  icon: cat.icon || 'Folder',
                                  color: cat.color || '',
                                  sort_order: cat.sort_order,
                                  is_active: cat.is_active,
                                });
                                setIsCategoryFormOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) {
                                  await deleteCategory(cat.id);
                                }
                              }}
                              disabled={isCategoryDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Kategori Form Dialog */}
          <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}</DialogTitle>
                <DialogDescription>
                  Widget kategorisi bilgilerini girin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    <Input
                      value={categoryFormData.slug}
                      onChange={e => setCategoryFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="dashboard"
                      className="font-mono"
                      disabled={!!editingCategory}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ad *</Label>
                    <Input
                      value={categoryFormData.name}
                      onChange={e => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Dashboard"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Textarea
                    value={categoryFormData.description}
                    onChange={e => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Kategori açıklaması..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>İkon (Lucide)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={categoryFormData.icon}
                        onChange={e => setCategoryFormData(prev => ({ ...prev, icon: e.target.value }))}
                        placeholder="Folder"
                      />
                      <div className="flex items-center justify-center w-10 h-10 border rounded-md">
                        <DynamicIcon iconName={categoryFormData.icon || 'Folder'} className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Sıra</Label>
                    <Input
                      type="number"
                      value={categoryFormData.sort_order}
                      onChange={e => setCategoryFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={categoryFormData.is_active}
                    onCheckedChange={checked => setCategoryFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label>Aktif</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCategoryFormOpen(false)}>
                  İptal
                </Button>
                <Button 
                  onClick={async () => {
                    if (!categoryFormData.slug || !categoryFormData.name) return;
                    
                    if (editingCategory) {
                      await updateCategory(editingCategory, categoryFormData);
                    } else {
                      await createCategory(categoryFormData);
                    }
                    setIsCategoryFormOpen(false);
                  }}
                  disabled={!categoryFormData.slug || !categoryFormData.name || isCategoryCreating || isCategoryUpdating}
                >
                  {(isCategoryCreating || isCategoryUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingCategory ? 'Güncelle' : 'Oluştur'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="datasources" className="mt-0">
          <DataSourceManager />
        </TabsContent>
      </Tabs>

      {/* Custom Code Widget Builder */}
      <CustomCodeWidgetBuilder
        open={isCustomCodeBuilderOpen}
        onOpenChange={(open) => {
          setIsCustomCodeBuilderOpen(open);
          if (!open) setEditingCustomCodeWidget(null);
        }}
        onSave={() => refetch()}
        editingWidget={editingCustomCodeWidget}
      />

      {/* Widget Kalıcı Silme Onay Dialog'u */}
      <AlertDialog open={!!deleteConfirmWidget} onOpenChange={() => setDeleteConfirmWidget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Widget'ı Kalıcı Olarak Sil?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteConfirmWidget?.name}" widget'ı kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
