// RotanomBI API Client
// Supabase tabanlı backend

import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats, SatisRaporu, FinansRaporu, CariHesap } from './types';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Dashboard stats - mock data for demo (will be replaced with real data later)
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  // Mock data for now - will be replaced with real Supabase queries
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
  // Mock data for now
  return { 
    success: true, 
    data: {
      toplamSatis: 1396000,
      gunlukSatis: 45000,
      aylikSatis: 155000,
      toplamFatura: 892,
      satirlar: []
    }
  };
}

// Finance report
export async function getFinansRaporu(): Promise<ApiResponse<FinansRaporu>> {
  // Mock data for now
  return { 
    success: true, 
    data: {
      toplamAlacak: 380000,
      toplamBorc: 125000,
      netBakiye: 255000,
      vadesiGecmis: 143000,
      vadesiBuGun: 42000,
    }
  };
}

// Cari accounts
export async function getCariHesaplar(): Promise<ApiResponse<CariHesap[]>> {
  // Mock data for now
  return { 
    success: true, 
    data: []
  };
}

// Get user profile
export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return profile;
}

// Update user profile
export async function updateUserProfile(updates: {
  display_name?: string;
  firma_kodu?: string;
  donem_kodu?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Kullanıcı bulunamadı' };

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Get app settings
export async function getAppSettings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return settings;
}

// Update app settings
export async function updateAppSettings(updates: {
  auto_refresh?: boolean;
  refresh_interval?: number;
  theme?: string;
  language?: string;
  timezone?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Kullanıcı bulunamadı' };

  // First try to update, if no row exists, insert
  const { data: existing } = await supabase
    .from('app_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('app_settings')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from('app_settings')
      .insert({ user_id: user.id, ...updates });

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}
