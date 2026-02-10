import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";
import { getTurkeyToday, getTurkeyMonthStart } from "../_shared/turkeyTime.ts";

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
  faturaTuru: number;
  satiselemani: string;
  marka: string;
}

interface SatisElemaniPerformans {
  eleman: string;
  brutSatis: number;
  iadeToplamı: number;
  netSatis: number;
  iadeOrani: number;
  faturaSayisi: number;
  ortSepet: number;
}

interface MarkaDagilimi {
  marka: string;
  toplamMiktar: number;
  satisTutar: number;
  iadeTutar: number;
  netTutar: number;
  iadeOrani: number;
}

interface SatisRaporu {
  // Mevcut alanlar
  toplamSatis: number;
  gunlukSatis: number;
  aylikSatis: number;
  toplamFatura: number;
  satirlar: SatisSatiri[];
  urunBazli: { stokKodu: string; stokAdi: string; toplamMiktar: number; toplamTutar: number }[];
  cariBazli: { cariKodu: string; cariAdi: string; toplamTutar: number; faturaAdedi: number }[];
  sonGuncelleme: string;
  // Yeni alanlar
  brutSatis: number;
  iadeToplamı: number;
  netSatis: number;
  iadeOrani: number;
  ortSepet: number;
  markaBazli: MarkaDagilimi[];
  satisElemaniPerformans: SatisElemaniPerformans[];
}

// Fatura türleri:
// Satış: 2 (Satış Faturası), 3 (Perakende), 10 (Proforma)
// İade:  7 (Satış İade), 8 (Perakende İade)
// Diğer: 5 (İrsaliye)
const SATIS_TURLERI = [2, 3, 10];
const IADE_TURLERI = [7, 8];

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

    // Get valid DIA session (auto-renews if expired)
    const diaResult = await getDiaSession(supabase, user.id);
    
    if (!diaResult.success || !diaResult.session) {
      return new Response(
        JSON.stringify({ success: false, error: diaResult.error || "DIA bağlantısı kurulamadı" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId, sunucuAdi, firmaKodu } = diaResult.session;
    const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/scf/json`;

    // Fatura listele - turu: 2,3,5,7,8,10 satış faturaları
    const faturaPayload = {
      scf_fatura_listele: {
        session_id: sessionId,
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
    
    if (faturaData.code && faturaData.code !== "200") {
      const errorMsg = faturaData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let faturalar: any[] = [];
    if (Array.isArray(faturaData.result)) {
      faturalar = faturaData.result;
    } else if (Array.isArray(faturaData.msg)) {
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
        session_id: sessionId,
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
      
      if (Array.isArray(faturaAyrintiliData.result)) {
        faturaKalemleri = faturaAyrintiliData.result;
      } else if (Array.isArray(faturaAyrintiliData.msg)) {
        faturaKalemleri = faturaAyrintiliData.msg;
      } else if (Array.isArray(faturaAyrintiliData.data)) {
        faturaKalemleri = faturaAyrintiliData.data;
      }
      console.log(`Found ${faturaKalemleri.length} fatura kalemi records`);
    }

    // Net Satış Hesaplama
    let brutSatis = 0;
    let iadeToplamı = 0;
    let gunlukSatis = 0;
    let aylikSatis = 0;
    const satirlar: SatisSatiri[] = [];
    const urunMap = new Map<string, { stokAdi: string; toplamMiktar: number; toplamTutar: number }>();
    const cariMap = new Map<string, { cariAdi: string; toplamTutar: number; faturaAdedi: number }>();
    const faturaSayisiSet = new Set<string>();

    // Marka bazlı hesaplama
    const markaMap = new Map<string, { toplamMiktar: number; satisTutar: number; iadeTutar: number }>();
    
    // Satış elemanı performansı
    const satisElemaniMap = new Map<string, { 
      brutSatis: number; 
      iadeToplamı: number; 
      faturaSayisi: Set<string>;
    }>();

    const bugun = getToday();
    const ayBasi = getMonthStart();

    // Kalem bazlı işleme
    for (const kalem of faturaKalemleri) {
      const turu = parseInt(kalem.turu) || 0;
      const tutar = Math.abs(parseFloat(kalem.sontutaryerel) || parseFloat(kalem.kdvharictutar) || 0);
      const miktar = Math.abs(parseFloat(kalem.miktar) || 0);
      const tarih = kalem.tarih || "";
      const faturaKey = kalem._key_scf_fatura || "";
      const satiselemani = kalem.satiselemani || "";
      const marka = kalem.stokkartmarka || "Diğer";
      const stokKodu = kalem.kartozelkodu1 || "";
      const stokAdi = kalem.kartaciklama || "";
      const birim = kalem.fatbirimi || "AD";
      const cariAdi = kalem.unvan || "";

      // Satış mı, iade mi?
      const isSatis = SATIS_TURLERI.includes(turu);
      const isIade = IADE_TURLERI.includes(turu);

      if (isSatis) {
        brutSatis += tutar;
        faturaSayisiSet.add(faturaKey);
        
        if (tarih === bugun) gunlukSatis += tutar;
        if (tarih >= ayBasi) aylikSatis += tutar;
      } else if (isIade) {
        iadeToplamı += tutar;
      }

      // Satır kaydet
      satirlar.push({
        stokKodu,
        stokAdi,
        miktar,
        birim,
        tutar: isSatis ? tutar : -tutar,
        tarih,
        faturaNo: faturaKey,
        cariAdi,
        faturaTuru: turu,
        satiselemani,
        marka,
      });

      // Ürün bazlı toplama (sadece satışlar)
      if (isSatis && stokKodu) {
        const mevcutUrun = urunMap.get(stokKodu) || { stokAdi, toplamMiktar: 0, toplamTutar: 0 };
        mevcutUrun.toplamMiktar += miktar;
        mevcutUrun.toplamTutar += tutar;
        urunMap.set(stokKodu, mevcutUrun);
      }

      // Cari bazlı toplama
      if (cariAdi) {
        const mevcutCari = cariMap.get(cariAdi) || { cariAdi, toplamTutar: 0, faturaAdedi: 0 };
        mevcutCari.toplamTutar += isSatis ? tutar : -tutar;
        if (isSatis) mevcutCari.faturaAdedi += 1;
        cariMap.set(cariAdi, mevcutCari);
      }

      // Marka bazlı toplama
      const mevcutMarka = markaMap.get(marka) || { toplamMiktar: 0, satisTutar: 0, iadeTutar: 0 };
      mevcutMarka.toplamMiktar += miktar;
      if (isSatis) {
        mevcutMarka.satisTutar += tutar;
      } else if (isIade) {
        mevcutMarka.iadeTutar += tutar;
      }
      markaMap.set(marka, mevcutMarka);

      // Satış elemanı performansı
      if (satiselemani) {
        const mevcutEleman = satisElemaniMap.get(satiselemani) || { 
          brutSatis: 0, 
          iadeToplamı: 0, 
          faturaSayisi: new Set<string>() 
        };
        if (isSatis) {
          mevcutEleman.brutSatis += tutar;
          mevcutEleman.faturaSayisi.add(faturaKey);
        } else if (isIade) {
          mevcutEleman.iadeToplamı += tutar;
        }
        satisElemaniMap.set(satiselemani, mevcutEleman);
      }
    }

    // Net satış ve oranlar
    const netSatis = brutSatis - iadeToplamı;
    const iadeOrani = brutSatis > 0 ? (iadeToplamı / (brutSatis + iadeToplamı)) * 100 : 0;
    const faturaSayisi = faturaSayisiSet.size;
    const ortSepet = faturaSayisi > 0 ? netSatis / faturaSayisi : 0;

    // Convert maps to arrays and sort
    const urunBazli = Array.from(urunMap.entries())
      .map(([stokKodu, data]) => ({ stokKodu, ...data }))
      .sort((a, b) => b.toplamTutar - a.toplamTutar)
      .slice(0, 20);

    const cariBazli = Array.from(cariMap.entries())
      .map(([cariKodu, data]) => ({ cariKodu, ...data }))
      .sort((a, b) => b.toplamTutar - a.toplamTutar)
      .slice(0, 20);

    const markaBazli: MarkaDagilimi[] = Array.from(markaMap.entries())
      .map(([marka, data]) => ({
        marka,
        toplamMiktar: data.toplamMiktar,
        satisTutar: data.satisTutar,
        iadeTutar: data.iadeTutar,
        netTutar: data.satisTutar - data.iadeTutar,
        iadeOrani: data.satisTutar > 0 ? (data.iadeTutar / (data.satisTutar + data.iadeTutar)) * 100 : 0,
      }))
      .sort((a, b) => b.netTutar - a.netTutar)
      .slice(0, 15);

    const satisElemaniPerformans: SatisElemaniPerformans[] = Array.from(satisElemaniMap.entries())
      .map(([eleman, data]) => {
        const netSatisEleman = data.brutSatis - data.iadeToplamı;
        const faturaSayisiEleman = data.faturaSayisi.size;
        return {
          eleman,
          brutSatis: data.brutSatis,
          iadeToplamı: data.iadeToplamı,
          netSatis: netSatisEleman,
          iadeOrani: data.brutSatis > 0 ? (data.iadeToplamı / (data.brutSatis + data.iadeToplamı)) * 100 : 0,
          faturaSayisi: faturaSayisiEleman,
          ortSepet: faturaSayisiEleman > 0 ? netSatisEleman / faturaSayisiEleman : 0,
        };
      })
      .sort((a, b) => b.netSatis - a.netSatis);

    const rapor: SatisRaporu = {
      toplamSatis: netSatis,
      gunlukSatis,
      aylikSatis,
      toplamFatura: faturaSayisi,
      satirlar: satirlar.slice(0, 100),
      urunBazli,
      cariBazli,
      sonGuncelleme: new Date().toISOString(),
      // Yeni alanlar
      brutSatis,
      iadeToplamı,
      netSatis,
      iadeOrani,
      ortSepet,
      markaBazli,
      satisElemaniPerformans,
    };

    console.log(`Satis raporu generated for user ${user.id}`);
    console.log(`Net Satış: brutSatis=${brutSatis.toFixed(2)}, iadeToplamı=${iadeToplamı.toFixed(2)}, netSatis=${netSatis.toFixed(2)}, iadeOrani=${iadeOrani.toFixed(2)}%`);
    console.log(`Markalar: ${markaBazli.length}, Satış Elemanları: ${satisElemaniPerformans.length}`);

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
  return getTurkeyToday();
}

function getMonthStart(): string {
  return getTurkeyMonthStart();
}
