// Widget Filtre Yardımcı Fonksiyonları
// Tüm widget'lar için filtreleme mantığı

import type { DiaCari } from '@/lib/diaClient';
import { KpiFilter } from '@/components/dashboard/KpiFilterModal';

// Cari listeyi widget filtrelerine göre filtrele
export function applyWidgetFilters(cariler: DiaCari[], filters?: KpiFilter): DiaCari[] {
  if (!filters || !cariler?.length) return cariler || [];
  
  return cariler.filter(cari => {
    // Görünüm Modu filtresi (Cari/Potansiyel)
    if (filters.gorunumModu !== 'hepsi') {
      const isPotansiyel = cari.potansiyel === true;
      if (filters.gorunumModu === 'potansiyel' && !isPotansiyel) return false;
      if (filters.gorunumModu === 'cari' && isPotansiyel) return false;
    }
    
    // Durum filtresi (Aktif/Pasif)
    if (filters.durum !== 'hepsi') {
      const isPasif = cari.durum === 'P' || cari.durum === 'Pasif';
      if (filters.durum === 'pasif' && !isPasif) return false;
      if (filters.durum === 'aktif' && isPasif) return false;
    }
    
    // Cari Kart Tipi filtresi (AL/AS/ST)
    if (filters.cariKartTipi && filters.cariKartTipi.length > 0 && filters.cariKartTipi.length < 3) {
      if (!filters.cariKartTipi.includes(cari.carikarttipi as any)) {
        return false;
      }
    }
    
    // Özel Kod filtreleri
    if (filters.ozelKod1 && cari.ozelkod1kod !== filters.ozelKod1) return false;
    if (filters.ozelKod2 && cari.ozelkod2kod !== filters.ozelKod2) return false;
    if (filters.ozelKod3 && cari.ozelkod3kod !== filters.ozelKod3) return false;
    
    return true;
  });
}

// Filtrelenmiş carilerden KPI değerlerini hesapla
export function calculateFilteredKpis(cariler: DiaCari[], filters?: KpiFilter) {
  const filteredCariler = applyWidgetFilters(cariler, filters);
  
  let toplamAlacak = 0;
  let toplamBorc = 0;
  let gecikimisAlacak = 0;
  let gecikimisBorc = 0;
  let musteriSayisi = 0;
  let aktifCariSayisi = 0;
  
  for (const cari of filteredCariler) {
    const bakiye = cari.bakiye || cari.toplambakiye || 0;
    
    if (bakiye > 0) {
      toplamAlacak += bakiye;
    } else if (bakiye < 0) {
      toplamBorc += Math.abs(bakiye);
    }
    
    // Vadesi geçmiş hesaplama
    if (cari.vadesigecentutar && cari.vadesigecentutar > 0) {
      gecikimisAlacak += cari.vadesigecentutar;
    }
    
    // Cari sayısı (potansiyel olmayanlar)
    if (!cari.potansiyel) {
      musteriSayisi++;
    }
    
    // Aktif cari sayısı
    if (cari.durum !== 'P' && cari.durum !== 'Pasif') {
      aktifCariSayisi++;
    }
  }
  
  const netBakiye = toplamAlacak - toplamBorc;
  
  return {
    toplamAlacak,
    toplamBorc,
    netBakiye,
    gecikimisAlacak,
    gecikimisBorc,
    musteriSayisi,
    aktifCariSayisi,
    filteredCount: filteredCariler.length,
    totalCount: cariler?.length || 0,
  };
}

// Filtre aktif mi kontrolü
export function hasActiveFilters(filters?: KpiFilter): boolean {
  if (!filters) return false;
  
  return (
    filters.gorunumModu !== 'hepsi' ||
    filters.durum !== 'hepsi' ||
    filters.cariKartTipi.length !== 3 ||
    !!filters.ozelKod1 ||
    !!filters.ozelKod2 ||
    !!filters.ozelKod3
  );
}
