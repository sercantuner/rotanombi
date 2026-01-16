import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VadeYaslandirma {
  guncel: number;
  vade30: number;
  vade60: number;
  vade90: number;
  vade90Plus: number;
}

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
  yaslandirma: VadeYaslandirma;
  bankaHesaplari: BankaHesabi[];
  kasaHesaplari: KasaHesabi[];
  dovizBazliOzet: { doviz: string; banka: number; kasa: number; toplam: number }[];
  sonGuncelleme: string;
}

// FIFO Vade Yaşlandırma Hesaplaması
function hesaplaYaslandirma(borcHareketler: any[]): VadeYaslandirma {
  const yaslandirma: VadeYaslandirma = {
    guncel: 0,
    vade30: 0,
    vade60: 0,
    vade90: 0,
    vade90Plus: 0,
  };

  if (!Array.isArray(borcHareketler)) return yaslandirma;

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  for (const hareket of borcHareketler) {
    const vadetarihi = new Date(hareket.vadetarihi);
    vadetarihi.setHours(0, 0, 0, 0);
    
    const tutar = parseFloat(hareket.kalantutar) || 0;
    if (tutar <= 0) continue;

    const farkGun = Math.floor((bugun.getTime() - vadetarihi.getTime()) / (1000 * 60 * 60 * 24));

    if (farkGun <= 0) {
      yaslandirma.guncel += tutar;
    } else if (farkGun <= 30) {
      yaslandirma.vade30 += tutar;
    } else if (farkGun <= 60) {
      yaslandirma.vade60 += tutar;
    } else if (farkGun <= 90) {
      yaslandirma.vade90 += tutar;
    } else {
      yaslandirma.vade90Plus += tutar;
    }
  }

  return yaslandirma;
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

    // Banka hesapları - bcs modülü
    const bankaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/bcs/json`;
    const bankaPayload = {
      bcs_bankahesabi_listele: {
        session_id: profile.dia_session_id,
        donem_kodu: 0,
        firma_kodu: firmaKodu,
        filters: "",
        sorts: "",
        params: "",
        offset: 0
      }
    };

    console.log(`Fetching finans raporu for user ${user.id}`);
    console.log("Banka payload:", JSON.stringify(bankaPayload));

    const bankaResponse = await fetch(bankaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bankaPayload),
    });

    let bankaHesaplari: BankaHesabi[] = [];
    let toplamBankaBakiyesi = 0;

    if (bankaResponse.ok) {
      const bankaData = await bankaResponse.json();
      console.log("DIA Banka Response:", JSON.stringify(bankaData).substring(0, 1000));
      
      let bankalar: any[] = [];
      if (Array.isArray(bankaData.result)) {
        bankalar = bankaData.result;
      } else if (Array.isArray(bankaData.msg)) {
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
          hesapKodu: banka.hesapkodu || banka.kod || banka._key || "",
          hesapAdi: banka.hesapadi || banka.adi || "",
          bankaAdi: banka.bankaadi || banka.banka || "",
          dovizCinsi: banka.dovizcinsi || banka.doviz || "TRY",
          bakiye,
          kullanilabilirBakiye: parseFloat(banka.kullanilabilir_bakiye) || bakiye,
        };
      });
    } else {
      console.log("Banka response not ok:", bankaResponse.status);
    }

    // Kasa hesapları
    let kasaHesaplari: KasaHesabi[] = [];
    let toplamKasaBakiyesi = 0;

    // Cari vade bakiye ile alacak/borç ve FIFO yaşlandırma
    const scfUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/scf/json`;
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

    let toplamAlacak = 0;
    let toplamBorc = 0;
    let vadesiGecmis = 0;
    let vadesiBuGun = 0;
    const genelYaslandirma: VadeYaslandirma = {
      guncel: 0,
      vade30: 0,
      vade60: 0,
      vade90: 0,
      vade90Plus: 0,
    };

    const vadeBakiyeResponse = await fetch(scfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vadeBakiyePayload),
    });

    if (vadeBakiyeResponse.ok) {
      const vadeBakiyeData = await vadeBakiyeResponse.json();
      console.log("DIA Vade Bakiye Response:", JSON.stringify(vadeBakiyeData).substring(0, 2000));
      
      let vadeBakiyeList: any[] = [];
      if (Array.isArray(vadeBakiyeData.result)) {
        vadeBakiyeList = vadeBakiyeData.result;
      } else if (Array.isArray(vadeBakiyeData.msg)) {
        vadeBakiyeList = vadeBakiyeData.msg;
      } else if (Array.isArray(vadeBakiyeData.data)) {
        vadeBakiyeList = vadeBakiyeData.data;
      }
      
      console.log(`Found ${vadeBakiyeList.length} vade bakiye records`);
      
      for (const vade of vadeBakiyeList) {
        // toplambakiye: net bakiye (pozitif = alacak, negatif = borç)
        const toplambakiye = parseFloat(vade.toplambakiye) || 0;
        const vadesigecentutar = parseFloat(vade.vadesigecentutar) || 0;
        
        if (toplambakiye > 0) {
          toplamAlacak += toplambakiye;
        } else {
          toplamBorc += Math.abs(toplambakiye);
        }
        
        vadesiGecmis += vadesigecentutar;

        // FIFO yaşlandırma hesapla
        const borcHareketler = Array.isArray(vade.__borchareketler) ? vade.__borchareketler : [];
        const yaslandirma = hesaplaYaslandirma(borcHareketler);
        
        genelYaslandirma.guncel += yaslandirma.guncel;
        genelYaslandirma.vade30 += yaslandirma.vade30;
        genelYaslandirma.vade60 += yaslandirma.vade60;
        genelYaslandirma.vade90 += yaslandirma.vade90;
        genelYaslandirma.vade90Plus += yaslandirma.vade90Plus;
      }
    }

    // Currency-based summary
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
      yaslandirma: genelYaslandirma,
      bankaHesaplari,
      kasaHesaplari,
      dovizBazliOzet,
      sonGuncelleme: new Date().toISOString(),
    };

    console.log(`Finans raporu generated for user ${user.id}`);
    console.log(`Yaşlandırma: güncel=${genelYaslandirma.guncel}, 30=${genelYaslandirma.vade30}, 60=${genelYaslandirma.vade60}, 90=${genelYaslandirma.vade90}, 90+=${genelYaslandirma.vade90Plus}`);

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
