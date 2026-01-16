// RotanomBI Types

export interface SessionData {
  sessionId: string;
  firmKodu: string;
  donemKodu: string;
  sunucuAdi: string;
  kullaniciAdi: string;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  sunucuAdi: string;
  kullaniciAdi: string;
  sifre: string;
  rememberMe: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  html?: string;
}

export interface ReportData {
  id: string;
  title: string;
  type: 'genel' | 'satis' | 'finans';
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface CariHesap {
  cariKodu: string;
  cariAdi: string;
  bakiye: number;
  vadeBakiyesi: number;
  sonIslemTarihi: string;
}

export interface SatisRaporu {
  toplamSatis: number;
  gunlukSatis: number;
  aylikSatis: number;
  toplamFatura: number;
  satirlar: SatisSatiri[];
}

export interface SatisSatiri {
  stokKodu: string;
  stokAdi: string;
  miktar: number;
  birim: string;
  tutar: number;
  tarih: string;
}

export interface FinansRaporu {
  toplamAlacak: number;
  toplamBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
  vadesiBuGun: number;
}

export interface DashboardStats {
  toplamCiro: number;
  gunlukSatis: number;
  toplamAlacak: number;
  toplamBorc: number;
  netBakiye: number;
  vadesiGecmis: number;
}

export type NavigationPage = 'dashboard' | 'satis' | 'finans' | 'cari' | 'ayarlar';
