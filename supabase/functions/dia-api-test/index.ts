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
  returnAllData?: boolean; // Tüm veriyi döndür (widget renderer için)
  returnAllSampleData?: boolean; // Filtre önerileri için tüm veriyi döndür (sampleData olarak)
  // Impersonation için - super admin başka kullanıcının verisini çekebilir
  targetUserId?: string;
  // Sadece bağlantı durumunu kontrol et (veri çekme)
  checkConnectionOnly?: boolean;
  // Sadece oturumun geçerli olduğundan emin ol (DIA'ya method çağrısı yapmaz)
  ensureSessionOnly?: boolean;
  // Dönem loop için
  periodConfig?: {
    enabled: boolean;
    periodField: string;       // "_level2" veya "donem_kodu"
    currentPeriod?: number;    // Mevcut dönem (otomatik profile'dan alınır)
    fetchHistorical: boolean;  // Eski dönemleri de çek
    historicalCount: number;   // Kaç dönem geriye git
    mergeStrategy: 'union' | 'separate';
  };
  // Kullanıcı bazlı zorunlu filtreler (profiles.dia_auto_filters'dan otomatik uygulanır)
  applyUserFilters?: boolean;
  // Sayfa bazlı global filtreler
  pageFilters?: {
    satisTemsilcisi?: string[];
    sube?: string[];
    depo?: string[];
    ozelkod1?: string[];
    ozelkod2?: string[];
    ozelkod3?: string[];
  };
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
  fullDataAvailable?: boolean; // Tüm veri döndürüldü mü
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
      limit, // undefined olursa limitsiz çeker
      filters, 
      selectedColumns = [], 
      orderby = '',
      rawMode = false,
      rawPayload = '',
      returnAllData = false, // Tüm veriyi döndür (widget renderer için)
      returnAllSampleData = false, // Filtre önerileri için tüm veriyi sampleData olarak döndür
      targetUserId, // Impersonation için - super admin başka kullanıcının verisini çekebilir
      checkConnectionOnly = false, // Sadece bağlantı durumunu kontrol et
      ensureSessionOnly = false, // Sadece session yenile / doğrula
      periodConfig, // Dönem loop yapılandırması
    } = body;

    // ensureSessionOnly modu - DIA'ya herhangi bir method çağrısı yapmadan sadece geçerli session üret
    // (Impersonation dashboard için güvenli: frontend'e şifre/apiKey taşımadan session yenileme)
    if (ensureSessionOnly) {
      const effectiveUserId = targetUserId || user.id;

      // Super admin kontrolü - sadece super admin başka kullanıcının session'ını tetikleyebilir
      if (targetUserId && targetUserId !== user.id) {
        const { data: roleCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .single();

        if (!roleCheck) {
          return new Response(
            JSON.stringify({ success: false, error: 'Bu işlem için Super Admin yetkisi gerekli' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const diaResult = await getDiaSession(supabase, effectiveUserId);
      if (!diaResult.success || !diaResult.session) {
        return new Response(
          JSON.stringify({ success: false, error: diaResult.error || 'DIA bağlantısı kurulamadı' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // NOT: sessionId hassas bilgi - client'a dönmüyoruz
      return new Response(
        JSON.stringify({
          success: true,
          diaConfigured: true,
          hasSession: true,
          sunucuAdi: diaResult.session.sunucuAdi,
          firmaKodu: diaResult.session.firmaKodu,
          donemKodu: diaResult.session.donemKodu,
          expiresAt: diaResult.session.expiresAt,
          effectiveUserId: diaResult.effectiveUserId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // checkConnectionOnly modu - sadece DIA yapılandırmasını kontrol et, veri çekme
    if (checkConnectionOnly) {
      console.log('[checkConnectionOnly] Checking DIA configuration for user:', targetUserId || user.id);
      
      const effectiveUserId = targetUserId || user.id;
      
      // Super admin kontrolü - sadece super admin başka kullanıcının bilgisine erişebilir
      if (targetUserId && targetUserId !== user.id) {
        const { data: roleCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .single();
        
        if (!roleCheck) {
          return new Response(
            JSON.stringify({ success: false, diaConfigured: false, error: "Super Admin yetkisi gerekli" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Profil bilgilerini kontrol et
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('dia_sunucu_adi, firma_kodu, donem_kodu, dia_session_id, dia_session_expires')
        .eq('user_id', effectiveUserId)
        .single();
      
      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ success: true, diaConfigured: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const isDiaConfigured = !!(profile.dia_sunucu_adi && profile.firma_kodu);
      const hasSession = !!(profile.dia_session_id && 
        profile.dia_session_expires && 
        new Date(profile.dia_session_expires) > new Date());
      
      console.log('[checkConnectionOnly] DIA configured:', isDiaConfigured, 'Has valid session:', hasSession);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          diaConfigured: isDiaConfigured,
          hasSession,
          sunucuAdi: profile.dia_sunucu_adi,
          firmaKodu: profile.firma_kodu,
          donemKodu: profile.donem_kodu
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // returnAllData/returnAllSampleData istenip limit verilmezse,
    // büyük liste servisleri DIA tarafında CancelledError ile iptal olabiliyor.
    // Artık limit sınırlaması tamamen kaldırıldı - DIA'nın döndürdüğü tüm veri çekilir.
    // NOT: Çok büyük veri setlerinde timeout olabilir - bu durumda kullanıcı limit belirlemeli.
    
    // Bazı servisler çok ağır veri döndürüyor (nested diziler vb.)
    // Bu servisler için hala dikkatli olunmalı ama zorunlu limit yok
    const HEAVY_DATA_METHODS = [
      'carikart_vade_bakiye_listele', // Her kayıtta __borchareketler dizisi var
      'carikart_hareket_listele',      // Hareket detayları
      'fatura_listele',               // Fatura kalemleri içerebilir
    ];
    
    const isHeavyMethod = HEAVY_DATA_METHODS.includes(method || '');
    
    const wantsAllData = returnAllData || returnAllSampleData;
    const hasValidLimit = typeof limit === 'number' && limit > 0;
    // Kullanıcı limit verdiyse onu kullan, limit yoksa undefined = limitsiz
    const effectiveLimit = hasValidLimit ? limit : undefined;
    
    // Hedef kullanıcı ID'sini belirle - impersonation varsa targetUserId, yoksa authenticated user
    const effectiveUserId = targetUserId || user.id;
    
    // Super admin kontrolü - sadece super admin başka kullanıcının verisine erişebilir
    if (targetUserId && targetUserId !== user.id) {
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .single();
      
      if (!roleCheck) {
        return new Response(
          JSON.stringify({ success: false, error: "Bu işlem için Super Admin yetkisi gerekli" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[Impersonation] Super admin ${user.id} accessing data for user ${targetUserId}`);
    }
    
    // DIA uyumlu operatör dönüşümü
    // DIA kuralları:
    // - Operatör gönderilmezse "içeren" gibi çalışır
    // - "!" operatörü "içermeyen" anlamına gelir
    // - Desteklenen operatörler: =, !=, !, >, <, >=, <=, IN, NOT IN
    function mapFiltersToDiaFormat(inputFilters: any): any[] {
      if (!inputFilters) return [];
      
      // String ise parse et
      let filtersArray = inputFilters;
      if (typeof inputFilters === 'string') {
        try {
          filtersArray = JSON.parse(inputFilters);
        } catch {
          return [];
        }
      }
      
      // Array değilse boş döndür
      if (!Array.isArray(filtersArray)) {
        // Object ise legacy format olabilir, array'e çevir
        if (typeof filtersArray === 'object' && filtersArray !== null) {
          filtersArray = Object.entries(filtersArray).map(([field, value]) => ({
            field,
            operator: '=',
            value: String(value)
          }));
        } else {
          return [];
        }
      }
      
      // Her filtreyi DIA formatına dönüştür
      return filtersArray.map((filter: any) => {
        const diaFilter: Record<string, any> = {
          field: filter.field,
          value: filter.value
        };
        
        // Operatör mapping
        const op = filter.operator;
        if (!op || op === 'contains') {
          // Operatör yok veya "contains" ise DIA'ya operator gönderme (default: içeren)
          // diaFilter.operator = undefined; (alanı ekleme)
        } else if (op === 'not_contains') {
          // İçermeyen için DIA "!" kullanıyor
          diaFilter.operator = '!';
        } else {
          // Diğer operatörler aynen gönderilir: =, !=, !, >, <, >=, <=, IN, NOT IN
          diaFilter.operator = op;
        }
        
        return diaFilter;
      });
    }

    // DIA session al - impersonation varsa hedef kullanıcının session'ını al
    const diaResult = await getDiaSession(supabase, effectiveUserId);
    
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
      
      // Bazı DIA servisleri özel parametreler gerektirir
      // Bu parametreler olmadan nested diziler (örn: __borchareketler) dönmez
      const methodParams: Record<string, any> = {};
      
      // scf_carikart_vade_bakiye_listele için detaylı veri gerekli
      if (method === 'carikart_vade_bakiye_listele') {
        methodParams.params = {
          detaygoster: "True",  // __borchareketler dizisini döndürmek için ZORUNLU
          irsaliyeleriDahilEt: "True",
          tarihreferans: new Date().toISOString().split('T')[0], // Bugünün tarihi
        };
        console.log(`[DIA Params] Added required params for ${method}:`, methodParams.params);
      }
      
      payload = {
        [methodKey]: {
          session_id: sessionId,
          firma_kodu: firmaKodu,
          donem_kodu: donemKodu,
          // Limit sadece belirtilmişse gönder, yoksa (returnAll* isteklerinde) güvenli limit uygula
          ...(effectiveLimit !== undefined && { limit: effectiveLimit }),
          offset: 0,
          ...methodParams, // Metod-specific parametreler
        }
      };

      // Filtreleri DIA formatına dönüştür ve ekle
      const diaFilters = mapFiltersToDiaFormat(filters);
      if (diaFilters.length > 0) {
        payload[methodKey].filters = diaFilters;
        console.log(`[DIA Filter] Applied ${diaFilters.length} filters:`, JSON.stringify(diaFilters.slice(0, 2)));
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

    // DIA API çağrısını retry mekanizmasıyla yap
    // CRITICAL: effectiveUserId kullanılmalı - impersonation durumunda hedef kullanıcının ID'si
    const targetUserIdForRetry = effectiveUserId;
    
    async function makeDiaRequest(currentPayload: Record<string, any>, currentUrl: string, retryCount = 0): Promise<any> {
      const response = await fetch(currentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload),
      });

      if (!response.ok) {
        throw new Error(`DIA API hatası: ${response.status}`);
      }

      const result = await response.json();

      // INVALID_SESSION kontrolü - retry mekanizması
      // DIA çeşitli formatlarda INVALID_SESSION dönebilir:
      // - result.msg: "INVALID_SESSION" (string)
      // - result.code: "401" veya "403" veya "500" with SESSION in msg
      // - result.error içinde SESSION kelimesi
      const resultString = JSON.stringify(result).toUpperCase();
      const isInvalidSession = 
        resultString.includes('INVALID_SESSION') ||
        resultString.includes('SESSION_EXPIRED') ||
        resultString.includes('SESSION_INVALID') ||
        (result.code && (result.code === "401" || result.code === "403") && resultString.includes('SESSION')) ||
        (typeof result.msg === 'string' && (
          result.msg.toUpperCase().includes('INVALID') || 
          result.msg.toUpperCase().includes('SESSION') ||
          result.msg.toUpperCase().includes('OTURUM')
        ));

      if (isInvalidSession && retryCount === 0) {
        console.log(`INVALID_SESSION detected for user ${targetUserIdForRetry}, response: ${resultString.substring(0, 200)}`);
        console.log(`Clearing session and retrying...`);
        console.log(`INVALID_SESSION detected for user ${targetUserIdForRetry}, clearing session and retrying...`);
        
        // Session'ı temizle - hedef kullanıcı için (impersonation durumunda)
        await supabase
          .from("profiles")
          .update({
            dia_session_id: null,
            dia_session_expires: null,
          })
          .eq("user_id", targetUserIdForRetry);

        // Yeni session al - hedef kullanıcı için
        const newDiaResult = await getDiaSession(supabase, targetUserIdForRetry);
        
        if (!newDiaResult.success || !newDiaResult.session) {
          throw new Error(newDiaResult.error || "DIA yeniden bağlantı başarısız");
        }

        // Payload'daki session_id'yi güncelle
        const newSessionId = newDiaResult.session.sessionId;
        const methodKey = Object.keys(currentPayload)[0];
        
        if (currentPayload[methodKey]?.session_id) {
          currentPayload[methodKey].session_id = newSessionId;
          console.log(`[RETRY] Updated payload session_id to: ${newSessionId.substring(0, 8)}...`);
        } else {
          console.log(`[RETRY] WARNING: Could not find session_id in payload for method ${methodKey}`);
          console.log(`[RETRY] Payload keys: ${JSON.stringify(Object.keys(currentPayload[methodKey] || {}))}`);
        }

        console.log(`[RETRY] Retrying DIA API call with new session for user ${targetUserIdForRetry}`);
        const retryResult = await makeDiaRequest(currentPayload, currentUrl, retryCount + 1);
        console.log(`[RETRY] Retry result code: ${retryResult?.code}, has data: ${!!retryResult?.result}`);
        return retryResult;
      }

      return result;
    }

    // ============= DÖNEM LOOP MEKANİZMASI =============
    // periodConfig varsa ve fetchHistorical açıksa, birden fazla dönem sorgula
    let allData: any[] = [];
    let fetchedPeriods: number[] = [];
    
    if (!rawMode && periodConfig?.enabled && periodConfig?.fetchHistorical && periodConfig?.historicalCount > 0) {
      const currentPeriod = periodConfig.currentPeriod || donemKodu;
      const startPeriod = Math.max(1, currentPeriod - periodConfig.historicalCount + 1);
      
      console.log(`[Period Loop] Fetching periods ${startPeriod} to ${currentPeriod} (${periodConfig.historicalCount} periods)`);
      
      for (let period = startPeriod; period <= currentPeriod; period++) {
        // Payload'ın kopyasını oluştur ve donem_kodu'yu güncelle
        const periodPayload = JSON.parse(JSON.stringify(payload));
        const methodKey = Object.keys(periodPayload)[0];
        periodPayload[methodKey].donem_kodu = period;
        
        console.log(`[Period Loop] Fetching period ${period}...`);
        
        try {
          const periodResult = await makeDiaRequest(periodPayload, diaUrl);
          
          // Hata kontrolü
          if (periodResult.code && periodResult.code !== "200") {
            console.log(`[Period Loop] Period ${period} error: ${periodResult.msg}`);
            continue; // Bu dönem için hata varsa sonraki döneme geç
          }
          
          // Veriyi çıkar
          let periodData: any[] = [];
          if (periodResult.result) {
            if (Array.isArray(periodResult.result)) {
              periodData = periodResult.result;
            } else if (typeof periodResult.result === 'object') {
              const firstKey = Object.keys(periodResult.result)[0];
              if (firstKey && Array.isArray(periodResult.result[firstKey])) {
                periodData = periodResult.result[firstKey];
              }
            }
          } else if (periodResult.msg && Array.isArray(periodResult.msg)) {
            periodData = periodResult.msg;
          }
          
          // Her kayda dönem bilgisini ekle
          const taggedData = periodData.map((item: any) => ({
            ...item,
            _fetched_period: period,
          }));
          
          allData = [...allData, ...taggedData];
          fetchedPeriods.push(period);
          console.log(`[Period Loop] Period ${period}: ${periodData.length} records`);
        } catch (periodError) {
          console.log(`[Period Loop] Period ${period} fetch error:`, periodError);
          continue;
        }
      }
      
      console.log(`[Period Loop] Total: ${allData.length} records from ${fetchedPeriods.length} periods`);
      
      // Dönem loop sonuçlarını döndür
      const { fields, fieldTypes, fieldStats } = allData.length > 0 
        ? extractFieldsAndTypes(allData) 
        : { fields: [], fieldTypes: {}, fieldStats: {} };
      
      const sampleData = (returnAllData || returnAllSampleData) ? allData : allData.slice(0, 10);
      
      return new Response(
        JSON.stringify({
          success: true,
          recordCount: allData.length,
          sampleFields: fields,
          fieldTypes,
          fieldStats,
          sampleData,
          fullDataAvailable: returnAllData,
          fetchedPeriods,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Normal tek dönem sorgusu
    const result = await makeDiaRequest(payload, diaUrl);

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
      // CREDITS_ERROR özel işleme - kullanıcı dostu mesaj
      let errorMessage = result.msg || `DIA hata kodu: ${result.code}`;
      if (errorMessage.includes('CREDITS') || errorMessage.includes('CREDIT')) {
        errorMessage = 'DIA servis limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.';
        console.log(`[DIA CREDITS_ERROR] User ${effectiveUserId}: ${result.msg}`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          // Önemli: Widget'ın boş veriyle çalışabilmesi için sampleData da dön
          sampleData: [],
          recordCount: 0,
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

    // returnAllData veya returnAllSampleData: true ise tüm veriyi, değilse sadece 10 örnek döndür
    const sampleData = (returnAllData || returnAllSampleData) ? data : data.slice(0, 10);

    const responseData: TestApiResponse = {
      success: true,
      recordCount: data.length,
      sampleFields: fields,
      fieldTypes,
      fieldStats,
      sampleData,
      // Tüm veri istenmediyse, hesaplamalar için fieldStats kullan
      fullDataAvailable: returnAllData,
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
