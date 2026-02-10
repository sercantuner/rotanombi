

## Widget Bazinda "Mobilde Goster/Gizle" Kullanici Ayari

### Ozet
Her kullanici, kendi dashboard'undaki her widget icin "Bu widget mobilde gorunsun mu?" secenegini belirleyebilecek. Bu, super admin degil **kullanicinin kendisinin** kontrol ettigi bir ayar olacak. Widget hem masaustunde hem mobilde gorunebilir veya sadece masaustunde gorunur olabilir.

### Nasil Calisacak
- Kullanici, widget'in sag ust kosesindeki ayarlar popover'inda (WidgetFiltersButton) bir "Mobilde Goster" toggle'i gorecek.
- Toggle kapali oldugunda, o widget mobil cihazlarda tamamen gizlenecek.
- Toggle acik oldugunda (varsayilan), widget her iki platformda da gorunecek.
- Bu ayar kullaniciya ozeldir - her kullanici kendi tercihini yapar.

### Teknik Degisiklikler

#### 1. ContainerWidgetSettings Guncelleme (ContainerRenderer.tsx)
`ContainerWidgetSettings` interface'ine `hideOnMobile?: boolean` alani eklenecek. Varsayilan `false` (yani widget mobilde gorunur).

```text
ContainerWidgetSettings
+---------------------------+
| filters?: ...             |
| heightMultiplier?: ...    |
| hideOnMobile?: boolean    |  <-- YENI ALAN
+---------------------------+
```

#### 2. ContainerRenderer.tsx - Mobil Gizleme Mantigi
`renderSlots()` icerisinde, widget render edilmeden once mobil kontrolu yapilacak:
- `isMobile === true` ve `hideOnMobile === true` ise, o slot tamamen gizlenecek (render edilmeyecek).
- Masaustunde tum widget'lar her zaman gorunur.

#### 3. ContainerRenderer.tsx - Toggle Degisikligi Kaydetme
Yeni bir `handleMobileVisibilityChange` fonksiyonu eklenecek. Bu fonksiyon `container_widgets` tablosundaki `settings` JSONB alanina `hideOnMobile` degerini yazacak.

#### 4. WidgetFiltersButton.tsx - "Mobilde Goster" Toggle UI
Popover icerisine yeni bir bolum eklenecek:
- "Gorunum" basliginin altinda bir "Mobilde Goster" switch'i olacak.
- Toggle degistiginde `onMobileVisibilityChange` callback'i cagirilacak.
- Bu toggle **tum kullanicilar** icin gorunur olacak (super admin degil, herkes kendi widget'ini yonetebilir).

Yeni prop'lar:
- `hideOnMobile?: boolean` - mevcut deger
- `onMobileVisibilityChange?: (hide: boolean) => void` - degisiklik callback'i

#### 5. Veri Akisi

```text
Kullanici Toggle'i Degistirir
         |
         v
WidgetFiltersButton -> onMobileVisibilityChange(true/false)
         |
         v
ContainerRenderer -> handleMobileVisibilityChange()
         |
         v
UPDATE container_widgets SET settings = {..., hideOnMobile: true/false}
WHERE id = containerWidgetId
         |
         v
Mobilde: hideOnMobile === true ise widget gizlenir
Masaustunde: Her zaman gorunur
```

Degistirilecek dosyalar:
- `src/components/pages/ContainerRenderer.tsx` - Gizleme mantigi, ayar kaydetme, prop gecisi
- `src/components/dashboard/WidgetFiltersButton.tsx` - Mobilde Goster toggle UI

Veritabani degisikligi gerekmez - mevcut `container_widgets.settings` JSONB alani kullanilacak.

