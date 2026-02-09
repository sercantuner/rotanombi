

## Yeni Renk Paleti ve Tema Entegrasyonu

### Renk Paleti (HEX -> HSL)

| HEX | HSL | Kullanim |
|------|-----|----------|
| #f4b135 | hsl(39, 90%, 58%) | Amber/Altin - **Accent** |
| #308684 | hsl(179, 47%, 35%) | Teal - **Primary (Light)** |
| #50bb9f | hsl(162, 42%, 52%) | Mint - **Success/Accent Dark** |
| #112f41 | hsl(203, 60%, 16%) | Koyu Lacivert - **Background Dark** |
| #ed553b | hsl(8, 83%, 58%) | Mercan Kirmizi - **Destructive** |
| #769eb3 | hsl(203, 28%, 58%) | Celik Mavi - **Muted/Secondary** |
| #aeb730 | hsl(64, 58%, 45%) | Zeytin Yesili - **Warning/Ek** |
| #6d0210 | hsl(351, 97%, 23%) | Koyu Bordo - **Destructive Dark** |

### Degisecek Dosyalar

**1. `src/hooks/useChartColorPalette.tsx`**
- Yeni palet eklenmesi: `'rotanombi'` adinda, 8 rengi icerecek
- `ColorPaletteName` tipine `'rotanombi'` eklenmesi
- `COLOR_PALETTES` dizisinde ilk siraya konulmasi
- Default palet `'corporate'` yerine `'rotanombi'` olarak degistirilmesi (globalPaletteName fallback)

**2. `src/index.css`**
- **Light tema (`:root`)**: Primary -> Teal (#308684), Accent -> Amber (#f4b135), Destructive -> Mercan (#ed553b), Success -> Mint (#50bb9f), Warning -> Zeytin (#aeb730). Gradient'ler ve glow efektleri yeni renklere gore guncellenir.
- **Dark tema (`.dark`)**: Primary -> Mint (#50bb9f), Accent -> Amber (#f4b135), Background -> Koyu Lacivert (#112f41) tonlari, Destructive -> Mercan (#ed553b). Sidebar renkleri de Koyu Lacivert (#112f41) bazli olacak.
- Gradient'ler, glow efektleri ve glass efektleri yeni paletle uyumlu hale getirilecek.

**3. `src/pages/LoginPage.tsx`**
- **Normal Login**: Zaten tema token'lari (bg-primary, text-primary-foreground vb.) kullaniyor, CSS degisikligi otomatik yansiyacak. Ek degisiklik gerekmez.
- **Super Admin Login**: Hardcoded `sky-500/600/700`, `slate-*` renkleri var. Bunlar:
  - `sky-500/600` -> Teal/Mint tonlarina (`#308684` / `#50bb9f`)
  - `slate-900` -> Koyu Lacivert (`#112f41`)
  - `slate-800/700/600` -> #112f41 bazli acilmis tonlar
  - Butonlar, ikonlar ve hover efektleri yeni renk paletine uyarlanacak

**4. Landing Page Bilesenleri** (Dolayali etki)
- `HeroSection`, `FeaturesSection`, `StatsSection`, `PricingSection`, `BusinessSection`, `LandingFooter`: Hepsi CSS token'lari (`text-primary`, `bg-primary/10`, `text-accent` vb.) kullaniyor, `index.css` degisikligi otomatik yansiyacak. Ek kod degisikligi gerekmez.

**5. `src/components/layout/Sidebar.tsx`** (Dolayili etki)
- Sidebar renkleri CSS degiskenlerinden (`--sidebar-*`) geliyor, `index.css` guncellemesi yeterli.

### Teknik Detaylar

Light tema yeni CSS degiskenleri:
```
--primary: 179 47% 35%       (#308684 Teal)
--accent: 39 90% 58%          (#f4b135 Amber)
--destructive: 8 83% 58%      (#ed553b Mercan)
--success: 162 42% 52%        (#50bb9f Mint)
--warning: 64 58% 45%         (#aeb730 Zeytin)
```

Dark tema yeni CSS degiskenleri:
```
--primary: 162 42% 52%        (#50bb9f Mint - dark'ta daha iyi okunur)
--accent: 39 90% 58%          (#f4b135 Amber)
--background: 203 60% 10%    (#112f41 bazli karartilmis)
--destructive: 8 83% 58%      (#ed553b)
--success: 162 42% 52%        (#50bb9f)
```

Chart default palette:
```typescript
colors: ['#f4b135', '#308684', '#50bb9f', '#112f41', '#ed553b', '#769eb3', '#aeb730', '#6d0210']
```

### Beklenen Sonuc
- Tum kullanicilar icin varsayilan grafik paleti "RotanomBI" olacak
- Landing page, login, super admin login ve uygulama ici renkler tutarli olacak
- Dark modda okunurluk korunacak (#50bb9f ve #f4b135 koyu arka planlarda iyi gorulur)

Mevcut widget ozel palet secimlerini defaulta çek

