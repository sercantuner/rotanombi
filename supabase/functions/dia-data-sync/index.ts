import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";
import { 
  cleanupStuckSyncRecords, 
  NON_DIA_SOURCES, 
  SyncRequest, 
  SyncResult 
} from "../_shared/diaDataSyncHelpers.ts";
import { syncSingleSourcePeriod } from "../_shared/diaStreamingSync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { action, dataSourceSlug, periodNo, targetUserId } = body;

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

    // ========== Diğer action'lar ==========
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
      
      if (!firmaPeriods?.length) {
        console.log(`[DIA Sync] No periods found, fetching from DIA...`);
        
        const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;
        const periodsPayload = { sis_yetkili_firma_donem_sube_depo: { session_id: session.sessionId } };
        
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
