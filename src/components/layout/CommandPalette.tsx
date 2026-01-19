// Command Palette - Global Arama (Ctrl+K)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Wallet, 
  Users, 
  Settings, 
  BarChart3, 
  PieChart, 
  List,
  Link,
  FlaskConical,
  Palette,
  Shield,
  RefreshCw,
  Plus,
  Search
} from 'lucide-react';
import { searchItems, groupSearchResults, SearchItem } from '@/lib/searchIndex';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Users,
  Settings,
  BarChart3,
  PieChart,
  List,
  Link,
  FlaskConical,
  Palette,
  Shield,
  RefreshCw,
  Plus,
  Search,
};

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const results = searchItems(query);
  const groupedResults = groupSearchResults(results);

  const handleSelect = useCallback((item: SearchItem) => {
    setOpen(false);
    setQuery('');
    navigate(item.path);
  }, [navigate, setOpen]);

  const getIcon = (iconName?: string) => {
    if (!iconName) return Search;
    return iconMap[iconName] || Search;
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Sayfa, widget veya ayar ara... (Ctrl+K)" 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        
        {Object.entries(groupedResults).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => {
              const IconComponent = getIcon(item.icon);
              return (
                <CommandItem
                  key={item.id}
                  value={item.title}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {item.type === 'page' ? 'Sayfa' 
                      : item.type === 'widget' ? 'Widget'
                      : item.type === 'setting' ? 'Ayar'
                      : 'Aksiyon'}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        
        {query.length === 0 && (
          <>
            <CommandGroup heading="Hızlı Erişim">
              <CommandItem onSelect={() => { setOpen(false); navigate('/dashboard'); }}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); navigate('/satis'); }}>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Satış Raporu
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); navigate('/finans'); }}>
                <Wallet className="w-4 h-4 mr-2" />
                Finans
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); navigate('/cari'); }}>
                <Users className="w-4 h-4 mr-2" />
                Cari Hesaplar
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); navigate('/ayarlar'); }}>
                <Settings className="w-4 h-4 mr-2" />
                Ayarlar
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
