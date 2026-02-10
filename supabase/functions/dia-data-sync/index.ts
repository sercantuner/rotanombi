import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession, ensureValidSession, invalidateSession, performAutoLogin } from "../_shared/diaAutoLogin.ts";
import { getTurkeyToday, getTurkeyNow } from "../_shared/turkeyTime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE_SIZE = 200, MAX_RECORDS = 50000;
const CLEANUP_TIMEOUT_MS = 15 * 60 * 1000;
const NON_DIA = ['takvim', '_system_calendar', 'system_calendar'];

const DEFAULT_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 1000;
const UPSERT_BATCH_SIZE = 200;

function parse(r: any, m: string): any[] {
  if (r.result) {
    if (Array.isArray(r.result)) return r.result;
    const k = Object.keys(r.result)[0];
    if (k && Array.isArray(r.result[k])) return r.result[k];
  }
  return r.msg && Array.isArray(r.msg) ? r.msg : r[m] && Array.isArray(r[m]) ? r[m] : [];
}

async function cleanup(sb: any) {
  await sb.from('sync_history').update({ status: 'failed', error: 'Timeout - işlem 15 dakikayı aştı', completed_at: new Date().toISOString() })
    .eq('status', 'running').lt('started_at', new Date(Date.now() - CLEANUP_TIMEOUT_MS).toISOString());
}

function extractKey(r: any, idx: number): number | null {
  if (r._key) return Number(r._key);
  if (r.id) return Number(r.id);
  if (r.carikart_key) return Number(r.carikart_key);
  if (r.cari_key) return Number(r.cari_key);
  if (r._key_scf_carikart && typeof r._key_scf_carikart === 'object' && r._key_scf_carikart._key) {
    return Number(r._key_scf_carikart._key);
  }
  if (r.stokkart_key) return Number(r.stokkart_key);
  if (r.stok_key) return Number(r.stok_key);
  if (r.fatura_key) return Number(r.fatura_key);
  if (r.carikodu) {
    const hashStr = `${r.carikodu}_${r.vade_tarihi || ''}_${r.bakiye || ''}_${idx}`;
    const hashed = Math.abs(hashString(hashStr));
    return hashed % 9223372036854775807;
  }
  if (r.stokkodu) {
    const hashStr = `${r.stokkodu}_${r.depo || ''}_${idx}`;
    const hashed = Math.abs(hashString(hashStr));
    return hashed % 9223372036854775807;
  }
  const baseKey = (Math.floor(Date.now() / 1000000) % 1000000000) * 10000 + (idx % 10000);
  return Math.abs(baseKey);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

async function writeBatch(sb: any, sun: string, fk: string, dk: number, slug: string, recs: any[]) {
  let written = 0;
  for (let i = 0; i < recs.length; i += UPSERT_BATCH_SIZE) {
    const batch = recs.slice(i, i + UPSERT_BATCH_SIZE)
      .map((r, batchIdx) => {
        const k = extractKey(r, i + batchIdx);
        if (!k) return null;
        return { sunucu_adi: sun, firma_kodu: fk, donem_kodu: dk, data_source_slug: slug, dia_key: k, data: r, is_deleted: false, updated_at: new Date().toISOString() };
      })
      .filter(Boolean);
    if (batch.length === 0) continue;
    const { error } = await sb.from('company_data_cache').upsert(batch, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key' });
    if (error) console.log(`[writeBatch] Upsert error:`, error.message);
    else written += batch.length;
  }
  return written;
}

async function write(sb: any, sun: string, fk: string, dk: number, slug: string, recs: any[], keys: Set<number>) {
  let written = 0;
  for (let i = 0; i < recs.length; i += UPSERT_BATCH_SIZE) {
    const batch = recs.slice(i, i + UPSERT_BATCH_SIZE)
      .map((r, batchIdx) => {
        const k = extractKey(r, i + batchIdx);
        if (!k) return null;
        keys.add(k);
        return { sunucu_adi: sun, firma_kodu: fk, donem_kodu: dk, data_source_slug: slug, dia_key: k, data: r, is_deleted: false, updated_at: new Date().toISOString() };
      })
      .filter(Boolean);
    if (batch.length === 0) continue;
    const { error } = await sb.from('company_data_cache').upsert(batch, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key' });
    if (error) console.log(`[write] Upsert error:`, error.message);
    else written += batch.length;
  }
  return written;
}

// ===== fetchPage (orijinal - session kontrollü) =====
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

// ===== fetchPageSimple - opsiyonel filters desteği eklendi =====
async function fetchPageSimple(sess: any, mod: string, met: string, dk: number, off: number, filters?: any[]) {
  const url = `https://${sess.sunucuAdi}.ws.dia.com.tr/api/v3/${mod}/json`;
  const fm = met.startsWith(`${mod}_`) ? met : `${mod}_${met}`;
  const pl: any = { [fm]: { 
    session_id: sess.sessionId, 
    firma_kodu: sess.firmaKodu, 
    donem_kodu: dk, 
    limit: PAGE_SIZE, 
    offset: off 
  }};
  
  // Filtre desteği
  if (filters && filters.length > 0) {
    pl[fm].filters = filters;
  }
  
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) });
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

// ===== streamChunk - filters desteği eklendi =====
async function streamChunk(
  sb: any, uid: string, sess: any, mod: string, met: string, dk: number, 
  sun: string, fk: string, slug: string, startOffset: number, chunkSize: number,
  filters?: any[]
) {
  const sr = await ensureValidSession(sb, uid, sess);
  if (!sr.success || !sr.session) {
    return { ok: false, fetched: 0, written: 0, hasMore: false, nextOffset: startOffset, err: sr.error || "Session fail" };
  }
  
  let validSession = sr.session;
  let off = startOffset;
  let fetched = 0;
  let written = 0;
  
  console.log(`[syncChunk] Starting: ${slug}, offset=${startOffset}, chunkSize=${chunkSize}${filters ? `, filters=${JSON.stringify(filters)}` : ''}`);
  
  while (fetched < chunkSize) {
    const r = await fetchPageSimple(validSession, mod, met, dk, off, filters);
    
    if (r.needsRefresh) {
      console.log(`[syncChunk] Session expired, refreshing...`);
      await invalidateSession(sb, uid);
      const ns = await getDiaSession(sb, uid);
      if (!ns.success || !ns.session) {
        return { ok: false, fetched, written, hasMore: false, nextOffset: off, err: "Session refresh fail" };
      }
      validSession = ns.session;
      continue;
    }
    
    if (!r.ok) {
      if (fetched === 0) return { ok: false, fetched, written, hasMore: false, nextOffset: off, err: r.err };
      break;
    }
    
    if (r.data.length > 0) {
      written += await writeBatch(sb, sun, fk, dk, slug, r.data);
      fetched += r.data.length;
    }
    
    if (r.data.length < PAGE_SIZE) {
      return { ok: true, fetched, written, hasMore: false, nextOffset: off + r.data.length };
    }
    
    off += PAGE_SIZE;
    if (fetched >= chunkSize) {
      return { ok: true, fetched, written, hasMore: true, nextOffset: off };
    }
  }
  
  return { ok: true, fetched, written, hasMore: false, nextOffset: off };
}

// ===== stream (eski tam veri çekme) =====
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

// ===== syncOne =====
async function syncOne(sb: any, uid: string, sess: any, src: any, pn: number, sun: string, fk: string, trig: string) {
  const { data: h } = await sb.from('sync_history').insert({ sunucu_adi: sun, firma_kodu: fk, donem_kodu: pn, data_source_slug: src.slug, sync_type: 'single', triggered_by: trig, status: 'running' }).select().single();
  try {
    const r = await stream(sb, uid, sess, src.module, src.method, pn, sun, fk, src.slug);
    if (!r.ok) { await sb.from('sync_history').update({ status: 'failed', error: r.err, completed_at: new Date().toISOString() }).eq('id', h?.id); return { success: false, slug: src.slug, pn, error: r.err }; }
    await sb.from('sync_history').update({ status: 'completed', records_fetched: r.fetched, records_inserted: r.written, completed_at: new Date().toISOString() }).eq('id', h?.id);
    await sb.from('period_sync_status').upsert({ sunucu_adi: sun, firma_kodu: fk, donem_kodu: pn, data_source_slug: src.slug, last_incremental_sync: new Date().toISOString(), total_records: r.fetched, updated_at: new Date().toISOString() }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
    
    const { data: countData } = await sb.rpc('get_cache_record_counts', { p_sunucu_adi: sun, p_firma_kodu: fk });
    const totalForSlug = countData?.find((c: any) => c.data_source_slug === src.slug)?.record_count || r.written;
    await sb.from('data_sources').update({ last_record_count: totalForSlug, last_fetched_at: new Date().toISOString() }).eq('slug', src.slug);
    console.log(`[syncOne] Updated data_sources.last_record_count for ${src.slug}: ${totalForSlug}`);
    
    return { success: true, slug: src.slug, pn, fetched: r.fetched, written: r.written };
  } catch (e) { const em = e instanceof Error ? e.message : "Error"; if (h?.id) await sb.from('sync_history').update({ status: 'failed', error: em, completed_at: new Date().toISOString() }).eq('id', h.id); return { success: false, slug: src.slug, pn, error: em }; }
}

// ===== YENİ: incrementalSync - _cdate/_date filtreli artımlı sync =====
async function incrementalSync(
  sb: any, uid: string, sess: any, src: any, pn: number, sun: string, fk: string, trig: string
) {
  // period_sync_status'tan last_incremental_sync al
  const { data: pss } = await sb.from('period_sync_status')
    .select('last_incremental_sync, is_locked, last_full_sync')
    .eq('sunucu_adi', sun).eq('firma_kodu', fk).eq('donem_kodu', pn).eq('data_source_slug', src.slug)
    .single();

  // Kilitli dönem -> atla
  if (pss?.is_locked) {
    console.log(`[incrementalSync] Period ${pn} is locked for ${src.slug}, skipping`);
    return { success: true, slug: src.slug, pn, fetched: 0, written: 0, skipped: true };
  }

  // Hiç full sync yapılmamışsa -> full sync gerekli (frontend orchestrator bunu yönetir)
  if (!pss?.last_full_sync && !pss?.last_incremental_sync) {
    console.log(`[incrementalSync] No previous sync for ${src.slug} period ${pn}, needs full sync first`);
    return { success: false, slug: src.slug, pn, error: 'NEEDS_FULL_SYNC', needsFullSync: true };
  }

  const lastSync = pss?.last_incremental_sync || pss?.last_full_sync;
  const today = getTurkeyToday();
  
  // Sync history kaydı oluştur
  const { data: h } = await sb.from('sync_history').insert({ 
    sunucu_adi: sun, firma_kodu: fk, donem_kodu: pn, data_source_slug: src.slug, 
    sync_type: 'incremental', triggered_by: trig, status: 'running' 
  }).select().single();

  try {
    // Sorgu 1: _cdate >= bugün (bugün eklenen yeni kayıtlar)
    const cdateFilters = [{ field: "_cdate", operator: ">=", value: today }];
    console.log(`[incrementalSync] ${src.slug} period ${pn}: fetching _cdate >= ${today}`);
    
    const cdateResult = await streamChunk(
      sb, uid, sess, src.module, src.method, pn, sun, fk, src.slug, 0, MAX_RECORDS, cdateFilters
    );

    // Sorgu 2: _date >= last_sync (son sync'ten beri değiştirilen kayıtlar)
    // lastSync tarihini YYYY-MM-DD formatına çevir
    const lastSyncDate = lastSync ? lastSync.split('T')[0] : today;
    const dateFilters = [{ field: "_date", operator: ">=", value: lastSyncDate }];
    console.log(`[incrementalSync] ${src.slug} period ${pn}: fetching _date >= ${lastSyncDate}`);
    
    const dateResult = await streamChunk(
      sb, uid, sess, src.module, src.method, pn, sun, fk, src.slug, 0, MAX_RECORDS, dateFilters
    );

    const totalFetched = (cdateResult.fetched || 0) + (dateResult.fetched || 0);
    const totalWritten = (cdateResult.written || 0) + (dateResult.written || 0);

    console.log(`[incrementalSync] ${src.slug} period ${pn}: total fetched=${totalFetched}, written=${totalWritten}`);

    // Sync history güncelle
    await sb.from('sync_history').update({ 
      status: 'completed', 
      records_fetched: totalFetched, 
      records_inserted: totalWritten, 
      completed_at: new Date().toISOString() 
    }).eq('id', h?.id);

    // period_sync_status güncelle
    await sb.from('period_sync_status').upsert({ 
      sunucu_adi: sun, firma_kodu: fk, donem_kodu: pn, data_source_slug: src.slug, 
      last_incremental_sync: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });

    // Cache kayıt sayısını güncelle
    const { data: countData } = await sb.rpc('get_cache_record_counts', { p_sunucu_adi: sun, p_firma_kodu: fk });
    const totalForSlug = countData?.find((c: any) => c.data_source_slug === src.slug)?.record_count || 0;
    await sb.from('data_sources').update({ last_record_count: totalForSlug, last_fetched_at: new Date().toISOString() }).eq('slug', src.slug);

    return { success: true, slug: src.slug, pn, fetched: totalFetched, written: totalWritten };
  } catch (e) {
    const em = e instanceof Error ? e.message : "Error";
    if (h?.id) await sb.from('sync_history').update({ status: 'failed', error: em, completed_at: new Date().toISOString() }).eq('id', h.id);
    return { success: false, slug: src.slug, pn, error: em };
  }
}

// ===== YENİ: cronSync - Tüm sunucularda artımlı senkronizasyon =====
async function handleCronSync(sb: any, cronSecret: string) {
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return { success: false, error: "Invalid CRON_SECRET" };
  }

  console.log(`[cronSync] Starting nightly sync at ${getTurkeyNow().toISOString()}`);

  // Tüm benzersiz sunucu/firma çiftlerini bul
  const { data: profiles } = await sb.from('profiles')
    .select('user_id, dia_sunucu_adi, firma_kodu')
    .not('dia_sunucu_adi', 'is', null)
    .not('firma_kodu', 'is', null);

  if (!profiles?.length) {
    console.log(`[cronSync] No configured profiles found`);
    return { success: true, message: "No profiles to sync", results: [] };
  }

  // Benzersiz sunucu/firma çiftleri (her çift için bir kullanıcı seç)
  const uniquePairs = new Map<string, string>(); // key: sun:fk, value: user_id
  for (const p of profiles) {
    const key = `${p.dia_sunucu_adi}:${p.firma_kodu}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, p.user_id);
    }
  }

  console.log(`[cronSync] Found ${uniquePairs.size} unique server/company pairs`);

  const allResults: any[] = [];

  for (const [pairKey, userId] of uniquePairs) {
    const [sun, fk] = pairKey.split(':');
    console.log(`[cronSync] Processing ${sun}:${fk} with user ${userId}`);

    try {
      // Session al
      const dr = await getDiaSession(sb, userId);
      if (!dr.success || !dr.session) {
        console.log(`[cronSync] Session failed for ${sun}:${fk}: ${dr.error}`);
        allResults.push({ sun, fk, success: false, error: dr.error });
        continue;
      }

      // Aktif veri kaynaklarını al
      const { data: ds } = await sb.from('data_sources')
        .select('slug, module, method, name, is_period_independent, is_non_dia')
        .eq('is_active', true);
      
      const diaSources = (ds || []).filter((d: any) => !NON_DIA.includes(d.slug) && !d.slug.startsWith('_system') && !d.is_non_dia);
      
      if (diaSources.length === 0) {
        console.log(`[cronSync] No active DIA sources for ${sun}:${fk}`);
        continue;
      }

      // Dönemleri al
      const { data: periods } = await sb.from('firma_periods')
        .select('period_no, is_current')
        .eq('sunucu_adi', sun).eq('firma_kodu', fk)
        .order('period_no', { ascending: false });

      if (!periods?.length) {
        console.log(`[cronSync] No periods found for ${sun}:${fk}`);
        continue;
      }

      // Current period bul
      const currentPeriod = periods.find((p: any) => p.is_current)?.period_no || periods[0].period_no;

      for (const src of diaSources) {
        // Dönem bağımsız kaynaklar sadece aktif dönemden çekilir
        const srcPeriods = src.is_period_independent ? [currentPeriod] : periods.map((p: any) => p.period_no);

        for (const pn of srcPeriods) {
          try {
            const result = await incrementalSync(sb, userId, dr.session, src, pn, sun, fk, 'cron');
            allResults.push({ sun, fk, slug: src.slug, pn, ...result });
            
            if (result.skipped) {
              console.log(`[cronSync] ${src.slug} period ${pn}: skipped (locked)`);
            } else if (result.needsFullSync) {
              console.log(`[cronSync] ${src.slug} period ${pn}: needs full sync (skipping in cron)`);
            } else {
              console.log(`[cronSync] ${src.slug} period ${pn}: fetched=${result.fetched}, written=${result.written}`);
            }
          } catch (e) {
            const em = e instanceof Error ? e.message : "Error";
            console.log(`[cronSync] Error for ${src.slug} period ${pn}: ${em}`);
            allResults.push({ sun, fk, slug: src.slug, pn, success: false, error: em });
          }
        }
      }
    } catch (e) {
      const em = e instanceof Error ? e.message : "Error";
      console.log(`[cronSync] Error processing ${sun}:${fk}: ${em}`);
      allResults.push({ sun, fk, success: false, error: em });
    }
  }

  const successCount = allResults.filter(r => r.success).length;
  const failCount = allResults.filter(r => !r.success && !r.skipped && !r.needsFullSync).length;
  console.log(`[cronSync] Complete: ${successCount} success, ${failCount} failed, ${allResults.length} total`);

  return { success: true, results: allResults, successCount, failCount };
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action } = body;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await cleanup(sb);

    // ===== cronSync - özel auth (CRON_SECRET) =====
    if (action === 'cronSync') {
      const cronSecret = req.headers.get("x-cron-secret") || body.cronSecret || '';
      const result = await handleCronSync(sb, cronSecret);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normal auth
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ success: false, error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
    const { data: { user }, error: ue } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (ue || !user) return new Response(JSON.stringify({ success: false, error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
    const { dataSourceSlug, periodNo, targetUserId, syncAllPeriods, offset, chunkSize, filters: reqFilters } = body;
    let euid = user.id;
    if ((action === 'syncAllForUser' || action === 'syncSingleSource' || action === 'syncChunk' || action === 'incrementalSync') && targetUserId) {
      const { data: rc } = await sb.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').single();
      if (!rc) return new Response(JSON.stringify({ success: false, error: "Super admin required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      euid = targetUserId;
    }
    const dr = await getDiaSession(sb, euid);
    if (!dr.success || !dr.session) return new Response(JSON.stringify({ success: false, error: dr.error || "DIA connection failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { session } = dr, sun = session.sunucuAdi, fk = String(session.firmaKodu);
    
    // ===== incrementalSync action =====
    if (action === 'incrementalSync') {
      if (!dataSourceSlug || periodNo === undefined) {
        return new Response(JSON.stringify({ success: false, error: "dataSourceSlug and periodNo required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: src } = await sb.from('data_sources').select('slug, module, method, name').eq('slug', dataSourceSlug).eq('is_active', true).single();
      if (!src) return new Response(JSON.stringify({ success: false, error: `Source not found: ${dataSourceSlug}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      const result = await incrementalSync(sb, euid, session, src, periodNo, sun, fk, user.id);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== syncChunk action (filters desteği eklendi) =====
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
        sun, fk, src.slug, startOffset, requestedChunkSize,
        reqFilters // Opsiyonel filtre desteği
      );
      
      if (!result.ok) {
        return new Response(JSON.stringify({ 
          success: false, error: result.err, written: result.written, hasMore: false, nextOffset: result.nextOffset
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (result.written > 0) {
        await sb.from('period_sync_status').upsert({ 
          sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo, 
          data_source_slug: src.slug, 
          last_incremental_sync: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });
      }
      
      console.log(`[syncChunk] Complete: written=${result.written}, hasMore=${result.hasMore}, nextOffset=${result.nextOffset}`);
      
      return new Response(JSON.stringify({ 
        success: true, written: result.written, fetched: result.fetched, hasMore: result.hasMore, nextOffset: result.nextOffset
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
    
    const { data: currentPeriodData } = await sb.from('firma_periods').select('period_no').eq('sunucu_adi', sun).eq('firma_kodu', fk).eq('is_current', true).single();
    const currentPeriod = currentPeriodData?.period_no || curDon;
    console.log(`[DIA Sync] Current period for period-independent sources: ${currentPeriod} (profile curDon: ${curDon})`);
    
    const results: any[] = [];
    for (const src of srcs) {
      const srcPeriods = src.is_period_independent ? [currentPeriod] : periods;
      console.log(`[DIA Sync] ${src.slug}: ${src.is_period_independent ? `period-independent (period ${currentPeriod})` : `period-dependent (${srcPeriods.length} periods)`}`);
      for (const pn of srcPeriods) results.push(await syncOne(sb, euid, session, src, pn, sun, fk, user.id));
    }
    return new Response(JSON.stringify({ success: results.some(r=>r.success), results, totalSynced: results.filter(r=>r.success).length, totalFailed: results.filter(r=>!r.success).length, periodsProcessed: periods.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
