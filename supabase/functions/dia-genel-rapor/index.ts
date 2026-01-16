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
  
  const borcToplam = parseFloat(cari.borctoplam) || 0;
  const alacakToplam = parseFloat(cari.alacaktoplam) || 0;
  const bakiye = borcToplam - alacakToplam;
  
  // Yüksek bakiye riski
  if (bakiye > 100000) skor += 30;
  else if (bakiye > 50000) skor += 20;
  else if (bakiye > 10000) skor += 10;
  
  // Potansiyel durumu
  if (cari.potansiyel === "True" || cari.potansiyel === true) skor += 10;
  
  return Math.min(100, Math.round(skor));
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
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

    // 1. Fetch cari kart listesi - n8n formatına göre
    const cariListePayload = {
      scf_carikart_listele: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        filters: "",
        sorts: [{ field: "carikartkodu", sorttype: "DESC" }],
        params: {
          irsaliyeleriDahilEt: "False",
          selectedcolumns: [
            "_key", "potansiyeleklemetarihi", "durum", "unvan", "carikartkodu",
            "carikarttipi", "potansiyel", "yurtdisi", "subeadi", "ozelkod1kod",
            "ozelkod2kod", "ozelkod3kod", "sehir", "bolge", "ulke", "ilce",
            "borctoplam", "alacaktoplam", "eposta", "kaynak", "telefon1",
            "ceptel", "telefon2", "sektorler", "satiselemani", "cariyedonusmetarihi"
          ]
        }
      }
    };

    console.log(`Fetching cari list for user ${user.id}`);
    console.log("Cari payload:", JSON.stringify(cariListePayload));

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
    console.log("DIA Cari Response:", JSON.stringify(cariData).substring(0, 1000));
    
    // Check for DIA error
    if (cariData.code && cariData.code !== "200") {
      const errorMsg = cariData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DIA v3 returns data in msg field
    let cariListe: any[] = [];
    if (Array.isArray(cariData.msg)) {
      cariListe = cariData.msg;
    } else if (Array.isArray(cariData.data)) {
      cariListe = cariData.data;
    } else if (Array.isArray(cariData)) {
      cariListe = cariData;
    }
    
    console.log(`Found ${cariListe.length} cari records`);

    // 2. Fetch vade bakiye listesi - n8n formatına göre
    const vadeBakiyePayload = {
      scf_carikart_vade_bakiye_listele: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        filters: [{ field: "durum", operator: "=", value: "A" }],
        sorts: "",
        params: {
          irsaliyeleriDahilEt: "True",
          tarihreferans: getToday(),
          detaygoster: "True"
        }
      }
    };

    console.log("Vade bakiye payload:", JSON.stringify(vadeBakiyePayload));

    const vadeBakiyeResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vadeBakiyePayload),
    });

    let vadeBakiyeMap = new Map<string, any>();
    
    if (vadeBakiyeResponse.ok) {
      const vadeBakiyeData = await vadeBakiyeResponse.json();
      console.log("DIA Vade Bakiye Response:", JSON.stringify(vadeBakiyeData).substring(0, 1000));
      
      let vadeBakiyeList: any[] = [];
      if (Array.isArray(vadeBakiyeData.msg)) {
        vadeBakiyeList = vadeBakiyeData.msg;
      } else if (Array.isArray(vadeBakiyeData.data)) {
        vadeBakiyeList = vadeBakiyeData.data;
      }
      
      console.log(`Found ${vadeBakiyeList.length} vade bakiye records`);
      
      // Map by _key_scf_carikart for easy lookup
      for (const vade of vadeBakiyeList) {
        const key = vade._key_scf_carikart || vade._key;
        if (key) {
          vadeBakiyeMap.set(key, vade);
        }
      }
    }

    let toplamAlacak = 0;
    let toplamBorc = 0;
    let vadesiGecmis = 0;
    let vadesiBugun = 0;
    let vadesiYaklasan = 0;

    const cariler: CariHesap[] = cariListe.slice(0, 100).map((cari: any) => {
      const borcToplam = parseFloat(cari.borctoplam) || 0;
      const alacakToplam = parseFloat(cari.alacaktoplam) || 0;
      const bakiye = borcToplam - alacakToplam;
      
      toplamAlacak += alacakToplam;
      toplamBorc += borcToplam;

      // Vade bilgisi varsa al
      const vadeInfo = vadeBakiyeMap.get(cari._key);
      let vadeBakiyesi = bakiye;
      let vadeDagilimi = {
        guncel: 0,
        vade30: 0,
        vade60: 0,
        vade90: 0,
        vade90Plus: 0,
      };

      if (vadeInfo) {
        vadeBakiyesi = parseFloat(vadeInfo.bakiye) || bakiye;
        // Vade yaşlandırma hesapla
        const vadesiGecmisBakiye = parseFloat(vadeInfo.vadesi_gecmis) || 0;
        if (vadesiGecmisBakiye > 0) {
          vadesiGecmis += vadesiGecmisBakiye;
        }
      }

      const riskSkoru = hesaplaRiskSkoru(cari);

      return {
        cariKodu: cari.carikartkodu || cari.kod || "",
        cariAdi: cari.unvan || cari.adi || "",
        bakiye,
        vadeBakiyesi,
        sonIslemTarihi: cari.cariyedonusmetarihi || "",
        riskSkoru,
        vadeDagilimi,
      };
    });

    const rapor: GenelRapor = {
      toplamAlacak,
      toplamBorc,
      netBakiye: toplamBorc - toplamAlacak,
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
