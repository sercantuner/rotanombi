// Sayfa Ekleme Modal

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAGE_ICONS } from '@/lib/pageTypes';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatePageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePage: (name: string, icon: string) => Promise<void>;
}

export function CreatePageModal({ open, onOpenChange, onCreatePage }: CreatePageModalProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('LayoutDashboard');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await onCreatePage(name.trim(), selectedIcon);
      setName('');
      setSelectedIcon('LayoutDashboard');
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Sayfa Oluştur</DialogTitle>
          <DialogDescription>
            Kendi raporlama sayfanızı oluşturun ve widget'lar ekleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sayfa Adı */}
          <div className="space-y-2">
            <Label htmlFor="pageName">Sayfa Adı</Label>
            <Input
              id="pageName"
              placeholder="Örn: Satış Analizi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* İkon Seçimi */}
          <div className="space-y-2">
            <Label>Sayfa İkonu</Label>
            <div className="grid grid-cols-5 gap-2 p-3 border rounded-lg bg-muted/30">
              {PAGE_ICONS.map((iconName) => {
                const Icon = (LucideIcons as any)[iconName];
                if (!Icon) return null;
                
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setSelectedIcon(iconName)}
                    className={cn(
                      'p-2 rounded-md transition-all hover:bg-accent',
                      selectedIcon === iconName && 'bg-primary text-primary-foreground hover:bg-primary'
                    )}
                  >
                    <Icon className="w-5 h-5 mx-auto" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? 'Oluşturuluyor...' : 'Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
