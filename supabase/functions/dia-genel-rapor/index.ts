import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CariHesap {
  cariKodu: string;
  cariAdi: string;
  bakiye: number;
  vadeBakiyesi: number;
  sonIslemTarihi: string;
  riskSkoru: number;
  vadeDagilimi: {
    guncel: number;
    vade30: number;
    vade60: number;
    vade90: number;
    vade90Plus: number;
  };
}

interface GenelRapor {
  toplamAlacak: number;
  toplamBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
  vadesiBugun: number;
  vadesiYaklasan: number;
  cariler: CariHesap[];
  sonGuncelleme: string;
}

// Risk score calculation based on n8n workflow logic
function hesaplaRiskSkoru(cari: any): number {
  let skor = 0;
  
  // Vadesi geçmiş bakiye varsa risk artar
  const vadesiGecmisBakiye = cari.vadesi_gecmis_bakiye || 0;
  const toplamBakiye = cari.bakiye || 0;
  
  if (toplamBakiye > 0) {
    const vadesiGecmisOrani = vadesiGecmisBakiye / toplamBakiye;
    skor += vadesiGecmisOrani * 50;
  }
  
  // Son işlem tarihi eski ise risk artar
  if (cari.son_islem_tarihi) {
    const sonIslem = new Date(cari.son_islem_tarihi);
    const simdi = new Date();
    const gunFarki = Math.floor((simdi.getTime() - sonIslem.getTime()) / (1000 * 60 * 60 * 24));
    
    if (gunFarki > 90) skor += 30;
    else if (gunFarki > 60) skor += 20;
    else if (gunFarki > 30) skor += 10;
  }
  
  // Yüksek bakiye riski
  if (toplamBakiye > 100000) skor += 20;
  else if (toplamBakiye > 50000) skor += 10;
  
  return Math.min(100, Math.round(skor));
}

// FIFO-based aging calculation
function hesaplaVadeDagilimi(hareketler: any[]): {
  guncel: number;
  vade30: number;
  vade60: number;
  vade90: number;
  vade90Plus: number;
} {
  const simdi = new Date();
  const dagilim = { guncel: 0, vade30: 0, vade60: 0, vade90: 0, vade90Plus: 0 };
  
  for (const hareket of hareketler) {
    const vadeTarihi = new Date(hareket.vade_tarihi || hareket.tarih);
    const gunFarki = Math.floor((simdi.getTime() - vadeTarihi.getTime()) / (1000 * 60 * 60 * 24));
    const tutar = hareket.borc - hareket.alacak;
    
    if (tutar <= 0) continue; // Alacak bakiyesi
    
    if (gunFarki <= 0) dagilim.guncel += tutar;
    else if (gunFarki <= 30) dagilim.vade30 += tutar;
    else if (gunFarki <= 60) dagilim.vade60 += tutar;
    else if (gunFarki <= 90) dagilim.vade90 += tutar;
    else dagilim.vade90Plus += tutar;
  }
  
  return dagilim;
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

    // Get user's DIA connection info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.dia_session_id) {
      return new Response(
        JSON.stringify({ success: false, error: "DIA bağlantısı bulunamadı. Lütfen önce giriş yapın." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check session expiry
    if (new Date(profile.dia_session_expires) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "DIA oturumu sona ermiş. Lütfen tekrar giriş yapın." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const diaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/scf/json`;
    const firmaKodu = parseInt(profile.firma_kodu) || 1;
    const donemKodu = parseInt(profile.donem_kodu) || 0;

    // Fetch cari hesap listesi from DIA
    const cariListePayload = {
      scf_carikart_listele: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
        filters: "",
        sorts: "",
        params: "",
        offset: 0,
      },
    };

    console.log(`Fetching cari list for user ${user.id}`);

    const cariResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cariListePayload),
    });

    if (!cariResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `DIA API hatası: ${cariResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cariData = await cariResponse.json();
    
    console.log("DIA Cari Response:", JSON.stringify(cariData).substring(0, 500));
    
    // Check for DIA error - code !== "200" means error
    if (cariData.code && cariData.code !== "200") {
      const errorMsg = cariData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DIA v3 returns data in msg field or as array
    // Try multiple possible response structures
    let cariListe: any[] = [];
    if (Array.isArray(cariData.msg)) {
      cariListe = cariData.msg;
    } else if (Array.isArray(cariData.data)) {
      cariListe = cariData.data;
    } else if (cariData.scf_carikart_listele?.data) {
      cariListe = cariData.scf_carikart_listele.data;
    } else if (Array.isArray(cariData)) {
      cariListe = cariData;
    }
    
    console.log(`Found ${cariListe.length} cari records`);
    
    let toplamAlacak = 0;
    let toplamBorc = 0;
    let vadesiGecmis = 0;
    let vadesiBugun = 0;
    let vadesiYaklasan = 0;

    const cariler: CariHesap[] = cariListe.slice(0, 100).map((cari: any) => {
      const bakiye = parseFloat(cari.bakiye) || 0;
      const vadeBakiyesi = parseFloat(cari.vade_bakiyesi) || bakiye;
      
      if (bakiye > 0) toplamAlacak += bakiye;
      else toplamBorc += Math.abs(bakiye);

      // Vade analizi
      const vadeTarihi = cari.vade_tarihi ? new Date(cari.vade_tarihi) : null;
      if (vadeTarihi) {
        const simdi = new Date();
        const gunFarki = Math.floor((vadeTarihi.getTime() - simdi.getTime()) / (1000 * 60 * 60 * 24));
        
        if (gunFarki < 0 && bakiye > 0) vadesiGecmis += bakiye;
        else if (gunFarki === 0 && bakiye > 0) vadesiBugun += bakiye;
        else if (gunFarki > 0 && gunFarki <= 7 && bakiye > 0) vadesiYaklasan += bakiye;
      }

      const vadeDagilimi = hesaplaVadeDagilimi(cari.hareketler || []);
      const riskSkoru = hesaplaRiskSkoru(cari);

      return {
        cariKodu: cari.cari_kodu || cari.kod || "",
        cariAdi: cari.cari_adi || cari.adi || "",
        bakiye,
        vadeBakiyesi,
        sonIslemTarihi: cari.son_islem_tarihi || "",
        riskSkoru,
        vadeDagilimi,
      };
    });

    const rapor: GenelRapor = {
      toplamAlacak,
      toplamBorc,
      netBakiye: toplamAlacak - toplamBorc,
      vadesiGecmis,
      vadesiBugun,
      vadesiYaklasan,
      cariler,
      sonGuncelleme: new Date().toISOString(),
    };

    console.log(`Genel rapor generated for user ${user.id}: ${cariler.length} cari`);

    return new Response(
      JSON.stringify({ success: true, data: rapor }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`Genel rapor error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
