// DIA veri çekme ve upsert işlemleri
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// DIA API'den veri çek
export async function fetchFromDia(
  diaSession: any,
  module: string,
  method: string,
  donemKodu: number,
  dateFilter?: { field: string; startDate: string; endDate: string }
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const diaUrl = `https://${diaSession.sunucuAdi}.ws.dia.com.tr/api/v3/${module}/json`;
  
  const payload: Record<string, any> = {
    [method]: {
      session_id: diaSession.sessionId,
      firma_kodu: diaSession.firmaKodu,
      donem_kodu: donemKodu,
      limit: 0,
    }
  };

  if (dateFilter) {
    payload[method].filters = [
      { field: dateFilter.field, operator: ">=", value: dateFilter.startDate },
      { field: dateFilter.field, operator: "<=", value: dateFilter.endDate }
    ];
  }

  try {
    console.log(`[DIA Sync] Fetching from ${module}/${method} for period ${donemKodu}`);
    
    const response = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `DIA HTTP error: ${response.status}` };
    }

    const result = await response.json();
    
    if (result.error || result.hata) {
      const errorMsg = result.error?.message || result.hata?.aciklama || "DIA API hatası";
      return { success: false, error: errorMsg };
    }

    const data = result[method] || result.data || [];
    console.log(`[DIA Sync] Fetched ${Array.isArray(data) ? data.length : 0} records`);
    
    return { success: true, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
  }
}

// Verileri Supabase'e upsert et
export async function upsertData(
  supabase: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  dataSourceSlug: string,
  records: any[]
): Promise<{ inserted: number; updated: number; deleted: number }> {
  const stats = { inserted: 0, updated: 0, deleted: 0 };
  
  if (!records.length) return stats;

  // Sayfalama ile tüm mevcut kayıtları çek (1000 limit aşımı)
  const existingMap = new Map<number, string>();
  let exOffset = 0;
  const EX_PAGE = 1000;
  while (true) {
    const { data: exPage } = await supabase
      .from('company_data_cache')
      .select('id, dia_key')
      .eq('sunucu_adi', sunucuAdi)
      .eq('firma_kodu', firmaKodu)
      .eq('donem_kodu', donemKodu)
      .eq('data_source_slug', dataSourceSlug)
      .eq('is_deleted', false)
      .range(exOffset, exOffset + EX_PAGE - 1);
    if (!exPage || exPage.length === 0) break;
    exPage.forEach((r: any) => existingMap.set(r.dia_key, r.id));
    if (exPage.length < EX_PAGE) break;
    exOffset += EX_PAGE;
  }

  const incomingKeys = new Set<number>();
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const upsertData = batch.map(record => {
      const diaKey = record._key || record.id;
      if (diaKey) incomingKeys.add(Number(diaKey));
      
      return {
        sunucu_adi: sunucuAdi,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
        data_source_slug: dataSourceSlug,
        dia_key: Number(diaKey),
        data: record,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      };
    }).filter(r => r.dia_key);

    if (upsertData.length === 0) continue;

    const { error } = await supabase
      .from('company_data_cache')
      .upsert(upsertData, {
        onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`[DIA Sync] Upsert error:`, error);
      continue;
    }

    for (const record of batch) {
      const diaKey = Number(record._key || record.id);
      if (existingMap.has(diaKey)) {
        stats.updated++;
      } else {
        stats.inserted++;
      }
    }
  }

  for (const [diaKey, id] of existingMap) {
    if (!incomingKeys.has(diaKey)) {
      await supabase
        .from('company_data_cache')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      stats.deleted++;
    }
  }

  return stats;
}
