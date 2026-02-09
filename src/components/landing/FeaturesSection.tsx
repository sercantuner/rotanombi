import { motion } from 'framer-motion';
import { Zap, GripVertical, Database, BarChart3, Store, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  { icon: Zap, title: 'Gerçek Zamanlı Veri', desc: 'DIA ERP verilerinizi anlık olarak izleyin ve analiz edin.' },
  { icon: GripVertical, title: 'Sürükle-Bırak Dashboard', desc: "Widget'ları sürükleyip bırakarak kendi dashboard'unuzu tasarlayın." },
  { icon: Database, title: 'DIA ERP Entegrasyonu', desc: 'Cari, stok, fatura ve daha fazla modüle doğrudan erişim.' },
  { icon: BarChart3, title: 'Özel Raporlama', desc: 'İhtiyacınıza özel raporlar oluşturun ve paylaşın.' },
  { icon: Store, title: 'Widget Marketplace', desc: "Hazır widget'ları keşfedin ve tek tıkla ekleyin." },
  { icon: Users, title: 'Takım Yönetimi', desc: "Ekip üyelerinize özel izinler ve dashboard'lar atayın." },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Güçlü Özellikler</h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">
            İş zekası ihtiyaçlarınız için ihtiyacınız olan her şey.
          </p>
        </motion.div>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={item}>
              <Card className="group hover:shadow-md transition-shadow duration-200 h-full">
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
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
