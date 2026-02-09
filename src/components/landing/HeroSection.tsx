import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import diaDevices from '@/assets/dia-devices.svg';
import biConcept from '@/assets/bi-concept.png';
import diaLogoDark from '@/assets/dia-logo-dark.svg';
import diaLogoLight from '@/assets/dia-logo-light.svg';

export default function HeroSection() {
  const { theme } = useTheme();
  const diaLogo = theme === 'dark' ? diaLogoDark : diaLogoLight;

  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Creative lines from right to left */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, x: 200 }}
          animate={{ opacity: 0.15, x: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute top-[10%] -right-20 w-[120%] h-[1px] bg-gradient-to-l from-transparent via-primary to-transparent rotate-[-8deg]"
        />
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 0.1, x: 0 }}
          transition={{ duration: 1.4, delay: 0.1, ease: 'easeOut' }}
          className="absolute top-[18%] -right-10 w-[110%] h-[2px] bg-gradient-to-l from-transparent via-primary/60 to-transparent rotate-[-5deg]"
        />
        <motion.div
          initial={{ opacity: 0, x: 250 }}
          animate={{ opacity: 0.12, x: 0 }}
          transition={{ duration: 1.6, delay: 0.2, ease: 'easeOut' }}
          className="absolute top-[30%] -right-32 w-[130%] h-[1px] bg-gradient-to-l from-transparent via-accent to-transparent rotate-[-12deg]"
        />
        <motion.div
          initial={{ opacity: 0, x: 350 }}
          animate={{ opacity: 0.08, x: 0 }}
          transition={{ duration: 1.8, delay: 0.3, ease: 'easeOut' }}
          className="absolute top-[45%] -right-20 w-[125%] h-[3px] bg-gradient-to-l from-primary/30 via-primary/10 to-transparent rotate-[-3deg]"
        />
        <motion.div
          initial={{ opacity: 0, x: 200 }}
          animate={{ opacity: 0.14, x: 0 }}
          transition={{ duration: 1.3, delay: 0.15, ease: 'easeOut' }}
          className="absolute top-[55%] -right-16 w-[115%] h-[1px] bg-gradient-to-l from-transparent via-accent/50 to-transparent rotate-[-7deg]"
        />
        <motion.div
          initial={{ opacity: 0, x: 280 }}
          animate={{ opacity: 0.06, x: 0 }}
          transition={{ duration: 2, delay: 0.4, ease: 'easeOut' }}
          className="absolute top-[68%] -right-24 w-[120%] h-[2px] bg-gradient-to-l from-primary/20 via-accent/15 to-transparent rotate-[-10deg]"
        />
        <motion.div
          initial={{ opacity: 0, x: 220 }}
          animate={{ opacity: 0.1, x: 0 }}
          transition={{ duration: 1.5, delay: 0.25, ease: 'easeOut' }}
          className="absolute top-[80%] -right-10 w-[110%] h-[1px] bg-gradient-to-l from-transparent via-primary/40 to-transparent rotate-[-4deg]"
        />
        <motion.svg
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 0.08, x: 0 }}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1200 600"
          preserveAspectRatio="none"
        >
          <path d="M1200,100 Q800,150 600,80 T0,200" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.3" />
          <path d="M1200,250 Q900,200 650,300 T0,350" fill="none" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.2" />
          <path d="M1200,400 Q850,350 500,450 T0,500" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.15" />
        </motion.svg>
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

        {/* Device mockup + BI concept side by side */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="mt-16 flex flex-col lg:flex-row items-center justify-center gap-8"
        >
          {/* Device mockup - smaller */}
          <div className="w-full lg:w-1/2 max-w-lg">
            <img
              src={diaDevices}
              alt="DIA ERP - Telefon, Tablet ve Bilgisayarda"
              className="w-full h-auto drop-shadow-lg"
              loading="lazy"
              style={{ background: 'transparent' }}
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
        </motion.div>
      </div>
    </section>
  );
}
