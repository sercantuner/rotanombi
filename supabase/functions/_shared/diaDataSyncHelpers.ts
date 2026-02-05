/**
 * DIA Data Sync Helper Functions
 * Shared utilities for data synchronization
 */

// DIA dışı veri kaynakları (atlanacak)
export const NON_DIA_SOURCES = ['takvim', '_system_calendar', 'system_calendar'];

// Bellek optimizasyonu sabitleri
export const PAGE_SIZE = 200;
export const MICRO_BATCH_SIZE = 25;
export const MAX_RECORDS = 50000;

export interface SyncResult {
  success: boolean;
  dataSourceSlug?: string;
  periodNo?: number;
  recordsFetched?: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsDeleted?: number;
  error?: string;
  syncHistoryId?: string;
}

export interface SyncRequest {
  action: 'sync' | 'syncAll' | 'lockPeriod' | 'getSyncStatus' | 'syncAllForUser' | 'syncSingleSource';
  dataSourceSlug?: string;
  forceRefresh?: boolean;
  periodNo?: number;
  targetUserId?: string;
  syncAllPeriods?: boolean;
}

export interface DataSource {
  slug: string;
  module: string;
  method: string;
  name: string;
}

/**
 * Takılı kalan sync kayıtlarını temizle
 */
export async function cleanupStuckSyncRecords(supabase: any): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: stuckRecords } = await supabase
    .from('sync_history')
    .update({ 
      status: 'failed', 
      error: 'Timeout - işlem tamamlanamadı',
      completed_at: new Date().toISOString()
    })
    .eq('status', 'running')
    .lt('started_at', fiveMinutesAgo)
    .select();
  
  if (stuckRecords?.length) {
    console.log(`[DIA Sync] Cleaned up ${stuckRecords.length} stuck sync records`);
  }
}

/**
 * DIA API yanıtını parse et
 */
export function parseDiaResponse(result: any, fullMethod: string): any[] {
  if (result.result) {
    if (Array.isArray(result.result)) {
      return result.result;
    } else if (typeof result.result === 'object' && result.result !== null) {
      const firstKey = Object.keys(result.result)[0];
      if (firstKey && Array.isArray(result.result[firstKey])) {
        return result.result[firstKey];
      }
    }
  } else if (result.msg && Array.isArray(result.msg)) {
    return result.msg;
  } else if (result[fullMethod] && Array.isArray(result[fullMethod])) {
    return result[fullMethod];
  }
  return [];
}

/**
 * Mikro batch ile veritabanına yaz - timeout önleme
 */
export async function writeMicroBatches(
  supabase: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  dataSourceSlug: string,
  records: any[],
  processedKeys: Set<number>
): Promise<{ success: boolean; written: number; error?: string }> {
  if (!records.length) return { success: true, written: 0 };
  
  let written = 0;
  
  for (let i = 0; i < records.length; i += MICRO_BATCH_SIZE) {
    const batch = records.slice(i, i + MICRO_BATCH_SIZE);
    
    for (const record of batch) {
      const diaKey = record._key || record.id;
      if (!diaKey) continue;
      
      processedKeys.add(Number(diaKey));
      
      const upsertData = { 
        sunucu_adi: sunucuAdi, 
        firma_kodu: firmaKodu, 
        donem_kodu: donemKodu, 
        data_source_slug: dataSourceSlug, 
        dia_key: Number(diaKey), 
        data: record, 
        is_deleted: false, 
        updated_at: new Date().toISOString() 
      };

      const { error } = await supabase
        .from('company_data_cache')
        .upsert(upsertData, { 
          onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key', 
          ignoreDuplicates: false 
        });
      
      if (error) { 
        console.error(`[DIA Sync] Single upsert error:`, error.message);
      } else {
        written++;
      }
    }
  }
  
  return { success: true, written };
}
