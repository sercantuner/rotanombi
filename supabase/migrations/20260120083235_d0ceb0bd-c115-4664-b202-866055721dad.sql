-- Widget kategorileri için yeni tablo
CREATE TABLE widget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Folder',
  color VARCHAR(20),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS aktifleştir
ALTER TABLE widget_categories ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Widget categories are viewable by everyone"
ON widget_categories FOR SELECT
USING (true);

-- Sadece adminler ekleyebilir/düzenleyebilir
CREATE POLICY "Admins can manage widget categories"
ON widget_categories FOR ALL
USING (public.is_admin(auth.uid()));

-- Mevcut kategorileri ekle
INSERT INTO widget_categories (slug, name, icon, sort_order) VALUES
('dashboard', 'Dashboard', 'LayoutGrid', 1),
('satis', 'Satış', 'ShoppingCart', 2),
('finans', 'Finans', 'Wallet', 3),
('cari', 'Cari Hesaplar', 'Users', 4);