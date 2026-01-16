import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SatisSatiri {
  stokKodu: string;
  stokAdi: string;
  miktar: number;
  birim: string;
  tutar: number;
  tarih: string;
  faturaNo: string;
  cariAdi: string;
}

interface SatisRaporu {
  toplamSatis: number;
  gunlukSatis: number;
  aylikSatis: number;
  toplamFatura: number;
  satirlar: SatisSatiri[];
  urunBazli: { stokKodu: string; stokAdi: string; toplamMiktar: number; toplamTutar: number }[];
  cariBazli: { cariKodu: string; cariAdi: string; toplamTutar: number; faturaAdedi: number }[];
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

    // Get user's DIA connection info
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

    const diaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/scf/json`;
    const firmaKodu = parseInt(profile.firma_kodu) || 1;

    // n8n workflow'a göre fatura listele - turu: 2,3,5,7,8,10 satış faturaları
    const faturaPayload = {
      scf_fatura_listele: {
        session_id: profile.dia_session_id,
        donem_kodu: 0,
        firma_kodu: firmaKodu,
        filters: [{ field: "turu", operator: "IN", value: "2,3,5,7,8,10" }],
        sorts: "",
        params: {
          selectedcolumns: [
            "_key", "turu", "__sourcesubeadi", "tarih", "toplam", 
            "toplamkdvdvz", "net", "dovizkuru", "toplamkdv", "iptal"
          ]
        },
        offset: 0
      }
    };

    console.log(`Fetching satis raporu for user ${user.id}`);
    console.log("Fatura payload:", JSON.stringify(faturaPayload));

    const faturaResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(faturaPayload),
    });

    if (!faturaResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `DIA API hatası: ${faturaResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const faturaData = await faturaResponse.json();
    console.log("DIA Fatura Response:", JSON.stringify(faturaData).substring(0, 1000));
    
    // Check for DIA error
    if (faturaData.code && faturaData.code !== "200") {
      const errorMsg = faturaData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DIA v3 returns data in msg field
    let faturalar: any[] = [];
    if (Array.isArray(faturaData.msg)) {
      faturalar = faturaData.msg;
    } else if (Array.isArray(faturaData.data)) {
      faturalar = faturaData.data;
    } else if (Array.isArray(faturaData)) {
      faturalar = faturaData;
    }
    
    console.log(`Found ${faturalar.length} fatura records`);

    // Ayrıntılı fatura kalemi listele
    const faturaAyrintiliPayload = {
      scf_fatura_listele_ayrintili: {
        session_id: profile.dia_session_id,
        donem_kodu: 0,
        firma_kodu: firmaKodu,
        filters: [{ field: "turu", operator: "IN", value: "2,3,5,7,8,10" }],
        sorts: "",
        params: {
          selectedcolumns: [
            "turu", "kdvharictutar", "kdvtutari", "_key_scf_fatura", "miktar",
            "satiselemani", "stokkartmarka", "kartozelkodu1", "kartozelkodu2",
            "kartozelkodu3", "tarih", "kartaciklama", "unvan", "kalemdovizi",
            "masrafmerkeziaciklama_kalem", "sonbirimfiyatifisdovizi", "fatbirimi",
            "fatanabirimi", "faturaikincibirimmiktar", "faturaikincibirimi",
            "toplambrutagirlik", "toplambruthacim", "toplamnetagirlik",
            "toplamnethacim", "sontutaryerel", "kalemturu", "dovizkuru",
            "kdvdurumu", "indirim1", "indirim2", "indirim3", "indirim4",
            "indirim5", "indirimtoplam", "indirimtutari", "kdv", "sonbirimfiyati",
            "yerelbirimfiyati", "birimfiyati"
          ]
        },
        offset: 0
      }
    };

    const faturaAyrintiliResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(faturaAyrintiliPayload),
    });

    let faturaKalemleri: any[] = [];
    if (faturaAyrintiliResponse.ok) {
      const faturaAyrintiliData = await faturaAyrintiliResponse.json();
      console.log("DIA Fatura Ayrintili Response:", JSON.stringify(faturaAyrintiliData).substring(0, 1000));
      
      if (Array.isArray(faturaAyrintiliData.msg)) {
        faturaKalemleri = faturaAyrintiliData.msg;
      } else if (Array.isArray(faturaAyrintiliData.data)) {
        faturaKalemleri = faturaAyrintiliData.data;
      }
      console.log(`Found ${faturaKalemleri.length} fatura kalemi records`);
    }

    // Process sales data
    let toplamSatis = 0;
    let gunlukSatis = 0;
    let aylikSatis = 0;
    const satirlar: SatisSatiri[] = [];
    const urunMap = new Map<string, { stokAdi: string; toplamMiktar: number; toplamTutar: number }>();
    const cariMap = new Map<string, { cariAdi: string; toplamTutar: number; faturaAdedi: number }>();

    const bugun = getToday();
    const ayBasi = getMonthStart();

    // Fatura bazlı toplama
    for (const fatura of faturalar) {
      if (fatura.iptal === "True" || fatura.iptal === true) continue;
      
      const tutar = parseFloat(fatura.net) || parseFloat(fatura.toplam) || 0;
      const tarih = fatura.tarih || "";
      
      toplamSatis += tutar;
      if (tarih === bugun) gunlukSatis += tutar;
      if (tarih >= ayBasi) aylikSatis += tutar;
    }

    // Kalem bazlı işleme
    for (const kalem of faturaKalemleri) {
      const stokKodu = kalem.kartozelkodu1 || "";
      const stokAdi = kalem.kartaciklama || "";
      const miktar = parseFloat(kalem.miktar) || 0;
      const birim = kalem.fatbirimi || "AD";
      const tutar = parseFloat(kalem.sontutaryerel) || parseFloat(kalem.kdvharictutar) || 0;
      const tarih = kalem.tarih || "";
      const cariAdi = kalem.unvan || "";

      satirlar.push({
        stokKodu,
        stokAdi,
        miktar,
        birim,
        tutar,
        tarih,
        faturaNo: kalem._key_scf_fatura || "",
        cariAdi,
      });

      // Ürün bazlı toplama
      if (stokKodu) {
        const mevcutUrun = urunMap.get(stokKodu) || { stokAdi, toplamMiktar: 0, toplamTutar: 0 };
        mevcutUrun.toplamMiktar += miktar;
        mevcutUrun.toplamTutar += tutar;
        urunMap.set(stokKodu, mevcutUrun);
      }

      // Cari bazlı toplama
      if (cariAdi) {
        const mevcutCari = cariMap.get(cariAdi) || { cariAdi, toplamTutar: 0, faturaAdedi: 0 };
        mevcutCari.toplamTutar += tutar;
        mevcutCari.faturaAdedi += 1;
        cariMap.set(cariAdi, mevcutCari);
      }
    }

    // Convert maps to arrays and sort
    const urunBazli = Array.from(urunMap.entries())
      .map(([stokKodu, data]) => ({ stokKodu, ...data }))
      .sort((a, b) => b.toplamTutar - a.toplamTutar)
      .slice(0, 20);

    const cariBazli = Array.from(cariMap.entries())
      .map(([cariKodu, data]) => ({ cariKodu, ...data }))
      .sort((a, b) => b.toplamTutar - a.toplamTutar)
      .slice(0, 20);

    const rapor: SatisRaporu = {
      toplamSatis,
      gunlukSatis,
      aylikSatis,
      toplamFatura: faturalar.filter(f => f.iptal !== "True" && f.iptal !== true).length,
      satirlar: satirlar.slice(0, 100),
      urunBazli,
      cariBazli,
      sonGuncelleme: new Date().toISOString(),
    };

    console.log(`Satis raporu generated for user ${user.id}: ${faturalar.length} fatura`);

    return new Response(
      JSON.stringify({ success: true, data: rapor }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`Satis rapor error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}
