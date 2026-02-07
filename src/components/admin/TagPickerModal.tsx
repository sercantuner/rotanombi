// TagPickerModal - Çoklu etiket seçimi ve ekleme için modal
// CategoryPickerModal'ın multi-select versiyonu

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useWidgetCategories, WidgetCategory } from '@/hooks/useWidgetCategories';
import { Search, Folder, Check, Loader2, Plus, ChevronLeft, Tag } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TagPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTags?: string[];
  onSelect: (tagSlugs: string[]) => void;
  maxTags?: number; // Maksimum seçilebilir etiket sayısı
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

export function TagPickerModal({
  open,
  onOpenChange,
  selectedTags = [],
  onSelect,
  maxTags,
}: TagPickerModalProps) {
  const { categories, isLoading, createCategory, isCreating } = useWidgetCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelection, setLocalSelection] = useState<string[]>(selectedTags);
  
  // Yeni etiket ekleme modu
  const [isAddMode, setIsAddMode] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagSlug, setNewTagSlug] = useState('');
  const [newTagIcon, setNewTagIcon] = useState('Tag');
  const [newTagDescription, setNewTagDescription] = useState('');

  // Modal açıldığında seçimi güncelle
  React.useEffect(() => {
    if (open) {
      setLocalSelection(selectedTags);
    }
  }, [open, selectedTags]);

  // Etiketleri filtrele
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term) ||
      cat.slug.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term)
    );
  }, [categories, searchTerm]);

  const toggleTag = (slug: string) => {
    setLocalSelection(prev => {
      if (prev.includes(slug)) {
        return prev.filter(s => s !== slug);
      }
      if (maxTags && prev.length >= maxTags) {
        toast.error(`En fazla ${maxTags} etiket seçebilirsiniz`);
        return prev;
      }
      return [...prev, slug];
    });
  };

  const handleConfirm = () => {
    onSelect(localSelection);
    onOpenChange(false);
  };

  // Slug otomatik oluştur
  const handleNameChange = (name: string) => {
    setNewTagName(name);
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
    setNewTagSlug(autoSlug);
  };

  // Yeni etiket ekle
  const handleAddTag = async () => {
    if (!newTagName.trim() || !newTagSlug.trim()) {
      toast.error('Etiket adı ve slug zorunludur');
      return;
    }

    try {
      await createCategory({
        name: newTagName.trim(),
        slug: newTagSlug.trim(),
        icon: newTagIcon,
        description: newTagDescription.trim() || undefined,
        is_active: true,
        sort_order: categories.length,
      });
      
      // Formu temizle ve seçim moduna dön
      setNewTagName('');
      setNewTagSlug('');
      setNewTagIcon('Tag');
      setNewTagDescription('');
      setIsAddMode(false);
      
      // Yeni etiketi otomatik seç
      setLocalSelection(prev => [...prev, newTagSlug.trim()]);
    } catch (error) {
      console.error('Etiket oluşturma hatası:', error);
    }
  };

  // Modal kapanırken sıfırla
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsAddMode(false);
      setNewTagName('');
      setNewTagSlug('');
      setNewTagIcon('Tag');
      setNewTagDescription('');
      setSearchTerm('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0">
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
                Yeni Etiket Ekle
              </>
            ) : (
              <>
                <Tag className="h-5 w-5" />
                Etiket Seç
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAddMode 
              ? 'Yeni bir widget etiketi oluşturun' 
              : 'Widget\'a atamak istediğiniz etiketleri seçin (birden fazla seçebilirsiniz)'
            }
          </DialogDescription>
        </DialogHeader>

        {isAddMode ? (
          // YENİ ETİKET EKLEME FORMU
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etiket Adı *</Label>
                <Input
                  value={newTagName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Satış Raporları"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={newTagSlug}
                  onChange={(e) => setNewTagSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="satis_raporlari"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                placeholder="Etiket açıklaması (opsiyonel)"
              />
            </div>

            <div className="space-y-2">
              <Label>İkon</Label>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <DynamicIcon iconName={newTagIcon} className="h-5 w-5" />
                </div>
                <div className="flex-1 grid grid-cols-9 gap-1">
                  {POPULAR_ICONS.map(icon => (
                    <Button
                      key={icon}
                      variant={newTagIcon === icon ? 'default' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setNewTagIcon(icon)}
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
                onClick={handleAddTag} 
                disabled={isCreating || !newTagName.trim() || !newTagSlug.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ekleniyor...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Etiket Ekle
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // ETİKET SEÇİM LİSTESİ
          <>
            {/* Seçili etiketler */}
            {localSelection.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b">
                {localSelection.map(slug => {
                  const tag = categories.find(c => c.slug === slug);
                  return (
                    <Badge 
                      key={slug} 
                      variant="default"
                      className="gap-1 cursor-pointer hover:bg-primary/80"
                      onClick={() => toggleTag(slug)}
                    >
                      <DynamicIcon iconName={tag?.icon || 'Tag'} className="h-3 w-3" />
                      {tag?.name || slug}
                      <LucideIcons.X className="h-3 w-3 ml-0.5" />
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Arama + Ekle Butonu */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Etiket ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setIsAddMode(true)}
                title="Yeni Etiket Ekle"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Etiket Listesi */}
            <ScrollArea className="h-[320px] border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Yükleniyor...</span>
                </div>
              ) : filteredTags.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Tag className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz etiket yok'}
                  </p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setIsAddMode(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Yeni Etiket Ekle
                  </Button>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredTags.map((tag) => {
                    const isSelected = localSelection.includes(tag.slug);
                    
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.slug)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                          isSelected 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted"
                        )}
                      >
                        <Checkbox 
                          checked={isSelected}
                          className={cn(
                            "pointer-events-none",
                            isSelected && "border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                          )}
                        />
                        
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          isSelected ? "bg-primary-foreground/20" : "bg-muted"
                        )}>
                          <DynamicIcon 
                            iconName={tag.icon || 'Tag'} 
                            className="h-5 w-5"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{tag.name}</div>
                          {tag.description && (
                            <div className={cn(
                              "text-xs truncate",
                              isSelected ? "opacity-80" : "text-muted-foreground"
                            )}>
                              {tag.description}
                            </div>
                          )}
                        </div>

                        {!tag.is_active && (
                          <Badge variant="outline" className="text-[10px]">
                            Pasif
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>
                {localSelection.length} etiket seçili
                {maxTags && ` (max ${maxTags})`}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                  İptal
                </Button>
                <Button size="sm" onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-1" />
                  Onayla
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
