import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession, ensureValidSession, invalidateSession, isInvalidSessionError } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRequest {
  action: 'sync' | 'syncAll' | 'lockPeriod' | 'getSyncStatus' | 'syncAllForUser' | 'syncSingleSource';
  dataSourceSlug?: string;
  forceRefresh?: boolean;
  periodNo?: number;
  targetUserId?: string;
  syncAllPeriods?: boolean;
}

// DIA dışı veri kaynakları (atlanacak)
const NON_DIA_SOURCES = ['takvim', '_system_calendar', 'system_calendar'];

interface SyncResult {
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

// Bellek optimizasyonu: Daha küçük sayfa ve batch boyutu
const PAGE_SIZE = 200;
const MICRO_BATCH_SIZE = 25; // Database timeout önleme
const MAX_RECORDS = 50000;

/**
 * Takılı kalan sync kayıtlarını temizle
 */
async function cleanupStuckSyncRecords(supabase: any): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: stuckRecords, error } = await supabase
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
 * Mikro batch ile veritabanına yaz - timeout önleme
 */
async function writeMicroBatches(
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
    
    // Her kayıt için tek tek upsert (en güvenli yöntem)
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
        // Hata olsa bile devam et
      } else {
        written++;
      }
    }
  }
  
  return { success: true, written };
}

/**
 * DIA API yanıtını parse et
 */
function parseDiaResponse(result: any, fullMethod: string): any[] {
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
 * Tek bir sayfa çek (session refresh ile)
 */
async function fetchPageWithSessionRefresh(
  supabase: any,
  userId: string,
  currentSession: any,
  module: string,
  method: string,
  donemKodu: number,
  offset: number
): Promise<{ success: boolean; data: any[]; newSession?: any; error?: string }> {
  // Session'ı kontrol et ve gerekirse yenile
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
      
      // Yeni session al ve tekrar dene
      const newSessionResult = await getDiaSession(supabase, userId);
      if (!newSessionResult.success || !newSessionResult.session) {
        return { success: false, data: [], error: "Session yenilemesi başarısız" };
      }
      
      // Yeni session ile tekrar çağır
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
    
    // Normal hata kontrolü
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
async function fetchAndWriteStreaming(
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
      // 1. DIA'dan bir sayfa çek (session refresh dahil)
      const fetchResult = await fetchPageWithSessionRefresh(
        supabase, userId, currentSession, module, method, donemKodu, offset
      );
      
      if (!fetchResult.success) {
        console.error(`[DIA Sync] Page ${pageCount + 1} fetch failed: ${fetchResult.error}`);
        
        // İlk sayfada hata varsa tamamen başarısız say
        if (pageCount === 0) {
          return { success: false, totalFetched, totalWritten, error: fetchResult.error };
        }
        
        // Sonraki sayfalarda hata varsa, şimdiye kadar çekilenleri kaydet ve dur
        break;
      }
      
      // Session güncellenmiş olabilir
      if (fetchResult.newSession) {
        currentSession = fetchResult.newSession;
      }
      
      const pageData = fetchResult.data;
      console.log(`[DIA Sync] Page ${pageCount + 1}: Received ${pageData.length} records (offset: ${offset})`);
      
      // 2. Bu sayfayı HEMEN veritabanına yaz
      if (pageData.length > 0) {
        const writeResult = await writeMicroBatches(
          supabase, sunucuAdi, firmaKodu, donemKodu, dataSourceSlug, pageData, processedKeys
        );
        
        totalWritten += writeResult.written;
        console.log(`[DIA Sync] Page ${pageCount + 1}: Wrote ${writeResult.written} records`);
      }
      
      totalFetched += pageData.length;
      pageCount++;
      
      // Sonraki sayfa var mı?
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
 * Tek bir veri kaynağı ve tek bir dönem için sync (Frontend orchestration için)
 */
async function syncSingleSourcePeriod(
  supabase: any,
  userId: string,
  session: any,
  source: { slug: string; module: string; method: string; name: string },
  periodNo: number,
  sunucuAdi: string,
  firmaKodu: string,
  triggerUserId: string
): Promise<SyncResult> {
  console.log(`[DIA Sync] syncSingleSource: ${source.slug} / period ${periodNo}`);
  
  // Sync history kaydı oluştur
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
    // Streaming sync
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

    // Başarılı
    await supabase.from('sync_history').update({ 
      status: 'completed', 
      records_fetched: syncResult.totalFetched, 
      records_inserted: syncResult.totalWritten, 
      completed_at: new Date().toISOString() 
    }).eq('id', historyRecord?.id);

    // Period sync status güncelle
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Yetkilendirme gerekli" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Takılı kalan sync kayıtlarını temizle
    await cleanupStuckSyncRecords(supabase);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Geçersiz token" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const body: SyncRequest = await req.json();
    const { action, dataSourceSlug, forceRefresh = false, periodNo, targetUserId } = body;

    let effectiveUserId = user.id;
    
    // Super admin kontrolü
    if ((action === 'syncAllForUser' || action === 'syncSingleSource') && targetUserId) {
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .single();
      
      if (!roleCheck) {
        return new Response(JSON.stringify({ success: false, error: "Bu işlem için süper admin yetkisi gerekli" }), { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      effectiveUserId = targetUserId;
    }

    // DIA session al
    const diaResult = await getDiaSession(supabase, effectiveUserId);
    if (!diaResult.success || !diaResult.session) {
      return new Response(JSON.stringify({ success: false, error: diaResult.error || "DIA bağlantısı kurulamadı" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { session } = diaResult;
    const sunucuAdi = session.sunucuAdi;
    const firmaKodu = String(session.firmaKodu);

    // ========== syncSingleSource: Tek kaynak + tek dönem ==========
    if (action === 'syncSingleSource') {
      if (!dataSourceSlug || periodNo === undefined) {
        return new Response(JSON.stringify({ success: false, error: "dataSourceSlug ve periodNo gerekli" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // Veri kaynağını bul
      const { data: sourceData } = await supabase
        .from('data_sources')
        .select('slug, module, method, name')
        .eq('slug', dataSourceSlug)
        .eq('is_active', true)
        .single();

      if (!sourceData) {
        return new Response(JSON.stringify({ success: false, error: `Veri kaynağı bulunamadı: ${dataSourceSlug}` }), { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const result = await syncSingleSourcePeriod(
        supabase, effectiveUserId, session, sourceData, periodNo,
        sunucuAdi, firmaKodu, user.id
      );

      return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // ========== Diğer action'lar (getSyncStatus, lockPeriod, syncAll, syncAllForUser) ==========
    
    const { data: profile } = await supabase.from('profiles').select('donem_kodu').eq('user_id', effectiveUserId).single();
    const currentDonem = parseInt(profile?.donem_kodu) || session.donemKodu;

    if (action === 'getSyncStatus') {
      const { data: syncHistory } = await supabase.from('sync_history').select('*').eq('sunucu_adi', sunucuAdi).eq('firma_kodu', firmaKodu).order('started_at', { ascending: false }).limit(10);
      const { data: periodStatus } = await supabase.from('period_sync_status').select('*').eq('sunucu_adi', sunucuAdi).eq('firma_kodu', firmaKodu);
      const { data: recordCounts } = await supabase.from('company_data_cache').select('data_source_slug').eq('sunucu_adi', sunucuAdi).eq('firma_kodu', firmaKodu).eq('is_deleted', false);
      
      const countBySource: Record<string, number> = {};
      (recordCounts || []).forEach((r: any) => { countBySource[r.data_source_slug] = (countBySource[r.data_source_slug] || 0) + 1; });

      return new Response(JSON.stringify({ 
        success: true, 
        syncHistory: syncHistory || [], 
        periodStatus: periodStatus || [], 
        recordCounts: countBySource, 
        currentPeriod: currentDonem 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'lockPeriod' && periodNo) {
      await supabase.from('period_sync_status').upsert({ 
        sunucu_adi: sunucuAdi, 
        firma_kodu: firmaKodu, 
        donem_kodu: periodNo, 
        data_source_slug: dataSourceSlug || 'all', 
        is_locked: true, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
      
      return new Response(JSON.stringify({ success: true, message: `Dönem ${periodNo} kilitlendi` }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // syncAll veya syncAllForUser için tüm kaynakları al
    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('slug, module, method, name')
      .eq('is_active', true);
    
    if (!dataSources?.length) {
      return new Response(JSON.stringify({ success: false, error: "Aktif veri kaynağı bulunamadı" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // DIA dışı veri kaynaklarını filtrele
    const diaDataSources = dataSources.filter(ds => 
      !NON_DIA_SOURCES.includes(ds.slug) && !ds.slug.startsWith('_system')
    );
    
    const sourcesToSync = (action === 'syncAll' || action === 'syncAllForUser') 
      ? diaDataSources 
      : diaDataSources.filter(ds => ds.slug === dataSourceSlug);
    
    if (!sourcesToSync.length) {
      return new Response(JSON.stringify({ success: false, error: `DIA veri kaynağı bulunamadı: ${dataSourceSlug}` }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Dönemleri belirle
    const syncAllPeriods = body.syncAllPeriods ?? true;
    let periodsToSync: number[] = [currentDonem];
    
    if (syncAllPeriods) {
      let { data: firmaPeriods } = await supabase
        .from('firma_periods')
        .select('period_no')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .order('period_no', { ascending: false });
      
      // Eğer dönem yoksa DIA'dan çek
      if (!firmaPeriods?.length) {
        console.log(`[DIA Sync] No periods found, fetching from DIA...`);
        
        const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;
        const periodsPayload = {
          sis_yetkili_firma_donem_sube_depo: { session_id: session.sessionId }
        };
        
        try {
          const periodsResponse = await fetch(diaUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(periodsPayload),
          });
          
          const periodsData = await periodsResponse.json();
          
          if (periodsData?.code === "200" && Array.isArray(periodsData?.result)) {
            const targetFirma = periodsData.result.find((f: any) => String(f.firmakodu) === firmaKodu);
            
            if (targetFirma?.donemler?.length) {
              for (const donem of targetFirma.donemler) {
                await supabase.from('firma_periods').upsert({
                  sunucu_adi: sunucuAdi,
                  firma_kodu: firmaKodu,
                  period_no: donem.donemkodu,
                  period_name: donem.gorunendonemkodu || `Dönem ${donem.donemkodu}`,
                  start_date: donem.baslangictarihi || null,
                  end_date: donem.bitistarihi || null,
                  is_current: donem.ontanimli === 't',
                  fetched_at: new Date().toISOString(),
                }, { onConflict: 'sunucu_adi,firma_kodu,period_no' });
              }
              
              const { data: refreshedPeriods } = await supabase
                .from('firma_periods')
                .select('period_no')
                .eq('sunucu_adi', sunucuAdi)
                .eq('firma_kodu', firmaKodu)
                .order('period_no', { ascending: false });
              
              firmaPeriods = refreshedPeriods;
            }
          }
        } catch (err) {
          console.error(`[DIA Sync] Failed to fetch periods:`, err);
        }
      }
      
      if (firmaPeriods?.length) {
        periodsToSync = firmaPeriods.map(p => p.period_no);
      }
    }

    console.log(`[DIA Sync] Will sync ${sourcesToSync.length} sources across ${periodsToSync.length} periods`);

    // Tüm kaynaklar ve dönemler için sync
    const results: SyncResult[] = [];

    for (const source of sourcesToSync) {
      for (const pNo of periodsToSync) {
        const result = await syncSingleSourcePeriod(
          supabase, effectiveUserId, session, source, pNo,
          sunucuAdi, firmaKodu, user.id
        );
        results.push(result);
      }
    }

    return new Response(JSON.stringify({ 
      success: results.some(r => r.success), 
      results, 
      totalSynced: results.filter(r => r.success).length, 
      totalFailed: results.filter(r => !r.success).length,
      periodsProcessed: periodsToSync.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`[DIA Sync] Error:`, errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
