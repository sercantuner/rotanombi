// DIA ERP API Client
// Edge function'lar üzerinden DIA'ya bağlanır

import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface DiaLoginParams {
  sunucuAdi: string;
  apiKey: string;
  wsKullanici: string;
  wsSifre: string;
  firmaKodu?: number;
  donemKodu?: number;
}

export interface DiaLoginResult {
  session_id: string;
  firma_kodu: number;
  donem_kodu: number;
  kullanici_adi: string;
  expires_at: string;
}

export interface VadeYaslandirma {
  // Vadesi geçmiş (geçmişe doğru)
  vade90Plus: number;    // 90+ gün geçmiş
  vade90: number;        // 61-90 gün geçmiş
  vade60: number;        // 31-60 gün geçmiş
  vade30: number;        // 1-30 gün geçmiş
  // Güncel
  guncel: number;        // Vadesi henüz gelmemiş veya bugün
  // Gelecek vadeler (geleceğe doğru)
  gelecek30: number;     // 1-30 gün sonra
  gelecek60: number;     // 31-60 gün sonra
  gelecek90: number;     // 61-90 gün sonra
  gelecek90Plus: number; // 90+ gün sonra
}

export interface OzelkodDagilimi {
  kod: string;
  toplam: number;
  adet: number;
}

export interface SatisElemaniDagilimi {
  eleman: string;
  toplam: number;
  adet: number;
}

export interface DiaGenelRapor {
  toplamAlacak: number;
  toplamBorc: number;
  gecikimisAlacak: number;
  gecikimisBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
  yaslandirma: VadeYaslandirma;
  ozelkodDagilimi: OzelkodDagilimi[];
  satisElemaniDagilimi: SatisElemaniDagilimi[];
  cariler: DiaCari[];
  sonGuncelleme: string;
}

export interface DiaCari {
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

export interface DiaSatisRapor {
  toplamSatis: number;
  gunlukSatis: number;
  aylikSatis: number;
  toplamFatura: number;
  satirlar: DiaSatisSatiri[];
  urunBazli: { stokKodu: string; stokAdi: string; toplamMiktar: number; toplamTutar: number }[];
  cariBazli: { cariKodu: string; cariAdi: string; toplamTutar: number; faturaAdedi: number }[];
  sonGuncelleme: string;
}

export interface DiaSatisSatiri {
  stokKodu: string;
  stokAdi: string;
  miktar: number;
  birim: string;
  tutar: number;
  tarih: string;
  faturaNo: string;
  cariAdi: string;
}

export interface DiaFinansRapor {
  toplamBankaBakiyesi: number;
  toplamKasaBakiyesi: number;
  toplamNakitPozisyon: number;
  toplamAlacak: number;
  toplamBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
  vadesiBuGun: number;
  yaslandirma: VadeYaslandirma;
  bankaHesaplari: DiaBankaHesabi[];
  kasaHesaplari: DiaKasaHesabi[];
  dovizBazliOzet: { doviz: string; banka: number; kasa: number; toplam: number }[];
  sonGuncelleme: string;
}

export interface DiaBankaHesabi {
  hesapKodu: string;
  hesapAdi: string;
  bankaAdi: string;
  dovizCinsi: string;
  bakiye: number;
  kullanilabilirBakiye: number;
}

export interface DiaKasaHesabi {
  kasaKodu: string;
  kasaAdi: string;
  dovizCinsi: string;
  bakiye: number;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function callEdgeFunction<T>(functionName: string, body?: object): Promise<ApiResult<T>> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' };
  }

  try {
    // Cache-busting için timestamp ekle
    const timestamp = Date.now();
    const url = `${SUPABASE_URL}/functions/v1/${functionName}?_t=${timestamp}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, data: data.data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Beklenmeyen hata';
    return { success: false, error: errorMessage };
  }
}

// DIA Giriş
export async function diaLogin(params: DiaLoginParams): Promise<ApiResult<DiaLoginResult>> {
  return callEdgeFunction<DiaLoginResult>('dia-login', params);
}

// DIA Bağlantı Test (login yaparak kontrol)
export async function diaTestConnection(params: DiaLoginParams): Promise<ApiResult<{ connected: boolean; message: string }>> {
  const result = await diaLogin(params);
  if (result.success) {
    return { success: true, data: { connected: true, message: 'Bağlantı başarılı' } };
  }
  return { success: false, error: result.error };
}

// Genel Cari Rapor
export async function diaGetGenelRapor(): Promise<ApiResult<DiaGenelRapor>> {
  return callEdgeFunction<DiaGenelRapor>('dia-genel-rapor');
}

// Satış Rapor
export async function diaGetSatisRapor(baslangic?: string, bitis?: string): Promise<ApiResult<DiaSatisRapor>> {
  const params: Record<string, string> = {};
  if (baslangic) params.baslangic = baslangic;
  if (bitis) params.bitis = bitis;
  
  return callEdgeFunction<DiaSatisRapor>('dia-satis-rapor', params);
}

// Finans Rapor
export async function diaGetFinansRapor(): Promise<ApiResult<DiaFinansRapor>> {
  return callEdgeFunction<DiaFinansRapor>('dia-finans-rapor');
}

// Profildeki DIA bağlantı bilgilerini al
export async function getDiaConnectionInfo(): Promise<{
  connected: boolean;
  sunucuAdi?: string;
  wsKullanici?: string;
  sessionExpires?: string;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('dia_sunucu_adi, dia_ws_kullanici, dia_session_id, dia_session_expires')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  const hasConnection = !!(profile.dia_sunucu_adi && profile.dia_session_id);
  const sessionValid = profile.dia_session_expires 
    ? new Date(profile.dia_session_expires) > new Date()
    : false;

  return {
    connected: hasConnection && sessionValid,
    sunucuAdi: profile.dia_sunucu_adi || undefined,
    wsKullanici: profile.dia_ws_kullanici || undefined,
    sessionExpires: profile.dia_session_expires || undefined,
  };
}
