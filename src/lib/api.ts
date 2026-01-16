// RotanomBI API Client
// Bu dosya n8n webhook'larıyla iletişimi sağlar

import type { LoginCredentials, SessionData, ApiResponse, DashboardStats, SatisRaporu, FinansRaporu, CariHesap } from './types';

// Default webhook URL - can be overridden in settings
const DEFAULT_WEBHOOK_URL = 'https://n8n.diauygulama.com/webhook/f9c3a6d0-f211-42a4-9ef2-08801b33aeba';

// Storage keys
const SESSION_KEY = 'rotanombi_session';
const REMEMBER_KEY = 'rotanombi_remember';
const SETTINGS_KEY = 'rotanombi_settings';

export interface AppSettings {
  webhookUrl: string;
  autoRefresh: boolean;
  refreshInterval: number; // minutes
}

const defaultSettings: AppSettings = {
  webhookUrl: DEFAULT_WEBHOOK_URL,
  autoRefresh: true,
  refreshInterval: 5,
};

// Settings management
export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    return { ...defaultSettings, ...JSON.parse(stored) };
  }
  return defaultSettings;
};

export const saveSettings = (settings: Partial<AppSettings>): void => {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
};

// Session management
export const saveSession = (session: SessionData): void => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const getSession = (): SessionData | null => {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return null;
};

export const clearSession = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
};

export const saveRememberCredentials = (credentials: Omit<LoginCredentials, 'rememberMe'>): void => {
  localStorage.setItem(REMEMBER_KEY, JSON.stringify(credentials));
};

export const getRememberCredentials = (): Omit<LoginCredentials, 'rememberMe'> | null => {
  const stored = localStorage.getItem(REMEMBER_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return null;
};

export const clearRememberCredentials = (): void => {
  localStorage.removeItem(REMEMBER_KEY);
};

// Generic API call function
async function apiCall<T>(action: string, additionalParams: Record<string, string> = {}): Promise<ApiResponse<T>> {
  const session = getSession();
  const settings = getSettings();
  
  const params = new URLSearchParams({
    action,
    ...additionalParams,
  });

  if (session) {
    params.append('session_id', session.sessionId);
    params.append('firma_kodu', session.firmKodu);
    params.append('donem_kodu', session.donemKodu);
    params.append('sunucu_adi', session.sunucuAdi);
  }

  try {
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const text = await response.text();

    // Check if response is HTML (success case from n8n)
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      return { success: true, html: text };
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      
      // Check for error in JSON response
      if (data.error || data.hata) {
        return { success: false, error: data.error || data.hata };
      }
      
      return { success: true, data };
    } catch {
      // Plain text response (usually error messages)
      if (text.includes('HATA') || text.includes('bulunamadı') || text.includes('Hatalı')) {
        return { success: false, error: text };
      }
      return { success: true, data: text as T };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Bağlantı hatası' 
    };
  }
}

// Login API
export async function login(credentials: LoginCredentials): Promise<ApiResponse<SessionData>> {
  const settings = getSettings();
  
  const params = new URLSearchParams({
    action: 'login',
    sunucu_adi: credentials.sunucuAdi,
    kullanici_adi: credentials.kullaniciAdi,
    sifre: credentials.sifre,
  });

  try {
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const text = await response.text();

    // n8n returns HTML on success, or JSON with session data
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      // Parse session data from HTML if available, or create session
      const session: SessionData = {
        sessionId: 'session_' + Date.now(),
        firmKodu: '1',
        donemKodu: '1',
        sunucuAdi: credentials.sunucuAdi,
        kullaniciAdi: credentials.kullaniciAdi,
        isAuthenticated: true,
      };

      saveSession(session);

      if (credentials.rememberMe) {
        saveRememberCredentials({
          sunucuAdi: credentials.sunucuAdi,
          kullaniciAdi: credentials.kullaniciAdi,
          sifre: credentials.sifre,
        });
      } else {
        clearRememberCredentials();
      }

      return { success: true, data: session };
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      
      if (data.session_id || data.sessionId) {
        const session: SessionData = {
          sessionId: data.session_id || data.sessionId,
          firmKodu: data.firma_kodu || data.firmKodu || '1',
          donemKodu: data.donem_kodu || data.donemKodu || '1',
          sunucuAdi: credentials.sunucuAdi,
          kullaniciAdi: credentials.kullaniciAdi,
          isAuthenticated: true,
        };

        saveSession(session);

        if (credentials.rememberMe) {
          saveRememberCredentials({
            sunucuAdi: credentials.sunucuAdi,
            kullaniciAdi: credentials.kullaniciAdi,
            sifre: credentials.sifre,
          });
        } else {
          clearRememberCredentials();
        }

        return { success: true, data: session };
      }
      
      // Error in response
      if (data.error || data.hata) {
        return { success: false, error: data.error || data.hata };
      }
    } catch {
      // Not JSON, check for error text
    }

    // Error case - plain text
    if (text.includes('HATA') || text.includes('bulunamadı') || text.includes('Hatalı') || text.includes('geçersiz')) {
      return { success: false, error: text };
    }

    return { success: false, error: text || 'Giriş başarısız' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Bağlantı hatası' 
    };
  }
}

// Test connection to webhook
export async function testConnection(webhookUrl: string): Promise<ApiResponse<boolean>> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ action: 'ping' }),
    });
    
    if (response.ok) {
      return { success: true, data: true };
    }
    return { success: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Bağlantı hatası' 
    };
  }
}

// Dashboard stats
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  const result = await apiCall<any>('get_details');
  
  if (result.success && result.data) {
    // Map the response to DashboardStats
    const data = result.data;
    return {
      success: true,
      data: {
        toplamCiro: data.toplam_ciro || data.toplamCiro || 0,
        gunlukSatis: data.gunluk_satis || data.gunlukSatis || 0,
        toplamAlacak: data.toplam_alacak || data.toplamAlacak || 0,
        toplamBorc: data.toplam_borc || data.toplamBorc || 0,
        netBakiye: data.net_bakiye || data.netBakiye || 0,
        vadesiGecmis: data.vadesi_gecmis || data.vadesiGecmis || 0,
      }
    };
  }
  
  return result as ApiResponse<DashboardStats>;
}

// Sales report
export async function getSatisRaporu(): Promise<ApiResponse<SatisRaporu>> {
  return apiCall<SatisRaporu>('satis_raporu');
}

// Finance report
export async function getFinansRaporu(): Promise<ApiResponse<FinansRaporu>> {
  return apiCall<FinansRaporu>('finans_raporu');
}

// Cari accounts
export async function getCariHesaplar(): Promise<ApiResponse<CariHesap[]>> {
  return apiCall<CariHesap[]>('get_details');
}

// Logout
export function logout(): void {
  clearSession();
}
