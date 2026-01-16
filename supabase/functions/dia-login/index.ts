import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiaLoginRequest {
  sunucuAdi: string;
  apiKey: string;
  wsKullanici: string;
  wsSifre: string;
  firmaKodu?: number;
  donemKodu?: number;
}

interface DiaLoginResponse {
  session_id: string;
  firma_kodu: number;
  donem_kodu: number;
  kullanici_adi: string;
  expires_at: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Yetkilendirme gerekli" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Geçersiz token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DiaLoginRequest = await req.json();
    const { sunucuAdi, apiKey, wsKullanici, wsSifre, firmaKodu = 1, donemKodu = 0 } = body;

    if (!sunucuAdi || !apiKey || !wsKullanici || !wsSifre) {
      return new Response(
        JSON.stringify({ success: false, error: "Tüm bağlantı bilgileri gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build DIA API URL
    const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/sis/json`;

    // DIA Login Request
    const loginPayload = {
      login: {
        username: wsKullanici,
        password: wsSifre,
        disconnect_same_user: true,
        Lang: "tr",
        params: {
          apikey: apiKey,
        },
      },
    };

    console.log(`DIA Login attempt for user ${user.id} to ${sunucuAdi}`);

    const diaResponse = await fetch(diaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginPayload),
    });

    if (!diaResponse.ok) {
      console.error(`DIA API error: ${diaResponse.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `DIA bağlantı hatası: ${diaResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const diaData = await diaResponse.json();

    // Check for DIA error response
    if (diaData.error || diaData.hata) {
      const errorMsg = diaData.error?.message || diaData.hata?.aciklama || "DIA giriş hatası";
      console.error(`DIA login failed: ${errorMsg}`);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract session info
    const sessionId = diaData.login?.session_id || diaData.session_id;
    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: "DIA oturum ID alınamadı" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Session expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Update user profile with DIA connection info
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        dia_sunucu_adi: sunucuAdi,
        dia_api_key: apiKey,
        dia_ws_kullanici: wsKullanici,
        dia_ws_sifre: wsSifre, // In production, encrypt this
        dia_session_id: sessionId,
        dia_session_expires: expiresAt,
        firma_kodu: String(firmaKodu),
        donem_kodu: String(donemKodu),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error(`Profile update error: ${updateError.message}`);
    }

    const response: DiaLoginResponse = {
      session_id: sessionId,
      firma_kodu: firmaKodu,
      donem_kodu: donemKodu,
      kullanici_adi: wsKullanici,
      expires_at: expiresAt,
    };

    console.log(`DIA Login successful for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`DIA Login error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
