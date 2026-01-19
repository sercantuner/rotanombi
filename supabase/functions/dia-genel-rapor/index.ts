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

// FIFO Açık Fatura
interface AcikFatura {
  belgeno: string;
  tarih: string;
  vadetarihi: string;
  tutar: number;
  kalan: number;
  gecikmeGunu: number;
  durum: 'acik' | 'kismi' | 'kapali';
}

// FIFO Hesaplama Sonucu
interface FifoSonuc {
  acikFaturalar: AcikFatura[];
  gercekGecikmisBakiye: number;
  odemeHavuzu: number;
  toplamAcikBakiye: number;
}

// Hibrit Risk Analizi
interface RiskAnalizi {
  guvenSkoru: number;       // 100'den başla, ceza kes (yüksek = iyi)
  riskSkoru: number;        // 0'dan başla, risk ekle (düşük = iyi)
  odemeAliskanligi: number; // +15 ile -15 arası
  sonOdemeTarihi: string | null;
  siparisSkikligi: number;  // Ortalama gün
  maxGecikmeGunu: number;
  acikFaturaSayisi: number;
  kapaliOranı: number;      // Kapanan faturaların oranı
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
  // Mevcut alanlar
  sektorler: string;
  kaynak: string;
  carikarttipi: string;
  potansiyel: boolean;
  potansiyeleklemetarihi: string | null;
  cariyedonusmetarihi: string | null;
  borctoplam: number;
  alacaktoplam: number;
  durum: string; // 'A' (Aktif), 'P' (Pasif)
  // FIFO ve Risk alanları (yeni)
  fifo: FifoSonuc;
  riskAnalizi: RiskAnalizi;
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
  // Cari sayıları (cariListe'den)
  toplamCariSayisi: number;
  musteriSayisi: number; // potansiyel = false olanlar
  // FIFO özet (yeni)
  fifoOzet: {
    toplamAcikFatura: number;
    toplamAcikBakiye: number;
    gercekGecikmisBakiye: number;
  };
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function hesaplaGunFarki(tarihStr: string): number {
  if (!tarihStr) return 0;
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const tarih = new Date(tarihStr);
  tarih.setHours(0, 0, 0, 0);
  return Math.floor((bugun.getTime() - tarih.getTime()) / (1000 * 60 * 60 * 24));
}

function hesaplaGecikme(vadetarihiStr: string): number {
  if (!vadetarihiStr) return 0;
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const vadetarihi = new Date(vadetarihiStr);
  vadetarihi.setHours(0, 0, 0, 0);
  const fark = Math.floor((bugun.getTime() - vadetarihi.getTime()) / (1000 * 60 * 60 * 24));
  return fark > 0 ? fark : 0; // Sadece gecikmiş günleri döndür
}

// FIFO Açık Hesap Kapatma Algoritması
function hesaplaFIFO(hareketler: any[]): FifoSonuc {
  const sonuc: FifoSonuc = {
    acikFaturalar: [],
    gercekGecikmisBakiye: 0,
    odemeHavuzu: 0,
    toplamAcikBakiye: 0,
  };

  if (!Array.isArray(hareketler) || hareketler.length === 0) {
    return sonuc;
  }

  // 1. Hareketleri tarih sırasına göre sırala
  const sirali = [...hareketler].sort((a, b) => {
    const tarihA = new Date(a.tarih || a.islemtarihi || "1900-01-01").getTime();
    const tarihB = new Date(b.tarih || b.islemtarihi || "1900-01-01").getTime();
    return tarihA - tarihB;
  });

  // 2. Ödeme havuzunu oluştur (alacak hareketleri toplamı = müşteriden gelen ödemeler)
  let odemeHavuzu = 0;
  for (const h of sirali) {
    const alacak = parseFloat(h.alacak) || 0;
    if (alacak > 0) {
      odemeHavuzu += alacak;
    }
  }
  sonuc.odemeHavuzu = odemeHavuzu;

  // 3. Faturaları (borç) FIFO ile eşleştir
  let kalanOdeme = odemeHavuzu;
  const borcHareketleri = sirali.filter(h => (parseFloat(h.borc) || 0) > 0);

  for (const hareket of borcHareketleri) {
    const borcTutar = parseFloat(hareket.borc) || 0;
    const vadetarihi = hareket.vadetarihi || hareket.tarih;
    const belgeno = hareket.belgeno2 || hareket.fisno || hareket.belgeno || "";
    const tarih = hareket.tarih || hareket.islemtarihi || "";
    const gecikmeGunu = hesaplaGecikme(vadetarihi);

    let kalan = 0;
    let durum: 'acik' | 'kismi' | 'kapali' = 'kapali';

    if (kalanOdeme >= borcTutar) {
      // Tam ödendi
      kalanOdeme -= borcTutar;
      durum = 'kapali';
      kalan = 0;
    } else if (kalanOdeme > 0) {
      // Kısmi ödendi
      kalan = borcTutar - kalanOdeme;
      kalanOdeme = 0;
      durum = 'kismi';
    } else {
      // Hiç ödenmedi
      kalan = borcTutar;
      durum = 'acik';
    }

    // Sadece açık veya kısmi faturalar listeye ekle
    if (durum !== 'kapali') {
      sonuc.acikFaturalar.push({
        belgeno,
        tarih,
        vadetarihi,
        tutar: borcTutar,
        kalan,
        gecikmeGunu,
        durum,
      });

      sonuc.toplamAcikBakiye += kalan;

      // Vadesi geçmiş ise gecikmiş bakiyeye ekle
      if (gecikmeGunu > 0) {
        sonuc.gercekGecikmisBakiye += kalan;
      }
    }
  }

  return sonuc;
}

// Hibrit Risk Puanı Algoritması
function hesaplaRiskAnalizi(
  hareketler: any[],
  bakiye: number,
  fifoSonuc: FifoSonuc
): RiskAnalizi {
  const analiz: RiskAnalizi = {
    guvenSkoru: 100,
    riskSkoru: 0,
    odemeAliskanligi: 0,
    sonOdemeTarihi: null,
    siparisSkikligi: 0,
    maxGecikmeGunu: 0,
    acikFaturaSayisi: fifoSonuc.acikFaturalar.length,
    kapaliOranı: 0,
  };

  if (!Array.isArray(hareketler) || hareketler.length === 0) {
    return analiz;
  }

  // 1. GÜVEN SKORU (100'den düş)
  // Gecikme oranına göre ceza
  const gecikmeOrani = bakiye > 0 ? fifoSonuc.gercekGecikmisBakiye / bakiye : 0;
  const cezaPuani = Math.round(gecikmeOrani * 100 * 0.6);
  analiz.guvenSkoru = Math.max(0, 100 - cezaPuani);

  // 2. RİSK SKORU (0'dan artır) - mevcut mantık
  // Yüksek bakiye riski
  if (bakiye > 100000) analiz.riskSkoru += 30;
  else if (bakiye > 50000) analiz.riskSkoru += 20;
  else if (bakiye > 10000) analiz.riskSkoru += 10;

  // Vadesi geçmiş riski
  if (fifoSonuc.gercekGecikmisBakiye > 50000) analiz.riskSkoru += 40;
  else if (fifoSonuc.gercekGecikmisBakiye > 20000) analiz.riskSkoru += 25;
  else if (fifoSonuc.gercekGecikmisBakiye > 5000) analiz.riskSkoru += 15;
  else if (fifoSonuc.gercekGecikmisBakiye > 0) analiz.riskSkoru += 5;

  analiz.riskSkoru = Math.min(100, analiz.riskSkoru);

  // 3. SON ÖDEME TARİHİ ve ALIŞ­KAN­LIK
  const odemeler = hareketler
    .filter(h => (parseFloat(h.alacak) || 0) > 0)
    .sort((a, b) => {
      const tarihA = new Date(a.tarih || a.islemtarihi || "1900-01-01").getTime();
      const tarihB = new Date(b.tarih || b.islemtarihi || "1900-01-01").getTime();
      return tarihB - tarihA; // En yeni en üstte
    });

  if (odemeler.length > 0) {
    analiz.sonOdemeTarihi = odemeler[0].tarih || odemeler[0].islemtarihi || null;
    const gunFarki = analiz.sonOdemeTarihi ? hesaplaGunFarki(analiz.sonOdemeTarihi) : 999;

    // Ödeme alışkanlığı puanı
    if (gunFarki <= 15) analiz.odemeAliskanligi = 15;
    else if (gunFarki <= 30) analiz.odemeAliskanligi = 10;
    else if (gunFarki <= 45) analiz.odemeAliskanligi = 0;
    else if (gunFarki <= 60) analiz.odemeAliskanligi = -10;
    else analiz.odemeAliskanligi = -15;

    // Güven skoruna ekle
    analiz.guvenSkoru = Math.max(0, Math.min(100, analiz.guvenSkoru + analiz.odemeAliskanligi));
  }

  // 4. SİPARİŞ SIKLIĞI
  const faturalar = hareketler.filter(h => (parseFloat(h.borc) || 0) > 0);
  if (faturalar.length > 1) {
    const tarihler = faturalar
      .map(f => new Date(f.tarih || f.islemtarihi || "1900-01-01").getTime())
      .filter(t => t > 0)
      .sort((a, b) => a - b);
    
    if (tarihler.length > 1) {
      const toplam = tarihler[tarihler.length - 1] - tarihler[0];
      analiz.siparisSkikligi = Math.round(toplam / (1000 * 60 * 60 * 24) / (tarihler.length - 1));
    }
  }

  // 5. MAX GECİKME GÜNÜ
  analiz.maxGecikmeGunu = Math.max(0, ...fifoSonuc.acikFaturalar.map(f => f.gecikmeGunu));

  // 6. KAPALI ORANI (toplam fatura sayısına göre)
  const toplamFaturaSayisi = faturalar.length;
  const kapananFaturaSayisi = toplamFaturaSayisi - fifoSonuc.acikFaturalar.length;
  analiz.kapaliOranı = toplamFaturaSayisi > 0 ? (kapananFaturaSayisi / toplamFaturaSayisi) * 100 : 100;

  return analiz;
}

// Vade Yaşlandırma Hesaplaması (FIFO verisiyle veya kalantutar ile)
function hesaplaYaslandirma(borcHareketler: any[], fifoAcikFaturalar?: AcikFatura[]): VadeYaslandirma {
  const yaslandirma: VadeYaslandirma = {
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

  // FIFO açık faturalardan yaşlandırma yap
  if (fifoAcikFaturalar && fifoAcikFaturalar.length > 0) {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);

    for (const fatura of fifoAcikFaturalar) {
      const vadetarihi = new Date(fatura.vadetarihi);
      vadetarihi.setHours(0, 0, 0, 0);
      const tutar = fatura.kalan;

      const farkGun = Math.floor((bugun.getTime() - vadetarihi.getTime()) / (1000 * 60 * 60 * 24));

      if (farkGun > 90) yaslandirma.vade90Plus += tutar;
      else if (farkGun > 60) yaslandirma.vade90 += tutar;
      else if (farkGun > 30) yaslandirma.vade60 += tutar;
      else if (farkGun > 0) yaslandirma.vade30 += tutar;
      else if (farkGun === 0) yaslandirma.guncel += tutar;
      else if (farkGun >= -30) yaslandirma.gelecek30 += tutar;
      else if (farkGun >= -60) yaslandirma.gelecek60 += tutar;
      else if (farkGun >= -90) yaslandirma.gelecek90 += tutar;
      else yaslandirma.gelecek90Plus += tutar;
    }
    return yaslandirma;
  }

  // Fallback: DIA'nın kalantutar alanını kullan
  if (!Array.isArray(borcHareketler)) return yaslandirma;

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  for (const hareket of borcHareketler) {
    const vadetarihi = new Date(hareket.vadetarihi);
    vadetarihi.setHours(0, 0, 0, 0);
    
    const tutar = parseFloat(hareket.kalantutar) || 0;
    if (tutar <= 0) continue;

    const farkGun = Math.floor((bugun.getTime() - vadetarihi.getTime()) / (1000 * 60 * 60 * 24));

    if (farkGun > 90) yaslandirma.vade90Plus += tutar;
    else if (farkGun > 60) yaslandirma.vade90 += tutar;
    else if (farkGun > 30) yaslandirma.vade60 += tutar;
    else if (farkGun > 0) yaslandirma.vade30 += tutar;
    else if (farkGun === 0) yaslandirma.guncel += tutar;
    else if (farkGun >= -30) yaslandirma.gelecek30 += tutar;
    else if (farkGun >= -60) yaslandirma.gelecek60 += tutar;
    else if (farkGun >= -90) yaslandirma.gelecek90 += tutar;
    else yaslandirma.gelecek90Plus += tutar;
  }

  return yaslandirma;
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

    // 1. Fetch vade bakiye listesi with __borchareketler for FIFO aging (NO LIMIT)
    // FİLTRE KALDIRILDI: Tüm carileri getir (aktif, pasif, potansiyel)
    const vadeBakiyePayload = {
      scf_carikart_vade_bakiye_listele: {
        session_id: sessionId,
        firma_kodu: firmaKodu,
        filters: "",
        sorts: "",
        limit: 50000,
        offset: 0,
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
    
    if (vadeBakiyeData.code && vadeBakiyeData.code !== "200") {
      const errorMsg = vadeBakiyeData.msg || "DIA veri çekme hatası";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let vadeBakiyeList: any[] = [];
    if (Array.isArray(vadeBakiyeData.result)) {
      vadeBakiyeList = vadeBakiyeData.result;
    } else if (Array.isArray(vadeBakiyeData.msg)) {
      vadeBakiyeList = vadeBakiyeData.msg;
    } else if (Array.isArray(vadeBakiyeData.data)) {
      vadeBakiyeList = vadeBakiyeData.data;
    }
    
    console.log(`Found ${vadeBakiyeList.length} vade bakiye records`);

    // 2. Fetch cari kart listesi for additional info (NO LIMIT)
    const cariListePayload = {
      scf_carikart_listele: {
        session_id: sessionId,
        firma_kodu: firmaKodu,
        filters: "",
        sorts: [{ field: "carikartkodu", sorttype: "DESC" }],
        limit: 50000,
        offset: 0,
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
    let toplamCariSayisi = 0;
    let musteriSayisi = 0;
    
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
      
      // Cari sayılarını hesapla (scf_carikart_listele'den)
      toplamCariSayisi = cariListe.length;
      musteriSayisi = cariListe.filter(c => 
        c.potansiyel !== true && c.potansiyel !== "True"
      ).length;
      
      for (const cari of cariListe) {
        cariMap.set(cari._key, cari);
      }
      console.log(`Found ${cariListe.length} cari records, ${musteriSayisi} müşteri (potansiyel hariç)`);
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

    // FIFO özet
    let toplamAcikFatura = 0;
    let toplamAcikBakiye = 0;
    let gercekGecikmisBakiye = 0;

    const ozelkodMap = new Map<string, { toplam: number; adet: number }>();
    const satisElemaniMap = new Map<string, { toplam: number; adet: number }>();

    const cariler: CariHesap[] = vadeBakiyeList.map((vade: any, index: number) => {
      const cariKey = vade._key_scf_carikart || vade._key;
      const cariInfo = cariMap.get(cariKey) || {};
      
      const borctoplam = parseFloat(cariInfo.borctoplam) || parseFloat(vade.borctoplam) || 0;
      const alacaktoplam = parseFloat(cariInfo.alacaktoplam) || parseFloat(vade.alacaktoplam) || 0;
      const toplambakiye = parseFloat(vade.toplambakiye) || (borctoplam - alacaktoplam);
      const vadesigecentutar = parseFloat(vade.vadesigecentutar) || 0;
      
      // DEBUG: İlk 3 cari için detaylı log
      if (index < 3) {
        console.log(`DEBUG Cari ${index + 1}: ${vade.cariunvan || cariInfo.unvan}`);
        console.log(`  - toplambakiye: ${toplambakiye}, vadesigecentutar: ${vadesigecentutar}`);
        console.log(`  - __borchareketler count: ${Array.isArray(vade.__borchareketler) ? vade.__borchareketler.length : 0}`);
      }
      
      // FIFO hesaplama (ham hareket verilerinden)
      const borcHareketler = Array.isArray(vade.__borchareketler) ? vade.__borchareketler : [];
      const fifo = hesaplaFIFO(borcHareketler);
      
      // Hibrit Risk Analizi
      const riskAnalizi = hesaplaRiskAnalizi(borcHareketler, toplambakiye, fifo);
      
      // Yaşlandırma (FIFO bazlı)
      const yaslandirma = hesaplaYaslandirma(borcHareketler, fifo.acikFaturalar);
      
      // FIFO özete ekle
      toplamAcikFatura += fifo.acikFaturalar.length;
      toplamAcikBakiye += fifo.toplamAcikBakiye;
      gercekGecikmisBakiye += fifo.gercekGecikmisBakiye;
      
      // Alacak/Borç hesaplama - vadesigecentutar kullan, toplambakiye ile sınırla
      if (toplambakiye > 0) {
        toplamAlacak += toplambakiye;
        // Gecikmiş alacak: vadesigecentutar kullan, ama toplambakiye'yi aşamaz
        const gecikmisTutar = Math.min(vadesigecentutar, toplambakiye);
        gecikimisAlacak += gecikmisTutar;
      } else if (toplambakiye < 0) {
        toplamBorc += Math.abs(toplambakiye);
        // Gecikmiş borç: vadesigecentutar kullan, ama toplambakiye'yi (mutlak) aşamaz
        const gecikmisTutar = Math.min(vadesigecentutar, Math.abs(toplambakiye));
        gecikimisBorc += gecikmisTutar;
      }
      
      vadesiGecmis += vadesigecentutar;
      
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
      const durum = cariInfo.durum || "A"; // Default: Aktif
      
      // Özelkod dağılımı
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
        riskSkoru: riskAnalizi.riskSkoru,
        yaslandirma,
        sektorler,
        kaynak,
        carikarttipi,
        potansiyel,
        potansiyeleklemetarihi,
        cariyedonusmetarihi,
        borctoplam,
        alacaktoplam,
        durum,
        // Yeni FIFO ve Risk alanları
        fifo,
        riskAnalizi,
      };
    });

    // Sort cariler by toplambakiye descending
    cariler.sort((a, b) => b.toplambakiye - a.toplambakiye);

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
      toplamCariSayisi,
      musteriSayisi,
      fifoOzet: {
        toplamAcikFatura,
        toplamAcikBakiye,
        gercekGecikmisBakiye,
      },
    };

    console.log(`Genel rapor generated for user ${user.id}: ${cariler.length} cari`);
    console.log(`FIFO Özet: toplamAcikFatura=${toplamAcikFatura}, toplamAcikBakiye=${toplamAcikBakiye.toFixed(2)}, gercekGecikmisBakiye=${gercekGecikmisBakiye.toFixed(2)}`);
    console.log(`DEBUG Özet: toplamAlacak=${toplamAlacak.toFixed(2)}, toplamBorc=${toplamBorc.toFixed(2)}, gecikimisAlacak=${gecikimisAlacak.toFixed(2)}, gecikimisBorc=${gecikimisBorc.toFixed(2)}`);

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
