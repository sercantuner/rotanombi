// Hook: Veri kaynağı ilişkilerinden otomatik affectedByFilters oluşturma
// Widget oluşturulurken, tanımlı ilişkileri kullanarak filtre bağlamalarını önerir

import { useMemo } from 'react';
import { useDataSourceRelationships } from './useDataSourceRelationships';
import { useDataSources } from './useDataSources';

// Global filtre anahtarları ile veri alanlarını eşleştiren mapping
const GLOBAL_FILTER_MAPPINGS: Record<string, string[]> = {
  cariKartTipi: ['carikarttipi', 'cari_kart_tipi', 'tip'],
  satisTemsilcisi: ['satiselemani', 'satis_elemani', 'temsilci', 'plasiyer'],
  subeKodu: ['subekodu', 'sube_kodu', 'sube'],
  depoKodu: ['depokodu', 'depo_kodu', 'depo'],
  ozelKod1: ['ozelkod1kod', 'ozelkod1', 'ozel_kod_1'],
  ozelKod2: ['ozelkod2kod', 'ozelkod2', 'ozel_kod_2'],
  sektor: ['sektor', 'sektorkodu', 'sektor_kodu'],
  bolge: ['bolge', 'bolgekodu', 'bolge_kodu'],
};

export interface AffectedByFilter {
  globalFilterKey: string;
  dataField: string;
  operator: 'IN' | '=' | 'contains';
}

interface RelationshipAutoFillResult {
  // Bir veri kaynağı için önerilen filtre bağlamaları
  getSuggestedFilters: (dataSourceId: string) => AffectedByFilter[];
  // İlişkiler üzerinden otomatik filtre önerileri
  getRelationshipBasedFilters: (dataSourceId: string) => AffectedByFilter[];
  // Tüm önerileri birleştir
  getAllSuggestedFilters: (dataSourceId: string) => AffectedByFilter[];
  isLoading: boolean;
}

export function useRelationshipAutoFill(): RelationshipAutoFillResult {
  const { relationships, isLoading: relLoading } = useDataSourceRelationships();
  const { dataSources, isLoading: dsLoading } = useDataSources();

  // Veri kaynağının alanlarından direkt filtre önerileri
  const getSuggestedFilters = useMemo(() => {
    return (dataSourceId: string): AffectedByFilter[] => {
      const ds = dataSources.find(d => d.id === dataSourceId);
      if (!ds?.last_fields) return [];

      const suggestions: AffectedByFilter[] = [];
      const fields = ds.last_fields;

      // Her global filtre için eşleşen alanları bul
      Object.entries(GLOBAL_FILTER_MAPPINGS).forEach(([globalKey, possibleFields]) => {
        const matchingField = fields.find(f => 
          possibleFields.some(pf => f.toLowerCase() === pf.toLowerCase())
        );
        
        if (matchingField) {
          suggestions.push({
            globalFilterKey: globalKey,
            dataField: matchingField,
            operator: 'IN',
          });
        }
      });

      return suggestions;
    };
  }, [dataSources]);

  // İlişkiler üzerinden filtre önerileri
  const getRelationshipBasedFilters = useMemo(() => {
    return (dataSourceId: string): AffectedByFilter[] => {
      const suggestions: AffectedByFilter[] = [];
      
      // Bu veri kaynağına bağlı ilişkileri bul
      const relatedRelationships = relationships.filter(
        r => r.source_data_source_id === dataSourceId || 
             r.target_data_source_id === dataSourceId
      );

      relatedRelationships.forEach(rel => {
        // Cross-filter direction kontrolü
        if (rel.cross_filter_direction === 'none') return;
        
        const isSource = rel.source_data_source_id === dataSourceId;
        const field = isSource ? rel.source_field : rel.target_field;
        const otherDsId = isSource ? rel.target_data_source_id : rel.source_data_source_id;
        const otherDs = dataSources.find(d => d.id === otherDsId);
        
        // Hedef veri kaynağının filterable_fields'ını kontrol et
        if (otherDs?.filterable_fields) {
          const filterableFields = otherDs.filterable_fields as Record<string, string>;
          
          Object.entries(filterableFields).forEach(([dataField, globalKey]) => {
            // Alan eşleşmesi var mı?
            if (dataField.toLowerCase() === field.toLowerCase() ||
                rel.target_field.toLowerCase() === dataField.toLowerCase()) {
              suggestions.push({
                globalFilterKey: globalKey,
                dataField: field,
                operator: 'IN',
              });
            }
          });
        }
        
        // İlişki alanından global filtre mapping kontrolü
        Object.entries(GLOBAL_FILTER_MAPPINGS).forEach(([globalKey, possibleFields]) => {
          if (possibleFields.some(pf => 
            field.toLowerCase().includes(pf.toLowerCase()) ||
            pf.toLowerCase().includes(field.toLowerCase())
          )) {
            // Duplicate kontrolü
            if (!suggestions.some(s => s.globalFilterKey === globalKey && s.dataField === field)) {
              suggestions.push({
                globalFilterKey: globalKey,
                dataField: field,
                operator: 'IN',
              });
            }
          }
        });
      });

      return suggestions;
    };
  }, [relationships, dataSources]);

  // Tüm önerileri birleştir
  const getAllSuggestedFilters = useMemo(() => {
    return (dataSourceId: string): AffectedByFilter[] => {
      const directSuggestions = getSuggestedFilters(dataSourceId);
      const relationshipSuggestions = getRelationshipBasedFilters(dataSourceId);
      
      // Unique filtreler
      const seen = new Set<string>();
      const combined: AffectedByFilter[] = [];
      
      [...directSuggestions, ...relationshipSuggestions].forEach(filter => {
        const key = `${filter.globalFilterKey}:${filter.dataField}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(filter);
        }
      });
      
      return combined;
    };
  }, [getSuggestedFilters, getRelationshipBasedFilters]);

  return {
    getSuggestedFilters,
    getRelationshipBasedFilters,
    getAllSuggestedFilters,
    isLoading: relLoading || dsLoading,
  };
}

// Yardımcı: Global filtre key'den Türkçe etiket
export const GLOBAL_FILTER_LABELS: Record<string, string> = {
  cariKartTipi: 'Cari Kart Tipi',
  satisTemsilcisi: 'Satış Temsilcisi',
  subeKodu: 'Şube',
  depoKodu: 'Depo',
  ozelKod1: 'Özel Kod 1',
  ozelKod2: 'Özel Kod 2',
  sektor: 'Sektör',
  bolge: 'Bölge',
};
