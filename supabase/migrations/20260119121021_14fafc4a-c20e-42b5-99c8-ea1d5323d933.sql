-- Widget tanımları tablosu (Super Admin tarafından yönetilir)
CREATE TABLE public.widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_key TEXT NOT NULL UNIQUE, -- Kod içinde kullanılacak benzersiz anahtar (örn: 'kpi_toplam_alacak')
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'dashboard', -- dashboard, satis, finans, cari
  type TEXT NOT NULL DEFAULT 'kpi', -- kpi, chart, table, list, summary
  data_source TEXT NOT NULL DEFAULT 'genel', -- genel, satis, finans, mock
  size TEXT NOT NULL DEFAULT 'md', -- sm, md, lg, xl, full
  icon TEXT, -- Lucide icon adı (örn: 'DollarSign')
  default_page TEXT NOT NULL DEFAULT 'dashboard', -- Varsayılan gösterileceği sayfa
  default_visible BOOLEAN NOT NULL DEFAULT true,
  available_filters JSONB DEFAULT '[]'::jsonb, -- Uygulanabilir filtreler
  default_filters JSONB DEFAULT '{}'::jsonb,
  min_height TEXT,
  grid_cols INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true, -- Widget aktif mi?
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;

-- Herkes widget listesini görebilir (public read)
CREATE POLICY "Widgets are viewable by everyone"
ON public.widgets
FOR SELECT
USING (is_active = true);

-- Sadece admin'ler widget oluşturabilir/düzenleyebilir/silebilir
CREATE POLICY "Admins can insert widgets"
ON public.widgets
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update widgets"
ON public.widgets
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete widgets"
ON public.widgets
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Admin'ler inaktif widget'ları da görebilir
CREATE POLICY "Admins can view all widgets"
ON public.widgets
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_widgets_updated_at
BEFORE UPDATE ON public.widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Mevcut widget'ları tabloya aktar (varsayılan widget'lar)
INSERT INTO public.widgets (widget_key, name, description, category, type, data_source, size, icon, default_page, default_visible, available_filters, default_filters, min_height, sort_order) VALUES
-- KPI Widgets
('kpi_toplam_alacak', 'Toplam Alacak', 'Toplam alacak bakiyesi', 'finans', 'kpi', 'genel', 'sm', 'TrendingUp', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 1),
('kpi_gecikmis_alacak', 'Gecikmiş Alacak', 'Vadesi geçmiş alacaklar', 'finans', 'kpi', 'genel', 'sm', 'AlertTriangle', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 2),
('kpi_toplam_borc', 'Toplam Borç', 'Toplam borç bakiyesi', 'finans', 'kpi', 'genel', 'sm', 'TrendingDown', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 3),
('kpi_gecikmis_borc', 'Gecikmiş Borç', 'Vadesi geçmiş borçlar', 'finans', 'kpi', 'genel', 'sm', 'AlertCircle', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 4),
('kpi_net_bakiye', 'Net Bakiye', 'Alacak - Borç farkı', 'finans', 'kpi', 'genel', 'sm', 'Scale', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 5),
('kpi_musteri_sayisi', 'Müşteri Sayısı', 'Toplam cari hesap sayısı', 'cari', 'kpi', 'genel', 'sm', 'Users', 'cari', false, '["gorunumModu", "durum", "cariKartTipi"]', '{"gorunumModu": "cari", "durum": "aktif", "cariKartTipi": ["AL"]}', null, 6),
('kpi_net_satis', 'Net Satış', 'Toplam net satış tutarı', 'satis', 'kpi', 'satis', 'sm', 'DollarSign', 'satis', true, '[]', '{}', null, 7),
('kpi_brut_satis', 'Brüt Satış', 'Toplam brüt satış tutarı', 'satis', 'kpi', 'satis', 'sm', 'TrendingUp', 'satis', true, '[]', '{}', null, 8),
('kpi_iade_tutari', 'İade Tutarı', 'Toplam iade tutarı', 'satis', 'kpi', 'satis', 'sm', 'RotateCcw', 'satis', true, '[]', '{}', null, 9),
('kpi_fatura_sayisi', 'Fatura Sayısı', 'Toplam fatura adedi', 'satis', 'kpi', 'satis', 'sm', 'FileText', 'satis', true, '[]', '{}', null, 10),
('kpi_banka_bakiyesi', 'Banka Bakiyesi', 'Toplam banka bakiyesi', 'finans', 'kpi', 'finans', 'sm', 'Building2', 'finans', true, '[]', '{}', null, 11),

-- Chart Widgets
('grafik_vade_yaslandirma', 'Vade Yaşlandırma', 'Nakit akış projeksiyonu grafiği', 'finans', 'chart', 'genel', 'full', 'BarChart3', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', '300px', 20),
('grafik_sektor_dagilimi', 'Sektör Dağılımı', 'Carilerin sektörel dağılımı', 'cari', 'chart', 'genel', 'md', 'PieChart', 'cari', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 21),
('grafik_kaynak_dagilimi', 'Kaynak Dağılımı', 'Müşteri edinme kaynaklarının dağılımı', 'cari', 'chart', 'genel', 'md', 'PieChart', 'cari', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 22),
('grafik_ozelkod_dagilimi', 'Özel Kod Dağılımı', 'Carilerin özel kod dağılımı', 'cari', 'chart', 'genel', 'md', 'PieChart', 'cari', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 23),
('grafik_lokasyon_dagilimi', 'Lokasyon Dağılımı', 'Şehir bazlı müşteri dağılımı', 'cari', 'chart', 'genel', 'lg', 'MapPin', 'cari', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 24),
('grafik_cari_donusum_trend', 'Cari Dönüşüm Trendi', 'Potansiyelden cariye dönüşüm trendi', 'cari', 'chart', 'genel', 'lg', 'LineChart', 'cari', true, '[]', '{}', null, 25),
('grafik_marka_dagilimi', 'Marka Dağılımı', 'Satışların marka bazlı dağılımı', 'satis', 'chart', 'satis', 'md', 'PieChart', 'satis', true, '[]', '{}', null, 26),

-- List/Table Widgets
('liste_kritik_stok', 'Kritik Stok Uyarıları', 'Stok seviyesi kritik olan ürünler', 'satis', 'list', 'mock', 'md', 'Package', 'dashboard', true, '[]', '{}', '250px', 30),
('liste_bugun_vade', 'Bugün Vadesi Gelenler', 'Bugün vadesi gelen alacak ve borçlar', 'finans', 'list', 'genel', 'md', 'Calendar', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', '250px', 31),
('liste_aranacak_musteriler', 'Aranacak Müşteriler', 'Bugün takip edilmesi gereken müşteriler', 'cari', 'list', 'genel', 'md', 'Phone', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', '250px', 32),
('liste_en_borclu', 'En Borçlu/Alacaklı', 'En yüksek bakiyeli cariler', 'finans', 'list', 'genel', 'lg', 'ListOrdered', 'dashboard', true, '["gorunumModu", "durum", "cariKartTipi"]', '{}', null, 33),
('liste_banka_hesaplari', 'Banka Hesapları', 'Banka hesapları ve bakiyeleri', 'finans', 'list', 'finans', 'lg', 'Building2', 'dashboard', true, '[]', '{}', null, 34),
('liste_satis_elemani_performans', 'Satış Elemanı Performansı', 'Satış temsilcileri performans listesi', 'satis', 'list', 'genel', 'full', 'Users', 'dashboard', true, '[]', '{}', null, 35),
('liste_cari', 'Cari Listesi', 'Tüm cariler tablosu', 'cari', 'table', 'genel', 'full', 'Table2', 'cari', true, '["gorunumModu", "durum", "cariKartTipi", "ozelKodlar", "sehirler", "satisElemanlari"]', '{}', null, 36),
('liste_top_urunler', 'En Çok Satan Ürünler', 'En çok satılan ürünler listesi', 'satis', 'table', 'satis', 'lg', 'Trophy', 'satis', true, '[]', '{}', null, 37),

-- Summary Widgets
('ozet_gunluk', 'Günlük Özet', 'Günlük satış, tahsilat ve ödeme özeti', 'dashboard', 'summary', 'satis', 'full', 'Activity', 'dashboard', true, '[]', '{}', null, 40);