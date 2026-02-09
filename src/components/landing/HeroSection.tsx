import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import diaDevices from '@/assets/dia-devices.svg';
import biConcept from '@/assets/bi-concept.svg';
import diaLogoDark from '@/assets/dia-logo-dark.svg';
import diaLogoLight from '@/assets/dia-logo-light.svg';

export default function HeroSection() {
  const { theme } = useTheme();
  const diaLogo = theme === 'dark' ? diaLogoDark : diaLogoLight;

  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decorations removed for clean look */}

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

        {/* Device mockup + BI concept with background lines */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="mt-16 relative"
        >
          {/* Clean background - no lines */}

          <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            {/* Device mockup */}
            <div className="w-full lg:w-1/2 max-w-lg">
              <img
                src={diaDevices}
                alt="DIA ERP - Telefon, Tablet ve Bilgisayarda"
                className="w-full h-auto drop-shadow-lg dark:mix-blend-lighten mix-blend-multiply"
                loading="lazy"
              />
            </div>

            {/* BI concept image */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.6, ease: 'easeOut' }}
              className="w-full lg:w-1/2 max-w-md"
            >
              <img
                src={biConcept}
                alt="İş Zekası Dashboard - Her yerden erişilebilir raporlama"
                className="w-full h-auto rounded-xl shadow-xl"
                loading="lazy"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
