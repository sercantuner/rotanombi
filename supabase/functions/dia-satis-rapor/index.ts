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

    // Parse query parameters for date filtering
    const url = new URL(req.url);
    const baslangicTarihi = url.searchParams.get("baslangic") || getMonthStart();
    const bitisTarihi = url.searchParams.get("bitis") || getToday();

    const diaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/fat/json`;
    const firmaKodu = parseInt(profile.firma_kodu) || 1;
    const donemKodu = parseInt(profile.donem_kodu) || 0;

    // Fetch fatura listesi from DIA
    const faturaPayload = {
      fat_fatura_listele: {
        session_id: profile.dia_session_id,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
        filters: `tarih>='${baslangicTarihi}' AND tarih<='${bitisTarihi}' AND fatura_tipi=1`, // 1 = Satış faturası
        sorts: "tarih DESC",
        params: "",
        offset: 0,
      },
    };

    console.log(`Fetching satis raporu for user ${user.id}`);

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
    
    console.log("DIA Fatura Response:", JSON.stringify(faturaData).substring(0, 500));
    
    // Check for DIA error
    if (faturaData.code && faturaData.code !== "200") {
      const errorMsg = faturaData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DIA v3 returns data in msg field or as array
    let faturalar: any[] = [];
    if (Array.isArray(faturaData.msg)) {
      faturalar = faturaData.msg;
    } else if (Array.isArray(faturaData.data)) {
      faturalar = faturaData.data;
    } else if (faturaData.fat_fatura_listele?.data) {
      faturalar = faturaData.fat_fatura_listele.data;
    } else if (Array.isArray(faturaData)) {
      faturalar = faturaData;
    }
    
    console.log(`Found ${faturalar.length} fatura records`);

    // Process sales data
    let toplamSatis = 0;
    let gunlukSatis = 0;
    let aylikSatis = 0;
    const satirlar: SatisSatiri[] = [];
    const urunMap = new Map<string, { stokAdi: string; toplamMiktar: number; toplamTutar: number }>();
    const cariMap = new Map<string, { cariAdi: string; toplamTutar: number; faturaAdedi: number }>();

    const bugun = getToday();
    const ayBasi = getMonthStart();

    for (const fatura of faturalar) {
      const tutar = parseFloat(fatura.genel_toplam) || 0;
      const tarih = fatura.tarih || "";
      
      toplamSatis += tutar;
      if (tarih === bugun) gunlukSatis += tutar;
      if (tarih >= ayBasi) aylikSatis += tutar;

      // Cari bazlı toplama
      const cariKodu = fatura.cari_kodu || "";
      const cariAdi = fatura.cari_adi || "";
      if (cariKodu) {
        const mevcut = cariMap.get(cariKodu) || { cariAdi, toplamTutar: 0, faturaAdedi: 0 };
        mevcut.toplamTutar += tutar;
        mevcut.faturaAdedi += 1;
        cariMap.set(cariKodu, mevcut);
      }

      // Fatura kalemleri
      const kalemler = fatura.kalemler || [];
      for (const kalem of kalemler) {
        const stokKodu = kalem.stok_kodu || "";
        const stokAdi = kalem.stok_adi || "";
        const miktar = parseFloat(kalem.miktar) || 0;
        const birim = kalem.birim || "AD";
        const kalemTutar = parseFloat(kalem.tutar) || 0;

        satirlar.push({
          stokKodu,
          stokAdi,
          miktar,
          birim,
          tutar: kalemTutar,
          tarih,
          faturaNo: fatura.fatura_no || "",
          cariAdi,
        });

        // Ürün bazlı toplama
        if (stokKodu) {
          const mevcutUrun = urunMap.get(stokKodu) || { stokAdi, toplamMiktar: 0, toplamTutar: 0 };
          mevcutUrun.toplamMiktar += miktar;
          mevcutUrun.toplamTutar += kalemTutar;
          urunMap.set(stokKodu, mevcutUrun);
        }
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
      toplamFatura: faturalar.length,
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
