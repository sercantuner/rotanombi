// DIA API Test Client - Widget Builder için
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface FieldStat {
  type: string;
  nullable: boolean;
  distinctCount?: number;
  sampleValues?: any[];
  min?: number;
  max?: number;
  sum?: number;
}

export interface DiaApiTestRequest {
  module: string;
  method: string;
  limit?: number;
  filters?: any; // Array veya Object
  selectedColumns?: string[];
  sorts?: { field: string; sorttype: string }[];
  orderby?: string;
  // Raw mode için yeni alanlar
  rawMode?: boolean;
  rawPayload?: string;
  // Dönem loop için
  periodConfig?: {
    enabled: boolean;
    periodField: string;
    currentPeriod?: number;
    fetchHistorical: boolean;
    historicalCount: number;
    mergeStrategy: 'union' | 'separate';
  };
}

export interface DiaApiTestResponse {
  success: boolean;
  recordCount?: number;
  sampleFields?: string[];
  fieldTypes?: Record<string, string>;
  fieldStats?: Record<string, FieldStat>;
  sampleData?: any[];
  rawResponse?: any;
  error?: string;
}

export async function testDiaApi(request: DiaApiTestRequest): Promise<DiaApiTestResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Oturum bulunamadı' };
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-api-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Beklenmeyen hata' 
    };
  }
}
