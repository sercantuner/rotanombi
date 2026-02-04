// CategoryPickerModal - Kategori seçimi ve ekleme için tam ekran modal
// Tüm kategorileri listeleyerek seçim yapmaya ve yeni kategori eklemeye olanak sağlar

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWidgetCategories, WidgetCategory } from '@/hooks/useWidgetCategories';
import { Search, Folder, Check, Loader2, Plus, ChevronLeft } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CategoryPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory?: string;
  onSelect: (categorySlug: string) => void;
}

// Dinamik ikon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Folder className={className} />;
  return <Icon className={className} />;
};

// Popüler ikonlar
const POPULAR_ICONS = [
  'Folder', 'LayoutDashboard', 'TrendingUp', 'Wallet', 'Users', 'ShoppingCart',
  'Package', 'FileText', 'BarChart3', 'Settings', 'Database', 'Building',
  'CreditCard', 'PieChart', 'Target', 'Award', 'Calendar', 'Clock',
];

export function CategoryPickerModal({
  open,
  onOpenChange,
  selectedCategory,
  onSelect,
}: CategoryPickerModalProps) {
  const { categories, isLoading, createCategory, isCreating } = useWidgetCategories();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Yeni kategori ekleme modu
  const [isAddMode, setIsAddMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Folder');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Kategorileri filtrele
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term) ||
      cat.slug.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term)
    );
  }, [categories, searchTerm]);

  const handleSelect = (category: WidgetCategory) => {
    onSelect(category.slug);
    onOpenChange(false);
  };

  // Slug otomatik oluştur
  const handleNameChange = (name: string) => {
    setNewCategoryName(name);
    // Sadece slug boşsa veya otomatik oluşturulmuşsa güncelle
    const autoSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/g, '_')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    setNewCategorySlug(autoSlug);
  };

  // Yeni kategori ekle
  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategorySlug.trim()) {
      toast.error('Kategori adı ve slug zorunludur');
      return;
    }

    try {
      await createCategory({
        name: newCategoryName.trim(),
        slug: newCategorySlug.trim(),
        icon: newCategoryIcon,
        description: newCategoryDescription.trim() || undefined,
        is_active: true,
        sort_order: categories.length,
      });
      
      // Formu temizle ve seçim moduna dön
      setNewCategoryName('');
      setNewCategorySlug('');
      setNewCategoryIcon('Folder');
      setNewCategoryDescription('');
      setIsAddMode(false);
      
      // Yeni kategoriyi otomatik seç
      onSelect(newCategorySlug.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Kategori oluşturma hatası:', error);
    }
  };

  // Modal kapanırken sıfırla
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsAddMode(false);
      setNewCategoryName('');
      setNewCategorySlug('');
      setNewCategoryIcon('Folder');
      setNewCategoryDescription('');
      setSearchTerm('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAddMode ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 mr-1"
                  onClick={() => setIsAddMode(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                Yeni Kategori Ekle
              </>
            ) : (
              <>
                <Folder className="h-5 w-5" />
                Kategori Seç
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAddMode 
              ? 'Yeni bir widget kategorisi oluşturun' 
              : 'Widget\'ı atamak istediğiniz kategoriyi seçin veya yeni bir kategori ekleyin'
            }
          </DialogDescription>
        </DialogHeader>

        {isAddMode ? (
          // YENİ KATEGORİ EKLEME FORMU
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori Adı *</Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Satış Raporları"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={newCategorySlug}
                  onChange={(e) => setNewCategorySlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="satis_raporlari"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Kategori açıklaması (opsiyonel)"
              />
            </div>

            <div className="space-y-2">
              <Label>İkon</Label>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <DynamicIcon iconName={newCategoryIcon} className="h-5 w-5" />
                </div>
                <div className="flex-1 grid grid-cols-9 gap-1">
                  {POPULAR_ICONS.map(icon => (
                    <Button
                      key={icon}
                      variant={newCategoryIcon === icon ? 'default' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setNewCategoryIcon(icon)}
                      title={icon}
                    >
                      <DynamicIcon iconName={icon} className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddMode(false)}>
                İptal
              </Button>
              <Button 
                onClick={handleAddCategory} 
                disabled={isCreating || !newCategoryName.trim() || !newCategorySlug.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ekleniyor...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Kategori Ekle
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // KATEGORİ SEÇİM LİSTESİ
          <>
            {/* Arama + Ekle Butonu */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kategori ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setIsAddMode(true)}
                title="Yeni Kategori Ekle"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Kategori Listesi */}
            <ScrollArea className="h-[320px] border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Yükleniyor...</span>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Folder className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz kategori yok'}
                  </p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setIsAddMode(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Yeni Kategori Ekle
                  </Button>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredCategories.map((category) => {
                    const isSelected = selectedCategory === category.slug;
                    
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleSelect(category)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                          isSelected 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          isSelected ? "bg-primary-foreground/20" : "bg-muted"
                        )}>
                          <DynamicIcon 
                            iconName={category.icon || 'Folder'} 
                            className="h-5 w-5"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className={cn(
                              "text-xs truncate",
                              isSelected ? "opacity-80" : "text-muted-foreground"
                            )}>
                              {category.description}
                            </div>
                          )}
                        </div>

                        {!category.is_active && (
                          <Badge variant="outline" className="text-[10px]">
                            Pasif
                          </Badge>
                        )}

                        {isSelected && (
                          <Check className="h-5 w-5 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>{filteredCategories.length} kategori</span>
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                İptal
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
