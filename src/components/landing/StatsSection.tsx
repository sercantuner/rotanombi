import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, BarChart3, Brain, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

function useLiveStats() {
  const [stats, setStats] = useState({ users: 0, widgets: 0, aiWidgets: 0 });
  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.rpc('get_landing_stats');
        if (!error && data && data.length > 0) {
          setStats({
            users: Number(data[0].user_count) || 0,
            widgets: Number(data[0].widget_count) || 0,
            aiWidgets: Number(data[0].ai_widget_count) || 0,
          });
        }
      } catch { /* Keep fallback */ }
    }
    fetchStats();
  }, []);
  return stats;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function StatsSection() {
  const { users, widgets, aiWidgets } = useLiveStats();
  const items = [
    { label: 'Aktif Kullanıcı', value: users, icon: Users },
    { label: 'Toplam Widget', value: widgets, icon: BarChart3 },
    { label: 'AI ile Üretilen', value: aiWidgets, icon: Brain },
    { label: 'Veri Modeli', value: '20+', icon: Database },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
      >
        {items.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card className="text-center">
              <CardContent className="pt-6 pb-4">
                <s.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <div className="text-3xl font-bold text-foreground">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
