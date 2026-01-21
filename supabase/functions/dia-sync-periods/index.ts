import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PeriodInfo {
  period_no: number;
  period_name: string;
  start_date: string | null;
  end_date: string | null;
  is_default: boolean;
}

interface BranchInfo {
  branch_key: number;
  branch_code: string;
  branch_name: string;
}

interface WarehouseInfo {
  branch_key: number;
  warehouse_key: number;
  warehouse_code: string;
  warehouse_name: string;
  can_view_movement: boolean;
  can_operate: boolean;
  can_view_quantity: boolean;
}

interface SyncResult {
  success: boolean;
  periods?: PeriodInfo[];
  branches?: BranchInfo[];
  warehouses?: WarehouseInfo[];
  activePeriod?: number;
  error?: string;
  rawResponse?: unknown;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Yetkilendirme başlığı eksik" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Kullanıcı doğrulanamadı" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Helper function to make DIA request with session recovery
    async function makeDiaRequest(
      retryCount = 0,
    ): Promise<{ success: boolean; data?: any; error?: string; raw?: any }> {
      // Get DIA session (will auto-login if needed)
      const sessionResult = await getDiaSession(supabase, userId);
      if (!sessionResult.success || !sessionResult.session) {
        return { success: false, error: sessionResult.error || "DIA oturumu alınamadı" };
      }

      const { session } = sessionResult;
      const diaUrl = `https://${session.sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;

      // Yeni metod: sis_yetkili_firma_donem_sube_depo
      const payload = {
        sis_yetkili_firma_donem_sube_depo: {
          session_id: session.sessionId,
        }
      };

      console.log("Calling sis_yetkili_firma_donem_sube_depo:", { sunucu: session.sunucuAdi, retry: retryCount });

      const diaResponse = await fetch(diaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const diaData = await diaResponse.json();
      console.log("DIA Response code:", diaData?.code, "result length:", Array.isArray(diaData?.result) ? diaData.result.length : 'N/A');

      // Check for INVALID_SESSION and retry
      if (diaData?.code === "401" || diaData?.msg === "INVALID_SESSION") {
        if (retryCount < 1) {
          console.log("Session invalid, clearing and retrying...");
          await supabase
            .from("profiles")
            .update({ dia_session_id: null, dia_session_expires: null })
            .eq("user_id", userId);
          
          return makeDiaRequest(retryCount + 1);
        }
        return { success: false, error: "DIA oturumu yenilenemedi" };
      }

      // Check for success
      if (diaData?.code !== "200" || !Array.isArray(diaData?.result)) {
        return {
          success: false,
          error: "DIA'dan dönem/şube/depo bilgisi alınamadı",
          raw: { code: diaData?.code, msg: diaData?.msg },
        };
      }

      return { success: true, data: { result: diaData.result, session } };
    }

    // Make the request with retry support
    const requestResult = await makeDiaRequest();
    if (!requestResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: requestResult.error,
          rawResponse: requestResult.raw 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: firmaList, session } = requestResult.data;
    const sunucuAdi = session.sunucuAdi;
    const userFirmaKodu = session.firmaKodu;

    // Kullanıcının bağlı olduğu firmayı bul
    const targetFirma = firmaList.find((f: any) => f.firmakodu === userFirmaKodu);
    
    if (!targetFirma) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Firma kodu ${userFirmaKodu} listede bulunamadı`,
          rawResponse: { firmaKodlari: firmaList.map((f: any) => f.firmakodu) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firmaKodu = targetFirma.firmakodu.toString();

    // Parse periods
    const periods: PeriodInfo[] = (targetFirma.donemler || []).map((d: any) => ({
      period_no: d.donemkodu,
      period_name: d.gorunendonemkodu || `Dönem ${d.donemkodu}`,
      start_date: d.baslangictarihi || null,
      end_date: d.bitistarihi || null,
      is_default: d.ontanimli === 't',
    }));

    // Parse branches
    const branches: BranchInfo[] = (targetFirma.subeler || []).map((s: any) => ({
      branch_key: s._key,
      branch_code: s.subekodu,
      branch_name: s.subeadi,
    }));

    // Parse warehouses
    const warehouses: WarehouseInfo[] = [];
    for (const sube of targetFirma.subeler || []) {
      for (const depo of sube.depolar || []) {
        warehouses.push({
          branch_key: sube._key,
          warehouse_key: depo._key,
          warehouse_code: depo.depokodu,
          warehouse_name: depo.depoadi,
          can_view_movement: depo.hareket_gorebilme ?? true,
          can_operate: depo.islem_yapabilme ?? true,
          can_view_quantity: depo.miktar_gorebilme ?? true,
        });
      }
    }

    console.log(`Parsed: ${periods.length} periods, ${branches.length} branches, ${warehouses.length} warehouses`);

    // Determine active period - prefer ontanimli='t', else by date, else highest
    let activePeriod: number | null = null;
    const defaultPeriod = periods.find(p => p.is_default);
    if (defaultPeriod) {
      activePeriod = defaultPeriod.period_no;
    } else {
      const today = new Date();
      for (const period of periods) {
        if (period.start_date && period.end_date) {
          const startDate = new Date(period.start_date);
          const endDate = new Date(period.end_date);
          if (today >= startDate && today <= endDate) {
            activePeriod = period.period_no;
            break;
          }
        }
      }
      if (activePeriod === null && periods.length > 0) {
        activePeriod = Math.max(...periods.map(p => p.period_no));
      }
    }

    // Upsert periods
    for (const period of periods) {
      await supabase
        .from("firma_periods")
        .upsert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          period_no: period.period_no,
          period_name: period.period_name,
          start_date: period.start_date,
          end_date: period.end_date,
          is_current: period.period_no === activePeriod,
          fetched_at: new Date().toISOString(),
        }, {
          onConflict: "sunucu_adi,firma_kodu,period_no"
        });
    }

    // Upsert branches
    for (const branch of branches) {
      await supabase
        .from("firma_branches")
        .upsert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          branch_key: branch.branch_key,
          branch_code: branch.branch_code,
          branch_name: branch.branch_name,
          is_active: true,
          fetched_at: new Date().toISOString(),
        }, {
          onConflict: "sunucu_adi,firma_kodu,branch_key"
        });
    }

    // Upsert warehouses
    for (const wh of warehouses) {
      await supabase
        .from("firma_warehouses")
        .upsert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          branch_key: wh.branch_key,
          warehouse_key: wh.warehouse_key,
          warehouse_code: wh.warehouse_code,
          warehouse_name: wh.warehouse_name,
          can_view_movement: wh.can_view_movement,
          can_operate: wh.can_operate,
          can_view_quantity: wh.can_view_quantity,
          fetched_at: new Date().toISOString(),
        }, {
          onConflict: "sunucu_adi,firma_kodu,warehouse_key"
        });
    }

    // Update user's profile with active period if determined
    if (activePeriod !== null) {
      await supabase
        .from("profiles")
        .update({ donem_kodu: activePeriod.toString() })
        .eq("user_id", userId);
    }

    const response: SyncResult = {
      success: true,
      periods,
      branches,
      warehouses,
      activePeriod: activePeriod || undefined,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in dia-sync-periods:", error);
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
