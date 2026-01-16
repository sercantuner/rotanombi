import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BankaHesabi {
  hesapKodu: string;
  hesapAdi: string;
  bankaAdi: string;
  dovizCinsi: string;
  bakiye: number;
  kullanilabilirBakiye: number;
}

interface KasaHesabi {
  kasaKodu: string;
  kasaAdi: string;
  dovizCinsi: string;
  bakiye: number;
}

interface FinansRaporu {
  toplamBankaBakiyesi: number;
  toplamKasaBakiyesi: number;
  toplamNakitPozisyon: number;
  toplamAlacak: number;
  toplamBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
  vadesiBuGun: number;
  bankaHesaplari: BankaHesabi[];
  kasaHesaplari: KasaHesabi[];
  dovizBazliOzet: { doviz: string; banka: number; kasa: number; toplam: number }[];
  sonGuncelleme: string;
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.dia_session_id) {
      return new Response(
        JSON.stringify({ success: false, error: "DIA bağlantısı bulunamadı" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(profile.dia_session_expires) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "DIA oturumu sona ermiş" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firmaKodu = parseInt(profile.firma_kodu) || 1;
    const donemKodu = parseInt(profile.donem_kodu) || 0;

    // Fetch banka hesapları
    const bankaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/bcs/json`;
    const bankaPayload = {
      bcs_bankahesabi_listele: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
        filters: "",
        sorts: "",
        params: "",
        offset: 0,
      },
    };

    console.log(`Fetching finans raporu for user ${user.id}`);

    const bankaResponse = await fetch(bankaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bankaPayload),
    });

    let bankaHesaplari: BankaHesabi[] = [];
    let toplamBankaBakiyesi = 0;

    if (bankaResponse.ok) {
      const bankaData = await bankaResponse.json();
      console.log("DIA Banka Response:", JSON.stringify(bankaData).substring(0, 500));
      
      // DIA v3 returns data in msg field
      let bankalar: any[] = [];
      if (Array.isArray(bankaData.msg)) {
        bankalar = bankaData.msg;
      } else if (Array.isArray(bankaData.data)) {
        bankalar = bankaData.data;
      } else if (bankaData.bcs_bankahesabi_listele?.data) {
        bankalar = bankaData.bcs_bankahesabi_listele.data;
      }
      
      console.log(`Found ${bankalar.length} banka records`);
      
      bankaHesaplari = bankalar.map((banka: any) => {
        const bakiye = parseFloat(banka.bakiye) || 0;
        toplamBankaBakiyesi += bakiye;
        
        return {
          hesapKodu: banka.hesap_kodu || banka.kod || "",
          hesapAdi: banka.hesap_adi || banka.adi || "",
          bankaAdi: banka.banka_adi || "",
          dovizCinsi: banka.doviz_cinsi || "TRY",
          bakiye,
          kullanilabilirBakiye: parseFloat(banka.kullanilabilir_bakiye) || bakiye,
        };
      });
    }

    // Fetch kasa hesapları
    const kasaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/kcs/json`;
    const kasaPayload = {
      kcs_kasa_listele: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
        filters: "",
        sorts: "",
        params: "",
        offset: 0,
      },
    };

    const kasaResponse = await fetch(kasaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kasaPayload),
    });

    let kasaHesaplari: KasaHesabi[] = [];
    let toplamKasaBakiyesi = 0;

    if (kasaResponse.ok) {
      const kasaData = await kasaResponse.json();
      const kasalar = kasaData.kcs_kasa_listele?.data || kasaData.data || [];
      
      kasaHesaplari = kasalar.map((kasa: any) => {
        const bakiye = parseFloat(kasa.bakiye) || 0;
        toplamKasaBakiyesi += bakiye;
        
        return {
          kasaKodu: kasa.kasa_kodu || kasa.kod || "",
          kasaAdi: kasa.kasa_adi || kasa.adi || "",
          dovizCinsi: kasa.doviz_cinsi || "TRY",
          bakiye,
        };
      });
    }

    // Fetch cari bakiye özeti for alacak/borç
    const scfUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/scf/json`;
    const cariOzetPayload = {
      scf_carikart_bakiye_ozet: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
      },
    };

    let toplamAlacak = 0;
    let toplamBorc = 0;
    let vadesiGecmis = 0;
    let vadesiBuGun = 0;

    const cariOzetResponse = await fetch(scfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cariOzetPayload),
    });

    if (cariOzetResponse.ok) {
      const cariOzetData = await cariOzetResponse.json();
      const ozet = cariOzetData.scf_carikart_bakiye_ozet?.data || cariOzetData.data || {};
      
      toplamAlacak = parseFloat(ozet.toplam_alacak) || 0;
      toplamBorc = parseFloat(ozet.toplam_borc) || 0;
      vadesiGecmis = parseFloat(ozet.vadesi_gecmis) || 0;
      vadesiBuGun = parseFloat(ozet.vadesi_bugun) || 0;
    }

    // Calculate currency-based summary
    const dovizMap = new Map<string, { banka: number; kasa: number }>();
    
    for (const banka of bankaHesaplari) {
      const mevcut = dovizMap.get(banka.dovizCinsi) || { banka: 0, kasa: 0 };
      mevcut.banka += banka.bakiye;
      dovizMap.set(banka.dovizCinsi, mevcut);
    }
    
    for (const kasa of kasaHesaplari) {
      const mevcut = dovizMap.get(kasa.dovizCinsi) || { banka: 0, kasa: 0 };
      mevcut.kasa += kasa.bakiye;
      dovizMap.set(kasa.dovizCinsi, mevcut);
    }

    const dovizBazliOzet = Array.from(dovizMap.entries()).map(([doviz, data]) => ({
      doviz,
      banka: data.banka,
      kasa: data.kasa,
      toplam: data.banka + data.kasa,
    }));

    const rapor: FinansRaporu = {
      toplamBankaBakiyesi,
      toplamKasaBakiyesi,
      toplamNakitPozisyon: toplamBankaBakiyesi + toplamKasaBakiyesi,
      toplamAlacak,
      toplamBorc,
      netBakiye: toplamAlacak - toplamBorc,
      vadesiGecmis,
      vadesiBuGun,
      bankaHesaplari,
      kasaHesaplari,
      dovizBazliOzet,
      sonGuncelleme: new Date().toISOString(),
    };

    console.log(`Finans raporu generated for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, data: rapor }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`Finans rapor error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
