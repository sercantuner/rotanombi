import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';
import businessTeam from '@/assets/business-team.jpg';
import diaLogoDark from '@/assets/dia-logo-dark.svg';
import diaLogoLight from '@/assets/dia-logo-light.svg';

export default function BusinessSection() {
  const { theme } = useTheme();
  const diaLogo = theme === 'dark' ? diaLogoDark : diaLogoLight;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="rounded-xl overflow-hidden shadow-lg border border-border">
            <img
              src={businessTeam}
              alt="İş ekibi veri analizi yapıyor"
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <img src={diaLogo} alt="DIA ERP" className="h-10" />
            <span className="text-sm font-medium text-muted-foreground">ERP Entegrasyonu</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Veriye Dayalı Kararlar,{' '}
            <span className="gradient-text">Güçlü Sonuçlar</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            DIA ERP sisteminizden gelen cari, stok, fatura ve finansal verilerinizi
            tek bir platformda birleştirin. Yapay zeka destekli analizlerle işletmenizin
            nabzını gerçek zamanlı tutun.
          </p>
          <ul className="space-y-3 text-sm text-foreground">
            {['Anlık veri senkronizasyonu', 'Çoklu dönem ve firma desteği', 'Rol tabanlı erişim kontrolü', 'Mobil uyumlu dashboard\'lar'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
