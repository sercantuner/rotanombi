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
}

interface SyncResult {
  success: boolean;
  periods?: PeriodInfo[];
  activePeriod?: number;
  error?: string;
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
    async function makeDiaRequest(retryCount = 0): Promise<{ success: boolean; data?: any; error?: string }> {
      // Get DIA session (will auto-login if needed)
      const sessionResult = await getDiaSession(supabase, userId);
      if (!sessionResult.success || !sessionResult.session) {
        return { success: false, error: sessionResult.error || "DIA oturumu alınamadı" };
      }

      const { session } = sessionResult;
      const diaUrl = `https://${session.sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;

      const payload = {
        sis_firma_getir: {
          session_id: session.sessionId,
          firma_kodu: session.firmaKodu,
          params: ""
        }
      };

      console.log("Calling sis_firma_getir for periods:", { sunucu: session.sunucuAdi, firma: session.firmaKodu, retry: retryCount });

      const diaResponse = await fetch(diaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const diaData = await diaResponse.json();
      console.log("DIA Response:", JSON.stringify(diaData).substring(0, 500));

      // Check for INVALID_SESSION and retry
      if (diaData?.code === "401" || diaData?.msg === "INVALID_SESSION") {
        if (retryCount < 1) {
          console.log("Session invalid, clearing and retrying...");
          // Clear session to force re-login
          await supabase
            .from("profiles")
            .update({ dia_session_id: null, dia_session_expires: null })
            .eq("user_id", userId);
          
          return makeDiaRequest(retryCount + 1);
        }
        return { success: false, error: "DIA oturumu yenilenemedi" };
      }

      const result = diaData?.sis_firma_getir?.result;
      if (!result || result.code !== 200) {
        return { success: false, error: "DIA'dan dönem bilgisi alınamadı", data: diaData };
      }

      return { success: true, data: { result, session } };
    }

    // Make the request with retry support
    const requestResult = await makeDiaRequest();
    if (!requestResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: requestResult.error,
          rawResponse: requestResult.data 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result, session } = requestResult.data;

    // Extract periods from msg - structure depends on DIA response
    // Common structure: msg contains firma info with donemler array
    const msg = result.msg;
    let periods: PeriodInfo[] = [];
    
    // Try to find periods in the response
    // DIA typically returns periods as an array with donem_no, donem_adi, baslangic_tarih, bitis_tarih
    if (msg && Array.isArray(msg.donemler)) {
      periods = msg.donemler.map((d: any) => ({
        period_no: parseInt(d.donem_no || d.donem_kodu || d.level2 || "0"),
        period_name: d.donem_adi || d.aciklama || `Dönem ${d.donem_no}`,
        start_date: d.baslangic_tarih || d.baslangic || null,
        end_date: d.bitis_tarih || d.bitis || null,
      }));
    } else if (msg && Array.isArray(msg)) {
      // Alternative: msg itself might be the array
      periods = msg.map((d: any) => ({
        period_no: parseInt(d.donem_no || d.donem_kodu || d.level2 || "0"),
        period_name: d.donem_adi || d.aciklama || `Dönem ${d.donem_no}`,
        start_date: d.baslangic_tarih || d.baslangic || null,
        end_date: d.bitis_tarih || d.bitis || null,
      }));
    } else if (msg && typeof msg === 'object') {
      // Check if periods are nested in firma object
      const firmaData = msg.firma || msg;
      if (firmaData.donemler && Array.isArray(firmaData.donemler)) {
        periods = firmaData.donemler.map((d: any) => ({
          period_no: parseInt(d.donem_no || d.donem_kodu || d.level2 || "0"),
          period_name: d.donem_adi || d.aciklama || `Dönem ${d.donem_no}`,
          start_date: d.baslangic_tarih || d.baslangic || null,
          end_date: d.bitis_tarih || d.bitis || null,
        }));
      }
    }

    console.log("Parsed periods:", periods);

    // Determine active period based on today's date
    const today = new Date();
    let activePeriod: number | null = null;

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

    // If no active period found by date, use the highest period number
    if (activePeriod === null && periods.length > 0) {
      activePeriod = Math.max(...periods.map(p => p.period_no));
    }

    // Upsert periods to firma_periods table
    const sunucuAdi = session.sunucuAdi;
    const firmaKodu = session.firmaKodu.toString();

    for (const period of periods) {
      const { error: upsertError } = await supabase
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

      if (upsertError) {
        console.error("Error upserting period:", upsertError);
      }
    }

    // Update user's profile with active period if determined
    if (activePeriod !== null) {
      await supabase
        .from("profiles")
        .update({ donem_kodu: activePeriod.toString() })
        .eq("user_id", user.id);
    }

    const response: SyncResult = {
      success: true,
      periods,
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