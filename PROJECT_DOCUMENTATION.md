# RotanomBI - Proje Tam Dokümantasyonu

> **Amaç:** Bu dosya, projeyi sıfırdan ayağa kaldırmak için gereken tek referans kaynağıdır.
> Harici bir Supabase projesine bağlanarak sistemi yeniden kurma rehberi içerir.

---

## 1. Proje Özeti

**RotanomBI**, DIA ERP sistemiyle entegre çalışan bir **Business Intelligence (BI) dashboarding platformudur.**

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions, Realtime) |
| Grafik | Recharts, Nivo (bar/line/pie/radar/heatmap/sankey/treemap…) |
| Durum Yönetimi | TanStack React Query + Context API |
| Sürükle-Bırak | @dnd-kit |
| Animasyon | Framer Motion |
| Veri Kaynağı | DIA ERP Web Service API v3 |

### Temel Yetenekler
- DIA ERP'den chunk bazlı veri senkronizasyonu (500 kayıt/chunk)
- Pre-computed widget snapshot'ları ile < 200ms dashboard yükleme
- No-code Widget Builder (KPI, grafik, tablo, pivot, özel kod)
- AI destekli widget kodu üretimi (React.createElement tabanlı)
- Çoklu sorgu birleştirme (LEFT/INNER/RIGHT/FULL JOIN, UNION)
- Rol tabanlı erişim kontrolü (super_admin, admin, user, viewer)
- Takım yönetimi (admin DIA credentials devralma)
- Dinamik sayfa ve konteyner sistemi
- Cron tabanlı otomatik senkronizasyon
- Realtime ilerleme takibi

---

## 2. Mimari Genel Bakış

### 2.1. Katmanlı Mimari

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  React + Vite + TypeScript + Tailwind + shadcn/ui   │
│  ┌─────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Contexts │ │   Hooks      │ │   Components     │  │
│  │ Auth     │ │ useDynamic.. │ │ Dashboard        │  │
│  │ Cache    │ │ useSync..    │ │ Widget Builder   │  │
│  │ Settings │ │ useCompany.. │ │ Marketplace      │  │
│  │ Sync     │ │ usePermis..  │ │ Admin Panel      │  │
│  │ Imperf.. │ │ useDiaProf.. │ │ Settings         │  │
│  └─────────┘ └──────────────┘ └──────────────────┘  │
│         │              │                │            │
│    Memory Cache    TanStack Query    Supabase SDK    │
└────────────┬───────────┬───────────────┬────────────┘
             │           │               │
┌────────────┴───────────┴───────────────┴────────────┐
│                 SUPABASE BACKEND                     │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │   Auth   │ │  PostgreSQL  │ │ Edge Functions   │  │
│  │ (email)  │ │  (RLS, RPC)  │ │ dia-login        │  │
│  │          │ │              │ │ dia-data-sync    │  │
│  │          │ │ company_data │ │ dia-api-test     │  │
│  │          │ │ _cache       │ │ dia-sync-periods │  │
│  │          │ │ widgets      │ │ widget-compute   │  │
│  │          │ │ widget_snap  │ │ ai-code-generator│  │
│  │          │ │ sync_*       │ │ widget-csv-import│  │
│  │          │ │ user_*       │ │                  │  │
│  └──────────┘ └──────────────┘ └─────────────────┘  │
│         │              │               │             │
│    Realtime      pg_cron/pg_net    CRON_SECRET       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────┐
│                  DIA ERP API v3                      │
│  https://{sunucu}.ws.dia.com.tr/api/v3/{modul}/json │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │   SCF    │ │ BCS  │ │ FAT  │ │ SIS  │ │ STK  │  │
│  │ Cari/Stok│ │Banka │ │Fatura│ │Sistem│ │ Stok │  │
│  └──────────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2. Provider/Context Hiyerarşisi

```
QueryClientProvider
  └─ ThemeProvider
       └─ TooltipProvider
            └─ BrowserRouter
                 └─ AuthProvider
                      └─ UserSettingsProvider
                           └─ DiaDataCacheProvider (userId)
                                └─ SyncOrchestratorProvider
                                     └─ ImpersonationProvider
                                          └─ Routes/Pages
```

### 2.3. Veri Akışı Stratejisi: DB-First v4.0

```
Widget İstek → Snapshot var mı? ─ EVET → Anında göster
                                    │
                                   HAYIR
                                    │
                            Memory Cache var mı?
                                    │
                              EVET ─┤─ HAYIR
                                │         │
                          Göster │    Supabase DB'den oku
                                │    (company_data_cache)
                                │         │
                                │    Veri var mı?
                                │         │
                                │   EVET ─┤─ HAYIR
                                │     │         │
                                │   Göster   DIA API'den çek
                                │     │      (Edge Function)
                                │     │         │
                                │     │    DB'ye yaz (upsert)
                                │     │         │
                                └─────┴─────────┘
```

---

## 3. Veritabanı Şeması

### 3.1. Enum Tipleri

```sql
-- Kullanıcı rolleri
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user', 'viewer');

-- Konteyner tipleri (sayfa düzeni)
CREATE TYPE public.container_type AS ENUM (
  'kpi_row_5', 'kpi_row_4', 'kpi_row_3',
  'chart_full', 'chart_half', 'chart_third',
  'map_full', 'map_half',
  'info_cards_3', 'info_cards_2',
  'table_full', 'list_full', 'custom_grid'
);
```

### 3.2. Ana Tablolar

#### `profiles` - Kullanıcı Profilleri ve DIA Bağlantı Bilgileri

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  
  -- DIA ERP Bağlantı Bilgileri
  dia_sunucu_adi TEXT,          -- DIA sunucu adı (örn: "demo")
  dia_api_key TEXT,             -- DIA API anahtarı
  dia_ws_kullanici TEXT,        -- DIA web servis kullanıcı adı
  dia_ws_sifre TEXT,            -- DIA web servis şifresi (şifreli saklanmalı)
  dia_session_id TEXT,          -- Aktif DIA oturum ID'si
  dia_session_expires TIMESTAMPTZ, -- Oturum bitiş zamanı (30 dk)
  firma_kodu TEXT,              -- DIA firma kodu
  firma_adi TEXT,               -- Firma adı
  donem_kodu TEXT,              -- Aktif mali dönem kodu
  donem_yili TEXT,              -- Dönem yılı (örn: "2024" veya "2024-2025")
  
  -- Uygulama ayarları
  use_mock_data BOOLEAN DEFAULT FALSE,
  is_demo_account BOOLEAN DEFAULT FALSE,
  is_team_admin BOOLEAN DEFAULT FALSE,
  license_type TEXT DEFAULT 'free',
  license_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Kullanıcı kendi profilini okuyabilir/güncelleyebilir
-- Hassas alanlar (dia_api_key, dia_ws_sifre vb.) sadece profil sahibine açık
-- Admin'ler profiles_safe view üzerinden temel bilgilere erişir
```

#### `user_roles` - Rol Tabanlı Erişim Kontrolü

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);
```

#### `user_permissions` - Modül Bazlı İzinler

```sql
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);
```

#### `user_teams` - Takım Yönetimi

```sql
CREATE TABLE public.user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id, member_id)
);
-- Team member'lar, admin'in DIA bağlantı bilgilerini devralır
```

#### `app_settings` - Kullanıcı Ayarları

```sql
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  chart_color_palette TEXT DEFAULT 'corporate',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `data_sources` - Merkezi Veri Kaynakları Tanımı

```sql
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,          -- Benzersiz kaynak kimliği (örn: "scf_carikart_listele")
  description TEXT,
  
  -- DIA API Konfigürasyonu
  module TEXT NOT NULL,               -- DIA modül adı (scf, bcs, fat, sis, stk)
  method TEXT NOT NULL,               -- DIA metot adı (carikart_listele, fatura_listele)
  filters JSONB DEFAULT '[]',         -- DIA API filtreleri [{field, operator, value}]
  sorts JSONB DEFAULT '[]',           -- DIA API sıralaması [{field, sorttype}]
  selected_columns TEXT[],            -- Çekilecek kolonlar (performans için)
  limit_count INTEGER DEFAULT 0,      -- 0 = limitsiz
  
  -- Dönem yapılandırması
  period_config JSONB,                -- Dönem loop yapılandırması
  is_period_independent BOOLEAN DEFAULT FALSE,  -- Dönem bağımsız mı?
  period_read_mode TEXT DEFAULT 'all_periods',  -- 'current_only' veya 'all_periods'
  skip_reconcile BOOLEAN DEFAULT FALSE,         -- Hash-key kaynaklar için reconcile atla
  is_non_dia BOOLEAN DEFAULT FALSE,             -- DIA dışı kaynak mı?
  
  -- Önbellek ayarları
  cache_ttl INTEGER DEFAULT 300,
  auto_refresh BOOLEAN DEFAULT FALSE,
  refresh_schedule TEXT,
  
  -- Son çalışma bilgisi
  last_fetched_at TIMESTAMPTZ,
  last_record_count INTEGER,
  last_fields TEXT[],
  last_sample_data JSONB,             -- Filtre önerileri için örnek veri
  
  -- Model görünümü
  filterable_fields JSONB,
  model_position JSONB,               -- {x, y} data model view pozisyonu
  
  is_active BOOLEAN DEFAULT TRUE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `company_data_cache` - Ana Veri Deposu

```sql
CREATE TABLE public.company_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,           -- DIA sunucu adı
  firma_kodu TEXT NOT NULL,           -- Firma kodu
  donem_kodu INTEGER NOT NULL,        -- Mali dönem kodu
  data_source_slug TEXT NOT NULL,     -- data_sources.slug referansı
  dia_key BIGINT NOT NULL,            -- DIA'daki _key değeri
  data JSONB NOT NULL,                -- DIA'dan gelen tüm veri (JSONB)
  is_deleted BOOLEAN DEFAULT FALSE,   -- Soft delete (reconcile ile)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tekil kısıtlama: Aynı kayıt birden fazla kez eklenemez
  UNIQUE(sunucu_adi, firma_kodu, donem_kodu, data_source_slug, dia_key)
);

-- TOAST stratejisi: JSONB sıkıştırması
ALTER TABLE public.company_data_cache ALTER COLUMN data SET STORAGE MAIN;

-- Temel indeks (RLS sorguları için)
CREATE INDEX idx_cdc_scope ON public.company_data_cache(sunucu_adi, firma_kodu, data_source_slug, is_deleted);
```

#### `widgets` - Widget Tanımları

```sql
CREATE TABLE public.widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key TEXT NOT NULL UNIQUE,     -- Benzersiz widget anahtarı (örn: "ai_toplam_ciro_kpi")
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'dashboard',   -- Legacy kategori
  type TEXT DEFAULT 'chart',           -- kpi, chart, table, list, summary
  data_source TEXT DEFAULT 'genel',
  size TEXT DEFAULT 'md',              -- sm, md, lg, xl, full
  icon TEXT,
  default_page TEXT DEFAULT 'dashboard',
  default_visible BOOLEAN DEFAULT TRUE,
  available_filters JSONB DEFAULT '[]',
  default_filters JSONB DEFAULT '{}',
  min_height TEXT,
  grid_cols INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,    -- Yeni kullanıcılara otomatik eklenir mi?
  default_sort_order INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  
  -- Builder Config - Widget'ın tüm yapılandırması (JSONB)
  builder_config JSONB,
  -- builder_config yapısı:
  -- {
  --   dataSourceId: string,           -- data_sources.id referansı
  --   diaApi: { module, method, parameters },
  --   multiQuery: { queries[], merges[], primaryQueryId },
  --   calculatedFields: [{id, name, label, expression}],
  --   postFetchFilters: [{id, field, operator, value, logicalOperator}],
  --   visualization: { type, kpi?, chart?, table?, pivot? },
  --   fieldWells: { xAxis?, yAxis?, legend?, value?, category? },
  --   chartSettings: { colorPalette, showLegend, ... },
  --   customCode: string,             -- AI tarafından üretilen React.createElement kodu
  --   requiredFields: string[],       -- JSONB alan projeksiyonu için
  --   widgetFilters: [{key, label, type, options}],
  --   widgetParameters: [{key, label, type, options}],
  --   drillDown: { ... },
  -- }
  
  -- Versiyon kontrolü
  version INTEGER DEFAULT 1,
  last_change_type TEXT,
  change_notes TEXT,
  
  -- Çoklu boyut ve sayfa desteği
  available_sizes TEXT[],
  target_pages TEXT[],
  
  -- AI Metadata
  short_description TEXT,
  long_description TEXT,
  technical_notes JSONB,
  preview_image TEXT,
  ai_suggested_tags TEXT[],
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `widget_categories` - Dinamik Kategori/Etiket Sistemi

```sql
CREATE TABLE public.widget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Tag',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `widget_tags` - Widget-Kategori İlişkileri (Many-to-Many)

```sql
CREATE TABLE public.widget_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.widget_categories(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(widget_id, category_id)
);
```

#### `widget_snapshots` - Önceden Hesaplanmış Widget Verileri

```sql
CREATE TABLE public.widget_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  raw_row_count INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  sync_trigger TEXT,                   -- 'manual', 'cron', 'sync_complete'
  status TEXT DEFAULT 'ready',         -- 'ready', 'computing', 'failed'
  error TEXT,
  computation_ms INTEGER,
  UNIQUE(sunucu_adi, firma_kodu, widget_id)
);
```

#### `widget_changelog` - Widget Değişiklik Geçmişi

```sql
CREATE TABLE public.widget_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  change_type TEXT NOT NULL,           -- 'created', 'updated'
  change_notes TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `widget_feedback` - Kullanıcı Geri Bildirimleri

```sql
CREATE TABLE public.widget_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `widget_permissions` - Widget Bazlı Erişim Kontrolü

```sql
CREATE TABLE public.widget_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE NOT NULL,
  can_view BOOLEAN DEFAULT TRUE,
  can_add BOOLEAN DEFAULT TRUE,
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, widget_id)
);
```

#### `user_pages` - Kullanıcı Sayfaları

```sql
CREATE TABLE public.user_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT 'LayoutDashboard',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `page_containers` - Sayfa Konteyner Yapısı

```sql
CREATE TABLE public.page_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.user_pages(id) ON DELETE CASCADE NOT NULL,
  container_type container_type NOT NULL,
  title TEXT,
  sort_order INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `container_widgets` - Konteynerdeki Widget'lar

```sql
CREATE TABLE public.container_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID REFERENCES public.page_containers(id) ON DELETE CASCADE NOT NULL,
  widget_id UUID REFERENCES public.widgets(id) ON DELETE CASCADE NOT NULL,
  slot_index INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Senkronizasyon Tabloları

```sql
-- Senkronizasyon Kilitleri (Concurrency Control)
CREATE TABLE public.sync_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL,     -- 30 dakika TTL
  sync_type TEXT DEFAULT 'full',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sunucu_adi, firma_kodu)
);

-- Arka Plan Senkronizasyon İşleri
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  status TEXT DEFAULT 'pending',       -- pending, running, completed, failed
  triggered_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sıralı Görev Kuyruğu
CREATE TABLE public.sync_queue_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  data_source_slug TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  task_type TEXT DEFAULT 'full',        -- full, incremental, reconcile
  status TEXT DEFAULT 'pending',
  offset_position INTEGER DEFAULT 0,
  records_fetched INTEGER DEFAULT 0,
  records_written INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Senkronizasyon Geçmişi
CREATE TABLE public.sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  donem_kodu INTEGER,
  data_source_slug TEXT,
  sync_type TEXT,                       -- full, incremental, cron, reconcile
  status TEXT,                          -- completed, failed
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  error TEXT,
  triggered_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dönem Bazlı Sync Durumu
CREATE TABLE public.period_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  data_source_slug TEXT NOT NULL,
  last_full_sync TIMESTAMPTZ,
  last_incremental_sync TIMESTAMPTZ,
  total_records INTEGER,
  is_locked BOOLEAN DEFAULT FALSE,
  UNIQUE(sunucu_adi, firma_kodu, donem_kodu, data_source_slug)
);
```

#### Dönem ve Şube Tabloları

```sql
-- Firma Mali Dönemleri
CREATE TABLE public.firma_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  period_no INTEGER NOT NULL,
  period_name TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMPTZ,
  UNIQUE(sunucu_adi, firma_kodu, period_no)
);

-- Firma Şubeleri
CREATE TABLE public.firma_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  branch_key INTEGER NOT NULL,
  branch_code TEXT,
  branch_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ,
  UNIQUE(sunucu_adi, firma_kodu, branch_key)
);

-- Firma Depoları
CREATE TABLE public.firma_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  branch_key INTEGER,
  warehouse_key INTEGER NOT NULL,
  warehouse_code TEXT,
  warehouse_name TEXT,
  can_view_movement BOOLEAN DEFAULT TRUE,
  can_operate BOOLEAN DEFAULT TRUE,
  can_view_quantity BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ,
  UNIQUE(sunucu_adi, firma_kodu, warehouse_key)
);
```

#### Diğer Tablolar

```sql
-- Zamanlanmış Görevler
CREATE TABLE public.cron_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  schedule_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,        -- Cron ifadesi (örn: "0 8 * * 1-5")
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sunucu_adi, firma_kodu)
);

-- Hariç Tutulan Dönemler
CREATE TABLE public.excluded_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  data_source_slug TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  excluded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sunucu_adi, firma_kodu, data_source_slug, donem_kodu)
);

-- Veri Kaynakları Arası İlişkiler
CREATE TABLE public.data_source_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE NOT NULL,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'left_join',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bildirimler
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3. Veritabanı Fonksiyonları

```sql
-- Rol kontrolü (RLS politikalarında kullanılır)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin kontrolü (admin + super_admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
$$;

-- Super Admin kontrolü
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- Şirket bazlı veri izolasyonu (RLS için)
CREATE OR REPLACE FUNCTION public.get_user_company_scope(p_user_id UUID)
RETURNS TABLE(sunucu_adi TEXT, firma_kodu TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Önce kullanıcının kendi profili
  SELECT p.dia_sunucu_adi, p.firma_kodu
  FROM public.profiles p
  WHERE p.user_id = p_user_id
    AND p.dia_sunucu_adi IS NOT NULL
    AND p.firma_kodu IS NOT NULL
  UNION
  -- Takım admin'inin profili (kullanıcı team member ise)
  SELECT p.dia_sunucu_adi, p.firma_kodu
  FROM public.user_teams t
  JOIN public.profiles p ON p.user_id = t.admin_id
  WHERE t.member_id = p_user_id
    AND p.dia_sunucu_adi IS NOT NULL
    AND p.firma_kodu IS NOT NULL
$$;

-- JSONB alan projeksiyonu (performans optimizasyonu)
CREATE OR REPLACE FUNCTION public.get_projected_cache_data(
  p_data_source_slug TEXT,
  p_sunucu_adi TEXT,
  p_firma_kodu TEXT,
  p_donem_kodu INTEGER,
  p_fields TEXT[],
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(data JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Manuel yetki kontrolü (RLS bypass'ı karşılığı)
  IF NOT EXISTS (
    SELECT 1 FROM public.get_user_company_scope(auth.uid()) s
    WHERE s.sunucu_adi = p_sunucu_adi AND s.firma_kodu = p_firma_kodu
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_object_agg(key, value) AS data
  FROM (
    SELECT c.id AS row_id, kv.key, kv.value
    FROM public.company_data_cache c,
         jsonb_each(c.data) kv
    WHERE c.data_source_slug = p_data_source_slug
      AND c.sunucu_adi = p_sunucu_adi
      AND c.firma_kodu = p_firma_kodu
      AND c.donem_kodu = p_donem_kodu
      AND c.is_deleted = FALSE
      AND kv.key = ANY(p_fields)
    ORDER BY c.id
    LIMIT p_limit OFFSET p_offset
  ) sub
  GROUP BY sub.row_id;
END;
$$;

-- Şirket için kullanılan widget'ları tespit et
CREATE OR REPLACE FUNCTION public.get_used_widget_ids_for_company(
  p_sunucu_adi TEXT,
  p_firma_kodu TEXT
)
RETURNS TABLE(widget_id UUID)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cw.widget_id
  FROM public.container_widgets cw
  JOIN public.page_containers pc ON pc.id = cw.container_id
  JOIN public.user_pages up ON up.id = pc.page_id
  JOIN public.profiles p ON p.user_id = up.user_id
  WHERE p.dia_sunucu_adi = p_sunucu_adi
    AND p.firma_kodu = p_firma_kodu
$$;

-- Otomatik updated_at trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Yeni kullanıcı kaydında otomatik profil oluşturma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;
```

### 3.4. Trigger'lar

```sql
-- Yeni kullanıcı kaydında otomatik profil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger'ları (tüm tablolar için)
-- profiles, widgets, data_sources, user_pages, page_containers,
-- container_widgets, widget_snapshots, cron_schedules, app_settings, vb.
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- (Diğer tablolar için benzer trigger'lar...)
```

### 3.5. RLS Politikaları (Özet)

| Tablo | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Kendi profili | - | Kendi profili | - |
| `user_roles` | Kendi rolleri veya admin | Admin | Admin | Admin |
| `user_permissions` | Kendi veya admin | Admin | Admin | Admin |
| `user_teams` | Admin=admin_id, Member=member_id | Admin | Admin | Admin |
| `company_data_cache` | `get_user_company_scope()` ile şirket bazlı | Auth | Auth | Auth |
| `data_sources` | Auth (tümü) | `is_admin()` | `is_admin()` | `is_admin()` |
| `widgets` | Auth (aktif olanlar) | `is_admin()` | `is_admin()` | `is_admin()` |
| `widget_snapshots` | `get_user_company_scope()` | Auth | Auth | Auth |
| `user_pages` | `user_id = auth.uid()` | Auth (kendi) | Auth (kendi) | Auth (kendi) |
| `page_containers` | Sayfa sahibi | Sayfa sahibi | Sayfa sahibi | Sayfa sahibi |
| `container_widgets` | Konteyner sahibi | Auth | Auth | Auth |
| `sync_locks` | Auth | Auth | Auth | Auth |
| `firma_periods` | `get_user_company_scope()` | Auth | Auth | - |
| `cron_schedules` | `is_admin()` | `is_admin()` | `is_admin()` | `is_admin()` |

### 3.6. Realtime Ayarları

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_queue_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cron_schedules;
```

---

## 4. Edge Function'lar (Backend)

### 4.1. `dia-login` - DIA ERP Giriş

**Amaç:** Kullanıcının DIA ERP bilgileriyle ilk bağlantıyı kurar ve session_id alır.

**Endpoint:** `POST /functions/v1/dia-login`

**İstek:**
```json
{
  "sunucuAdi": "demo",
  "apiKey": "API_KEY",
  "wsKullanici": "ws_user",
  "wsSifre": "ws_pass",
  "firmaKodu": 1,
  "donemKodu": 0
}
```

**İş Mantığı:**
1. DIA API URL oluştur: `https://{sunucu}.ws.dia.com.tr/api/v3/sis/json`
2. `login` metodu ile DIA'ya istek at
3. Yanıttaki `msg` alanından `session_id` al (code="200" ise)
4. `profiles` tablosunu güncelle (sunucu, apikey, session_id, expires +30dk)
5. Session bilgilerini frontend'e döndür

### 4.2. `dia-data-sync` - Ana Senkronizasyon Motoru

**Amaç:** DIA ERP'den verileri çekerek `company_data_cache` tablosuna yazar.

**Endpoint:** `POST /functions/v1/dia-data-sync`

**Aksiyonlar (action parametresi ile):**

| Aksiyon | Açıklama |
|---------|----------|
| `acquireLock` | Senkronizasyon kilidi al (30dk TTL). Super admin force-acquire yapabilir. |
| `releaseLock` | Kilidi serbest bırak |
| `getSyncStatus` | Dönem bazlı sync durumunu getir |
| `getRecordCounts` | DIA'dan sadece `_key` listesi çekerek kayıt sayılarını öğren |
| `syncChunk` | Chunk bazlı veri çekme (500 kayıt/chunk, sayfalama ile) |
| `incrementalSync` | `_date >= last_sync` filtresi ile sadece değişen kayıtları çek |
| `reconcileKeys` | DIA'daki `_key` listesini DB ile karşılaştır, silinenleri `is_deleted=true` yap |
| `markFullSyncComplete` | `period_sync_status` tablosunu güncelle |
| `lockPeriod` | Dönem kilitlenmesi (artık sadece reconcile yapılır) |
| `cronSync` | CRON_SECRET ile tetiklenen otomatik senkronizasyon |
| `manageCronSchedules` | `cron.schedule()` / `cron.unschedule()` SQL çalıştırma |

**syncChunk İş Mantığı:**
1. DIA session'ını doğrula/yenile (`ensureValidSession`)
2. Data source config'ini oku (`data_sources` tablosu)
3. Widget Field Pool'dan gerekli kolonları hesapla (selectedcolumns optimizasyonu)
4. DIA API'ye paginated istek at (limit+offset)
5. `company_data_cache` tablosuna upsert (onConflict: sunucu+firma+donem+slug+dia_key)
6. DIA 501 "Veri Hatası" alınırsa projeksiyon olmadan tekrar dene

### 4.3. `dia-api-test` - Widget Builder API Test Aracı

**Amaç:** Widget Builder'da veri kaynağı test etme, alan analizi, dönem loop.

**Endpoint:** `POST /functions/v1/dia-api-test`

**Özellikler:**
- `rawMode`: Ham JSON payload gönderme
- `returnAllData`: Tüm veriyi widget renderer'a döndürme
- `targetUserId`: Super admin impersonation
- `checkConnectionOnly`: Sadece DIA yapılandırma kontrolü
- `ensureSessionOnly`: Sadece session yenileme
- `periodConfig`: Dönem loop (geçmiş dönemleri de çekme)
- Alan tipleri tespiti (`detectFieldType`), istatistik çıkarma (min/max/sum/distinct)
- Nested dizi alanları bellek optimizasyonu (atlanır)

### 4.4. `dia-sync-periods` - Dönem/Şube/Depo Senkronizasyonu

**Amaç:** DIA'dan `sis_yetkili_firma_donem_sube_depo` metodu ile firma yapısını çeker.

**Endpoint:** `POST /functions/v1/dia-sync-periods`

**İş Mantığı:**
1. `getDiaSession` ile oturum al
2. `sis_yetkili_firma_donem_sube_depo` metodunu çağır
3. Kullanıcının firma koduna ait dönemleri, şubeleri, depoları ayrıştır
4. `firma_periods`, `firma_branches`, `firma_warehouses` tablolarına upsert
5. Aktif dönemi tespit et (ontanimli='t' > tarih aralığı > en yüksek)
6. Profili güncelle (donem_kodu, firma_adi, donem_yili)

### 4.5. `widget-compute` - Widget Snapshot Hesaplama

**Amaç:** `company_data_cache`'ten veri okuyarak widget sonuçlarını önceden hesaplar.

**Endpoint:** `POST /functions/v1/widget-compute`

**İş Mantığı:**
1. Hedef şirket (veya tüm şirketler) için aktif widget'ları bul
2. `get_used_widget_ids_for_company()` RPC ile sadece kullanılan widget'ları filtrele
3. Her widget için:
   - Multi-query ise: Her sorgunun verisini çek, merge uygula
   - Single query ise: Tek veri kaynağından çek
   - Calculated fields uygula
   - Post-fetch filtreler uygula
   - Visualization tipine göre sonuç hesapla (KPI/Chart/Table)
   - Custom code varsa: React referansı yoksa server-side çalıştır, varsa raw data kaydet
4. `widget_snapshots` tablosuna upsert
5. Self-chaining: `MAX_COMPANIES_PER_INVOCATION=2` sonra pg_net ile kendi kendini tetikle

**Timeout:** Widget başına 10sn, batch boyutu 2 widget.

### 4.6. `ai-code-generator` - AI Widget Kodu Üretimi

**Amaç:** Kullanıcı açıklamasına göre AI ile widget kodu üretir.

**Endpoint:** `POST /functions/v1/ai-code-generator`

**Özellikler:**
- Lovable AI Gateway kullanır (LOVABLE_API_KEY)
- React.createElement tabanlı kod üretir (JSX yasak)
- Recharts, LucideIcons, UI.Dialog scope'unda çalışır
- Renk sistemi: CSS değişkenleri zorunlu (sabit renk yasak)
- Para birimi formatı: TRY/USD/EUR/GBP destekli
- KPI sabit şablonu: Centered layout, w-12 h-12 ikon, text-3xl değer
- Mobil tam ekran popup zorunluluğu

### 4.7. `widget-csv-import` - CSV Dosyasından Widget İçe Aktarma

**Amaç:** CSV formatında widget verisi yükler/günceller.

**Özellikler:** Semicolon ayırıcı, UUID + widget_key doğrulama, version kontrolü, dry-run modu.

### 4.8. Paylaşılan Modüller (`_shared/`)

#### `diaAutoLogin.ts` - Otomatik Oturum Yenileme

```typescript
// Ana fonksiyonlar:
getDiaSession(supabase, userId)       // Geçerli session al veya otomatik login yap
ensureValidSession(supabase, userId)  // Uzun işlemlerde session tazele
invalidateSession(supabase, userId)   // Session'ı geçersiz kıl
withSessionRetry(supabase, userId, operation) // INVALID_SESSION'da retry

// Team member desteği:
getEffectiveUserId(supabase, userId)  // user_teams tablosundan admin_id bul

// Session süresi: 30 dakika, 2 dakika buffer ile "geçersiz" sayılır
```

#### `widgetFieldPool.ts` - Widget Alan Havuzu

```typescript
// Tüm widget'ların selectedcolumns'larını birleştirerek
// her veri kaynağı için minimum kolon seti hesaplar
getAllPooledColumns(supabase)          // Map<dataSourceId, string[] | null>
getPooledColumnsForSource(supabase, dataSourceId) // string[] | null
// null = projeksiyon yapılamaz (en az 1 widget kolon tanımlamadı)
```

#### `diaDataFetch.ts` - DIA Veri Çekme (Legacy)

```typescript
fetchFromDia(diaSession, module, method, donemKodu, dateFilter?)
upsertData(supabase, sunucuAdi, firmaKodu, donemKodu, slug, records)
```

#### `turkeyTime.ts` - Türkiye Saat Dilimi

```typescript
getTurkeyToday() // YYYY-MM-DD formatında bugünün tarihi (UTC+3)
```

---

## 5. Frontend Mimarisi

### 5.1. Context'ler

| Context | Dosya | Sorumluluk |
|---------|-------|------------|
| `AuthContext` | `src/contexts/AuthContext.tsx` | login, register, logout, resetPassword. Supabase Auth ile email/password. |
| `UserSettingsContext` | `src/contexts/UserSettingsContext.tsx` | Mock data toggle, grafik renk paleti, widget layout/filtre yönetimi |
| `DiaDataCacheContext` | `src/contexts/DiaDataCacheContext.tsx` | Memory cache (TTL: 10dk), scope-aware caching, stale-while-revalidate, background revalidation tracker |
| `SyncOrchestratorContext` | `src/contexts/SyncOrchestratorContext.tsx` | Senkronizasyon durumu paylaşımı (progress, tasks) |
| `ImpersonationContext` | `src/contexts/ImpersonationContext.tsx` | Super admin kullanıcı taklit etme, DIA bağlantı durumu kontrolü |

### 5.2. Önemli Hook'lar

| Hook | Dosya | Sorumluluk |
|------|-------|------------|
| `useDiaProfile` | `src/hooks/useDiaProfile.tsx` | DIA bağlantı bilgileri (team member devralma dahil) |
| `useCompanyData` | `src/hooks/useCompanyData.tsx` | DB'den veri okuma (sayfalama, dönem, projeksiyon desteği) |
| `useDynamicWidgetData` | `src/hooks/useDynamicWidgetData.tsx` | Widget veri hazırlama: snapshot-first → DB fallback → merge/filtre/agregasyon |
| `useSyncOrchestrator` | `src/hooks/useSyncOrchestrator.tsx` | Senkronizasyon orkestrasyonu: kilit → kayıt sayısı → chunk sync → reconcile → widget-compute |
| `useDataSources` | `src/hooks/useDataSources.tsx` | Veri kaynakları CRUD |
| `useWidgets` | `src/hooks/useWidgets.tsx` | Widget listesi ve etiket yönetimi |
| `useWidgetAdmin` | `src/hooks/useWidgets.tsx` | Widget CRUD (super admin) |
| `useUserPages` | `src/hooks/useUserPages.tsx` | Sayfa/konteyner/widget yönetimi |
| `usePermissions` | `src/hooks/usePermissions.tsx` | Rol/izin kontrolü, takım üyesi yönetimi |
| `useFirmaPeriods` | `src/hooks/useFirmaPeriods.tsx` | Mali dönem yönetimi |

### 5.3. Sayfa Rotaları

| Rota | Bileşen | Açıklama |
|------|---------|----------|
| `/` | `LandingPage` | Pazarlama sayfası |
| `/login` | `LoginPage` | Giriş/Kayıt |
| `/reset-password` | `ResetPasswordPage` | Şifre sıfırlama |
| `/dashboard` | `DashboardPage` → `ContainerBasedDashboard` | Ana dashboard (konteyner sistemi) |
| `/page/:pageSlug` | `DynamicPage` | Kullanıcı tanımlı sayfalar |
| `/ayarlar` | `SettingsPage` | DIA bağlantı, profil, veri yönetimi |
| `/takim` | `TeamManagementPage` | Takım üyesi ekleme/çıkarma |
| `/admin` | `AdminPage` | Kullanıcı yönetimi |
| `/marketplace` | `WidgetMarketplacePage` | Widget marketi (etiket filtreleme) |
| `/widget-builder` | `WidgetBuilderPage` | No-code widget oluşturucu |
| `/datasource-editor` | `DataSourceEditorPage` | Veri modeli görünümü (ilişki editörü) |
| `/super-admin-panel` | `SuperAdminPanel` | Super admin yönetim paneli |
| `/super-admin/users` | `SuperAdminUsersPage` | Kullanıcı listeleme/yönetimi |

---

## 6. Veri Akış Senaryoları

### 6.1. Senkronizasyon Akışı

```
1. Kullanıcı "Senkronize Et" butonuna tıklar
2. Frontend acquireLock → sync_locks tablosuna kilit yaz
3. Her veri kaynağı + dönem çifti için task listesi oluştur
4. getRecordCounts → DIA'dan sadece _key çekerek kayıt sayılarını öğren
5. DB'deki mevcut kayıt sayılarını çek (company_data_cache COUNT)
6. Karşılaştır:
   - DB >= DIA → Sadece reconcile yap
   - DB < DIA → Resume-from-offset (kaldığı yerden devam)
   - DB = 0 → Full sync
7. Her task için sırayla çalıştır:
   a. syncChunk → 500 kayıt/chunk, sayfalama ile DIA'dan çek → DB'ye upsert
   b. reconcileKeys → DIA _key listesi vs DB _key listesi → silinen = is_deleted
   c. markFullSyncComplete → period_sync_status güncelle
8. widget-compute tetikle → Snapshot'ları güncelle
9. releaseLock → Kilidi bırak
10. React Query cache'lerini invalidate et
```

### 6.2. Widget Rendering Akışı (useDynamicWidgetData)

```
1. Widget snapshot var mı? (widget_snapshots tablosu)
   → EVET ve status='ready': Snapshot'ı anında göster (< 200ms)
   → HAYIR veya filtre uygulanıyorsa: Canlı hesaplamaya geç

2. Canlı hesaplama:
   a. dataSourceId'den data_sources metadata'sını al
   b. Memory cache'te veri var mı? (DiaDataCacheContext)
      → EVET: Göster
      → HAYIR: company_data_cache'ten oku (useCompanyData)
   c. Period-independent kaynak mı?
      → EVET & current_only: Sadece aktif dönemden oku
      → EVET & all_periods: Tüm dönemlerden birleştir
   d. Multi-query varsa: Her sorgunun verisini çek, merge uygula
   e. Calculated fields uygula (expression tree evaluation)
   f. Post-fetch filtreler uygula
   g. Widget local filtreler uygula (arama, cari tip, şube, depo, özel kodlar)
   h. Visualization tipine göre sonuç hazırla:
      - KPI: Agregasyon (sum/avg/count/min/max)
      - Chart: groupDataForChart (group by + aggregation + displayLimit)
      - Table: Ham veri + kolon formatları
      - Custom: Kullanıcı kodunu new Function() ile çalıştır
```

---

## 7. Harici Supabase Kurulumu Rehberi

### 7.1. Yeni Supabase Projesi Oluşturma

1. [supabase.com](https://supabase.com) üzerinden yeni proje oluştur
2. Proje URL ve anon key'i not al

### 7.2. Extension'ları Etkinleştirme

```sql
-- SQL Editor'da çalıştır:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 7.3. Migration'ları Çalıştırma

`supabase/migrations/` klasöründeki tüm `.sql` dosyalarını **tarih sırasına göre** SQL Editor'da çalıştırın. İlk dosya `20260116132758_...sql` ile başlar.

> **Not:** Migration dosyaları read-only olarak proje içinde mevcuttur.

### 7.4. Edge Function'ları Deploy Etme

```bash
# Supabase CLI kurulumu
npm install -g supabase

# Projeye bağlan
supabase link --project-ref YOUR_PROJECT_REF

# Tüm fonksiyonları deploy et
supabase functions deploy dia-login
supabase functions deploy dia-api-test
supabase functions deploy dia-data-sync
supabase functions deploy dia-sync-periods
supabase functions deploy widget-compute
supabase functions deploy ai-code-generator
supabase functions deploy widget-csv-import
```

### 7.5. Supabase Config (Edge Function JWT)

Edge function'lar JWT doğrulamasını kod içinde yapar. `config.toml`'da gerekirse:

```toml
[functions.dia-login]
verify_jwt = false

[functions.dia-api-test]
verify_jwt = false

[functions.dia-data-sync]
verify_jwt = false

[functions.dia-sync-periods]
verify_jwt = false

[functions.widget-compute]
verify_jwt = false

[functions.ai-code-generator]
verify_jwt = false

[functions.widget-csv-import]
verify_jwt = false
```

### 7.6. Secret'ları Ayarlama

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set CRON_SECRET=your_random_secret_for_cron_triggers
supabase secrets set LOVABLE_API_KEY=your_lovable_api_key_for_ai
```

### 7.7. .env Dosyasını Güncelleme

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

### 7.8. İlk Super Admin Kullanıcısını Oluşturma

1. Uygulamadan normal kayıt yap
2. SQL Editor'da:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'your@email.com';
```

### 7.9. Realtime Yapılandırması

Migration'larda zaten tanımlıdır, ancak kontrol edin:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_queue_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cron_schedules;
```

---

## 8. Önemli Konfigürasyonlar

### 8.1. İstek Kuyruğu (Frontend Rate Limiting)

```typescript
// src/lib/diaRequestQueue.ts
maxConcurrent: 2        // Aynı anda en fazla 2 istek
// 429 hatası → 30sn duraklatma
// INVALID_SESSION → Otomatik retry
```

### 8.2. Cache TTL Değerleri

| Katman | TTL | Stale Threshold |
|--------|-----|-----------------|
| Memory Cache (DiaDataCacheContext) | 10 dakika | %80 (8dk) |
| React Query (useCompanyData) | 5 dakika (staleTime) | - |
| React Query gcTime | 30 dakika | - |

### 8.3. Senkronizasyon Parametreleri

| Parametre | Değer |
|-----------|-------|
| Chunk boyutu | 500 kayıt |
| Sayfa boyutu (DIA paging) | 100 kayıt |
| Kilit TTL | 30 dakika |
| Max retry | 3 (2s, 4s, 8s delay) |
| Widget hesaplama timeout | 10sn/widget |
| Widget batch boyutu | 2 widget |
| Self-chain şirket limiti | 2 şirket/invocation |

### 8.4. DIA API Endpoint Formatı

```
https://{sunucuAdi}.ws.dia.com.tr/api/v3/{module}/json

Modüller: scf (Cari/Stok), bcs (Banka), fat (Fatura), sis (Sistem), stk (Stok), gts (...)
Metot format: {module}_{method} (örn: scf_carikart_listele)
```

### 8.5. Konteyner Tipleri ve Grid Sınıfları

| Tip | Slot | Grid Class |
|-----|------|-----------|
| `kpi_row_5` | 5 | `grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-0.5 md:gap-1` |
| `kpi_row_4` | 4 | `grid-cols-2 md:grid-cols-4 gap-0.5 md:gap-1` |
| `kpi_row_3` | 3 | `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0.5 md:gap-1` |
| `chart_full` | 1 | `grid-cols-1 gap-0.5` |
| `chart_half` | 2 | `grid-cols-1 md:grid-cols-2 gap-0.5 md:gap-1` |
| `chart_third` | 3 | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 md:gap-1` |
| `table_full` | 1 | `grid-cols-1 gap-0.5` |
| `custom_grid` | 6 | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-0.5 md:gap-1` |

---

## 9. Güvenlik Notları

1. **RLS**: Tüm tablolarda Row Level Security aktif. `company_data_cache` şirket bazlı izole.
2. **SECURITY DEFINER**: `has_role()`, `is_admin()`, `get_user_company_scope()`, `get_projected_cache_data()` fonksiyonları recursive RLS sorununu önler.
3. **Hassas veri koruması**: `profiles` tablosundaki DIA şifreleri sadece profil sahibine açık. `profiles_safe` view ile admin'ler temel bilgilere erişir.
4. **Impersonation**: Super admin, `dia-api-test` ve `dia-data-sync` fonksiyonlarına `targetUserId` göndererek başka kullanıcının verilerine erişir. Frontend'e hassas bilgi taşınmaz.
5. **Cron güvenliği**: `cronSync` aksiyonu `CRON_SECRET` header kontrolü yapar.
6. **Edge Function auth**: Tüm fonksiyonlar JWT token veya service_role_key doğrulaması yapar.
