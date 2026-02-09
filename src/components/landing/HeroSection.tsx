import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import dashboardMockup from '@/assets/dashboard-mockup.png';
import diaLogoDark from '@/assets/dia-logo-dark.svg';
import diaLogoLight from '@/assets/dia-logo-light.svg';

export default function HeroSection() {
  const { theme } = useTheme();
  const diaLogo = theme === 'dark' ? diaLogoDark : diaLogoLight;

  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Yapay Zeka Destekli İş Zekası
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
            <img src={diaLogo} alt="DIA" className="inline-block h-12 sm:h-14 lg:h-16 mr-3 -mt-2 align-middle" />
            ERP Verilerinizi{' '}
            <span className="gradient-text">Anlamlı Görsellere</span>{' '}
            Dönüştürün
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Yapay zeka destekli iş zekası platformu ile verilerinizi gerçek zamanlı izleyin, özel dashboard'lar oluşturun.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="text-base px-8" asChild>
            <Link to="/login">
              Ücretsiz Deneyin
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="text-base px-8" asChild>
            <a href="#features">Özellikleri Keşfet</a>
          </Button>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="mt-16 relative"
        >
          <div className="rounded-xl overflow-hidden border border-border shadow-2xl bg-card">
            <img
              src={dashboardMockup}
              alt="RotanomBI Dashboard"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
          {/* Glow effect behind mockup */}
          <div className="absolute -inset-4 -z-10 rounded-2xl bg-primary/10 blur-2xl opacity-50" />
        </motion.div>
      </div>
    </section>
  );
}
