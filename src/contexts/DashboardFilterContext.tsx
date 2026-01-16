import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface DashboardFilters {
  cariTipi: string[];
  ozelkod1: string[];
  ozelkod2: string[];
  ozelkod3: string[];
  sehir: string[];
  satisTemsilcisi: string[];
  vadeDilimi: string | null;
  durum: 'hepsi' | 'aktif' | 'pasif';
  gorunumModu: 'hepsi' | 'potansiyel' | 'cari';
  searchTerm: string;
}

interface FilterOptions {
  cariTipleri: string[];
  ozelkodlar1: string[];
  ozelkodlar2: string[];
  ozelkodlar3: string[];
  sehirler: string[];
  satisTemsilcileri: string[];
}

interface DashboardFilterContextType {
  filters: DashboardFilters;
  filterOptions: FilterOptions;
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  toggleArrayFilter: (key: 'cariTipi' | 'ozelkod1' | 'ozelkod2' | 'ozelkod3' | 'sehir' | 'satisTemsilcisi', value: string) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof DashboardFilters) => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  activeFilterCount: number;
}

const defaultFilters: DashboardFilters = {
  cariTipi: [],
  ozelkod1: [],
  ozelkod2: [],
  ozelkod3: [],
  sehir: [],
  satisTemsilcisi: [],
  vadeDilimi: null,
  durum: 'aktif',
  gorunumModu: 'hepsi',
  searchTerm: '',
};

const defaultFilterOptions: FilterOptions = {
  cariTipleri: [],
  ozelkodlar1: [],
  ozelkodlar2: [],
  ozelkodlar3: [],
  sehirler: [],
  satisTemsilcileri: [],
};

const DashboardFilterContext = createContext<DashboardFilterContextType | undefined>(undefined);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [filterOptions, setFilterOptionsState] = useState<FilterOptions>(defaultFilterOptions);

  const setFilter = useCallback(<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayFilter = useCallback((
    key: 'cariTipi' | 'ozelkod1' | 'ozelkod2' | 'ozelkod3' | 'sehir' | 'satisTemsilcisi',
    value: string
  ) => {
    setFilters(prev => {
      const currentArray = prev[key] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const clearFilter = useCallback((key: keyof DashboardFilters) => {
    setFilters(prev => ({ ...prev, [key]: defaultFilters[key] }));
  }, []);

  const setFilterOptions = useCallback((options: Partial<FilterOptions>) => {
    setFilterOptionsState(prev => ({ ...prev, ...options }));
  }, []);

  // Calculate active filter count
  const activeFilterCount = 
    filters.cariTipi.length +
    filters.ozelkod1.length +
    filters.ozelkod2.length +
    filters.ozelkod3.length +
    filters.sehir.length +
    filters.satisTemsilcisi.length +
    (filters.vadeDilimi ? 1 : 0) +
    (filters.durum !== 'aktif' ? 1 : 0) +
    (filters.gorunumModu !== 'hepsi' ? 1 : 0) +
    (filters.searchTerm ? 1 : 0);

  return (
    <DashboardFilterContext.Provider value={{
      filters,
      filterOptions,
      setFilter,
      toggleArrayFilter,
      clearFilters,
      clearFilter,
      setFilterOptions,
      activeFilterCount,
    }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters() {
  const context = useContext(DashboardFilterContext);
  if (context === undefined) {
    throw new Error('useDashboardFilters must be used within a DashboardFilterProvider');
  }
  return context;
}
