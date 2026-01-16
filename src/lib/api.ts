// RotanomBI API Client
// Bu dosya n8n webhook'larıyla iletişimi sağlar

import type { LoginCredentials, SessionData, ApiResponse, DashboardStats, SatisRaporu, FinansRaporu, CariHesap } from './types';

const WEBHOOK_URL = 'https://n8n.diauygulama.com/webhook/f9c3a6d0-f211-42a4-9ef2-08801b33aeba';

// Session storage key
const SESSION_KEY = 'rotanombi_session';
const REMEMBER_KEY = 'rotanombi_remember';

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
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const text = await response.text();

    // Check if response is HTML (success case from n8n)
    if (text.includes('<!DOCTYPE html>')) {
      return { success: true, html: text };
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch {
      // Plain text response (usually error messages)
      if (text.includes('HATA') || text.includes('bulunamadı')) {
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
  const params = new URLSearchParams({
    action: 'login',
    sunucu_adi: credentials.sunucuAdi,
    kullanici_adi: credentials.kullaniciAdi,
    sifre: credentials.sifre,
  });

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const text = await response.text();

    // n8n returns HTML on success
    if (text.includes('<!DOCTYPE html>')) {
      // Extract session data from the HTML response if available
      // For now, we'll create a mock session since n8n handles this differently
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

    // Error case
    return { success: false, error: text || 'Giriş başarısız' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Bağlantı hatası' 
    };
  }
}

// Dashboard stats - mock data for demo
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  // In production, this would call the n8n webhook with action: 'get_details'
  // For now, returning mock data
  const mockData: DashboardStats = {
    toplamCiro: 1250000,
    gunlukSatis: 45000,
    toplamAlacak: 380000,
    toplamBorc: 125000,
    netBakiye: 255000,
    vadesiGecmis: 45000,
  };

  return { success: true, data: mockData };
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
