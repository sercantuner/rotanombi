// Widget - Veri Kaynağı Eşleşme Listesi
import React, { useMemo } from 'react';
import { useWidgets } from '@/hooks/useWidgets';
import { useDataSources } from '@/hooks/useDataSources';
import { Widget } from '@/lib/widgetTypes';
import { WidgetBuilderConfig, DiaApiQuery } from '@/lib/widgetBuilderTypes';
import { Database, Search, ArrowRight, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import * as LucideIcons from 'lucide-react';

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name] || LucideIcons.Box;
  return <Icon className={className} />;
}

interface DataSourceMapping {
  queryName: string;
  dataSourceSlug?: string;
  dataSourceName?: string;
  module: string;
  method: string;
  type: 'primary' | 'multi-query';
}

function extractDataSources(widget: Widget): DataSourceMapping[] {
  const config = widget.builder_config as WidgetBuilderConfig | null;
  if (!config) {
    return [{
      queryName: 'Ana Sorgu',
      module: widget.data_source,
      method: '-',
      type: 'primary',
    }];
  }

  const mappings: DataSourceMapping[] = [];

  // Check multiQuery first
  if (config.multiQuery?.queries?.length) {
    config.multiQuery.queries.forEach((q: DiaApiQuery) => {
      mappings.push({
        queryName: q.name || q.id,
        dataSourceSlug: q.dataSourceId,
        dataSourceName: q.dataSourceName,
        module: q.module,
        method: q.method,
        type: 'multi-query',
      });
    });
  } else {
    // Single query from diaApi
    mappings.push({
      queryName: 'Ana Sorgu',
      dataSourceSlug: config.dataSourceSlug || config.dataSourceId,
      module: config.diaApi?.module || widget.data_source,
      method: config.diaApi?.method || '-',
      type: 'primary',
    });
  }

  return mappings;
}

export default function WidgetDataSourceMap() {
  const { widgets, isLoading } = useWidgets();
  const { dataSources } = useDataSources();
  const [search, setSearch] = React.useState('');

  // Build a slug->name lookup
  const dsLookup = useMemo(() => {
    const map: Record<string, string> = {};
    dataSources.forEach(ds => {
      map[ds.slug] = ds.name;
      map[ds.id] = ds.name;
    });
    return map;
  }, [dataSources]);

  // Build flat list sorted by widget name
  const rows = useMemo(() => {
    const sorted = [...widgets].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const result: { widget: Widget; mapping: DataSourceMapping; resolvedDsName: string }[] = [];

    for (const widget of sorted) {
      const mappings = extractDataSources(widget);
      for (const mapping of mappings) {
        const resolvedDsName = mapping.dataSourceName
          || (mapping.dataSourceSlug && dsLookup[mapping.dataSourceSlug])
          || mapping.dataSourceSlug
          || '-';
        result.push({ widget, mapping, resolvedDsName });
      }
    }
    return result;
  }, [widgets, dsLookup]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.widget.name.toLowerCase().includes(q) ||
      r.widget.widget_key.toLowerCase().includes(q) ||
      r.resolvedDsName.toLowerCase().includes(q) ||
      r.mapping.module.toLowerCase().includes(q) ||
      r.mapping.method.toLowerCase().includes(q) ||
      r.mapping.queryName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Widget ↔ Veri Kaynağı Eşleşmeleri</h2>
        <p className="text-muted-foreground">
          {widgets.length} widget, {filtered.length} satır eşleşme
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Widget, veri kaynağı veya metod ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">Widget</TableHead>
              <TableHead>Sorgu Adı</TableHead>
              <TableHead>Veri Kaynağı</TableHead>
              <TableHead>Modül</TableHead>
              <TableHead>Metod</TableHead>
              <TableHead className="w-[80px]">Tip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Eşleşme bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => {
                // Check if this is the first row for the widget (for visual grouping)
                const isFirst = i === 0 || filtered[i - 1].widget.id !== row.widget.id;
                return (
                  <TableRow key={`${row.widget.id}-${row.mapping.queryName}-${i}`}>
                    <TableCell>
                      {isFirst ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <DynamicIcon name={row.widget.icon || 'BarChart2'} className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{row.widget.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{row.widget.widget_key}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground pl-9">↳</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{row.mapping.queryName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm">{row.resolvedDsName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {row.mapping.module}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {row.mapping.method}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.mapping.type === 'multi-query' ? (
                        <Badge variant="secondary" className="text-[10px]">
                          <Layers className="w-2.5 h-2.5 mr-0.5" />
                          Çoklu
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Tekli</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
