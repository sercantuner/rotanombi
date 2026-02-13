import { createClient } from "npm:@supabase/supabase-js@2";
import { getDiaSession, ensureValidSession, invalidateSession } from "../_shared/diaAutoLogin.ts";
import { getPooledColumnsForSource } from "../_shared/widgetFieldPool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action } = body;

    // Basic sync actions from hook
    if (action === 'acquireLock') {
      const { syncType } = body;
      const auth = req.headers.get("Authorization");
      const { data: { user }, error } = await sb.auth.getUser(auth?.replace("Bearer ", "") || "");
      if (error || !user) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const dr = await getDiaSession(sb, user.id);
      if (!dr.success) return new Response(JSON.stringify({ success: false, error: "No DIA session" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const sun = dr.session!.sunucuAdi, fk = String(dr.session!.firmaKodu);

      // Clean expired locks
      await sb.from('sync_locks').delete().lt('expires_at', new Date().toISOString());

      // Check for existing lock
      const { data: existing } = await sb.from('sync_locks').select('*').eq('sunucu_adi', sun).eq('firma_kodu', fk).single();
      if (existing) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'SYNC_IN_PROGRESS', 
          lockedBy: existing.locked_by_email || existing.locked_by 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create new lock
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: lock } = await sb.from('sync_locks').insert({
        sunucu_adi: sun,
        firma_kodu: fk,
        locked_by: user.id,
        locked_by_email: user.email,
        expires_at: expiresAt,
        sync_type: syncType || 'full',
      }).select().single();

      return new Response(JSON.stringify({ success: true, lockId: lock?.id, expiresAt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'releaseLock') {
      const { lockId } = body;
      if (lockId) {
        await sb.from('sync_locks').delete().eq('id', lockId);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'getSyncStatus') {
      const auth = req.headers.get("Authorization");
      const { data: { user }, error } = await sb.auth.getUser(auth?.replace("Bearer ", "") || "");
      if (error || !user) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const targetUserId = body.targetUserId || user.id;
      const dr = await getDiaSession(sb, targetUserId);
      if (!dr.success) return new Response(JSON.stringify({ success: false, error: "No DIA session" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const sun = dr.session!.sunucuAdi, fk = String(dr.session!.firmaKodu);
      
      const { data: ps } = await sb.from('period_sync_status').select('*').eq('sunucu_adi', sun).eq('firma_kodu', fk);

      return new Response(JSON.stringify({ 
        success: true,
        sunucuAdi: sun,
        firmaKodu: fk,
        periodStatus: ps || [] 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'getRecordCounts') {
      const auth = req.headers.get("Authorization");
      const { data: { user }, error } = await sb.auth.getUser(auth?.replace("Bearer ", "") || "");
      if (error || !user) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { sources } = body;
      const targetUserId = body.targetUserId || user.id;
      const dr = await getDiaSession(sb, targetUserId);
      if (!dr.success) return new Response(JSON.stringify({ success: false, error: "No DIA session" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const session = dr.session!;
      const sr = await ensureValidSession(sb, targetUserId, session);
      if (!sr.success) return new Response(JSON.stringify({ success: false, error: "Session fail" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const counts: Record<string, number> = {};
      let validSession = sr.session!;

      for (const s of sources) {
        const { data: src } = await sb.from('data_sources').select('slug, module, method').eq('slug', s.slug).eq('is_active', true).single();
        if (!src) { counts[`${s.slug}_${s.periodNo}`] = 0; continue; }

        const url = `https://${validSession.sunucuAdi}.ws.dia.com.tr/api/v3/${src.module}/json`;
        const fm = src.method.startsWith(`${src.module}_`) ? src.method : `${src.module}_${src.method}`;
        const pl: any = { [fm]: { 
          session_id: validSession.sessionId, 
          firma_kodu: validSession.firmaKodu, 
          donem_kodu: s.periodNo, 
          limit: 0,
          params: { selectedcolumns: ["_key"] }
        }};

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

      return new Response(JSON.stringify({ success: true, counts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
