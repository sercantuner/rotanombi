-- Satış Widget'ları - Fatura Listesi Kaynağına Bağlama
-- Veri Kaynağı: 00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33 (scf/fatura_listele)

-- 1. KPI: Net Satış (Satış Faturaları - İade Faturaları)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [
    {"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"},
    {"id": "f2", "field": "turuack", "operator": "contains", "value": "Satış", "logicalOperator": "AND"}
  ],
  "visualization": {"type": "kpi", "kpi": {"valueField": "geneltoplam", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_net_satis';

-- 2. KPI: Brüt Satış 
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [
    {"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"},
    {"id": "f2", "field": "turuack", "operator": "contains", "value": "Satış", "logicalOperator": "AND"}
  ],
  "visualization": {"type": "kpi", "kpi": {"valueField": "geneltoplam", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_brut_satis';

-- 3. KPI: İade Tutarı
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [
    {"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"},
    {"id": "f2", "field": "turuack", "operator": "contains", "value": "İade", "logicalOperator": "AND"}
  ],
  "visualization": {"type": "kpi", "kpi": {"valueField": "geneltoplam", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_iade_tutari';

-- 4. KPI: Fatura Sayısı
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"}],
  "visualization": {"type": "kpi", "kpi": {"valueField": "_key", "aggregation": "count", "format": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_fatura_sayisi';

-- 5. Grafik: Marka Dağılımı
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"}],
  "visualization": {"type": "pie", "chart": {"legendField": "marka", "valueField": "geneltoplam", "aggregation": "sum"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_marka_dagilimi';

-- 6. Liste: Satış Elemanı Performansı
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"}],
  "visualization": {"type": "table", "table": {"groupBy": "satiselemani", "columns": [
    {"field": "satiselemani", "header": "Satış Elemanı"},
    {"field": "geneltoplam", "header": "Toplam Satış", "aggregation": "sum", "format": "currency"}
  ]}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_satis_elemani_performans';

-- 7. Liste: En Çok Satan Ürünler
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"}],
  "visualization": {"type": "list", "list": {"titleField": "stokkartkodu", "valueField": "geneltoplam", "format": "currency", "sortField": "geneltoplam", "sortOrder": "desc", "limit": 10}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_top_urunler';

-- 8. Liste: Top Müşteriler (Satış)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33",
  "diaApi": {"module": "scf", "method": "fatura_listele", "parameters": {}},
  "postFetchFilters": [
    {"id": "f1", "field": "iptal", "operator": "=", "value": "-", "logicalOperator": "AND"},
    {"id": "f2", "field": "turuack", "operator": "contains", "value": "Satış", "logicalOperator": "AND"}
  ],
  "visualization": {"type": "list", "list": {"groupBy": "carikartkodu", "titleField": "unvan", "valueField": "geneltoplam", "aggregation": "sum", "format": "currency", "sortField": "geneltoplam", "sortOrder": "desc", "limit": 10}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_top_musteriler';