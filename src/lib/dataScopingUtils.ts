// dataScopingUtils - DataSource cache scope ve period-independent fallback yardımcıları
// Dönem karışmasını önlemek için tüm cache key'ler sunucu:firma:dönem bazlı scope edilir
// Period-independent kaynaklar en güncel dönemdeki veriden okunur (fallback)

import { supabase } from '@/integrations/supabase/client';

export interface DataScope {
  sunucuAdi: string;
  firmaKodu: string;
  donemKodu: number;
}

/**
 * Cache anahtarı için scope string oluşturur
 * Format: sunucu:firma:donem
 */
export function buildScopeKey(scope: DataScope): string {
  return `${scope.sunucuAdi}:${scope.firmaKodu}:${scope.donemKodu}`;
}

/**
 * dataSourceId + scope kombinasyonu ile benzersiz cache key oluşturur
 * Bu sayede aynı kaynak farklı dönemlerde birbirine karışmaz
 */
export function buildDataSourceCacheKey(dataSourceId: string, scope: DataScope): string {
  return `datasource_${dataSourceId}:${buildScopeKey(scope)}`;
}

/**
 * Period-independent kaynaklar için en güncel dönemi tespit eder
 * Önce verilen dönemde kayıt var mı bakar, yoksa max(donem_kodu) olan dönemi döndürür
 */
export async function findBestPeriodForSource(
  dataSourceSlug: string,
  sunucuAdi: string,
  firmaKodu: string,
  preferredDonem: number
): Promise<number> {
  // Önce tercih edilen dönemde veri var mı kontrol et
  const { count: preferredCount, error: preferredError } = await supabase
    .from('company_data_cache')
    .select('*', { count: 'exact', head: true })
    .eq('data_source_slug', dataSourceSlug)
    .eq('sunucu_adi', sunucuAdi)
    .eq('firma_kodu', firmaKodu)
    .eq('donem_kodu', preferredDonem)
    .eq('is_deleted', false);
  
  if (!preferredError && preferredCount && preferredCount > 0) {
    console.log(`[DataScoping] Preferred period ${preferredDonem} has ${preferredCount} records for ${dataSourceSlug}`);
    return preferredDonem;
  }
  
  // Tercih edilen dönemde veri yok - en son güncellenen dönemi bul
  const { data, error } = await supabase
    .from('company_data_cache')
    .select('donem_kodu')
    .eq('data_source_slug', dataSourceSlug)
    .eq('sunucu_adi', sunucuAdi)
    .eq('firma_kodu', firmaKodu)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) {
    console.log(`[DataScoping] No data found for ${dataSourceSlug}, falling back to preferred period ${preferredDonem}`);
    return preferredDonem;
  }
  
  const bestDonem = data[0].donem_kodu;
  console.log(`[DataScoping] Best period for ${dataSourceSlug}: ${bestDonem} (preferred was ${preferredDonem})`);
  return bestDonem;
}
