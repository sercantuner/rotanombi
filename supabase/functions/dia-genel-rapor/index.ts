import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VadeYaslandirma {
  // Vadesi geçmiş
  vade90Plus: number;
  vade90: number;
  vade60: number;
  vade30: number;
  // Güncel
  guncel: number;
  // Gelecek vadeler
  gelecek30: number;
  gelecek60: number;
  gelecek90: number;
  gelecek90Plus: number;
}

interface CariHesap {
  _key: string;
  cariKodu: string;
  cariAdi: string;
  bakiye: number;
  toplambakiye: number;
  vadesigecentutar: number;
  ozelkod1kod: string;
  ozelkod2kod: string;
  ozelkod3kod: string;
  satiselemani: string;
  sehir: string;
  telefon: string;
  eposta: string;
  riskSkoru: number;
  yaslandirma: VadeYaslandirma;
  // Yeni alanlar
  sektorler: string;
  kaynak: string;
  carikarttipi: string;
  potansiyel: boolean;
  potansiyeleklemetarihi: string | null;
  cariyedonusmetarihi: string | null;
  borctoplam: number;
  alacaktoplam: number;
}

interface OzelkodDagilimi {
  kod: string;
  toplam: number;
  adet: number;
}

interface SatisElemaniDagilimi {
  eleman: string;
  toplam: number;
  adet: number;
}

interface GenelRapor {
  toplamAlacak: number;
  toplamBorc: number;
  gecikimisAlacak: number;
  gecikimisBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
  yaslandirma: VadeYaslandirma;
  ozelkodDagilimi: OzelkodDagilimi[];
  satisElemaniDagilimi: SatisElemaniDagilimi[];
  cariler: CariHesap[];
  sonGuncelleme: string;
}

// Risk score calculation based on n8n workflow logic
function hesaplaRiskSkoru(bakiye: number, vadesiGecmis: number): number {
  let skor = 0;
  
  // Yüksek bakiye riski
  if (bakiye > 100000) skor += 30;
  else if (bakiye > 50000) skor += 20;
  else if (bakiye > 10000) skor += 10;
  
  // Vadesi geçmiş riski
  if (vadesiGecmis > 50000) skor += 40;
  else if (vadesiGecmis > 20000) skor += 25;
  else if (vadesiGecmis > 5000) skor += 15;
  else if (vadesiGecmis > 0) skor += 5;
  
  return Math.min(100, Math.round(skor));
}

// FIFO Vade Yaşlandırma Hesaplaması - Geçmiş ve Gelecek vadeler
function hesaplaYaslandirma(borcHareketler: any[]): VadeYaslandirma {
  const yaslandirma: VadeYaslandirma = {
    // Vadesi geçmiş
    vade90Plus: 0,
    vade90: 0,
    vade60: 0,
    vade30: 0,
    // Güncel
    guncel: 0,
    // Gelecek vadeler
    gelecek30: 0,
    gelecek60: 0,
    gelecek90: 0,
    gelecek90Plus: 0,
  };

  if (!Array.isArray(borcHareketler)) return yaslandirma;

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  for (const hareket of borcHareketler) {
    const vadetarihi = new Date(hareket.vadetarihi);
    vadetarihi.setHours(0, 0, 0, 0);
    
    // kalantutar: ödenmemiş kalan tutar (FIFO için kritik)
    const tutar = parseFloat(hareket.kalantutar) || 0;
    if (tutar <= 0) continue;

    // farkGun: pozitif = vadesi geçmiş, negatif = gelecek vade
    const farkGun = Math.floor((bugun.getTime() - vadetarihi.getTime()) / (1000 * 60 * 60 * 24));

    if (farkGun > 90) {
      yaslandirma.vade90Plus += tutar;
    } else if (farkGun > 60) {
      yaslandirma.vade90 += tutar;
    } else if (farkGun > 30) {
      yaslandirma.vade60 += tutar;
    } else if (farkGun > 0) {
      yaslandirma.vade30 += tutar;
    } else if (farkGun === 0) {
      yaslandirma.guncel += tutar;
    } else if (farkGun >= -30) {
      // 1-30 gün sonra
      yaslandirma.gelecek30 += tutar;
    } else if (farkGun >= -60) {
      // 31-60 gün sonra
      yaslandirma.gelecek60 += tutar;
    } else if (farkGun >= -90) {
      // 61-90 gün sonra
      yaslandirma.gelecek90 += tutar;
    } else {
      // 90+ gün sonra
      yaslandirma.gelecek90Plus += tutar;
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

    // 1. Fetch vade bakiye listesi with __borchareketler for FIFO aging
    const vadeBakiyePayload = {
      scf_carikart_vade_bakiye_listele: {
        session_id: sessionId,
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

    console.log(`Fetching genel rapor for user ${user.id}`);
    console.log("Vade bakiye payload:", JSON.stringify(vadeBakiyePayload));

    const vadeBakiyeResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vadeBakiyePayload),
    });

    if (!vadeBakiyeResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `DIA API hatası: ${vadeBakiyeResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vadeBakiyeData = await vadeBakiyeResponse.json();
    console.log("DIA Vade Bakiye Response:", JSON.stringify(vadeBakiyeData).substring(0, 2000));
    
    // Check for DIA error
    if (vadeBakiyeData.code && vadeBakiyeData.code !== "200") {
      const errorMsg = vadeBakiyeData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse vade bakiye response
    let vadeBakiyeList: any[] = [];
    if (Array.isArray(vadeBakiyeData.result)) {
      vadeBakiyeList = vadeBakiyeData.result;
    } else if (Array.isArray(vadeBakiyeData.msg)) {
      vadeBakiyeList = vadeBakiyeData.msg;
    } else if (Array.isArray(vadeBakiyeData.data)) {
      vadeBakiyeList = vadeBakiyeData.data;
    }
    
    console.log(`Found ${vadeBakiyeList.length} vade bakiye records`);

    // 2. Fetch cari kart listesi for additional info (ozelkod, satiselemani, etc.)
    const cariListePayload = {
      scf_carikart_listele: {
        session_id: sessionId,
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

    const cariResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cariListePayload),
    });

    let cariMap = new Map<string, any>();
    if (cariResponse.ok) {
      const cariData = await cariResponse.json();
      console.log("DIA Cari Response:", JSON.stringify(cariData).substring(0, 1000));
      
      let cariListe: any[] = [];
      if (Array.isArray(cariData.result)) {
        cariListe = cariData.result;
      } else if (Array.isArray(cariData.msg)) {
        cariListe = cariData.msg;
      } else if (Array.isArray(cariData.data)) {
        cariListe = cariData.data;
      }
      
      for (const cari of cariListe) {
        cariMap.set(cari._key, cari);
      }
      console.log(`Found ${cariListe.length} cari records for enrichment`);
    }

    // Process data
    let toplamAlacak = 0;
    let toplamBorc = 0;
    let gecikimisAlacak = 0;
    let gecikimisBorc = 0;
    let vadesiGecmis = 0;
    const genelYaslandirma: VadeYaslandirma = {
      vade90Plus: 0,
      vade90: 0,
      vade60: 0,
      vade30: 0,
      guncel: 0,
      gelecek30: 0,
      gelecek60: 0,
      gelecek90: 0,
      gelecek90Plus: 0,
    };

    // Özelkod ve satış elemanı dağılımları için
    const ozelkodMap = new Map<string, { toplam: number; adet: number }>();
    const satisElemaniMap = new Map<string, { toplam: number; adet: number }>();

    const cariler: CariHesap[] = vadeBakiyeList.map((vade: any) => {
      // Get additional cari info from cari liste
      const cariKey = vade._key_scf_carikart || vade._key;
      const cariInfo = cariMap.get(cariKey) || {};
      
      // Borç ve Alacak toplamları
      const borctoplam = parseFloat(cariInfo.borctoplam) || parseFloat(vade.borctoplam) || 0;
      const alacaktoplam = parseFloat(cariInfo.alacaktoplam) || parseFloat(vade.alacaktoplam) || 0;
      
      // bakiye = borç - alacak
      // bakiye > 0 → bizim alacağımız (müşteri bize borçlu)
      // bakiye < 0 → bizim borcumuz (biz müşteriye borçluyuz)
      const toplambakiye = parseFloat(vade.toplambakiye) || (borctoplam - alacaktoplam);
      const vadesigecentutar = parseFloat(vade.vadesigecentutar) || 0;
      
      // Alacak/Borç hesaplama: 
      // toplambakiye > 0 ise bizim alacağımız (borç bakiye)
      // toplambakiye < 0 ise bizim borcumuz (alacak bakiye - mutlak değer)
      if (toplambakiye > 0) {
        toplamAlacak += toplambakiye;
        // Vadesi geçmiş alacak
        if (vadesigecentutar > 0) {
          gecikimisAlacak += vadesigecentutar;
        }
      } else if (toplambakiye < 0) {
        toplamBorc += Math.abs(toplambakiye);
        // Vadesi geçmiş borç
        if (vadesigecentutar > 0) {
          gecikimisBorc += vadesigecentutar;
        }
      }
      
      vadesiGecmis += vadesigecentutar;
      
      // FIFO yaşlandırma hesapla
      const borcHareketler = Array.isArray(vade.__borchareketler) ? vade.__borchareketler : [];
      const yaslandirma = hesaplaYaslandirma(borcHareketler);
      
      // Genel yaşlandırmaya ekle
      genelYaslandirma.vade90Plus += yaslandirma.vade90Plus;
      genelYaslandirma.vade90 += yaslandirma.vade90;
      genelYaslandirma.vade60 += yaslandirma.vade60;
      genelYaslandirma.vade30 += yaslandirma.vade30;
      genelYaslandirma.guncel += yaslandirma.guncel;
      genelYaslandirma.gelecek30 += yaslandirma.gelecek30;
      genelYaslandirma.gelecek60 += yaslandirma.gelecek60;
      genelYaslandirma.gelecek90 += yaslandirma.gelecek90;
      genelYaslandirma.gelecek90Plus += yaslandirma.gelecek90Plus;

      const ozelkod1 = cariInfo.ozelkod1kod || vade.cariozelkodaciklama || "";
      const ozelkod2 = cariInfo.ozelkod2kod || vade.cariozelkod2aciklama || "";
      const ozelkod3 = cariInfo.ozelkod3kod || vade.cariozelkod3aciklama || "";
      const satiselemani = cariInfo.satiselemani || vade.carisatiselemaniaciklama || "";
      const sektorler = cariInfo.sektorler || "";
      const kaynak = cariInfo.kaynak || "";
      const carikarttipi = cariInfo.carikarttipi || "";
      const potansiyel = cariInfo.potansiyel === true || cariInfo.potansiyel === "True";
      const potansiyeleklemetarihi = cariInfo.potansiyeleklemetarihi || null;
      const cariyedonusmetarihi = cariInfo.cariyedonusmetarihi || null;
      
      // Özelkod dağılımı (ozelkod2 kullan - örn: "DİA")
      if (ozelkod2) {
        const mevcut = ozelkodMap.get(ozelkod2) || { toplam: 0, adet: 0 };
        mevcut.toplam += toplambakiye;
        mevcut.adet += 1;
        ozelkodMap.set(ozelkod2, mevcut);
      }

      // Satış elemanı dağılımı
      if (satiselemani) {
        const mevcut = satisElemaniMap.get(satiselemani) || { toplam: 0, adet: 0 };
        mevcut.toplam += toplambakiye;
        mevcut.adet += 1;
        satisElemaniMap.set(satiselemani, mevcut);
      }

      const riskSkoru = hesaplaRiskSkoru(toplambakiye, vadesigecentutar);

      return {
        _key: cariKey,
        cariKodu: vade.carikartkodu || cariInfo.carikartkodu || "",
        cariAdi: vade.cariunvan || cariInfo.unvan || "",
        bakiye: toplambakiye,
        toplambakiye,
        vadesigecentutar,
        ozelkod1kod: ozelkod1,
        ozelkod2kod: ozelkod2,
        ozelkod3kod: ozelkod3,
        satiselemani,
        sehir: cariInfo.sehir || "",
        telefon: cariInfo.telefon1 || cariInfo.ceptel || vade.caritelefon1 || vade.cariceptel || "",
        eposta: cariInfo.eposta || "",
        riskSkoru,
        yaslandirma,
        // Yeni alanlar
        sektorler,
        kaynak,
        carikarttipi,
        potansiyel,
        potansiyeleklemetarihi,
        cariyedonusmetarihi,
        borctoplam,
        alacaktoplam,
      };
    });

    // Sort cariler by toplambakiye descending
    cariler.sort((a, b) => b.toplambakiye - a.toplambakiye);

    // Convert maps to arrays
    const ozelkodDagilimi: OzelkodDagilimi[] = Array.from(ozelkodMap.entries())
      .map(([kod, data]) => ({ kod, toplam: data.toplam, adet: data.adet }))
      .sort((a, b) => b.toplam - a.toplam);

    const satisElemaniDagilimi: SatisElemaniDagilimi[] = Array.from(satisElemaniMap.entries())
      .map(([eleman, data]) => ({ eleman, toplam: data.toplam, adet: data.adet }))
      .sort((a, b) => b.toplam - a.toplam);

    const rapor: GenelRapor = {
      toplamAlacak,
      toplamBorc,
      gecikimisAlacak,
      gecikimisBorc,
      netBakiye: toplamAlacak - toplamBorc,
      vadesiGecmis,
      yaslandirma: genelYaslandirma,
      ozelkodDagilimi,
      satisElemaniDagilimi,
      cariler,
      sonGuncelleme: new Date().toISOString(),
    };

    console.log(`Genel rapor generated for user ${user.id}: ${cariler.length} cari, vadesi geçmiş: ${vadesiGecmis}`);
    console.log(`Yaşlandırma: güncel=${genelYaslandirma.guncel}, 30=${genelYaslandirma.vade30}, 60=${genelYaslandirma.vade60}, 90=${genelYaslandirma.vade90}, 90+=${genelYaslandirma.vade90Plus}`);

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
