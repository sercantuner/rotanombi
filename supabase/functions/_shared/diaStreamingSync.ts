/**
 * DIA Streaming Sync Module
 * Handles page-by-page data fetching and writing
 */

import { ensureValidSession, getDiaSession, invalidateSession } from "./diaAutoLogin.ts";
import { PAGE_SIZE, MAX_RECORDS, parseDiaResponse, writeMicroBatches, SyncResult, DataSource } from "./diaDataSyncHelpers.ts";

/**
 * Tek bir sayfa çek (session refresh ile)
 */
export async function fetchPageWithSessionRefresh(
  supabase: any,
  userId: string,
  currentSession: any,
  module: string,
  method: string,
  donemKodu: number,
  offset: number
): Promise<{ success: boolean; data: any[]; newSession?: any; error?: string }> {
  const sessionResult = await ensureValidSession(supabase, userId, currentSession);
  if (!sessionResult.success || !sessionResult.session) {
    return { success: false, data: [], error: sessionResult.error || "Session alınamadı" };
  }
  
  const session = sessionResult.session;
  const diaUrl = `https://${session.sunucuAdi}.ws.dia.com.tr/api/v3/${module}/json`;
  const fullMethod = method.startsWith(`${module}_`) ? method : `${module}_${method}`;
  
  const payload = { 
    [fullMethod]: { 
      session_id: session.sessionId, 
      firma_kodu: session.firmaKodu, 
      donem_kodu: donemKodu, 
      limit: PAGE_SIZE,
      offset: offset
    } 
  };
  
  try {
    const response = await fetch(diaUrl, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    if (!response.ok) {
      return { success: false, data: [], error: `HTTP ${response.status}` };
    }
    
    const result = await response.json();
    
    // INVALID_SESSION hatası kontrolü
    if (result.msg === 'INVALID_SESSION' || result.code === '401') {
      console.log(`[DIA Sync] Session invalid, refreshing...`);
      await invalidateSession(supabase, userId);
      
      const newSessionResult = await getDiaSession(supabase, userId);
      if (!newSessionResult.success || !newSessionResult.session) {
        return { success: false, data: [], error: "Session yenilemesi başarısız" };
      }
      
      payload[fullMethod].session_id = newSessionResult.session.sessionId;
      
      const retryResponse = await fetch(diaUrl, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
      });
      
      if (!retryResponse.ok) {
        return { success: false, data: [], error: `HTTP ${retryResponse.status} (retry)` };
      }
      
      const retryResult = await retryResponse.json();
      
      if (retryResult.code && retryResult.code !== "200") {
        return { success: false, data: [], error: retryResult.msg || `DIA Error: ${retryResult.code}` };
      }
      
      return { 
        success: true, 
        data: parseDiaResponse(retryResult, fullMethod),
        newSession: newSessionResult.session
      };
    }
    
    if (result.code && result.code !== "200") {
      return { success: false, data: [], error: result.msg || `DIA Error: ${result.code}` };
    }
    if (result.error || result.hata) {
      return { success: false, data: [], error: result.error?.message || result.hata?.aciklama || "API hatası" };
    }
    
    return { 
      success: true, 
      data: parseDiaResponse(result, fullMethod),
      newSession: session
    };
    
  } catch (error) {
    return { 
      success: false, 
      data: [], 
      error: error instanceof Error ? error.message : "Fetch hatası" 
    };
  }
}

/**
 * Sayfa sayfa veri çek ve anında yaz (streaming)
 */
export async function fetchAndWriteStreaming(
  supabase: any,
  userId: string,
  diaSession: any,
  module: string,
  method: string,
  donemKodu: number,
  sunucuAdi: string,
  firmaKodu: string,
  dataSourceSlug: string
): Promise<{ success: boolean; totalFetched: number; totalWritten: number; error?: string }> {
  let offset = 0;
  let hasMore = true;
  let totalFetched = 0;
  let totalWritten = 0;
  let pageCount = 0;
  let currentSession = diaSession;
  
  const processedKeys = new Set<number>();

  try {
    while (hasMore && totalFetched < MAX_RECORDS) {
      const fetchResult = await fetchPageWithSessionRefresh(
        supabase, userId, currentSession, module, method, donemKodu, offset
      );
      
      if (!fetchResult.success) {
        console.error(`[DIA Sync] Page ${pageCount + 1} fetch failed: ${fetchResult.error}`);
        
        if (pageCount === 0) {
          return { success: false, totalFetched, totalWritten, error: fetchResult.error };
        }
        break;
      }
      
      if (fetchResult.newSession) {
        currentSession = fetchResult.newSession;
      }
      
      const pageData = fetchResult.data;
      console.log(`[DIA Sync] Page ${pageCount + 1}: Received ${pageData.length} records (offset: ${offset})`);
      
      if (pageData.length > 0) {
        const writeResult = await writeMicroBatches(
          supabase, sunucuAdi, firmaKodu, donemKodu, dataSourceSlug, pageData, processedKeys
        );
        
        totalWritten += writeResult.written;
        console.log(`[DIA Sync] Page ${pageCount + 1}: Wrote ${writeResult.written} records`);
      }
      
      totalFetched += pageData.length;
      pageCount++;
      
      if (pageData.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }
    
    console.log(`[DIA Sync] Completed: ${totalFetched} fetched, ${totalWritten} written (${pageCount} pages)`);
    
    return { success: true, totalFetched, totalWritten };
    
  } catch (error) {
    return { 
      success: false, 
      totalFetched, 
      totalWritten, 
      error: error instanceof Error ? error.message : "Bilinmeyen hata" 
    };
  }
}

/**
 * Tek bir veri kaynağı ve tek bir dönem için sync
 */
export async function syncSingleSourcePeriod(
  supabase: any,
  userId: string,
  session: any,
  source: DataSource,
  periodNo: number,
  sunucuAdi: string,
  firmaKodu: string,
  triggerUserId: string
): Promise<SyncResult> {
  console.log(`[DIA Sync] syncSingleSource: ${source.slug} / period ${periodNo}`);
  
  const { data: historyRecord } = await supabase.from('sync_history').insert({ 
    sunucu_adi: sunucuAdi, 
    firma_kodu: firmaKodu, 
    donem_kodu: periodNo, 
    data_source_slug: source.slug, 
    sync_type: 'single', 
    triggered_by: triggerUserId, 
    status: 'running' 
  }).select().single();

  try {
    const syncResult = await fetchAndWriteStreaming(
      supabase, userId, session, source.module, source.method,
      periodNo, sunucuAdi, firmaKodu, source.slug
    );

    if (!syncResult.success) {
      await supabase.from('sync_history').update({ 
        status: 'failed', 
        error: syncResult.error, 
        completed_at: new Date().toISOString() 
      }).eq('id', historyRecord?.id);
      
      return { 
        success: false, 
        dataSourceSlug: source.slug,
        periodNo,
        error: syncResult.error 
      };
    }

    await supabase.from('sync_history').update({ 
      status: 'completed', 
      records_fetched: syncResult.totalFetched, 
      records_inserted: syncResult.totalWritten, 
      completed_at: new Date().toISOString() 
    }).eq('id', historyRecord?.id);

    await supabase.from('period_sync_status').upsert({ 
      sunucu_adi: sunucuAdi, 
      firma_kodu: firmaKodu, 
      donem_kodu: periodNo, 
      data_source_slug: source.slug, 
      last_incremental_sync: new Date().toISOString(), 
      total_records: syncResult.totalFetched, 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });

    return { 
      success: true, 
      dataSourceSlug: source.slug,
      periodNo,
      recordsFetched: syncResult.totalFetched, 
      recordsInserted: syncResult.totalWritten,
      syncHistoryId: historyRecord?.id
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
    
    if (historyRecord?.id) {
      await supabase.from('sync_history').update({ 
        status: 'failed', 
        error: errorMsg, 
        completed_at: new Date().toISOString() 
      }).eq('id', historyRecord.id);
    }
    
    return { 
      success: false, 
      dataSourceSlug: source.slug,
      periodNo,
      error: errorMsg 
    };
  }
}
