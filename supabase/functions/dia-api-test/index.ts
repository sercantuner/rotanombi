// DIA API Test Edge Function - Widget Builder için API test aracı

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDiaSession } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestApiRequest {
  module: string;      // scf, fat, bcs, sis
  method: string;      // carikart_listele, fatura_listele, vb.
  limit?: number;
  filters?: Record<string, any>;
  selectedColumns?: string[];
  orderby?: string;
}

interface TestApiResponse {
  success: boolean;
  recordCount?: number;
  sampleFields?: string[];
  fieldTypes?: Record<string, string>;
  sampleData?: any[];
  error?: string;
}

// Field tipini belirle
function detectFieldType(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    // Tarih mi?
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    // Sayı gibi görünen string mi?
    if (/^-?\d+(\.\d+)?$/.test(value)) return 'number-string';
    return 'string';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

// Tüm alanları ve tiplerini çıkar
function extractFieldsAndTypes(data: any[]): { fields: string[]; fieldTypes: Record<string, string> } {
  const fieldSet = new Set<string>();
  const fieldTypes: Record<string, string> = {};

  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    
    for (const [key, value] of Object.entries(item)) {
      if (!fieldSet.has(key)) {
        fieldSet.add(key);
        fieldTypes[key] = detectFieldType(value);
      } else if (fieldTypes[key] === 'null' && value !== null) {
        // Daha önce null olan alanın gerçek tipini güncelle
        fieldTypes[key] = detectFieldType(value);
      }
    }
  }

  return {
    fields: Array.from(fieldSet).sort(),
    fieldTypes,
  };
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

    // Request body'yi parse et
    const body: TestApiRequest = await req.json();
    const { module, method, limit = 100, filters = {}, selectedColumns = [], orderby = '' } = body;

    if (!module || !method) {
      return new Response(
        JSON.stringify({ success: false, error: "module ve method zorunludur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DIA session al
    const diaResult = await getDiaSession(supabase, user.id);
    
    if (!diaResult.success || !diaResult.session) {
      return new Response(
        JSON.stringify({ success: false, error: diaResult.error || "DIA bağlantısı kurulamadı" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId, sunucuAdi, firmaKodu, donemKodu } = diaResult.session;
    const diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/${module}/json`;

    // DIA payload oluştur
    const methodKey = `${module}_${method}`;
    const payload: Record<string, any> = {
      [methodKey]: {
        session_id: sessionId,
        firma_kodu: firmaKodu,
        donem_kodu: donemKodu,
        limit: Math.min(limit, 100), // Test için max 100 kayıt
        offset: 0,
      }
    };

    // Filtreleri ekle
    if (Object.keys(filters).length > 0) {
      payload[methodKey].filters = JSON.stringify(filters);
    }

    // Seçili kolonları ekle
    if (selectedColumns.length > 0) {
      payload[methodKey].selectedcolumns = selectedColumns.join(',');
    }

    // Sıralama ekle
    if (orderby) {
      payload[methodKey].sorts = orderby;
    }

    console.log(`Testing DIA API: ${module}/${method} for user ${user.id}`);

    // DIA API çağrısı
    const response = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `DIA API hatası: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();

    // Hata kontrolü
    if (result.code && result.code !== "200") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.msg || `DIA hata kodu: ${result.code}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Veriyi bul - DIA yanıtı farklı yapılarda olabilir
    let data: any[] = [];
    
    if (result.result) {
      // result içinde array varsa
      if (Array.isArray(result.result)) {
        data = result.result;
      } else if (typeof result.result === 'object') {
        // İç içe array olabilir
        const firstKey = Object.keys(result.result)[0];
        if (firstKey && Array.isArray(result.result[firstKey])) {
          data = result.result[firstKey];
        }
      }
    } else if (result.msg && Array.isArray(result.msg)) {
      data = result.msg;
    }

    if (data.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          recordCount: 0,
          sampleFields: [],
          fieldTypes: {},
          sampleData: [],
          error: 'Kayıt bulunamadı'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Alanları ve tiplerini çıkar
    const { fields, fieldTypes } = extractFieldsAndTypes(data);

    // Örnek veri (ilk 5 kayıt)
    const sampleData = data.slice(0, 5);

    const responseData: TestApiResponse = {
      success: true,
      recordCount: data.length,
      sampleFields: fields,
      fieldTypes,
      sampleData,
    };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("DIA API Test error:", error);
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
