import React from 'react';
import { X, Phone, Mail, Calendar, AlertTriangle, Building2 } from 'lucide-react';
import type { DiaCari } from '@/lib/diaClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  cariler: DiaCari[];
  yaslandirma: {
    vade90Plus: number;
    vade90: number;
    vade60: number;
    vade30: number;
    guncel: number;
    gelecek30: number;
    gelecek60: number;
    gelecek90: number;
    gelecek90Plus: number;
  };
}

// VadeDetayListesi artık global filtre kullanmıyor
// Bu bileşen sadece yaslandirma verisine göre özet gösterir
export function VadeDetayListesi({ cariler, yaslandirma }: Props) {
  const formatCurrency = (value: number) => {
    return `₺${Math.abs(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Vadesi geçmiş toplam yoksa gösterme
  const vadesiGecmisToplam = yaslandirma.vade90Plus + yaslandirma.vade90 + yaslandirma.vade60 + yaslandirma.vade30;
  if (vadesiGecmisToplam <= 0) return null;

  return (
    <div className="glass-card rounded-xl p-3 md:p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge className="bg-destructive text-destructive-foreground px-3 py-1">
            Vadesi Geçmiş
          </Badge>
          <div>
            <h3 className="font-semibold text-sm">Vade Özeti</h3>
            <p className="text-xs text-muted-foreground">
              Toplam: <span className="font-semibold text-foreground">{formatCurrency(vadesiGecmisToplam)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
