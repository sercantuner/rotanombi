// DIA Data Sync Edge Function
// Senkronizasyon mantığı: DIA'dan veri çekip Supabase'e kaydetme

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  action: 'sync' | 'syncAll' | 'lockPeriod' | 'getSyncStatus' | 'syncAllForUser';
  dataSourceSlug?: string;
  forceRefresh?: boolean;
  periodNo?: number;
  targetUserId?: string; // Super admin tarafından belirtilen hedef kullanıcı
}

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

// DIA API'den veri çek
async function fetchFromDia(
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
      limit: 0, // Tüm veriyi çek
    }
  };

  // Tarih filtresi ekle (aktif dönem için son 2 ay)
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
    
    // DIA hata kontrolü
    if (result.error || result.hata) {
      const errorMsg = result.error?.message || result.hata?.aciklama || "DIA API hatası";
      return { success: false, error: errorMsg };
    }

    // Veriyi çıkar
    const data = result[method] || result.data || [];
    console.log(`[DIA Sync] Fetched ${Array.isArray(data) ? data.length : 0} records`);
    
    return { success: true, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
  }
}

// Verileri Supabase'e upsert et
async function upsertData(
  supabase: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  dataSourceSlug: string,
  records: any[]
): Promise<{ inserted: number; updated: number; deleted: number }> {
  const stats = { inserted: 0, updated: 0, deleted: 0 };
  
  if (!records.length) return stats;

  // Mevcut kayıtları al (_key listesi)
  const { data: existingRecords } = await supabase
    .from('company_data_cache')
    .select('id, dia_key')
    .eq('sunucu_adi', sunucuAdi)
    .eq('firma_kodu', firmaKodu)
    .eq('donem_kodu', donemKodu)
    .eq('data_source_slug', dataSourceSlug)
    .eq('is_deleted', false);

  const existingMap = new Map<number, string>();
  (existingRecords || []).forEach((r: any) => existingMap.set(r.dia_key, r.id));

  const incomingKeys = new Set<number>();
  const batchSize = 500;
  
  // Batch upsert
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
    }).filter(r => r.dia_key); // dia_key olmayan kayıtları atla

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

    // İstatistik hesapla
    for (const record of batch) {
      const diaKey = Number(record._key || record.id);
      if (existingMap.has(diaKey)) {
        stats.updated++;
      } else {
        stats.inserted++;
      }
    }
  }

  // Soft delete: DIA'da olmayan kayıtları işaretle
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Yetkilendirme gerekli" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Geçersiz token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SyncRequest = await req.json();
    const { action, dataSourceSlug, forceRefresh = false, periodNo, targetUserId } = body;

    // Super admin kontrolü (syncAllForUser için)
    let effectiveUserId = user.id;
    
    if (action === 'syncAllForUser' && targetUserId) {
      // Super admin kontrolü
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .single();
      
      if (!roleCheck) {
        return new Response(
          JSON.stringify({ success: false, error: "Bu işlem için süper admin yetkisi gerekli" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      effectiveUserId = targetUserId;
    }

    // DIA session al (hedef kullanıcı için)
    const diaResult = await getDiaSession(supabase, effectiveUserId);
    if (!diaResult.success || !diaResult.session) {
      return new Response(
        JSON.stringify({ success: false, error: diaResult.error || "DIA bağlantısı kurulamadı" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { session } = diaResult;
    const sunucuAdi = session.sunucuAdi;
    const firmaKodu = String(session.firmaKodu);

    // Kullanıcı profilinden donem bilgisi
    const { data: profile } = await supabase
      .from('profiles')
      .select('donem_kodu')
      .eq('user_id', effectiveUserId)
      .single();

    const currentDonem = parseInt(profile?.donem_kodu) || session.donemKodu;

    // ===== SYNC ALL FOR USER (Super Admin) =====
    if (action === 'syncAllForUser') {
      // Bu action, syncAll ile aynı mantığı kullanır ama hedef kullanıcı için
      console.log(`[DIA Sync] Super admin syncing all data for user: ${effectiveUserId}`);
    }

    // ===== GET SYNC STATUS =====
    if (action === 'getSyncStatus') {
      // Son sync bilgilerini getir
      const { data: syncHistory } = await supabase
        .from('sync_history')
        .select('*')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .order('started_at', { ascending: false })
        .limit(10);

      // Period durumlarını getir
      const { data: periodStatus } = await supabase
        .from('period_sync_status')
        .select('*')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu);

      // Data source bazlı kayıt sayıları
      const { data: recordCounts } = await supabase
        .from('company_data_cache')
        .select('data_source_slug')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .eq('is_deleted', false);

      const countBySource: Record<string, number> = {};
      (recordCounts || []).forEach((r: any) => {
        countBySource[r.data_source_slug] = (countBySource[r.data_source_slug] || 0) + 1;
      });

      return new Response(
        JSON.stringify({
          success: true,
          syncHistory: syncHistory || [],
          periodStatus: periodStatus || [],
          recordCounts: countBySource,
          currentPeriod: currentDonem,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LOCK PERIOD =====
    if (action === 'lockPeriod' && periodNo) {
      await supabase
        .from('period_sync_status')
        .upsert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          donem_kodu: periodNo,
          data_source_slug: dataSourceSlug || 'all',
          is_locked: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug',
        });

      return new Response(
        JSON.stringify({ success: true, message: `Dönem ${periodNo} kilitlendi` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SYNC veya SYNC ALL =====
    // Veri kaynaklarını al
    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('slug, module, method, name')
      .eq('is_active', true);

    if (!dataSources?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "Aktif veri kaynağı bulunamadı" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SYNC veya SYNC ALL veya SYNC ALL FOR USER =====
    // Hangi veri kaynaklarını senkronize edeceğimizi belirle
    const sourcesToSync = (action === 'syncAll' || action === 'syncAllForUser')
      ? dataSources 
      : dataSources.filter(ds => ds.slug === dataSourceSlug);

    if (!sourcesToSync.length) {
      return new Response(
        JSON.stringify({ success: false, error: `Veri kaynağı bulunamadı: ${dataSourceSlug}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: SyncResult[] = [];

    for (const source of sourcesToSync) {
      // Sync history kaydı oluştur
      const { data: historyRecord } = await supabase
        .from('sync_history')
        .insert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          donem_kodu: currentDonem,
          data_source_slug: source.slug,
          sync_type: 'incremental',
          triggered_by: user.id,
          status: 'running',
        })
        .select()
        .single();

      try {
        // Period lock kontrolü
        const { data: periodLock } = await supabase
          .from('period_sync_status')
          .select('is_locked')
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .eq('donem_kodu', currentDonem)
          .eq('data_source_slug', source.slug)
          .single();

        if (periodLock?.is_locked && !forceRefresh) {
          console.log(`[DIA Sync] Period ${currentDonem} is locked for ${source.slug}, skipping`);
          results.push({
            success: true,
            dataSourceSlug: source.slug,
            recordsFetched: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsDeleted: 0,
            error: "Dönem kilitli - atlandı",
          });
          continue;
        }

        // Son 2 aylık tarih filtresi (aktif dönem için)
        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const dateFilter = {
          field: 'tarih',
          startDate: twoMonthsAgo.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0],
        };

        // DIA'dan veri çek
        const fetchResult = await fetchFromDia(
          session,
          source.module,
          source.method,
          currentDonem,
          dateFilter
        );

        if (!fetchResult.success) {
          await supabase
            .from('sync_history')
            .update({
              status: 'failed',
              error: fetchResult.error,
              completed_at: new Date().toISOString(),
            })
            .eq('id', historyRecord.id);

          results.push({
            success: false,
            dataSourceSlug: source.slug,
            error: fetchResult.error,
          });
          continue;
        }

        // Upsert
        const stats = await upsertData(
          supabase,
          sunucuAdi,
          firmaKodu,
          currentDonem,
          source.slug,
          fetchResult.data || []
        );

        // History güncelle
        await supabase
          .from('sync_history')
          .update({
            status: 'completed',
            records_fetched: fetchResult.data?.length || 0,
            records_inserted: stats.inserted,
            records_updated: stats.updated,
            records_deleted: stats.deleted,
            completed_at: new Date().toISOString(),
          })
          .eq('id', historyRecord.id);

        // Period status güncelle
        await supabase
          .from('period_sync_status')
          .upsert({
            sunucu_adi: sunucuAdi,
            firma_kodu: firmaKodu,
            donem_kodu: currentDonem,
            data_source_slug: source.slug,
            last_incremental_sync: new Date().toISOString(),
            total_records: (fetchResult.data?.length || 0),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug',
          });

        results.push({
          success: true,
          dataSourceSlug: source.slug,
          recordsFetched: fetchResult.data?.length || 0,
          recordsInserted: stats.inserted,
          recordsUpdated: stats.updated,
          recordsDeleted: stats.deleted,
          syncHistoryId: historyRecord.id,
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
        
        if (historyRecord?.id) {
          await supabase
            .from('sync_history')
            .update({
              status: 'failed',
              error: errorMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', historyRecord.id);
        }

        results.push({
          success: false,
          dataSourceSlug: source.slug,
          error: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: results.every(r => r.success),
        results,
        totalSynced: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`[DIA Sync] Error:`, errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
