import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotaLogoDark from '@/assets/rota-logo-dark.svg';
import rotaLogoLight from '@/assets/rota-logo-light.svg';
import {
  Brain, Zap, GripVertical, Database, Store, Users,
  Check, ArrowRight, BarChart3, Sparkles, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function useLiveStats() {
  const [stats, setStats] = useState({ users: 0, widgets: 0, aiWidgets: 0 });

  useEffect(() => {
    async function fetch() {
      const [profilesRes, widgetsRes, aiRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('widgets').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('widgets').select('id', { count: 'exact', head: true }).eq('type', 'custom_code'),
      ]);
      setStats({
        users: profilesRes.count ?? 0,
        widgets: widgetsRes.count ?? 0,
        aiWidgets: aiRes.count ?? 0,
      });
    }
    fetch();
  }, []);

  return stats;
}

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return scrolled;
}

/* ─── Header ─── */
function LandingHeader() {
  const scrolled = useScrolled();
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <Link to="/" className="flex items-center gap-2">
          <img src={rotanombiLogo} alt="RotanomBI" className="h-8" />
          <span className="text-lg font-bold text-foreground hidden sm:inline">RotanomBI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <a href="#features">Özellikler</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="#pricing">Fiyatlandırma</a>
          </Button>
          <Button size="sm" asChild>
            <Link to="/login">Giriş Yap</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center animate-fade-in">
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Yapay Zeka Destekli İş Zekası
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
          DIA ERP Verilerinizi{' '}
          <span className="gradient-text">Anlamlı Görsellere</span>{' '}
          Dönüştürün
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Yapay zeka destekli iş zekası platformu ile verilerinizi gerçek zamanlı izleyin, özel dashboard'lar oluşturun.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="text-base px-8" asChild>
            <Link to="/login">
              Ücretsiz Deneyin
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="text-base px-8" asChild>
            <a href="#features">Özellikleri Keşfet</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ─── */
function StatsSection() {
  const { users, widgets, aiWidgets } = useLiveStats();

  const items = [
    { label: 'Aktif Kullanıcı', value: users, icon: Users },
    { label: 'Toplam Widget', value: widgets, icon: BarChart3 },
    { label: 'AI ile Üretilen', value: aiWidgets, icon: Brain },
    { label: 'Veri Modeli', value: '20+', icon: Database },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {items.map((item) => (
          <Card key={item.label} className="text-center animate-slide-up">
            <CardContent className="pt-6 pb-4">
              <item.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
              <div className="text-3xl font-bold text-foreground">{item.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─── Features ─── */
const features = [
  { icon: Brain, title: 'AI Widget Üretici', desc: 'Yapay zeka ile saniyeler içinde özel widget\'lar oluşturun.' },
  { icon: Zap, title: 'Gerçek Zamanlı Veri', desc: 'DIA ERP verilerinizi anlık olarak izleyin ve analiz edin.' },
  { icon: GripVertical, title: 'Sürükle-Bırak Dashboard', desc: 'Widget\'ları sürükleyip bırakarak kendi dashboard\'unuzu tasarlayın.' },
  { icon: Database, title: 'DIA ERP Entegrasyonu', desc: 'Cari, stok, fatura ve daha fazla modüle doğrudan erişim.' },
  { icon: Store, title: 'Widget Marketplace', desc: 'Hazır widget\'ları keşfedin ve tek tıkla ekleyin.' },
  { icon: Users, title: 'Takım Yönetimi', desc: 'Ekip üyelerinize özel izinler ve dashboard\'lar atayın.' },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Güçlü Özellikler</h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">
            İş zekası ihtiyaçlarınız için ihtiyacınız olan her şey.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="group hover:shadow-md transition-shadow duration-200">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─── */
const plans = [
  {
    name: 'Demo',
    price: 'Ücretsiz',
    period: '1 Ay',
    desc: 'Tüm özellikleri 1 ay boyunca deneyin.',
    badge: null,
    features: ['Tüm özellikler', '1 ay süre', 'Sınırsız widget', 'DIA ERP bağlantısı'],
    highlight: false,
  },
  {
    name: 'Aylık',
    price: '2.315',
    period: '/ ay + KDV',
    desc: 'Aylık esneklik ile tüm özellikler.',
    badge: null,
    features: ['Tüm özellikler', 'Aylık faturalandırma', 'Öncelikli destek', 'Sınırsız widget'],
    highlight: false,
  },
  {
    name: 'Yıllık',
    price: '25.000',
    period: '/ yıl + KDV',
    desc: 'Aylık ~2.083 ₺ ile %10 tasarruf.',
    badge: '%10 İndirim',
    features: ['Tüm özellikler', 'Yıllık faturalandırma', 'Öncelikli destek', '%10 tasarruf', 'Sınırsız widget'],
    highlight: true,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Fiyatlandırma</h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">
            İhtiyacınıza uygun planı seçin.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.highlight ? 'border-primary shadow-lg ring-1 ring-primary/20' : ''
              }`}
            >
              {plan.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-3">
                  {plan.badge}
                </Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.desc}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  {plan.period !== '1 Ay' && (
                    <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
                  )}
                  {plan.period === '1 Ay' && (
                    <span className="block text-sm text-muted-foreground mt-1">{plan.period}</span>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  asChild
                >
                  <Link to="/login">Başla</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function LandingFooter() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rotaLogo = isDark ? rotaLogoLight : rotaLogoDark;

  return (
    <footer className="border-t border-border bg-muted/20 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src={rotaLogo} alt="Rota Yazılım" className="h-7" />
          <span className="text-sm text-muted-foreground">Rota Yazılım tarafından geliştirilmiştir</span>
        </div>
        <a
          href="https://rotayazilim.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          rotayazilim.net
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© 2024 Rota Yazılım – RotanomBI v3.0</p>
      </div>
    </footer>
  );
}

/* ─── Landing Page ─── */
export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) return null;
  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}
