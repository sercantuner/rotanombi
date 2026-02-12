import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple CSV parser that handles quoted fields with semicolons and newlines
function parseCSV(content: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  
  // Parse header
  const headerEnd = content.indexOf('\n');
  const headerLine = content.substring(0, headerEnd).trim();
  const headers = headerLine.split(';');
  
  // Parse body - handle quoted fields with newlines
  let i = headerEnd + 1;
  const len = content.length;
  
  while (i < len) {
    const fields: string[] = [];
    let fieldStart = i;
    
    for (let col = 0; col < headers.length; col++) {
      if (i >= len) {
        fields.push('');
        continue;
      }
      
      if (content[i] === '"') {
        // Quoted field - find closing quote
        i++; // skip opening quote
        let value = '';
        while (i < len) {
          if (content[i] === '"') {
            if (i + 1 < len && content[i + 1] === '"') {
              value += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            value += content[i];
            i++;
          }
        }
        fields.push(value);
        // Skip delimiter
        if (i < len && content[i] === ';') i++;
        else if (i < len && content[i] === '\n') { /* will be handled after loop */ }
      } else {
        // Unquoted field
        let value = '';
        while (i < len && content[i] !== ';' && content[i] !== '\n' && content[i] !== '\r') {
          value += content[i];
          i++;
        }
        fields.push(value);
        if (i < len && content[i] === ';') i++;
      }
    }
    
    // Skip newline
    while (i < len && (content[i] === '\n' || content[i] === '\r')) i++;
    
    if (fields.length >= 2 && fields[0] && fields[1]) {
      const record: Record<string, string> = {};
      for (let h = 0; h < headers.length && h < fields.length; h++) {
        record[headers[h]] = fields[h];
      }
      // Only add if it looks like a valid widget record (has UUID id and widget_key)
      if (record.id?.match(/^[0-9a-f]{8}-/) && record.widget_key?.startsWith('ai_')) {
        records.push(record);
      }
    }
  }
  
  return records;
}

function parseJsonField(value: string): any {
  if (!value || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseBool(value: string): boolean {
  return value === 'true' || value === 't';
}

function parseIntOrNull(value: string): number | null {
  if (!value || value === '') return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function parseArrayField(value: string): string[] | null {
  if (!value || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    // Try parsing PostgreSQL array format {val1,val2}
    if (value.startsWith('{') && value.endsWith('}')) {
      return value.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, storageFile, dryRun = false, forceUpdate = false } = await req.json();
    
    let csv = csvContent;
    
    // If storageFile is provided, download from Supabase Storage
    if (storageFile) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('temp-imports')
        .download(storageFile);
      
      if (downloadError || !fileData) {
        return new Response(JSON.stringify({ error: `Failed to download file: ${downloadError?.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      csv = await fileData.text();
    }
    
    if (!csv) {
      return new Response(JSON.stringify({ error: "csvContent or storageFile is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse CSV
    const records = parseCSV(csv);
    
    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "No valid widget records found in CSV" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing widgets
    const { data: existingWidgets } = await supabase
      .from('widgets')
      .select('id, widget_key, version');
    
    const existingMap = new Map<string, { id: string; version: number }>();
    (existingWidgets || []).forEach((w: any) => {
      existingMap.set(w.widget_key, { id: w.id, version: w.version || 1 });
    });

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    const skipped: string[] = [];

    for (const rec of records) {
      const widgetData: any = {
        widget_key: rec.widget_key,
        name: rec.name,
        description: rec.description || null,
        category: rec.category || 'dashboard',
        type: rec.type || 'chart',
        data_source: rec.data_source || 'genel',
        size: rec.size || 'md',
        icon: rec.icon || null,
        default_page: rec.default_page || 'dashboard',
        default_visible: parseBool(rec.default_visible),
        available_filters: parseJsonField(rec.available_filters) || [],
        default_filters: parseJsonField(rec.default_filters) || {},
        min_height: rec.min_height || null,
        grid_cols: parseIntOrNull(rec.grid_cols),
        is_active: parseBool(rec.is_active),
        sort_order: parseIntOrNull(rec.sort_order) || 0,
        builder_config: parseJsonField(rec.builder_config),
        is_default: parseBool(rec.is_default),
        default_sort_order: parseIntOrNull(rec.default_sort_order) || 0,
        version: parseIntOrNull(rec.version) || 1,
        change_notes: rec.change_notes || null,
        last_change_type: rec.last_change_type || 'imported',
        available_sizes: parseArrayField(rec.available_sizes),
        target_pages: parseArrayField(rec.target_pages),
        short_description: rec.short_description || null,
        long_description: rec.long_description || null,
        technical_notes: parseJsonField(rec.technical_notes),
        preview_image: rec.preview_image || null,
        ai_suggested_tags: parseArrayField(rec.ai_suggested_tags),
        created_by: rec.created_by || null,
      };

      const existing = existingMap.get(rec.widget_key);
      
      if (existing) {
        const csvVersion = parseIntOrNull(rec.version) || 1;
        if (forceUpdate || csvVersion > existing.version) {
          // Force update or CSV has newer version - update
          toUpdate.push({ id: existing.id, ...widgetData });
        } else {
          skipped.push(rec.widget_key + ' (same or older version)');
        }
      } else {
        // New widget - use the original ID from CSV
        toInsert.push({ id: rec.id, ...widgetData });
      }
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        csvRecords: records.length,
        existingInDb: existingMap.size,
        toInsert: toInsert.length,
        toUpdate: toUpdate.length,
        skipped: skipped.length,
        insertKeys: toInsert.map(w => w.widget_key),
        updateKeys: toUpdate.map(w => w.widget_key),
        skippedKeys: skipped,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute inserts
    let insertedCount = 0;
    let insertErrors: string[] = [];
    
    // Insert in batches of 10
    for (let i = 0; i < toInsert.length; i += 10) {
      const batch = toInsert.slice(i, i + 10);
      const { error } = await supabase.from('widgets').insert(batch);
      if (error) {
        insertErrors.push(`Batch ${i}: ${error.message}`);
      } else {
        insertedCount += batch.length;
      }
    }

    // Execute updates
    let updatedCount = 0;
    let updateErrors: string[] = [];
    
    for (const widget of toUpdate) {
      const { id, ...updateData } = widget;
      const { error } = await supabase.from('widgets').update(updateData).eq('id', id);
      if (error) {
        updateErrors.push(`${widget.widget_key}: ${error.message}`);
      } else {
        updatedCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      csvRecords: records.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skipped.length,
      insertErrors,
      updateErrors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
