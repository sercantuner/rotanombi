// Mock Data - Demo ve sunum için gerçekçi veriler
// use_mock_data: true olduğunda DIA API yerine bu veriler kullanılır

import type { 
  DiaGenelRapor, 
  DiaSatisRapor, 
  DiaFinansRapor, 
  DiaCari, 
  VadeYaslandirma,
  DiaBankaHesabi,
  MarkaDagilimi,
  SatisElemaniPerformans,
} from './diaClient';

// ============ YARDIMCI FONKSİYONLAR ============

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTurkishCompanyName(): string {
  const prefixes = ['ABC', 'XYZ', 'Delta', 'Mega', 'Pro', 'Eko', 'Star', 'Global', 'Ultra', 'Prime', 'Alfa', 'Beta', 'Gamma', 'Omega', 'Zenith'];
  const suffixes = ['Ticaret', 'Sanayi', 'İnşaat', 'Tekstil', 'Gıda', 'Makina', 'Elektronik', 'Otomotiv', 'Lojistik', 'Danışmanlık'];
  const types = ['Ltd. Şti.', 'A.Ş.', 'San. Tic.', 'Paz. A.Ş.'];
  
  return `${randomFromArray(prefixes)} ${randomFromArray(suffixes)} ${randomFromArray(types)}`;
}

const SEKTORLER = ['İnşaat', 'Tekstil', 'Gıda', 'Otomotiv', 'Elektronik', 'Makina', 'Lojistik', 'Perakende', 'Hizmet', 'Tarım'];
const KAYNAKLAR = ['Web', 'Referans', 'Fuar', 'Sosyal Medya', 'Reklam', 'Doğrudan', 'Telefon', 'E-posta'];
const SEHIRLER = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya', 'Adana', 'Gaziantep', 'Kayseri', 'Trabzon', 'Samsun', 'Eskişehir'];
const OZELKODLAR = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'VIP', 'STD', 'ECO'];
const SATIS_ELEMANLARI = ['Ahmet Yılmaz', 'Mehmet Kaya', 'Ayşe Demir', 'Fatma Çelik', 'Ali Öztürk', 'Zeynep Arslan', 'Mustafa Şahin', 'Elif Koç'];
const MARKALAR = ['Samsung', 'Apple', 'LG', 'Sony', 'Bosch', 'Philips', 'Siemens', 'Arçelik', 'Vestel', 'Beko'];

// ============ MOCK CARİLER ============

function generateMockCari(index: number): DiaCari {
  const isPotansiyel = Math.random() < 0.15;
  const bakiye = isPotansiyel ? 0 : randomBetween(-500000, 2000000);
  const isAktif = Math.random() < 0.85;
  const cariTipi = randomFromArray(['AL', 'AL', 'AL', 'AS', 'ST']); // Alıcı ağırlıklı
  
  const vadesiGecentutar = bakiye > 0 ? randomBetween(0, bakiye * 0.4) : 0;
  
  // Risk skoru hesaplama
  const riskFactor = vadesiGecentutar > 0 ? (vadesiGecentutar / bakiye) * 100 : 0;
  const riskSkoru = Math.min(100, Math.max(0, riskFactor + randomBetween(-10, 20)));
  
  // Potansiyel tarihleri
  const potansiyelTarihi = isPotansiyel 
    ? new Date(Date.now() - randomBetween(1, 365) * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - randomBetween(365, 1000) * 24 * 60 * 60 * 1000).toISOString();
  
  const cariyeDonusmeTarihi = !isPotansiyel && Math.random() > 0.3
    ? new Date(Date.now() - randomBetween(30, 365) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    _key: `MOCK-${String(index).padStart(4, '0')}`,
    cariKodu: `C${String(index).padStart(5, '0')}`,
    cariAdi: generateTurkishCompanyName(),
    bakiye: bakiye,
    toplambakiye: bakiye,
    vadesigecentutar: vadesiGecentutar,
    ozelkod1kod: randomFromArray(OZELKODLAR),
    ozelkod2kod: randomFromArray(OZELKODLAR),
    ozelkod3kod: randomFromArray(OZELKODLAR),
    satiselemani: randomFromArray(SATIS_ELEMANLARI),
    sehir: randomFromArray(SEHIRLER),
    telefon: `0${randomBetween(500, 599)} ${randomBetween(100, 999)} ${randomBetween(10, 99)} ${randomBetween(10, 99)}`,
    eposta: `info@${generateTurkishCompanyName().toLowerCase().replace(/[^a-z]/g, '').substring(0, 10)}.com.tr`,
    riskSkoru: Math.round(riskSkoru),
    yaslandirma: {
      vade90Plus: bakiye > 0 ? randomBetween(0, bakiye * 0.2) : 0,
      vade90: bakiye > 0 ? randomBetween(0, bakiye * 0.15) : 0,
      vade60: bakiye > 0 ? randomBetween(0, bakiye * 0.15) : 0,
      vade30: bakiye > 0 ? randomBetween(0, bakiye * 0.2) : 0,
      guncel: bakiye > 0 ? randomBetween(0, bakiye * 0.3) : 0,
      gelecek30: 0,
      gelecek60: 0,
      gelecek90: 0,
      gelecek90Plus: 0,
    },
    sektorler: randomFromArray(SEKTORLER),
    kaynak: randomFromArray(KAYNAKLAR),
    carikarttipi: cariTipi,
    potansiyel: isPotansiyel,
    potansiyeleklemetarihi: potansiyelTarihi,
    cariyedonusmetarihi: cariyeDonusmeTarihi,
    borctoplam: bakiye < 0 ? Math.abs(bakiye) : 0,
    alacaktoplam: bakiye > 0 ? bakiye : 0,
    durum: isAktif ? 'A' : 'P',
    fifo: {
      acikFaturalar: [],
      gercekGecikmisBakiye: vadesiGecentutar,
      odemeHavuzu: 0,
      toplamAcikBakiye: bakiye > 0 ? bakiye : 0,
    },
    riskAnalizi: {
      guvenSkoru: 100 - Math.round(riskSkoru),
      riskSkoru: Math.round(riskSkoru),
      odemeAliskanligi: randomBetween(60, 100),
      sonOdemeTarihi: new Date(Date.now() - randomBetween(1, 60) * 24 * 60 * 60 * 1000).toISOString(),
      siparisSkikligi: randomBetween(1, 15),
      maxGecikmeGunu: randomBetween(0, 90),
      acikFaturaSayisi: randomBetween(0, 10),
      kapaliOranı: randomFloat(0.5, 1),
    },
  };
}

// 500 mock cari oluştur
export const MOCK_CARILER: DiaCari[] = Array.from({ length: 500 }, (_, i) => generateMockCari(i + 1));

// ============ MOCK GENEL RAPOR ============

export function getMockGenelRapor(): DiaGenelRapor {
  const cariler = MOCK_CARILER;
  
  const toplamAlacak = cariler.filter(c => c.bakiye > 0).reduce((sum, c) => sum + c.bakiye, 0);
  const toplamBorc = Math.abs(cariler.filter(c => c.bakiye < 0).reduce((sum, c) => sum + c.bakiye, 0));
  const netBakiye = toplamAlacak - toplamBorc;
  const vadesiGecmis = cariler.reduce((sum, c) => sum + c.vadesigecentutar, 0);
  const gecikimisAlacak = cariler.filter(c => c.bakiye > 0 && c.vadesigecentutar > 0).reduce((sum, c) => sum + c.vadesigecentutar, 0);
  const gecikimisBorc = randomBetween(50000, 200000);
  
  // Yaslandirma hesapla
  const yaslandirma: VadeYaslandirma = {
    vade90Plus: randomBetween(200000, 500000),
    vade90: randomBetween(150000, 400000),
    vade60: randomBetween(200000, 500000),
    vade30: randomBetween(300000, 700000),
    guncel: randomBetween(400000, 800000),
    gelecek30: randomBetween(300000, 600000),
    gelecek60: randomBetween(200000, 400000),
    gelecek90: randomBetween(150000, 300000),
    gelecek90Plus: randomBetween(100000, 250000),
  };
  
  // Özel kod dağılımı
  const ozelkodDagilimi = OZELKODLAR.slice(0, 8).map(kod => ({
    kod,
    toplam: randomBetween(100000, 500000),
    adet: randomBetween(10, 50),
  }));
  
  // Satış elemanı dağılımı
  const satisElemaniDagilimi = SATIS_ELEMANLARI.map(eleman => ({
    eleman,
    toplam: randomBetween(200000, 1000000),
    adet: randomBetween(20, 80),
  }));
  
  const musteriSayisi = cariler.filter(c => !c.potansiyel).length;
  
  return {
    toplamAlacak,
    toplamBorc,
    gecikimisAlacak,
    gecikimisBorc,
    netBakiye,
    vadesiGecmis,
    yaslandirma,
    ozelkodDagilimi,
    satisElemaniDagilimi,
    cariler,
    sonGuncelleme: new Date().toISOString(),
    toplamCariSayisi: cariler.length,
    musteriSayisi,
    fifoOzet: {
      toplamAcikFatura: randomBetween(200, 500),
      toplamAcikBakiye: toplamAlacak,
      gercekGecikmisBakiye: gecikimisAlacak,
    },
  };
}

// ============ MOCK SATIŞ RAPOR ============

export function getMockSatisRapor(): DiaSatisRapor {
  const brutSatis = randomBetween(2000000, 5000000);
  const iadeToplamı = randomBetween(50000, brutSatis * 0.1);
  const netSatis = brutSatis - iadeToplamı;
  const iadeOrani = (iadeToplamı / brutSatis) * 100;
  const toplamFatura = randomBetween(150, 400);
  const ortSepet = netSatis / toplamFatura;
  
  // Marka dağılımı
  const markaBazli: MarkaDagilimi[] = MARKALAR.map(marka => {
    const satisTutar = randomBetween(100000, 800000);
    const iadeTutar = randomBetween(5000, satisTutar * 0.15);
    return {
      marka,
      toplamMiktar: randomBetween(50, 500),
      satisTutar,
      iadeTutar,
      netTutar: satisTutar - iadeTutar,
      iadeOrani: (iadeTutar / satisTutar) * 100,
    };
  });
  
  // Satış elemanı performansı
  const satisElemaniPerformans: SatisElemaniPerformans[] = SATIS_ELEMANLARI.map(eleman => {
    const elemBrutSatis = randomBetween(200000, 800000);
    const elemIade = randomBetween(10000, elemBrutSatis * 0.12);
    const elemFaturaSayisi = randomBetween(20, 80);
    return {
      eleman,
      brutSatis: elemBrutSatis,
      iadeToplamı: elemIade,
      netSatis: elemBrutSatis - elemIade,
      iadeOrani: (elemIade / elemBrutSatis) * 100,
      faturaSayisi: elemFaturaSayisi,
      ortSepet: (elemBrutSatis - elemIade) / elemFaturaSayisi,
    };
  });
  
  // Top ürünler
  const urunBazli = Array.from({ length: 20 }, (_, i) => ({
    stokKodu: `STK${String(i + 1).padStart(5, '0')}`,
    stokAdi: `${randomFromArray(MARKALAR)} Ürün ${i + 1}`,
    toplamMiktar: randomBetween(10, 200),
    toplamTutar: randomBetween(10000, 200000),
  })).sort((a, b) => b.toplamTutar - a.toplamTutar);
  
  // Top cariler
  const cariBazli = MOCK_CARILER.slice(0, 20).map(c => ({
    cariKodu: c.cariKodu,
    cariAdi: c.cariAdi,
    toplamTutar: randomBetween(50000, 300000),
    faturaAdedi: randomBetween(3, 20),
  })).sort((a, b) => b.toplamTutar - a.toplamTutar);
  
  return {
    toplamSatis: netSatis,
    gunlukSatis: randomBetween(80000, 200000),
    aylikSatis: netSatis,
    toplamFatura,
    satirlar: [],
    urunBazli,
    cariBazli,
    sonGuncelleme: new Date().toISOString(),
    brutSatis,
    iadeToplamı,
    netSatis,
    iadeOrani,
    ortSepet,
    markaBazli,
    satisElemaniPerformans,
  };
}

// ============ MOCK FİNANS RAPOR ============

export function getMockFinansRapor(): DiaFinansRapor {
  const bankaHesaplari: DiaBankaHesabi[] = [
    { hesapKodu: 'BNK001', hesapAdi: 'Ana Hesap', bankaAdi: 'İş Bankası', dovizCinsi: 'TL', bakiye: randomBetween(500000, 2000000), kullanilabilirBakiye: randomBetween(400000, 1800000) },
    { hesapKodu: 'BNK002', hesapAdi: 'Ticari Hesap', bankaAdi: 'Garanti', dovizCinsi: 'TL', bakiye: randomBetween(200000, 800000), kullanilabilirBakiye: randomBetween(150000, 700000) },
    { hesapKodu: 'BNK003', hesapAdi: 'Döviz Hesabı', bankaAdi: 'Yapı Kredi', dovizCinsi: 'USD', bakiye: randomBetween(10000, 50000), kullanilabilirBakiye: randomBetween(8000, 45000) },
    { hesapKodu: 'BNK004', hesapAdi: 'Euro Hesap', bankaAdi: 'Akbank', dovizCinsi: 'EUR', bakiye: randomBetween(5000, 30000), kullanilabilirBakiye: randomBetween(4000, 28000) },
  ];
  
  const toplamBankaBakiyesi = bankaHesaplari.reduce((sum, h) => sum + h.bakiye, 0);
  const toplamKasaBakiyesi = randomBetween(20000, 100000);
  
  const genelRapor = getMockGenelRapor();
  
  return {
    toplamBankaBakiyesi,
    toplamKasaBakiyesi,
    toplamNakitPozisyon: toplamBankaBakiyesi + toplamKasaBakiyesi,
    toplamAlacak: genelRapor.toplamAlacak,
    toplamBorc: genelRapor.toplamBorc,
    netBakiye: genelRapor.netBakiye,
    vadesiGecmis: genelRapor.vadesiGecmis,
    vadesiBuGun: randomBetween(50000, 200000),
    yaslandirma: genelRapor.yaslandirma,
    bankaHesaplari,
    kasaHesaplari: [
      { kasaKodu: 'KAS001', kasaAdi: 'Merkez Kasa', dovizCinsi: 'TL', bakiye: toplamKasaBakiyesi },
    ],
    dovizBazliOzet: [
      { doviz: 'TL', banka: bankaHesaplari.filter(h => h.dovizCinsi === 'TL').reduce((s, h) => s + h.bakiye, 0), kasa: toplamKasaBakiyesi, toplam: 0 },
      { doviz: 'USD', banka: bankaHesaplari.filter(h => h.dovizCinsi === 'USD').reduce((s, h) => s + h.bakiye, 0), kasa: 0, toplam: 0 },
      { doviz: 'EUR', banka: bankaHesaplari.filter(h => h.dovizCinsi === 'EUR').reduce((s, h) => s + h.bakiye, 0), kasa: 0, toplam: 0 },
    ],
    sonGuncelleme: new Date().toISOString(),
  };
}

// ============ GÜNLÜK ÖZET (GERÇEK ZAMANLI MOCK) ============

export interface GunlukOzetData {
  bugunSatis: number;
  dunSatis: number;
  bugunTahsilat: number;
  dunTahsilat: number;
  bugunOdeme: number;
  dunOdeme: number;
}

export function getMockGunlukOzet(): GunlukOzetData {
  return {
    bugunSatis: randomBetween(80000, 180000),
    dunSatis: randomBetween(70000, 160000),
    bugunTahsilat: randomBetween(40000, 120000),
    dunTahsilat: randomBetween(35000, 100000),
    bugunOdeme: randomBetween(20000, 80000),
    dunOdeme: randomBetween(15000, 70000),
  };
}

// ============ KRİTİK STOK MOCK ============

export interface MockStokUyari {
  stokKodu: string;
  stokAdi: string;
  mevcutStok: number;
  minStok: number;
  birim: string;
  durum: 'kritik' | 'dusuk' | 'yakin' | 'siparis';
}

export function getMockKritikStok(): MockStokUyari[] {
  const urunler = [
    'Laptop Model X', 'USB-C Kablo', 'Wireless Mouse', 'Monitör 24"', 'Klavye Mekanik',
    'Webcam HD', 'Kulaklık Bluetooth', 'Harici Disk 1TB', 'RAM 16GB', 'SSD 512GB',
    'Telefon Kılıfı', 'Şarj Adaptörü', 'HDMI Kablo', 'Powerbank 20000', 'Tablet Stand',
  ];
  
  return urunler.map((ad, i) => {
    const mevcutStok = randomBetween(0, 50);
    const minStok = randomBetween(10, 30);
    let durum: MockStokUyari['durum'] = 'yakin';
    
    if (mevcutStok === 0) durum = 'kritik';
    else if (mevcutStok < minStok * 0.3) durum = 'kritik';
    else if (mevcutStok < minStok * 0.6) durum = 'dusuk';
    else if (mevcutStok < minStok) durum = 'yakin';
    else durum = 'siparis';
    
    return {
      stokKodu: `STK${String(i + 1).padStart(5, '0')}`,
      stokAdi: ad,
      mevcutStok,
      minStok,
      birim: randomFromArray(['Adet', 'Kutu', 'Paket']),
      durum,
    };
  }).filter(s => s.mevcutStok < s.minStok).sort((a, b) => a.mevcutStok - b.mevcutStok);
}
