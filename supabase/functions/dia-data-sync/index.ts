import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession, ensureValidSession, invalidateSession } from "../_shared/diaAutoLogin.ts";
import { getPooledColumnsForSource } from "../_shared/widgetFieldPool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function getAuthUser(sb: any, req: Request) {
  const auth = req.headers.get("Authorization");
  const { data: { user }, error } = await sb.auth.getUser(auth?.replace("Bearer ", "") || "");
  if (error || !user) return null;
  return user;
}

async function getSessionForUser(sb: any, userId: string) {
  const dr = await getDiaSession(sb, userId);
  if (!dr.success || !dr.session) return null;
  return dr.session;
}

async function getDataSource(sb: any, slug: string) {
  const { data } = await sb.from('data_sources').select('*').eq('slug', slug).eq('is_active', true).single();
  return data;
}

function buildDiaMethodName(module: string, method: string): string {
  return method.startsWith(`${module}_`) ? method : `${module}_${method}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action } = body;

    // ─── acquireLock ───
    if (action === 'acquireLock') {
      const { syncType } = body;
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const session = await getSessionForUser(sb, body.targetUserId || user.id);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sun = session.sunucuAdi, fk = String(session.firmaKodu);
      await sb.from('sync_locks').delete().lt('expires_at', new Date().toISOString());

      const { data: existing } = await sb.from('sync_locks').select('*').eq('sunucu_adi', sun).eq('firma_kodu', fk).single();
      if (existing) {
        return respond({ success: false, error: 'SYNC_IN_PROGRESS', lockedBy: existing.locked_by_email || existing.locked_by });
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: lock } = await sb.from('sync_locks').insert({
        sunucu_adi: sun, firma_kodu: fk, locked_by: user.id,
        locked_by_email: user.email, expires_at: expiresAt, sync_type: syncType || 'full',
      }).select().single();

      return respond({ success: true, lockId: lock?.id, expiresAt });
    }

    // ─── releaseLock ───
    if (action === 'releaseLock') {
      const { lockId } = body;
      if (lockId) await sb.from('sync_locks').delete().eq('id', lockId);
      return respond({ success: true });
    }

    // ─── getSyncStatus ───
    if (action === 'getSyncStatus') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const targetUserId = body.targetUserId || user.id;
      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sun = session.sunucuAdi, fk = String(session.firmaKodu);
      const { data: ps } = await sb.from('period_sync_status').select('*').eq('sunucu_adi', sun).eq('firma_kodu', fk);

      return respond({ success: true, sunucuAdi: sun, firmaKodu: fk, currentPeriod: session.donemKodu, periodStatus: ps || [] });
    }

    // ─── getRecordCounts ───
    if (action === 'getRecordCounts') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const { sources } = body;
      const targetUserId = body.targetUserId || user.id;
      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sr = await ensureValidSession(sb, targetUserId, session);
      if (!sr.success || !sr.session) return respond({ success: false, error: "Session fail" }, 400);

      const counts: Record<string, number> = {};
      const validSession = sr.session;

      for (const s of sources) {
        const src = await getDataSource(sb, s.slug);
        if (!src) { counts[`${s.slug}_${s.periodNo}`] = 0; continue; }

        const url = `https://${validSession.sunucuAdi}.ws.dia.com.tr/api/v3/${src.module}/json`;
        const fm = buildDiaMethodName(src.module, src.method);
        const pl: any = { [fm]: { session_id: validSession.sessionId, firma_kodu: validSession.firmaKodu, donem_kodu: s.periodNo, limit: 0, params: { selectedcolumns: ["_key"] } } };

        try {
          const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) });
          if (!res.ok) { counts[`${s.slug}_${s.periodNo}`] = 0; continue; }
          const r = await res.json();
          if (r.code !== "200") { counts[`${s.slug}_${s.periodNo}`] = 0; continue; }
          const data = Array.isArray(r.result) ? r.result : r[fm] || [];
          counts[`${s.slug}_${s.periodNo}`] = data.length;
        } catch {
          counts[`${s.slug}_${s.periodNo}`] = 0;
        }
      }

      return respond({ success: true, counts });
    }

    // ─── syncChunk ───
    if (action === 'syncChunk') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const { dataSourceSlug, periodNo, offset = 0, chunkSize = 500, pageSize, filters: extraFilters } = body;
      const targetUserId = body.targetUserId || user.id;

      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sr = await ensureValidSession(sb, targetUserId, session);
      if (!sr.success || !sr.session) return respond({ success: false, error: "Session fail" }, 400);
      const validSession = sr.session;

      const src = await getDataSource(sb, dataSourceSlug);
      if (!src) return respond({ success: false, error: "Data source not found" });

      const url = `https://${validSession.sunucuAdi}.ws.dia.com.tr/api/v3/${src.module}/json`;
      const fm = buildDiaMethodName(src.module, src.method);
      const sun = validSession.sunucuAdi;
      const fk = String(validSession.firmaKodu);

      // Get pooled columns for this data source
      const pooledCols = await getPooledColumnsForSource(sb, src.id);
      
      // Build selected columns: pool + data source selected_columns + always include _key
      let selectedColumns: string[] | undefined;
      if (pooledCols) {
        const colSet = new Set(pooledCols);
        if (src.selected_columns && Array.isArray(src.selected_columns)) {
          for (const c of src.selected_columns) colSet.add(c);
        }
        colSet.add('_key');
        selectedColumns = Array.from(colSet);
      } else if (src.selected_columns && Array.isArray(src.selected_columns) && src.selected_columns.length > 0) {
        const colSet = new Set(src.selected_columns);
        colSet.add('_key');
        selectedColumns = Array.from(colSet);
      }

      // Build filters from data source + extra
      const diaFilters: any[] = [];
      if (src.filters && Array.isArray(src.filters)) {
        for (const f of src.filters) {
          diaFilters.push({ field: f.field, operator: f.operator || '', value: f.value });
        }
      }
      if (extraFilters && Array.isArray(extraFilters)) {
        diaFilters.push(...extraFilters);
      }

      // Build sorts
      const diaSorts: any[] = [];
      if (src.sorts && Array.isArray(src.sorts)) {
        diaSorts.push(...src.sorts);
      }
      // Always add deterministic sort by _key
      if (!diaSorts.some((s: any) => s.field === '_key')) {
        diaSorts.push({ field: '_key', sorttype: 'ASC' });
      }

      const effectiveChunkSize = Math.min(chunkSize, 2000);
      const effectivePageSize = pageSize || 100;

      // Fetch data from DIA in pages within the chunk
      let allRecords: any[] = [];
      let currentOffset = offset;
      let hasMore = true;
      let partialError: string | null = null;

      while (allRecords.length < effectiveChunkSize && hasMore) {
        const fetchLimit = Math.min(effectivePageSize, effectiveChunkSize - allRecords.length);
        
        const payload: any = {
          [fm]: {
            session_id: validSession.sessionId,
            firma_kodu: validSession.firmaKodu,
            donem_kodu: periodNo,
            limit: fetchLimit,
            offset: currentOffset,
            sorts: diaSorts,
          }
        };

        if (selectedColumns) {
          payload[fm].params = { selectedcolumns: selectedColumns };
        }
        if (diaFilters.length > 0) {
          payload[fm].filters = diaFilters;
        }

        try {
          const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          
          if (!res.ok) {
            partialError = `DIA HTTP ${res.status}`;
            break;
          }

          const r = await res.json();
          
          if (r.error || r.hata) {
            partialError = r.error?.message || r.hata?.aciklama || 'DIA API error';
            break;
          }

          if (r.code !== "200") {
            partialError = `DIA code: ${r.code}`;
            break;
          }

          const data = Array.isArray(r.result) ? r.result : r[fm] || [];
          allRecords.push(...data);

          if (data.length < fetchLimit) {
            hasMore = false;
          } else {
            currentOffset += data.length;
          }
        } catch (e) {
          partialError = e instanceof Error ? e.message : 'Fetch error';
          break;
        }
      }

      // Upsert to Supabase
      let written = 0;
      if (allRecords.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < allRecords.length; i += BATCH) {
          const batch = allRecords.slice(i, i + BATCH);
          const upsertRows = batch
            .filter((r: any) => r._key)
            .map((record: any) => ({
              sunucu_adi: sun,
              firma_kodu: fk,
              donem_kodu: periodNo,
              data_source_slug: dataSourceSlug,
              dia_key: Number(record._key),
              data: record,
              is_deleted: false,
              updated_at: new Date().toISOString(),
            }));

          if (upsertRows.length === 0) continue;

          const { error: uErr } = await sb
            .from('company_data_cache')
            .upsert(upsertRows, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key', ignoreDuplicates: false });

          if (uErr) {
            console.error(`[syncChunk] Upsert error:`, uErr.message);
          } else {
            written += upsertRows.length;
          }
        }
      }

      return respond({
        success: true,
        fetched: allRecords.length,
        written,
        hasMore,
        nextOffset: currentOffset,
        partialError,
      });
    }

    // ─── incrementalSync ───
    if (action === 'incrementalSync') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const { dataSourceSlug, periodNo } = body;
      const targetUserId = body.targetUserId || user.id;

      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sun = session.sunucuAdi, fk = String(session.firmaKodu);

      // Check if we have a previous full sync
      const { data: pss } = await sb.from('period_sync_status').select('last_full_sync')
        .eq('sunucu_adi', sun).eq('firma_kodu', fk)
        .eq('data_source_slug', dataSourceSlug).eq('donem_kodu', periodNo).single();

      if (!pss?.last_full_sync) {
        return respond({ success: true, needsFullSync: true, fetched: 0, written: 0 });
      }

      // Fetch records modified since last sync
      const sr = await ensureValidSession(sb, targetUserId, session);
      if (!sr.success || !sr.session) return respond({ success: false, error: "Session fail" }, 400);
      const validSession = sr.session;

      const src = await getDataSource(sb, dataSourceSlug);
      if (!src) return respond({ success: false, error: "Data source not found" });

      const url = `https://${validSession.sunucuAdi}.ws.dia.com.tr/api/v3/${src.module}/json`;
      const fm = buildDiaMethodName(src.module, src.method);

      // Get pooled columns
      const pooledCols = await getPooledColumnsForSource(sb, src.id);
      let selectedColumns: string[] | undefined;
      if (pooledCols) {
        const colSet = new Set(pooledCols);
        if (src.selected_columns && Array.isArray(src.selected_columns)) {
          for (const c of src.selected_columns) colSet.add(c);
        }
        colSet.add('_key');
        selectedColumns = Array.from(colSet);
      }

      // Use _date filter for incremental
      const lastSync = pss.last_full_sync;
      const payload: any = {
        [fm]: {
          session_id: validSession.sessionId,
          firma_kodu: validSession.firmaKodu,
          donem_kodu: periodNo,
          limit: 0,
          filters: [
            { field: '_date', operator: '>=', value: lastSync }
          ],
          sorts: [{ field: '_key', sorttype: 'ASC' }],
        }
      };
      if (selectedColumns) {
        payload[fm].params = { selectedcolumns: selectedColumns };
      }

      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) return respond({ success: false, error: `DIA HTTP ${res.status}` });

        const r = await res.json();
        if (r.error || r.hata) {
          return respond({ success: false, error: r.error?.message || r.hata?.aciklama || 'DIA error' });
        }

        const data = Array.isArray(r.result) ? r.result : r[fm] || [];

        // Upsert changed records
        let written = 0;
        const BATCH = 500;
        for (let i = 0; i < data.length; i += BATCH) {
          const batch = data.slice(i, i + BATCH);
          const upsertRows = batch.filter((r: any) => r._key).map((record: any) => ({
            sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo,
            data_source_slug: dataSourceSlug, dia_key: Number(record._key),
            data: record, is_deleted: false, updated_at: new Date().toISOString(),
          }));
          if (upsertRows.length === 0) continue;

          const { error: uErr } = await sb.from('company_data_cache')
            .upsert(upsertRows, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug,dia_key', ignoreDuplicates: false });
          if (!uErr) written += upsertRows.length;
        }

        // Update last incremental sync time
        await sb.from('period_sync_status').upsert({
          sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo,
          data_source_slug: dataSourceSlug,
          last_incremental_sync: new Date().toISOString(),
          total_records: null, // Don't update total on incremental
        }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });

        return respond({ success: true, fetched: data.length, written });
      } catch (e) {
        return respond({ success: false, error: e instanceof Error ? e.message : 'Error' });
      }
    }

    // ─── reconcileKeys ───
    if (action === 'reconcileKeys') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const { dataSourceSlug, periodNo } = body;
      const targetUserId = body.targetUserId || user.id;

      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sr = await ensureValidSession(sb, targetUserId, session);
      if (!sr.success || !sr.session) return respond({ success: false, error: "Session fail" }, 400);
      const validSession = sr.session;

      const sun = validSession.sunucuAdi, fk = String(validSession.firmaKodu);

      const src = await getDataSource(sb, dataSourceSlug);
      if (!src) return respond({ success: false, error: "Data source not found" });

      const url = `https://${validSession.sunucuAdi}.ws.dia.com.tr/api/v3/${src.module}/json`;
      const fm = buildDiaMethodName(src.module, src.method);

      // Fetch only keys from DIA
      const payload: any = {
        [fm]: {
          session_id: validSession.sessionId,
          firma_kodu: validSession.firmaKodu,
          donem_kodu: periodNo,
          limit: 0,
          params: { selectedcolumns: ["_key"] },
        }
      };

      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) return respond({ success: false, error: `DIA HTTP ${res.status}` });

        const r = await res.json();
        if (r.error || r.hata) {
          return respond({ success: false, error: r.error?.message || r.hata?.aciklama || 'DIA error' });
        }

        const diaData = Array.isArray(r.result) ? r.result : r[fm] || [];
        const diaKeys = new Set(diaData.map((d: any) => Number(d._key)).filter((k: number) => k));

        // Get all DB keys (paginated)
        const dbKeys = new Map<number, string>();
        let exOffset = 0;
        const PAGE = 1000;
        while (true) {
          const { data: exPage } = await sb.from('company_data_cache')
            .select('id, dia_key')
            .eq('sunucu_adi', sun).eq('firma_kodu', fk)
            .eq('donem_kodu', periodNo).eq('data_source_slug', dataSourceSlug)
            .eq('is_deleted', false)
            .range(exOffset, exOffset + PAGE - 1);
          if (!exPage || exPage.length === 0) break;
          exPage.forEach((r: any) => dbKeys.set(r.dia_key, r.id));
          if (exPage.length < PAGE) break;
          exOffset += PAGE;
        }

        // Mark deleted
        let markedDeleted = 0;
        for (const [diaKey, id] of dbKeys) {
          if (!diaKeys.has(diaKey)) {
            await sb.from('company_data_cache')
              .update({ is_deleted: true, updated_at: new Date().toISOString() })
              .eq('id', id);
            markedDeleted++;
          }
        }

        return respond({
          success: true,
          totalInDia: diaKeys.size,
          totalInDb: dbKeys.size,
          markedDeleted,
        });
      } catch (e) {
        return respond({ success: false, error: e instanceof Error ? e.message : 'Error' });
      }
    }

    // ─── markFullSyncComplete ───
    if (action === 'markFullSyncComplete') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const { dataSourceSlug, periodNo, totalRecords } = body;
      const targetUserId = body.targetUserId || user.id;

      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sun = session.sunucuAdi, fk = String(session.firmaKodu);

      await sb.from('period_sync_status').upsert({
        sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo,
        data_source_slug: dataSourceSlug,
        last_full_sync: new Date().toISOString(),
        total_records: totalRecords || 0,
      }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });

      // Also record in sync_history
      await sb.from('sync_history').insert({
        sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo,
        data_source_slug: dataSourceSlug,
        sync_type: 'full',
        status: 'completed',
        records_fetched: totalRecords || 0,
        triggered_by: user.id,
        completed_at: new Date().toISOString(),
      });

      return respond({ success: true });
    }

    // ─── lockPeriod ───
    if (action === 'lockPeriod') {
      const user = await getAuthUser(sb, req);
      if (!user) return respond({ success: false, error: "Unauthorized" }, 401);

      const { dataSourceSlug, periodNo } = body;
      const targetUserId = body.targetUserId || user.id;

      const session = await getSessionForUser(sb, targetUserId);
      if (!session) return respond({ success: false, error: "No DIA session" }, 400);

      const sun = session.sunucuAdi, fk = String(session.firmaKodu);

      await sb.from('period_sync_status').upsert({
        sunucu_adi: sun, firma_kodu: fk, donem_kodu: periodNo,
        data_source_slug: dataSourceSlug,
        is_locked: true,
      }, { onConflict: 'sunucu_adi,firma_kodu,donem_kodu,data_source_slug' });

      return respond({ success: true });
    }

    return respond({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    return respond({ success: false, error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
