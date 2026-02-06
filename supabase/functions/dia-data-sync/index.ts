import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession, ensureValidSession, invalidateSession } from "../_shared/diaAutoLogin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE_SIZE = 200, MAX_RECORDS = 50000;
const CLEANUP_TIMEOUT_MS = 15 * 60 * 1000; // 15 dakika
const NON_DIA = ['takvim', '_system_calendar', 'system_calendar'];

// Chunk sabitleri - 502 hatası için optimize edildi
const DEFAULT_CHUNK_SIZE = 500;  // Her chunk'ta max kayıt (eskisi 1000)
const MAX_CHUNK_SIZE = 1000;     // Güvenlik limiti
const UPSERT_BATCH_SIZE = 200;   // Batch upsert kayıt sayısı

function parse(r: any, m: string): any[] {
  if (r.result) {
    if (Array.isArray(r.result)) return r.result;
    const k = Object.keys(r.result)[0];
    if (k && Array.isArray(r.result[k])) return r.result[k];
  }
  return r.msg && Array.isArray(r.msg) ? r.msg : r[m] && Array.isArray(r[m]) ? r[m] : [];
}

async function cleanup(sb: any) {
  // 15 dakikadan uzun süren "running" kayıtları temizle
  await sb.from('sync_history').update({ status: 'failed', error: 'Timeout - işlem 15 dakikayı aştı', completed_at: new Date().toISOString() })
    .eq('status', 'running').lt('started_at', new Date(Date.now() - CLEANUP_TIMEOUT_MS).toISOString());
}

// Kayıttan benzersiz anahtar çıkarma - DIA metodlarına göre genişletildi
function extractKey(r: any, idx: number): number | null {
  // Öncelikli anahtarlar
  if (r._key) return Number(r._key);
  if (r.id) return Number(r.id);
  
  // Cari kart için alternatif anahtarlar
  if (r.carikart_key) return Number(r.carikart_key);
  if (r.cari_key) return Number(r.cari_key);
  if (r._key_scf_carikart && typeof r._key_scf_carikart === 'object' && r._key_scf_carikart._key) {
    return Number(r._key_scf_carikart._key);
  }
  
  // Stok için alternatif anahtarlar
  if (r.stokkart_key) return Number(r.stokkart_key);
  if (r.stok_key) return Number(r.stok_key);
  
  // Fatura için alternatif anahtarlar
  if (r.fatura_key) return Number(r.fatura_key);
  
  // Hash tabanlı anahtar oluştur (carikodu, stokkodu vb. varsa)
  if (r.carikodu) {
    // carikodu + vade bilgilerinden benzersiz hash oluştur
    const hashStr = `${r.carikodu}_${r.vade_tarihi || ''}_${r.bakiye || ''}_${idx}`;
    const hashed = Math.abs(hashString(hashStr));
    return hashed % 9223372036854775807; // INT64 max value'ye kısıtla
  }
  if (r.stokkodu) {
    const hashStr = `${r.stokkodu}_${r.depo || ''}_${idx}`;
    const hashed = Math.abs(hashString(hashStr));
    return hashed % 9223372036854775807;
  }
  
  // Son çare: index bazlı benzersiz numara
  // Timestamp'i kısıtla ve idx ile combine et (overflow risk yok)
  const baseKey = (Math.floor(Date.now() / 1000000) % 1000000000) * 10000 + (idx % 10000);
  return Math.abs(baseKey);
}

// Basit hash fonksiyonu
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer'a dönüştür
  }
  return hash;
}

// Batch upsert - bellek ve DB optimizasyonu için
async function writeBatch(sb: any, sun: string, fk: string, dk: number, slug: string, recs: any[]) {
  let written = 0;
  
  for (let i = 0; i < recs.length; i += UPSERT_BATCH_SIZE) {
    const batch = recs.slice(i, i + UPSERT_BATCH_SIZE)
      .map((r, batchIdx) => {
        const k = extractKey(r, i + batchIdx);
        if (!k) {
          console.log(`[writeBatch] No key found for record:`, JSON.stringify(r).substring(0, 200));
          return null;
        }
        return { 
          sunucu_adi: sun, 
          firma_kodu: fk, 
          donem_kodu: dk, 
          data_source_slug: slug, 
          dia_key: k, 
          data: r, 
          is_deleted: false, 
          updated_at: new Date().toISOString() 
        };
      })
      .filter(Boolean);
    
    if (batch.length === 0) continue;
    
    const { error } = await sb
      .from('company_data_cache')
      .upsert(batch, { 
        onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key' 
      });
    
    if (error) {
      console.log(`[writeBatch] Upsert error:`, error.message);
    } else {
      written += batch.length;
    }
  }
  
  return written;
}

// Eski write fonksiyonu - syncOne için (keys set kullanır)
async function write(sb: any, sun: string, fk: string, dk: number, slug: string, recs: any[], keys: Set<number>) {
  let written = 0;
  
  for (let i = 0; i < recs.length; i += UPSERT_BATCH_SIZE) {
    const batch = recs.slice(i, i + UPSERT_BATCH_SIZE)
      .map((r, batchIdx) => {
        const k = extractKey(r, i + batchIdx);
        if (!k) {
          console.log(`[write] No key found for record:`, JSON.stringify(r).substring(0, 200));
          return null;
        }
        keys.add(k);
        return { 
          sunucu_adi: sun, 
          firma_kodu: fk, 
          donem_kodu: dk, 
          data_source_slug: slug, 
          dia_key: k, 
          data: r, 
          is_deleted: false, 
          updated_at: new Date().toISOString() 
        };
      })
      .filter(Boolean);
    
    if (batch.length === 0) continue;
    
    const { error } = await sb
      .from('company_data_cache')
      .upsert(batch, { 
        onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key' 
      });
    
    if (error) {
      console.log(`[write] Upsert error:`, error.message);
    } else {
      written += batch.length;
    }
  }
  
  return written;
}

async function fetchPage(sb: any, uid: string, sess: any, mod: string, met: string, dk: number, off: number) {
  const sr = await ensureValidSession(sb, uid, sess);
  if (!sr.success || !sr.session) return { ok: false, data: [], err: sr.error || "Session fail" };
  const s = sr.session, url = `https://${s.sunucuAdi}.ws.dia.com.tr/api/v3/${mod}/json`;
  const fm = met.startsWith(`${mod}_`) ? met : `${mod}_${met}`;
  const pl = { [fm]: { session_id: s.sessionId, firma_kodu: s.firmaKodu, donem_kodu: dk, limit: PAGE_SIZE, offset: off } };
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) });
    if (!res.ok) return { ok: false, data: [], err: `HTTP ${res.status}` };
    const r = await res.json();
    if (r.msg === 'INVALID_SESSION' || r.code === '401') {
      await invalidateSession(sb, uid);
      const ns = await getDiaSession(sb, uid);
      if (!ns.success || !ns.session) return { ok: false, data: [], err: "Session refresh fail" };
      pl[fm].session_id = ns.session.sessionId;
      const rr = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) });
      if (!rr.ok) return { ok: false, data: [], err: `HTTP ${rr.status} retry` };
      const rj = await rr.json();
      if (rj.code && rj.code !== "200") return { ok: false, data: [], err: rj.msg || `Error ${rj.code}` };
      return { ok: true, data: parse(rj, fm), sess: ns.session };
    }
    if (r.code && r.code !== "200") return { ok: false, data: [], err: r.msg || `Error ${r.code}` };
    if (r.error || r.hata) return { ok: false, data: [], err: r.error?.message || r.hata?.aciklama || "API error" };
    return { ok: true, data: parse(r, fm), sess: s };
  } catch (e) { return { ok: false, data: [], err: e instanceof Error ? e.message : "Fetch error" }; }
}

// Session kontrolsüz sayfa çekme - streamChunk için optimize edildi
async function fetchPageSimple(sess: any, mod: string, met: string, dk: number, off: number) {
  const url = `https://${sess.sunucuAdi}.ws.dia.com.tr/api/v3/${mod}/json`;
  const fm = met.startsWith(`${mod}_`) ? met : `${mod}_${met}`;
  const pl = { [fm]: { 
    session_id: sess.sessionId, 
    firma_kodu: sess.firmaKodu, 
    donem_kodu: dk, 
    limit: PAGE_SIZE, 
    offset: off 
  }};
  
  try {
    const res = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(pl) 
    });
    
    if (!res.ok) return { ok: false, data: [], err: `HTTP ${res.status}` };
    const r = await res.json();
    
    if (r.msg === 'INVALID_SESSION' || r.code === '401') {
      return { ok: false, data: [], err: 'INVALID_SESSION', needsRefresh: true };
    }
    
    if (r.code && r.code !== "200") return { ok: false, data: [], err: r.msg || `Error ${r.code}` };
    if (r.error || r.hata) return { ok: false, data: [], err: r.error?.message || r.hata?.aciklama || "API error" };
    
    return { ok: true, data: parse(r, fm) };
  } catch (e) { 
    return { ok: false, data: [], err: e instanceof Error ? e.message : "Fetch error" }; 
  }
}

// Chunk-bazlı streaming: Session cache + batch upsert ile optimize edildi
async function streamChunk(
  sb: any, uid: string, sess: any, mod: string, met: string, dk: number, 
  sun: string, fk: string, slug: string, startOffset: number, chunkSize: number
) {
  // Chunk başında bir kez session doğrula
  const sr = await ensureValidSession(sb, uid, sess);
  if (!sr.success || !sr.session) {
    console.log(`[syncChunk] Session validation failed`);
    return { ok: false, fetched: 0, written: 0, hasMore: false, nextOffset: startOffset, err: sr.error || "Session fail" };
  }
  
  let validSession = sr.session;
  let off = startOffset;
  let fetched = 0;
  let written = 0;
  
  console.log(`[syncChunk] Starting: ${slug}, offset=${startOffset}, chunkSize=${chunkSize}`);
  
  while (fetched < chunkSize) {
    const r = await fetchPageSimple(validSession, mod, met, dk, off);
    
    // Session hatası - yenile ve tekrar dene
    if (r.needsRefresh) {
      console.log(`[syncChunk] Session expired, refreshing...`);
      await invalidateSession(sb, uid);
      const ns = await getDiaSession(sb, uid);
      if (!ns.success || !ns.session) {
        return { ok: false, fetched, written, hasMore: false, nextOffset: off, err: "Session refresh fail" };
      }
      validSession = ns.session;
      continue; // Aynı sayfayı tekrar dene
    }
    
    if (!r.ok) {
      // İlk sayfada hata varsa başarısız
      if (fetched === 0) {
        console.log(`[syncChunk] First page error: ${r.err}`);
        return { ok: false, fetched, written, hasMore: false, nextOffset: off, err: r.err };
      }
      // Sonraki sayfalarda hata = veri bitti
      console.log(`[syncChunk] Page error after ${fetched} records: ${r.err}`);
      break;
    }
    
    // Veri geldiyse hemen yaz (batch upsert ile)
    if (r.data.length > 0) {
      written += await writeBatch(sb, sun, fk, dk, slug, r.data);
      fetched += r.data.length;
      console.log(`[syncChunk] Page written: ${r.data.length} records, total=${fetched}`);
    }
    
    // Sayfa dolmadıysa = veri bitti
    if (r.data.length < PAGE_SIZE) {
      console.log(`[syncChunk] Data exhausted (${r.data.length} < ${PAGE_SIZE})`);
      return { ok: true, fetched, written, hasMore: false, nextOffset: off + r.data.length };
    }
    
    off += PAGE_SIZE;
    
    // ChunkSize'a ulaştık mı?
    if (fetched >= chunkSize) {
      console.log(`[syncChunk] Chunk complete: ${fetched} records`);
      return { ok: true, fetched, written, hasMore: true, nextOffset: off };
    }
  }
  
  // Döngü tamamlandı (hata veya veri bitti)
  return { ok: true, fetched, written, hasMore: false, nextOffset: off };
}

// Eski stream fonksiyonu (tüm veriyi çeker - syncSingleSource için)
async function stream(sb: any, uid: string, sess: any, mod: string, met: string, dk: number, sun: string, fk: string, slug: string) {
  let off = 0, more = true, fetched = 0, written = 0, pg = 0, cs = sess;
  const keys = new Set<number>();
  while (more && fetched < MAX_RECORDS) {
    const r = await fetchPage(sb, uid, cs, mod, met, dk, off);
    if (!r.ok) { if (pg === 0) return { ok: false, fetched, written, err: r.err }; break; }
    if (r.sess) cs = r.sess;
    if (r.data.length > 0) written += await write(sb, sun, fk, dk, slug, r.data, keys);
    fetched += r.data.length; pg++;
    more = r.data.length >= PAGE_SIZE; off += PAGE_SIZE;
  }
  return { ok: true, fetched, written };
}

async function syncOne(sb: any, uid: string, sess: any, src: any, pn: number, sun: string, fk: string, trig: string) {
  const { data: h } = await sb.from('sync_history').insert({ sunucu_adi: sun, firma_kodu: fk, donem_kodu: pn, data_source_slug: src.slug, sync_type: 'single', triggered_by: trig, status: 'running' }).select().single();
  try {
    const r = await stream(sb, uid, sess, src.module, src.method, pn, sun, fk, src.slug);
    if (!r.ok) { await sb.from('sync_history').update({ status: 'failed', error: r.err, completed_at: new Date().toISOString() }).eq('id', h?.id); return { success: false, slug: src.slug, pn, error: r.err }; }
    await sb.from('sync_history').update({ status: 'completed', records_fetched: r.fetched, records_inserted: r.written, completed_at: new Date().toISOString() }).eq('id', h?.id);
    await sb.from('period_sync_status').upsert({ sunucu_adi: sun, firma_kodu: fk, donem_kodu: pn, data_source_slug: src.slug, last_incremental_sync: new Date().toISOString(), total_records: r.fetched, updated_at: new Date().toISOString() }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
    
    // Cache'deki gerçek kayıt sayısını çek ve data_sources.last_record_count'u güncelle
    const { data: countData } = await sb.rpc('get_cache_record_counts', { p_sunucu_adi: sun, p_firma_kodu: fk });
    const totalForSlug = countData?.find((c: any) => c.data_source_slug === src.slug)?.record_count || r.written;
    await sb.from('data_sources').update({ last_record_count: totalForSlug, last_fetched_at: new Date().toISOString() }).eq('slug', src.slug);
    console.log(`[syncOne] Updated data_sources.last_record_count for ${src.slug}: ${totalForSlug}`);
    
    return { success: true, slug: src.slug, pn, fetched: r.fetched, written: r.written };
  } catch (e) { const em = e instanceof Error ? e.message : "Error"; if (h?.id) await sb.from('sync_history').update({ status: 'failed', error: em, completed_at: new Date().toISOString() }).eq('id', h.id); return { success: false, slug: src.slug, pn, error: em }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ success: false, error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await cleanup(sb);
    const { data: { user }, error: ue } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (ue || !user) return new Response(JSON.stringify({ success: false, error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const { action, dataSourceSlug, periodNo, targetUserId, syncAllPeriods, offset, chunkSize } = body;
    let euid = user.id;
    if ((action === 'syncAllForUser' || action === 'syncSingleSource' || action === 'syncChunk') && targetUserId) {
      const { data: rc } = await sb.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').single();
      if (!rc) return new Response(JSON.stringify({ success: false, error: "Super admin required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      euid = targetUserId;
    }
    const dr = await getDiaSession(sb, euid);
    if (!dr.success || !dr.session) return new Response(JSON.stringify({ success: false, error: dr.error || "DIA connection failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { session } = dr, sun = session.sunucuAdi, fk = String(session.firmaKodu);
    
    // ===== YENI: syncChunk action =====
    if (action === 'syncChunk') {
      if (!dataSourceSlug || periodNo === undefined) {
        return new Response(JSON.stringify({ success: false, error: "dataSourceSlug and periodNo required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const { data: src } = await sb.from('data_sources').select('slug, module, method, name').eq('slug', dataSourceSlug).eq('is_active', true).single();
      if (!src) {
        return new Response(JSON.stringify({ success: false, error: `Source not found: ${dataSourceSlug}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const startOffset = offset || 0;
      const requestedChunkSize = Math.min(chunkSize || DEFAULT_CHUNK_SIZE, MAX_CHUNK_SIZE);
      
      console.log(`[syncChunk] Processing: ${src.slug}, period=${periodNo}, offset=${startOffset}, chunkSize=${requestedChunkSize}`);
      
      const result = await streamChunk(
        sb, euid, session, src.module, src.method, periodNo, 
        sun, fk, src.slug, startOffset, requestedChunkSize
      );
      
      if (!result.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: result.err,
          written: result.written,
          hasMore: false,
          nextOffset: result.nextOffset
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // period_sync_status'ı güncelle (incremental)
      if (result.written > 0) {
        await sb.from('period_sync_status').upsert({ 
          sunucu_adi: sun, 
          firma_kodu: fk, 
          donem_kodu: periodNo, 
          data_source_slug: src.slug, 
          last_incremental_sync: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
      }
      
      console.log(`[syncChunk] Complete: written=${result.written}, hasMore=${result.hasMore}, nextOffset=${result.nextOffset}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        written: result.written,
        fetched: result.fetched,
        hasMore: result.hasMore,
        nextOffset: result.nextOffset
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    if (action === 'syncSingleSource') {
      if (!dataSourceSlug || periodNo === undefined) return new Response(JSON.stringify({ success: false, error: "dataSourceSlug and periodNo required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: src } = await sb.from('data_sources').select('slug, module, method, name').eq('slug', dataSourceSlug).eq('is_active', true).single();
      if (!src) return new Response(JSON.stringify({ success: false, error: `Source not found: ${dataSourceSlug}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(await syncOne(sb, euid, session, src, periodNo, sun, fk, user.id)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const { data: prof } = await sb.from('profiles').select('donem_kodu').eq('user_id', euid).single();
    const curDon = parseInt(prof?.donem_kodu) || session.donemKodu;
    
    if (action === 'getSyncStatus') {
      const { data: sh } = await sb.from('sync_history').select('*').eq('sunucu_adi', sun).eq('firma_kodu', fk).order('started_at', { ascending: false }).limit(10);
      const { data: ps } = await sb.from('period_sync_status').select('*').eq('sunucu_adi', sun).eq('firma_kodu', fk);
      const { data: rc } = await sb.from('company_data_cache').select('data_source_slug').eq('sunucu_adi', sun).eq('firma_kodu', fk).eq('is_deleted', false);
      const cnt: Record<string,number> = {}; (rc||[]).forEach((r:any) => { cnt[r.data_source_slug] = (cnt[r.data_source_slug]||0)+1; });
      return new Response(JSON.stringify({ success: true, syncHistory: sh||[], periodStatus: ps||[], recordCounts: cnt, currentPeriod: curDon }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    if (action === 'lockPeriod' && periodNo) {
      await sb.from('period_sync_status').upsert({ sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo, data_source_slug: dataSourceSlug||'all', is_locked: true, updated_at: new Date().toISOString() }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
      return new Response(JSON.stringify({ success: true, message: `Period ${periodNo} locked` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const { data: ds } = await sb.from('data_sources').select('slug, module, method, name, is_period_independent, is_non_dia').eq('is_active', true);
    if (!ds?.length) return new Response(JSON.stringify({ success: false, error: "No active data sources" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // DIA dışı kaynakları filtrele (is_non_dia=true olanlar senkronize edilmez)
    const dias = ds.filter(d => !NON_DIA.includes(d.slug) && !d.slug.startsWith('_system') && !d.is_non_dia);
    const srcs = (action === 'syncAll' || action === 'syncAllForUser') ? dias : dias.filter(d => d.slug === dataSourceSlug);
    if (!srcs.length) return new Response(JSON.stringify({ success: false, error: `Source not found or non-DIA: ${dataSourceSlug}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
    let periods = [curDon];
    if (syncAllPeriods ?? true) {
      let { data: fp } = await sb.from('firma_periods').select('period_no').eq('sunucu_adi', sun).eq('firma_kodu', fk).order('period_no', { ascending: false });
      if (!fp?.length) {
        try {
          const pr = await fetch(`https://${sun}.ws.dia.com.tr/api/v3/sis/json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sis_yetkili_firma_donem_sube_depo: { session_id: session.sessionId } }) });
          const pd = await pr.json();
          if (pd?.code === "200" && Array.isArray(pd?.result)) {
            const tf = pd.result.find((f:any) => String(f.firmakodu) === fk);
            if (tf?.donemler?.length) { for (const d of tf.donemler) await sb.from('firma_periods').upsert({ sunucu_adi: sun, firma_kodu: fk, period_no: d.donemkodu, period_name: d.gorunendonemkodu||`D${d.donemkodu}`, start_date: d.baslangictarihi, end_date: d.bitistarihi, is_current: d.ontanimli==='t', fetched_at: new Date().toISOString() }, { onConflict: 'sunucu_adi,firma_kodu,period_no' }); }
            const { data: rfp } = await sb.from('firma_periods').select('period_no').eq('sunucu_adi', sun).eq('firma_kodu', fk).order('period_no', { ascending: false });
            fp = rfp;
          }
        } catch {}
      }
      if (fp?.length) periods = fp.map(p => p.period_no);
    }
    
    const results: any[] = [];
    for (const src of srcs) {
      // Dönem bağımsız kaynaklar sadece aktif dönemde çekilir (bir kez yeterli)
      const srcPeriods = src.is_period_independent ? [curDon] : periods;
      console.log(`[DIA Sync] ${src.slug}: ${src.is_period_independent ? 'period-independent (1 period)' : `period-dependent (${srcPeriods.length} periods)`}`);
      for (const pn of srcPeriods) results.push(await syncOne(sb, euid, session, src, pn, sun, fk, user.id));
    }
    return new Response(JSON.stringify({ success: results.some(r=>r.success), results, totalSynced: results.filter(r=>r.success).length, totalFailed: results.filter(r=>!r.success).length, periodsProcessed: periods.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
