// DIA API Test Edge Function - Widget Builder için API test aracı
// Raw JSON mode ve gelişmiş alan analizi

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
  // Raw mode için yeni alanlar
  rawMode?: boolean;
  rawPayload?: string; // JSON string
}

interface TestApiResponse {
  success: boolean;
  recordCount?: number;
  sampleFields?: string[];
  fieldTypes?: Record<string, string>;
  fieldStats?: Record<string, FieldStat>; // Yeni: alan istatistikleri
  sampleData?: any[];
  rawResponse?: any; // Raw mode için tam yanıt
  error?: string;
}

interface FieldStat {
  type: string;
  nullable: boolean;
  distinctCount?: number;
  sampleValues?: any[];
  min?: number;
  max?: number;
  sum?: number;
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

// Tüm alanları, tiplerini ve istatistiklerini çıkar
function extractFieldsAndTypes(data: any[]): { 
  fields: string[]; 
  fieldTypes: Record<string, string>;
  fieldStats: Record<string, FieldStat>;
} {
  const fieldSet = new Set<string>();
  const fieldTypes: Record<string, string> = {};
  const fieldStats: Record<string, FieldStat> = {};

  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    
    for (const [key, value] of Object.entries(item)) {
      if (!fieldSet.has(key)) {
        fieldSet.add(key);
        const type = detectFieldType(value);
        fieldTypes[key] = type;
        fieldStats[key] = {
          type,
          nullable: value === null || value === undefined,
          distinctCount: 0,
          sampleValues: [],
        };
        if (type === 'number' || type === 'number-string') {
          const numVal = typeof value === 'number' ? value : parseFloat(value as string);
          if (!isNaN(numVal)) {
            fieldStats[key].min = numVal;
            fieldStats[key].max = numVal;
            fieldStats[key].sum = numVal;
          }
        }
      } else {
        // Nullable kontrolü güncelle
        if (value === null || value === undefined) {
          fieldStats[key].nullable = true;
        }
        // Daha önce null olan alanın gerçek tipini güncelle
        if (fieldTypes[key] === 'null' && value !== null) {
          const newType = detectFieldType(value);
          fieldTypes[key] = newType;
          fieldStats[key].type = newType;
        }
        // Sayısal istatistikler
        if (fieldTypes[key] === 'number' || fieldTypes[key] === 'number-string') {
          const numVal = typeof value === 'number' ? value : parseFloat(value as string);
          if (!isNaN(numVal)) {
            fieldStats[key].min = Math.min(fieldStats[key].min ?? numVal, numVal);
            fieldStats[key].max = Math.max(fieldStats[key].max ?? numVal, numVal);
            fieldStats[key].sum = (fieldStats[key].sum ?? 0) + numVal;
          }
        }
      }
    }
  }

  // Distinct değer sayısı ve örnekler
  const fields = Array.from(fieldSet).sort();
  for (const field of fields) {
    const values = data.map(item => item[field]).filter(v => v !== null && v !== undefined);
    const uniqueValues = [...new Set(values)];
    fieldStats[field].distinctCount = uniqueValues.length;
    fieldStats[field].sampleValues = uniqueValues.slice(0, 10); // İlk 10 benzersiz değer
  }

  return { fields, fieldTypes, fieldStats };
}

// Raw payload'daki placeholder'ları değiştir
function replacePlaceholders(
  payload: string, 
  sessionId: string, 
  firmaKodu: number, 
  donemKodu: number
): string {
  return payload
    .replace(/\{session_id\}/g, sessionId)
    .replace(/"\{session_id\}"/g, `"${sessionId}"`)
    .replace(/\{firma_kodu\}/g, String(firmaKodu))
    .replace(/\{donem_kodu\}/g, String(donemKodu));
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
    const { 
      module, 
      method, 
      limit = 100, 
      filters = {}, 
      selectedColumns = [], 
      orderby = '',
      rawMode = false,
      rawPayload = ''
    } = body;

    // DIA session al
    const diaResult = await getDiaSession(supabase, user.id);
    
    if (!diaResult.success || !diaResult.session) {
      return new Response(
        JSON.stringify({ success: false, error: diaResult.error || "DIA bağlantısı kurulamadı" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId, sunucuAdi, firmaKodu, donemKodu } = diaResult.session;

    let diaUrl: string;
    let payload: Record<string, any>;

    // Raw mode veya normal mode
    if (rawMode && rawPayload) {
      // Raw mode - kullanıcının yazdığı JSON
      console.log(`Raw mode DIA API test for user ${user.id}`);
      
      // Placeholder'ları değiştir
      const processedPayload = replacePlaceholders(rawPayload, sessionId, firmaKodu, donemKodu);
      
      try {
        payload = JSON.parse(processedPayload);
      } catch (parseError) {
        return new Response(
          JSON.stringify({ success: false, error: "Geçersiz JSON formatı" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Method key'den modülü belirle
      const methodKey = Object.keys(payload)[0];
      if (!methodKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Payload boş" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Modülü method key'den çıkar (örn: scf_carikart_listele -> scf)
      const detectedModule = methodKey.split('_')[0];
      diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/${detectedModule}/json`;

    } else {
      // Normal mode
      if (!module || !method) {
        return new Response(
          JSON.stringify({ success: false, error: "module ve method zorunludur" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      diaUrl = `https://${sunucuAdi}.ws.dia.com.tr/api/v3/${module}/json`;

      // DIA payload oluştur
      const methodKey = `${module}_${method}`;
      payload = {
        [methodKey]: {
          session_id: sessionId,
          firma_kodu: firmaKodu,
          donem_kodu: donemKodu,
          limit: Math.min(limit, 500), // Test için max 500 kayıt
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
    }

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

    // Raw mode ise tam yanıtı döndür
    if (rawMode) {
      // Hata kontrolü
      if (result.code && result.code !== "200") {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: result.msg || `DIA hata kodu: ${result.code}`,
            rawResponse: result
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Veriyi bul
      let data: any[] = [];
      if (result.result) {
        if (Array.isArray(result.result)) {
          data = result.result;
        } else if (typeof result.result === 'object') {
          const firstKey = Object.keys(result.result)[0];
          if (firstKey && Array.isArray(result.result[firstKey])) {
            data = result.result[firstKey];
          }
        }
      } else if (result.msg && Array.isArray(result.msg)) {
        data = result.msg;
      }

      const { fields, fieldTypes, fieldStats } = data.length > 0 
        ? extractFieldsAndTypes(data) 
        : { fields: [], fieldTypes: {}, fieldStats: {} };

      return new Response(
        JSON.stringify({
          success: true,
          recordCount: data.length,
          sampleFields: fields,
          fieldTypes,
          fieldStats,
          sampleData: data.slice(0, 10),
          rawResponse: result
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normal mode - mevcut mantık
    if (result.code && result.code !== "200") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.msg || `DIA hata kodu: ${result.code}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Veriyi bul
    let data: any[] = [];
    
    if (result.result) {
      if (Array.isArray(result.result)) {
        data = result.result;
      } else if (typeof result.result === 'object') {
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
          fieldStats: {},
          sampleData: [],
          error: 'Kayıt bulunamadı'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Alanları, tiplerini ve istatistiklerini çıkar
    const { fields, fieldTypes, fieldStats } = extractFieldsAndTypes(data);

    // Örnek veri (ilk 10 kayıt)
    const sampleData = data.slice(0, 10);

    const responseData: TestApiResponse = {
      success: true,
      recordCount: data.length,
      sampleFields: fields,
      fieldTypes,
      fieldStats,
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
