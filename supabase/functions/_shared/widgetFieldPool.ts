// Widget Field Pool - Widget'ların requiredFields'lerinden dinamik selectedcolumns hesaplama
// data_sources.selected_columns yerine widget bazlı alan havuzu kullanılır

/**
 * Tüm aktif widget'ların requiredFields'lerini analiz ederek
 * her veri kaynağı için birleştirilmiş (union) alan listesi döndürür.
 * 
 * @returns Map<dataSourceId, string[] | null>
 *   - string[]: Havuzlanmış alanlar (projeksiyon yapılabilir)
 *   - null: Projeksiyon yapılamaz (en az 1 widget requiredFields tanımlamadı)
 */
export async function getAllPooledColumns(sb: any): Promise<Map<string, string[] | null>> {
  // Tüm aktif widget'ların builder_config'lerini çek
  const { data: widgets, error: wErr } = await sb
    .from('widgets')
    .select('builder_config')
    .eq('is_active', true);

  if (wErr || !widgets || widgets.length === 0) {
    return new Map();
  }

  // dataSourceId -> { fields: Set<string>, hasWidgetWithoutFields: boolean }
  const poolMap = new Map<string, { fields: Set<string>; noFields: boolean }>();

  const addToPool = (dataSourceId: string, requiredFields: string[] | null | undefined) => {
    if (!poolMap.has(dataSourceId)) {
      poolMap.set(dataSourceId, { fields: new Set(), noFields: false });
    }
    const pool = poolMap.get(dataSourceId)!;

    if (!requiredFields || requiredFields.length === 0) {
      pool.noFields = true;
    } else {
      for (const f of requiredFields) {
        pool.fields.add(f);
      }
    }
  };

  for (const w of widgets) {
    const config = w.builder_config as any;
    if (!config) continue;

    // 1. Tek sorgu - üst düzey dataSourceId
    if (config.dataSourceId) {
      addToPool(config.dataSourceId, config.requiredFields);
    }

    // 2. MultiQuery
    if (config.multiQuery?.queries && Array.isArray(config.multiQuery.queries)) {
      for (const q of config.multiQuery.queries) {
        if (q.dataSourceId) {
          addToPool(q.dataSourceId, config.requiredFields);
        }
      }
    }

    // 3. Legacy queries format
    if (config.isMultiQuery && config.queries && Array.isArray(config.queries)) {
      for (const q of config.queries) {
        if (q.dataSourceId) {
          addToPool(q.dataSourceId, config.requiredFields);
        }
      }
    }
  }

  // Convert to result map
  const result = new Map<string, string[] | null>();
  for (const [dsId, pool] of poolMap) {
    result.set(dsId, pool.noFields ? null : (pool.fields.size > 0 ? Array.from(pool.fields) : null));
  }

  return result;
}

/**
 * Slug bazlı pool lookup - data_sources tablosundan ID'yi bulup pool'dan döndürür.
 * getAllPooledColumns sonucunu ve data_sources listesini kullanır.
 */
export function getPooledColumnsForSlug(
  poolMap: Map<string, string[] | null>,
  sources: { id: string; slug: string }[]
): Map<string, string[] | null> {
  const slugMap = new Map<string, string[] | null>();
  for (const src of sources) {
    const pooled = poolMap.get(src.id);
    slugMap.set(src.slug, pooled !== undefined ? pooled : null);
  }
  return slugMap;
}

/**
 * Tek bir veri kaynağı için pool hesaplama (ID bazlı).
 */
export async function getPooledColumnsForSource(
  sb: any,
  dataSourceId: string
): Promise<string[] | null> {
  const poolMap = await getAllPooledColumns(sb);
  return poolMap.get(dataSourceId) ?? null;
}
