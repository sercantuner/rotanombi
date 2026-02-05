import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRequest {
  action: 'sync' | 'syncAll' | 'lockPeriod' | 'getSyncStatus' | 'syncAllForUser';
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
  recordsFetched?: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsDeleted?: number;
  error?: string;
  syncHistoryId?: string;
}

// Bellek optimizasyonu: Daha küçük sayfa boyutu
const PAGE_SIZE = 250;
const MAX_RECORDS = 50000; // Maksimum kayıt limiti

// Sayfa bazlı veri çekme ve ANINDA yazma - bellek optimizasyonu
async function fetchAndWritePageByPage(
  supabase: any,
  diaSession: any,
  module: string,
  method: string,
  donemKodu: number,
  sunucuAdi: string,
  firmaKodu: string,
  dataSourceSlug: string
): Promise<{ success: boolean; totalFetched: number; totalWritten: number; error?: string }> {
  const diaUrl = `https://${diaSession.sunucuAdi}.ws.dia.com.tr/api/v3/${module}/json`;
  const fullMethod = method.startsWith(`${module}_`) ? method : `${module}_${method}`;
  
  let offset = 0;
  let hasMore = true;
  let totalFetched = 0;
  let totalWritten = 0;
  let pageCount = 0;
  
  // İşlenmiş key'leri takip et (soft delete için)
  const processedKeys = new Set<number>();

  try {
    while (hasMore && totalFetched < MAX_RECORDS) {
      // 1. DIA'dan bir sayfa çek
      const payload = { 
        [fullMethod]: { 
          session_id: diaSession.sessionId, 
          firma_kodu: diaSession.firmaKodu, 
          donem_kodu: donemKodu, 
          limit: PAGE_SIZE,
          offset: offset
        } 
      };
      
      console.log(`[DIA Sync] Page ${pageCount + 1}: Fetching ${fullMethod} (offset: ${offset}, limit: ${PAGE_SIZE})`);
      
      const response = await fetch(diaUrl, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
      });
      
      if (!response.ok) {
        return { success: false, totalFetched, totalWritten, error: `HTTP ${response.status}` };
      }
      
      const result = await response.json();
      
      // DIA hata kontrolü
      if (result.code && result.code !== "200") {
        return { success: false, totalFetched, totalWritten, error: result.msg || `DIA Error: ${result.code}` };
      }
      if (result.error || result.hata) {
        return { success: false, totalFetched, totalWritten, error: result.error?.message || result.hata?.aciklama || "API hatası" };
      }
      
      // DIA API yanıt formatını parse et
      let pageData: any[] = [];
      
      if (result.result) {
        if (Array.isArray(result.result)) {
          pageData = result.result;
        } else if (typeof result.result === 'object' && result.result !== null) {
          const firstKey = Object.keys(result.result)[0];
          if (firstKey && Array.isArray(result.result[firstKey])) {
            pageData = result.result[firstKey];
          }
        }
      } else if (result.msg && Array.isArray(result.msg)) {
        pageData = result.msg;
      } else if (result[fullMethod] && Array.isArray(result[fullMethod])) {
        pageData = result[fullMethod];
      }
      
      if (!pageData || !Array.isArray(pageData)) {
        pageData = [];
      }
      
      console.log(`[DIA Sync] Page ${pageCount + 1}: Received ${pageData.length} records`);
      
      // 2. Bu sayfayı HEMEN veritabanına yaz (bellek biriktirme)
      if (pageData.length > 0) {
        const writeResult = await writePageToDatabase(
          supabase, sunucuAdi, firmaKodu, donemKodu, dataSourceSlug, pageData, processedKeys
        );
        
        if (!writeResult.success) {
          console.error(`[DIA Sync] Page ${pageCount + 1}: Write failed - ${writeResult.error}`);
          // Hata olsa bile devam et, bir sonraki sayfayı dene
        } else {
          totalWritten += writeResult.written;
          console.log(`[DIA Sync] Page ${pageCount + 1}: Wrote ${writeResult.written} records to DB`);
        }
      }
      
      totalFetched += pageData.length;
      pageCount++;
      
      // Sonraki sayfa var mı?
      if (pageData.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
      
      // Bellekten temizle
      pageData = [];
    }
    
    console.log(`[DIA Sync] Completed: ${totalFetched} fetched, ${totalWritten} written (${pageCount} pages)`);
    
    // Soft delete: Artık olmayan kayıtları işaretle (sadece az kayıt varsa)
    if (totalFetched < 10000) {
      await softDeleteMissingRecords(supabase, sunucuAdi, firmaKodu, donemKodu, dataSourceSlug, processedKeys);
    }
    
    return { success: true, totalFetched, totalWritten };
    
  } catch (error) {
    return { success: false, totalFetched, totalWritten, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
  }
}

// Tek sayfa veritabanına yaz - küçük batch'ler
async function writePageToDatabase(
  supabase: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  dataSourceSlug: string,
  records: any[],
  processedKeys: Set<number>
): Promise<{ success: boolean; written: number; error?: string }> {
  if (!records.length) return { success: true, written: 0 };
  
  const batchSize = 100; // Çok küçük batch'ler (timeout önleme)
  let written = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const upsertPayload = batch.map(record => {
      const diaKey = record._key || record.id;
      if (diaKey) processedKeys.add(Number(diaKey));
      
      return { 
        sunucu_adi: sunucuAdi, 
        firma_kodu: firmaKodu, 
        donem_kodu: donemKodu, 
        data_source_slug: dataSourceSlug, 
        dia_key: Number(diaKey), 
        data: record, 
        is_deleted: false, 
        updated_at: new Date().toISOString() 
      };
    }).filter(r => r.dia_key);

    if (upsertPayload.length === 0) continue;

    const { error } = await supabase
      .from('company_data_cache')
      .upsert(upsertPayload, { 
        onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key', 
        ignoreDuplicates: false 
      });
    
    if (error) { 
      console.error(`[DIA Sync] Batch write error:`, error.message);
      return { success: false, written, error: error.message };
    }
    
    written += upsertPayload.length;
  }
  
  return { success: true, written };
}

// Artık olmayan kayıtları soft delete
async function softDeleteMissingRecords(
  supabase: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  dataSourceSlug: string,
  processedKeys: Set<number>
): Promise<void> {
  // Sadece mevcut kayıtları al
  const { data: existingRecords } = await supabase
    .from('company_data_cache')
    .select('id, dia_key')
    .eq('sunucu_adi', sunucuAdi)
    .eq('firma_kodu', firmaKodu)
    .eq('donem_kodu', donemKodu)
    .eq('data_source_slug', dataSourceSlug)
    .eq('is_deleted', false)
    .limit(5000);

  if (!existingRecords?.length) return;

  let deleteCount = 0;
  for (const record of existingRecords) {
    if (!processedKeys.has(record.dia_key) && deleteCount < 500) {
      await supabase
        .from('company_data_cache')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', record.id);
      deleteCount++;
    }
  }
  
  if (deleteCount > 0) {
    console.log(`[DIA Sync] Soft deleted ${deleteCount} missing records`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ success: false, error: "Yetkilendirme gerekli" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) return new Response(JSON.stringify({ success: false, error: "Geçersiz token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: SyncRequest = await req.json();
    const { action, dataSourceSlug, forceRefresh = false, periodNo, targetUserId } = body;

    let effectiveUserId = user.id;
    
    if (action === 'syncAllForUser' && targetUserId) {
      const { data: roleCheck } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').single();
      if (!roleCheck) return new Response(JSON.stringify({ success: false, error: "Bu işlem için süper admin yetkisi gerekli" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      effectiveUserId = targetUserId;
    }

    const diaResult = await getDiaSession(supabase, effectiveUserId);
    if (!diaResult.success || !diaResult.session) return new Response(JSON.stringify({ success: false, error: diaResult.error || "DIA bağlantısı kurulamadı" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { session } = diaResult;
    const sunucuAdi = session.sunucuAdi;
    const firmaKodu = String(session.firmaKodu);

    const { data: profile } = await supabase.from('profiles').select('donem_kodu').eq('user_id', effectiveUserId).single();
    const currentDonem = parseInt(profile?.donem_kodu) || session.donemKodu;

    if (action === 'getSyncStatus') {
      const { data: syncHistory } = await supabase.from('sync_history').select('*').eq('sunucu_adi', sunucuAdi).eq('firma_kodu', firmaKodu).order('started_at', { ascending: false }).limit(10);
      const { data: periodStatus } = await supabase.from('period_sync_status').select('*').eq('sunucu_adi', sunucuAdi).eq('firma_kodu', firmaKodu);
      const { data: recordCounts } = await supabase.from('company_data_cache').select('data_source_slug').eq('sunucu_adi', sunucuAdi).eq('firma_kodu', firmaKodu).eq('is_deleted', false);
      
      const countBySource: Record<string, number> = {};
      (recordCounts || []).forEach((r: any) => { countBySource[r.data_source_slug] = (countBySource[r.data_source_slug] || 0) + 1; });

      return new Response(JSON.stringify({ success: true, syncHistory: syncHistory || [], periodStatus: periodStatus || [], recordCounts: countBySource, currentPeriod: currentDonem }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'lockPeriod' && periodNo) {
      await supabase.from('period_sync_status').upsert({ sunucu_adi: sunucuAdi, firma_kodu: firmaKodu, donem_kodu: periodNo, data_source_slug: dataSourceSlug || 'all', is_locked: true, updated_at: new Date().toISOString() }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
      return new Response(JSON.stringify({ success: true, message: `Dönem ${periodNo} kilitlendi` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: dataSources } = await supabase.from('data_sources').select('slug, module, method, name').eq('is_active', true);
    if (!dataSources?.length) return new Response(JSON.stringify({ success: false, error: "Aktif veri kaynağı bulunamadı" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // DIA dışı veri kaynaklarını filtrele
    const diaDataSources = dataSources.filter(ds => !NON_DIA_SOURCES.includes(ds.slug) && !ds.slug.startsWith('_system'));
    
    const sourcesToSync = (action === 'syncAll' || action === 'syncAllForUser') ? diaDataSources : diaDataSources.filter(ds => ds.slug === dataSourceSlug);
    if (!sourcesToSync.length) return new Response(JSON.stringify({ success: false, error: `DIA veri kaynağı bulunamadı: ${dataSourceSlug}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Tüm dönemleri çek (syncAllPeriods aktifse)
    const syncAllPeriods = body.syncAllPeriods ?? true;
    let periodsToSync: number[] = [currentDonem];
    
    if (syncAllPeriods) {
      let { data: firmaPeriods } = await supabase
        .from('firma_periods')
        .select('period_no')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .order('period_no', { ascending: false });
      
      // Eğer firma_periods tablosunda dönem yoksa, DIA'dan çek ve kaydet
      if (!firmaPeriods?.length) {
        console.log(`[DIA Sync] No periods found for ${sunucuAdi}/${firmaKodu}, fetching from DIA...`);
        
        const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;
        const periodsPayload = {
          sis_yetkili_firma_donem_sube_depo: {
            session_id: session.sessionId,
          }
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
              console.log(`[DIA Sync] Found ${targetFirma.donemler.length} periods from DIA`);
              
              // Dönemleri veritabanına kaydet
              for (const donem of targetFirma.donemler) {
                await supabase
                  .from('firma_periods')
                  .upsert({
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
              
              // Yeniden oku
              const { data: refreshedPeriods } = await supabase
                .from('firma_periods')
                .select('period_no')
                .eq('sunucu_adi', sunucuAdi)
                .eq('firma_kodu', firmaKodu)
                .order('period_no', { ascending: false });
              
              firmaPeriods = refreshedPeriods;
            }
          }
        } catch (periodFetchError) {
          console.error(`[DIA Sync] Failed to fetch periods:`, periodFetchError);
        }
      }
      
      if (firmaPeriods?.length) {
        periodsToSync = firmaPeriods.map(p => p.period_no);
        console.log(`[DIA Sync] Syncing ${periodsToSync.length} periods: ${periodsToSync.join(', ')}`);
      }
    }

    const results: SyncResult[] = [];

    for (const source of sourcesToSync) {
      console.log(`[DIA Sync] Processing source: ${source.slug} (${source.module}/${source.method})`);
      
      let totalFetched = 0;
      let totalInserted = 0;
      let hasError = false;
      let lastError = '';

      for (const periodNo of periodsToSync) {
        const { data: historyRecord } = await supabase.from('sync_history').insert({ 
          sunucu_adi: sunucuAdi, 
          firma_kodu: firmaKodu, 
          donem_kodu: periodNo, 
          data_source_slug: source.slug, 
          sync_type: syncAllPeriods ? 'full' : 'incremental', 
          triggered_by: user.id, 
          status: 'running' 
        }).select().single();

        try {
          const { data: periodLock } = await supabase.from('period_sync_status')
            .select('is_locked')
            .eq('sunucu_adi', sunucuAdi)
            .eq('firma_kodu', firmaKodu)
            .eq('donem_kodu', periodNo)
            .eq('data_source_slug', source.slug)
            .single();

          if (periodLock?.is_locked && !forceRefresh) {
            console.log(`[DIA Sync] Period ${periodNo} is locked for ${source.slug}, skipping`);
            continue;
          }

          // Yeni streaming yaklaşımı: Sayfa sayfa çek ve yaz
          const syncResult = await fetchAndWritePageByPage(
            supabase,
            session,
            source.module,
            source.method,
            periodNo,
            sunucuAdi,
            firmaKodu,
            source.slug
          );

          if (!syncResult.success) {
            await supabase.from('sync_history').update({ 
              status: 'failed', 
              error: syncResult.error, 
              completed_at: new Date().toISOString() 
            }).eq('id', historyRecord.id);
            hasError = true;
            lastError = syncResult.error || 'Bilinmeyen hata';
            console.error(`[DIA Sync] Failed for ${source.slug} period ${periodNo}: ${lastError}`);
            continue;
          }

          await supabase.from('sync_history').update({ 
            status: 'completed', 
            records_fetched: syncResult.totalFetched, 
            records_inserted: syncResult.totalWritten, 
            records_updated: 0, 
            records_deleted: 0, 
            completed_at: new Date().toISOString() 
          }).eq('id', historyRecord.id);

          await supabase.from('period_sync_status').upsert({ 
            sunucu_adi: sunucuAdi, 
            firma_kodu: firmaKodu, 
            donem_kodu: periodNo, 
            data_source_slug: source.slug, 
            last_incremental_sync: new Date().toISOString(), 
            total_records: syncResult.totalFetched, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });

          totalFetched += syncResult.totalFetched;
          totalInserted += syncResult.totalWritten;

          console.log(`[DIA Sync] Period ${periodNo} for ${source.slug}: ${syncResult.totalFetched} fetched, ${syncResult.totalWritten} written`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
          if (historyRecord?.id) {
            await supabase.from('sync_history').update({ 
              status: 'failed', 
              error: errorMsg, 
              completed_at: new Date().toISOString() 
            }).eq('id', historyRecord.id);
          }
          hasError = true;
          lastError = errorMsg;
        }
      }

      results.push({ 
        success: !hasError || totalFetched > 0, 
        dataSourceSlug: source.slug, 
        recordsFetched: totalFetched, 
        recordsInserted: totalInserted, 
        recordsUpdated: 0, 
        recordsDeleted: 0,
        error: hasError ? lastError : undefined
      });
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
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
