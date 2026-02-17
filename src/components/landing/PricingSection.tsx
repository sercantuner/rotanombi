import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const plans = [
  { name: 'Demo', price: 'Ücretsiz', period: '1 Ay', desc: 'Tüm özellikleri 1 ay boyunca deneyin.', badge: null, features: ['Tüm özellikler', '1 ay süre', 'Sınırsız widget', 'DIA ERP bağlantısı'], highlight: false },
  { name: 'Aylık', price: '3.241', period: '/ ay + KDV', desc: 'Aylık esneklik ile tüm özellikler.', badge: null, features: ['Tüm özellikler', 'Aylık faturalandırma', 'Öncelikli destek', 'Sınırsız widget'], highlight: false },
  { name: 'Yıllık', price: '35.000', period: '/ yıl + KDV', desc: 'Aylık ~2.917 ₺ ile %10 tasarruf.', badge: '%10 İndirim', features: ['Tüm özellikler', 'Yıllık faturalandırma', 'Öncelikli destek', '%10 tasarruf', 'Sınırsız widget'], highlight: true },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const item = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Fiyatlandırma</h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">İhtiyacınıza uygun planı seçin.</p>
        </motion.div>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={item}>
              <Card className={`relative flex flex-col h-full ${plan.highlight ? 'border-primary shadow-lg ring-1 ring-primary/20' : ''}`}>
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
                    {plan.period !== '1 Ay' && <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>}
                    {plan.period === '1 Ay' && <span className="block text-sm text-muted-foreground mt-1">{plan.period}</span>}
                  </div>
                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-accent shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-8 w-full" variant={plan.highlight ? 'default' : 'outline'} asChild>
                    <Link to="/login">Başla</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
