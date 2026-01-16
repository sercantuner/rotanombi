import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, MapPin, Tag, Users, Building, Briefcase } from 'lucide-react';
import { useDashboardFilters } from '@/contexts/DashboardFilterContext';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Props {
  cariler: Array<{
    cariKodu: string;
    cariAdi: string;
    ozelkod1kod: string;
    ozelkod2kod: string;
    ozelkod3kod: string;
    sehir: string;
    satiselemani: string;
  }>;
}

export function DetailedFiltersPanel({ cariler }: Props) {
  const { filters, toggleArrayFilter, activeFilterCount, clearFilters } = useDashboardFilters();
  const [isOpen, setIsOpen] = useState(false);

  // Extract unique values from cariler
  const uniqueValues = {
    ozelkod1: [...new Set(cariler.map(c => c.ozelkod1kod).filter(Boolean))].sort(),
    ozelkod2: [...new Set(cariler.map(c => c.ozelkod2kod).filter(Boolean))].sort(),
    ozelkod3: [...new Set(cariler.map(c => c.ozelkod3kod).filter(Boolean))].sort(),
    sehir: [...new Set(cariler.map(c => c.sehir).filter(Boolean))].sort(),
    satisTemsilcisi: [...new Set(cariler.map(c => c.satiselemani).filter(Boolean))].sort(),
  };

  const filterSections = [
    { 
      key: 'ozelkod1' as const, 
      label: 'Özel Kod 1', 
      icon: Tag, 
      values: uniqueValues.ozelkod1,
      filterKey: 'ozelkod1' as const,
      color: 'text-blue-500'
    },
    { 
      key: 'ozelkod2' as const, 
      label: 'Özel Kod 2', 
      icon: Tag, 
      values: uniqueValues.ozelkod2,
      filterKey: 'ozelkod2' as const,
      color: 'text-primary'
    },
    { 
      key: 'ozelkod3' as const, 
      label: 'Özel Kod 3', 
      icon: Tag, 
      values: uniqueValues.ozelkod3,
      filterKey: 'ozelkod3' as const,
      color: 'text-purple-500'
    },
    { 
      key: 'sehir' as const, 
      label: 'Şehir', 
      icon: MapPin, 
      values: uniqueValues.sehir,
      filterKey: 'sehir' as const,
      color: 'text-orange-500'
    },
    { 
      key: 'satisTemsilcisi' as const, 
      label: 'Satış Temsilcisi', 
      icon: Users, 
      values: uniqueValues.satisTemsilcisi,
      filterKey: 'satisTemsilcisi' as const,
      color: 'text-success'
    },
  ];

  const relevantFilterCount = 
    filters.ozelkod1.length + 
    filters.ozelkod2.length + 
    filters.ozelkod3.length + 
    filters.sehir.length + 
    filters.satisTemsilcisi.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <CollapsibleTrigger asChild>
        <button className="w-full glass-card rounded-xl p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Filter className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold flex items-center gap-2">
                Detaylı Filtreler
                {relevantFilterCount > 0 && (
                  <Badge variant="default" className="h-5 px-2 text-xs">
                    {relevantFilterCount} aktif
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                Özel kod, şehir ve satış temsilcisi filtreleri
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {relevantFilterCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFilters();
                }}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors"
              >
                Temizle
              </button>
            )}
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {filterSections.map((section) => (
              <div key={section.key} className="space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <section.icon className={`w-4 h-4 ${section.color}`} />
                  <span className="font-medium text-sm">{section.label}</span>
                  {filters[section.filterKey].length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-auto">
                      {filters[section.filterKey].length}
                    </Badge>
                  )}
                </div>
                <ScrollArea className="h-40">
                  <div className="space-y-1 pr-2">
                    {section.values.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Veri yok</p>
                    ) : (
                      section.values.map((value) => {
                        const isChecked = filters[section.filterKey].includes(value);
                        return (
                          <label
                            key={value}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked 
                                ? 'bg-primary/10 border border-primary/30' 
                                : 'hover:bg-secondary/50'
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleArrayFilter(section.filterKey, value)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm truncate flex-1" title={value}>
                              {value}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
