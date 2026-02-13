// widget-compute: Pre-compute widget snapshots from company_data_cache
// Runs after dia-data-sync to prepare ready-to-render data for instant dashboard loading

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WIDGET_TIMEOUT_MS = 10_000; // 10 seconds per widget
const BATCH_SIZE = 2; // Process 2 widgets at a time (reduce connection pool pressure)
const COMPANY_BATCH_DELAY_MS = 1000; // 1 second delay between companies

// ===== Merge Functions (mirror of frontend logic) =====

function leftJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  return left.map(l => ({ ...l, ...(rightMap.get(l[leftKey]) || {}) }));
}

function innerJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  return left.filter(l => rightMap.has(l[leftKey])).map(l => ({ ...l, ...rightMap.get(l[leftKey]) }));
}

function unionAllData(left: any[], right: any[], columnMapping?: { left: string; right: string }[]): any[] {
  const mappedRight = right.map(r => {
    if (!columnMapping) return r;
    const mapped: any = {};
    columnMapping.forEach(m => { mapped[m.left] = r[m.right]; });
    return mapped;
  });
  return [...left, ...mappedRight];
}

function applyMerge(left: any[], right: any[], merge: any): any[] {
  switch (merge.mergeType) {
    case 'left_join': return leftJoin(left, right, merge.leftField, merge.rightField);
    case 'inner_join': return innerJoin(left, right, merge.leftField, merge.rightField);
    case 'right_join': return leftJoin(right, left, merge.rightField, merge.leftField);
    case 'union': case 'union_all': return unionAllData(left, right, merge.columnMapping);
    case 'cross_join': return left.flatMap(l => right.map(r => ({ ...l, ...r })));
    default: return leftJoin(left, right, merge.leftField, merge.rightField);
  }
}

// ===== Aggregation (mirror of frontend) =====

function calculateAggregation(data: any[], field: string, aggregation: string): number {
  if (!data || data.length === 0) return 0;
  const values = data.map(item => {
    const val = item[field];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
    return 0;
  }).filter(v => !isNaN(v));

  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'count': return data.length;
    case 'count_distinct': return new Set(data.map(item => item[field])).size;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

function groupDataForChart(data: any[], groupField: string, valueField: string, aggregation: string = 'sum', displayLimit: number = 10) {
  if (!data || data.length === 0) return [];
  const groups: Record<string, any[]> = {};
  data.forEach(item => {
    const key = String(item[groupField] || 'Belirsiz');
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups)
    .map(([name, items]) => ({ name, value: calculateAggregation(items, valueField, aggregation) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, displayLimit);
}

// ===== Fetch data from company_data_cache =====

async function fetchCacheData(sb: any, sunucuAdi: string, firmaKodu: string, slug: string, donemKodu?: number): Promise<any[]> {
  const PAGE = 1000;
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    let query = sb.from('company_data_cache')
      .select('data')
      .eq('sunucu_adi', sunucuAdi)
      .eq('firma_kodu', firmaKodu)
      .eq('data_source_slug', slug)
      .eq('is_deleted', false)
      .range(offset, offset + PAGE - 1);

    if (donemKodu) {
      query = query.eq('donem_kodu', donemKodu);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;
    allData = allData.concat(data.map((r: any) => r.data));
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return allData;
}

// ===== Execute custom code in sandbox =====

function executeCustomCode(customCode: string, data: any[], multiData?: any[][]): any {
  try {
    // Create a minimal scope - no React/DOM, just data transformation
    const toArray = (v: any) => Array.isArray(v) ? v : [];
    
    const fn = new Function(
      'data', 'rawData', 'filters', 'multiData', 'toArray',
      'calculateAggregation', 'groupDataForChart',
      // Return the processed result
      `
      try {
        // The custom code should return processedData
        ${customCode}
        // If function returns a component creator, we can't use it server-side
        // Try to detect if it returns processed data directly
        if (typeof arguments[arguments.length] === 'object') {
          return arguments[arguments.length];
        }
        return { processedData: data };
      } catch(e) {
        return { error: e.message, processedData: data };
      }
      `
    );

    const result = fn(data, data, {}, multiData || [], toArray, calculateAggregation, groupDataForChart);
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Custom code execution failed', processedData: data };
  }
}

// ===== Process visualization data (KPI, chart, table) =====

function processVisualizationData(data: any[], config: any): any {
  const vizType = config?.visualization?.type;
  
  if (vizType === 'kpi' && config.visualization.kpi) {
    const kpiConfig = config.visualization.kpi;
    let kpiValue = kpiConfig.aggregation === 'count'
      ? data.length
      : calculateAggregation(data, kpiConfig.valueField, kpiConfig.aggregation);
    
    if (kpiConfig.isAbsoluteValue && kpiValue < 0) {
      kpiValue = Math.abs(kpiValue);
    }
    
    return {
      type: 'kpi',
      value: kpiValue,
      format: kpiConfig.format,
      prefix: kpiConfig.prefix,
      suffix: kpiConfig.suffix,
      recordCount: data.length,
    };
  }
  
  if (['bar', 'line', 'area'].includes(vizType) && config.visualization.chart) {
    const cc = config.visualization.chart;
    const aggType = cc.yAxis?.aggregation || cc.aggregation || 'sum';
    return {
      type: vizType,
      chartData: groupDataForChart(data, cc.xAxis?.field || '', cc.yAxis?.field || cc.valueField || '', aggType, cc.displayLimit || 10),
      recordCount: data.length,
    };
  }
  
  if (['pie', 'donut'].includes(vizType) && config.visualization.chart) {
    const cc = config.visualization.chart;
    const groupField = config.fieldWells?.category?.field || cc.legendField || '';
    const valueField = config.fieldWells?.value?.field || cc.valueField || '';
    const aggType = config.fieldWells?.value?.aggregation || cc.aggregation || 'count';
    const displayLimit = config.chartSettings?.displayLimit || cc.displayLimit || 10;
    return {
      type: vizType,
      chartData: groupDataForChart(data, groupField, valueField, aggType, displayLimit),
      recordCount: data.length,
    };
  }
  
  // Custom code widget or table - return raw processed data
  return {
    type: vizType || 'custom',
    processedData: data,
    recordCount: data.length,
  };
}

// ===== Post-fetch filters =====

function applyPostFetchFilters(data: any[], filters: any[]): any[] {
  if (!filters || filters.length === 0) return data;
  return data.filter(row => {
    let result = true;
    let currentLogical: 'AND' | 'OR' = 'AND';
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const fieldValue = row[filter.field];
      let matches = false;
      const strValue = String(fieldValue ?? '').toLowerCase();
      const filterValue = filter.value.toLowerCase();
      const numValue = parseFloat(String(fieldValue).replace(/[^\d.-]/g, '')) || 0;
      const filterNumValue = parseFloat(filter.value) || 0;
      switch (filter.operator) {
        case '=': matches = strValue === filterValue; break;
        case '!=': matches = strValue !== filterValue; break;
        case '>': matches = numValue > filterNumValue; break;
        case '<': matches = numValue < filterNumValue; break;
        case '>=': matches = numValue >= filterNumValue; break;
        case '<=': matches = numValue <= filterNumValue; break;
        case 'contains': matches = strValue.includes(filterValue); break;
        case 'is_null': matches = fieldValue === null || fieldValue === undefined || fieldValue === ''; break;
        case 'is_not_null': matches = fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; break;
        default: matches = true;
      }
      if (i === 0) result = matches;
      else if (currentLogical === 'AND') result = result && matches;
      else result = result || matches;
      currentLogical = filter.logicalOperator;
    }
    return result;
  });
}

// ===== Calculated fields =====

function applyCalculatedFields(data: any[], fields: any[]): any[] {
  if (!fields || fields.length === 0) return data;
  return data.map(row => {
    const newRow = { ...row };
    fields.forEach((cf: any) => {
      try {
        newRow[cf.name] = evalExpression(cf.expression, row);
      } catch { /* skip */ }
    });
    return newRow;
  });
}

function evalExpression(expr: any, row: any): number {
  if (!expr) return 0;
  if (expr.type === 'field') {
    const val = row[expr.field];
    return typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
  }
  if (expr.type === 'constant') return expr.value ?? 0;
  if (expr.type === 'operation') {
    const l = evalExpression(expr.left, row);
    const r = evalExpression(expr.right, row);
    switch (expr.operator) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return r !== 0 ? l / r : 0;
      default: return 0;
    }
  }
  return 0;
}

// ===== Main: Compute all widgets for a company =====

async function computeWidgetsForCompany(
  sb: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  syncTrigger: string
): Promise<{ computed: number; failed: number; skipped: number; details: any[] }> {
  const stats = { computed: 0, failed: 0, skipped: 0, details: [] as any[] };

  // Get all active widgets with builder_config
  const { data: widgets, error: widgetErr } = await sb.from('widgets')
    .select('id, name, widget_key, builder_config')
    .eq('is_active', true)
    .not('builder_config', 'is', null);

  if (widgetErr || !widgets?.length) {
    console.log(`[widget-compute] No active widgets found: ${widgetErr?.message || 'empty'}`);
    return stats;
  }

  console.log(`[widget-compute] Processing ${widgets.length} widgets for ${sunucuAdi}:${firmaKodu}`);

  // Get data source slug mapping
  const { data: dataSources } = await sb.from('data_sources')
    .select('id, slug, is_period_independent, period_read_mode')
    .eq('is_active', true);
  
  const dsMap = new Map((dataSources || []).map((ds: any) => [ds.id, ds]));

  // Process widgets in batches
  for (let i = 0; i < widgets.length; i += BATCH_SIZE) {
    const batch = widgets.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (widget: any) => {
      const startMs = Date.now();
      const config = widget.builder_config;
      
      if (!config) {
        stats.skipped++;
        return;
      }

      // Mark as computing
      await sb.from('widget_snapshots').upsert({
        sunucu_adi: sunucuAdi,
        firma_kodu: firmaKodu,
        widget_id: widget.id,
        status: 'computing',
        sync_trigger: syncTrigger,
        snapshot_data: {},
        computed_at: new Date().toISOString(),
      }, { onConflict: 'sunucu_adi,firma_kodu,widget_id' });

      try {
        // Timeout wrapper
        const result = await Promise.race([
          computeSingleWidget(sb, sunucuAdi, firmaKodu, donemKodu, widget, config, dsMap),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), WIDGET_TIMEOUT_MS)),
        ]) as any;

        const computationMs = Date.now() - startMs;

        await sb.from('widget_snapshots').upsert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          widget_id: widget.id,
          snapshot_data: result.snapshotData,
          raw_row_count: result.rawRowCount,
          computed_at: new Date().toISOString(),
          sync_trigger: syncTrigger,
          status: 'ready',
          error: null,
          computation_ms: computationMs,
        }, { onConflict: 'sunucu_adi,firma_kodu,widget_id' });

        stats.computed++;
        stats.details.push({ widget: widget.name, status: 'ready', ms: computationMs, rows: result.rawRowCount });
        console.log(`[widget-compute] ✓ ${widget.name}: ${computationMs}ms, ${result.rawRowCount} rows`);
      } catch (err: any) {
        const computationMs = Date.now() - startMs;
        const errorMsg = err.message || 'Unknown error';

        await sb.from('widget_snapshots').upsert({
          sunucu_adi: sunucuAdi,
          firma_kodu: firmaKodu,
          widget_id: widget.id,
          snapshot_data: {},
          computed_at: new Date().toISOString(),
          sync_trigger: syncTrigger,
          status: 'failed',
          error: errorMsg,
          computation_ms: computationMs,
        }, { onConflict: 'sunucu_adi,firma_kodu,widget_id' });

        stats.failed++;
        stats.details.push({ widget: widget.name, status: 'failed', error: errorMsg, ms: computationMs });
        console.log(`[widget-compute] ✗ ${widget.name}: ${errorMsg} (${computationMs}ms)`);
      }
    });

    await Promise.all(batchPromises);
  }

  return stats;
}

async function computeSingleWidget(
  sb: any,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  widget: any,
  config: any,
  dsMap: Map<string, any>
): Promise<{ snapshotData: any; rawRowCount: number }> {
  let fetchedData: any[] = [];
  let multiData: any[][] | null = null;

  const getSlug = (dsId: string) => dsMap.get(dsId)?.slug;
  const isPeriodIndependent = (dsId: string) => {
    const ds = dsMap.get(dsId);
    if (!ds) return false;
    if (ds.period_read_mode === 'current_only') return false;
    return ds.is_period_independent === true;
  };

  // Multi-query
  if (config.multiQuery?.queries?.length > 0) {
    const queryResults: Record<string, any[]> = {};
    
    for (const query of config.multiQuery.queries) {
      if (!query.dataSourceId) continue;
      const slug = getSlug(query.dataSourceId);
      if (!slug) continue;
      const dk = isPeriodIndependent(query.dataSourceId) ? undefined : donemKodu;
      queryResults[query.id] = await fetchCacheData(sb, sunucuAdi, firmaKodu, slug, dk);
    }

    multiData = config.multiQuery.queries.map((q: any) => queryResults[q.id] || []);
    
    const primaryId = config.multiQuery.primaryQueryId || config.multiQuery.queries[0]?.id;
    fetchedData = queryResults[primaryId] || [];
    
    for (const merge of (config.multiQuery.merges || [])) {
      const rightData = queryResults[merge.rightQueryId] || [];
      fetchedData = applyMerge(fetchedData, rightData, merge);
    }
  } else if (config.dataSourceId) {
    const slug = getSlug(config.dataSourceId);
    if (slug) {
      const dk = isPeriodIndependent(config.dataSourceId) ? undefined : donemKodu;
      fetchedData = await fetchCacheData(sb, sunucuAdi, firmaKodu, slug, dk);
    }
  }

  const rawRowCount = fetchedData.length;

  // Calculated fields
  if (config.calculatedFields?.length > 0) {
    fetchedData = applyCalculatedFields(fetchedData, config.calculatedFields);
  }

  // Post-fetch filters
  if (config.postFetchFilters?.length > 0) {
    fetchedData = applyPostFetchFilters(fetchedData, config.postFetchFilters);
  }

  // Check if custom code contains React/DOM references (skip server-side execution)
  const customCode = config.customCode as string | undefined;
  const hasReactRefs = customCode && (
    /React\.createElement/.test(customCode) ||
    /return\s+function/.test(customCode) ||
    /createElement/.test(customCode)
  );

  let snapshotData: any;

  if (customCode && !hasReactRefs) {
    // Try to execute custom code for pure data transformation
    try {
      const result = executeCustomCode(customCode, fetchedData, multiData || undefined);
      snapshotData = {
        type: 'custom',
        processedData: result.processedData || fetchedData,
        rawRowCount,
        recordCount: fetchedData.length,
      };
    } catch {
      // Custom code failed - fall back to standard processing
      snapshotData = processVisualizationData(fetchedData, config);
    }
  } else if (customCode && hasReactRefs) {
    // Custom code has React references - store raw data for client-side processing
    snapshotData = {
      type: 'custom_client',
      processedData: fetchedData,
      multiData: multiData,
      rawRowCount,
      recordCount: fetchedData.length,
      needsClientRender: true,
    };
  } else {
    // Standard visualization processing (KPI, chart, table)
    snapshotData = processVisualizationData(fetchedData, config);
  }

  snapshotData.rawRowCount = rawRowCount;

  return { snapshotData, rawRowCount };
}

// ===== HTTP Handler =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { sunucuAdi, firmaKodu, donemKodu, syncTrigger, cronSecret } = body;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: either cron secret or user token
    if (cronSecret) {
      const expected = Deno.env.get("CRON_SECRET");
      if (!expected || cronSecret !== expected) {
        return new Response(JSON.stringify({ success: false, error: "Invalid CRON_SECRET" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const auth = req.headers.get("Authorization");
      if (!auth) {
        return new Response(JSON.stringify({ success: false, error: "Auth required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: { user }, error: ue } = await sb.auth.getUser(auth.replace("Bearer ", ""));
      if (ue || !user) {
        return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!sunucuAdi || !firmaKodu) {
      // If no specific company, process ALL companies (cron mode)
      const { data: profiles } = await sb.from('profiles')
        .select('dia_sunucu_adi, firma_kodu, donem_kodu')
        .not('dia_sunucu_adi', 'is', null)
        .not('firma_kodu', 'is', null);

      if (!profiles?.length) {
        return new Response(JSON.stringify({ success: true, message: "No profiles to compute" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unique company pairs
      const pairs = new Map<string, number>();
      for (const p of profiles) {
        const key = `${p.dia_sunucu_adi}:${p.firma_kodu}`;
        if (!pairs.has(key)) {
          pairs.set(key, parseInt(p.donem_kodu) || 1);
        }
      }

      const allResults: any[] = [];
      for (const [pairKey, dk] of pairs) {
        const [sun, fk] = pairKey.split(':');
        console.log(`[widget-compute] Computing for ${sun}:${fk}...`);
        const result = await computeWidgetsForCompany(sb, sun, fk, dk, syncTrigger || 'cron');
        allResults.push({ sunucuAdi: sun, firmaKodu: fk, ...result });
        // Delay between companies to prevent connection pool exhaustion
        await new Promise(resolve => setTimeout(resolve, COMPANY_BATCH_DELAY_MS));
      }

      return new Response(JSON.stringify({ success: true, results: allResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Specific company
    const dk = parseInt(donemKodu) || 1;
    const result = await computeWidgetsForCompany(sb, sunucuAdi, firmaKodu, dk, syncTrigger || 'manual');

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('[widget-compute] Fatal error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
