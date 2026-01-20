-- Widget'ları Merkezi Veri Kaynaklarına Bağlama
-- Veri Kaynakları:
-- 11e5348f-d52e-4f0a-8c40-00ed47124c28 = Cari Kart Listesi (scf/carikart_listele)
-- 47c29eae-0215-4e85-86f0-160de9659ef4 = Cari Vade Bakiye (scf/carikart_vade_bakiye_listele)
-- 9e3772f7-b1c5-431b-bb72-b78c517ea1e5 = Banka Hesap Listesi (bcs/bankahesabi_listele)
-- 00c2e81b-e7e2-447f-ad40-bf7ed5e2cd33 = Fatura Listesi (scf/fatura_listele)
-- 10fbfcb4-13db-4493-83d7-3a8e5aaee71f = Stok Listesi (scf/stokkart_listele)

-- 1. KPI: Toplam Alacak (Cari Vade Bakiye - toplambakiye > 0)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "toplambakiye", "operator": ">", "value": "0", "logicalOperator": "AND"}],
  "visualization": {"type": "kpi", "kpi": {"valueField": "toplambakiye", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_toplam_alacak';

-- 2. KPI: Gecikmiş Alacak (Cari Vade Bakiye - vadesigecentutar > 0)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "vadesigecentutar", "operator": ">", "value": "0", "logicalOperator": "AND"}],
  "visualization": {"type": "kpi", "kpi": {"valueField": "vadesigecentutar", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_gecikmis_alacak';

-- 3. KPI: Toplam Borç (Cari Vade Bakiye - toplambakiye < 0, abs değer)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "toplambakiye", "operator": "<", "value": "0", "logicalOperator": "AND"}],
  "visualization": {"type": "kpi", "kpi": {"valueField": "toplambakiye", "aggregation": "sum", "format": "currency", "prefix": "₺", "isAbsoluteValue": true}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_toplam_borc';

-- 4. KPI: Gecikmiş Borç (Cari Vade Bakiye - vadesigecentutar < 0)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "vadesigecentutar", "operator": "<", "value": "0", "logicalOperator": "AND"}],
  "visualization": {"type": "kpi", "kpi": {"valueField": "vadesigecentutar", "aggregation": "sum", "format": "currency", "prefix": "₺", "isAbsoluteValue": true}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_gecikmis_borc';

-- 5. KPI: Net Bakiye (Cari Vade Bakiye - tüm bakiyelerin toplamı)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "visualization": {"type": "kpi", "kpi": {"valueField": "toplambakiye", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_net_bakiye';

-- 6. KPI: Müşteri Sayısı (Cari Kart - potansiyel != E)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "potansiyel", "operator": "!=", "value": "E", "logicalOperator": "AND"}],
  "visualization": {"type": "kpi", "kpi": {"valueField": "_key", "aggregation": "count", "format": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_musteri_sayisi';

-- 7. KPI: Banka Bakiyesi (Banka Hesap Listesi)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "9e3772f7-b1c5-431b-bb72-b78c517ea1e5",
  "diaApi": {"module": "bcs", "method": "bankahesabi_listele", "parameters": {}},
  "visualization": {"type": "kpi", "kpi": {"valueField": "bakiye", "aggregation": "sum", "format": "currency", "prefix": "₺"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'kpi_banka_bakiyesi';

-- 8. Grafik: Sektör Dağılımı (Cari Kart - group by sektorler)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "visualization": {"type": "donut", "chart": {"legendField": "sektorler", "valueField": "_key", "aggregation": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_sektor_dagilimi';

-- 9. Grafik: Kaynak Dağılımı (Cari Kart - group by kaynak)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "visualization": {"type": "donut", "chart": {"legendField": "kaynak", "valueField": "_key", "aggregation": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_kaynak_dagilimi';

-- 10. Grafik: Özel Kod Dağılımı (Cari Kart - group by ozelkod1kod)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "visualization": {"type": "donut", "chart": {"legendField": "ozelkod1kod", "valueField": "_key", "aggregation": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_ozelkod_dagilimi';

-- 11. Grafik: Lokasyon Dağılımı (Cari Kart - group by il)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "visualization": {"type": "bar", "chart": {"xAxis": {"field": "il"}, "yAxis": {"field": "_key"}, "valueField": "_key", "aggregation": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_lokasyon_dagilimi';

-- 12. Grafik: Cari Dönüşüm Trendi (Cari Kart - group by cariyedonusmetarihi)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "postFetchFilters": [{"id": "f1", "field": "cariyedonusmetarihi", "operator": "is_not_null", "value": "", "logicalOperator": "AND"}],
  "visualization": {"type": "line", "chart": {"xAxis": {"field": "cariyedonusmetarihi"}, "yAxis": {"field": "_key"}, "valueField": "_key", "aggregation": "count"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_cari_donusum_trend';

-- 13. Liste: Cari Listesi (Cari Kart)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "visualization": {"type": "table", "table": {"columns": [
    {"field": "carikartkodu", "header": "Kod"},
    {"field": "unvan", "header": "Ünvan"},
    {"field": "sehir", "header": "Şehir"},
    {"field": "ozelkod1kod", "header": "Özel Kod"},
    {"field": "aktif", "header": "Durum"}
  ], "rowLimit": 50}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_cari';

-- 14. Liste: Bugün Vadesi Gelenler (Cari Vade Bakiye)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "visualization": {"type": "list", "list": {"titleField": "unvan", "valueField": "toplambakiye", "format": "currency"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_bugun_vade';

-- 15. Liste: En Borçlu/Alacaklı (Cari Vade Bakiye - sort by bakiye)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "visualization": {"type": "list", "list": {"titleField": "unvan", "valueField": "toplambakiye", "format": "currency", "sortField": "toplambakiye", "sortOrder": "desc", "limit": 10}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_en_borclu';

-- 16. Liste: Aranacak Müşteriler (Cari Kart)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "11e5348f-d52e-4f0a-8c40-00ed47124c28",
  "diaApi": {"module": "scf", "method": "carikart_listele", "parameters": {}},
  "visualization": {"type": "list", "list": {"titleField": "unvan", "subtitleField": "telefon1", "limit": 10}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_aranacak_musteriler';

-- 17. Liste: Banka Hesapları (Banka Hesap Listesi)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "9e3772f7-b1c5-431b-bb72-b78c517ea1e5",
  "diaApi": {"module": "bcs", "method": "bankahesabi_listele", "parameters": {}},
  "visualization": {"type": "table", "table": {"columns": [
    {"field": "hesapadi", "header": "Hesap Adı"},
    {"field": "bankaadi", "header": "Banka"},
    {"field": "bakiye", "header": "Bakiye", "format": "currency"}
  ]}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_banka_hesaplari';

-- 18. Liste: Kritik Stok Uyarıları (Stok Listesi)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "10fbfcb4-13db-4493-83d7-3a8e5aaee71f",
  "diaApi": {"module": "scf", "method": "stokkart_listele", "parameters": {}},
  "visualization": {"type": "list", "list": {"titleField": "stokkartkodu", "subtitleField": "stokadi", "valueField": "miktar", "limit": 10}}
}'::jsonb, updated_at = now() WHERE widget_key = 'liste_kritik_stok';

-- 19. Grafik: Vade Yaşlandırma (Cari Vade Bakiye)
UPDATE widgets SET builder_config = '{
  "dataSourceId": "47c29eae-0215-4e85-86f0-160de9659ef4",
  "diaApi": {"module": "scf", "method": "carikart_vade_bakiye_listele", "parameters": {}},
  "visualization": {"type": "bar", "chart": {"xAxis": {"field": "vadegrubu"}, "yAxis": {"field": "toplambakiye"}, "valueField": "toplambakiye", "aggregation": "sum"}}
}'::jsonb, updated_at = now() WHERE widget_key = 'grafik_vade_yaslandirma';