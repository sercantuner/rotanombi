// Filter Utilities - Ortak filtre yardımcı fonksiyonları
// CompactFilterBuilder ve PostFetchFilterBuilder tarafından paylaşılır

export type FieldType = 'text' | 'number' | 'date' | 'boolean';

// Alan tipini tespit et
export function detectFieldType(data: any[], field: string): FieldType {
  if (!data || !field || data.length === 0) return 'text';
  
  // İlk 20 değere bak (daha güvenilir sonuç için)
  const sampleValues = data.slice(0, 20).map(row => row[field]).filter(v => v !== null && v !== undefined && v !== '');
  if (sampleValues.length === 0) return 'text';
  
  // Tarih kontrolü - çeşitli formatlar
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // 2024-01-15
    /^\d{2}\.\d{2}\.\d{4}/, // 15.01.2024
    /^\d{2}\/\d{2}\/\d{4}/, // 15/01/2024
  ];
  
  const allDates = sampleValues.every(v => {
    const str = String(v);
    return datePatterns.some(p => p.test(str)) || !isNaN(Date.parse(str));
  });
  if (allDates) return 'date';
  
  // Sayı kontrolü
  const allNumbers = sampleValues.every(v => {
    const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return !isNaN(num) && isFinite(num);
  });
  if (allNumbers) return 'number';
  
  // Boolean kontrolü
  const boolValues = ['true', 'false', '1', '0', 'evet', 'hayır', 'e', 'h'];
  const allBools = sampleValues.every(v => boolValues.includes(String(v).toLowerCase()));
  if (allBools) return 'boolean';
  
  return 'text';
}

// Benzersiz değerler hesaplama
export function getUniqueValues(data: any[], field: string, maxCount = 100): string[] {
  if (!data || !field) return [];
  
  const values = data
    .map(row => row[field])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => String(v));
  
  const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b, 'tr'));
  return unique.slice(0, maxCount);
}

// Sayısal min/max hesaplama
export function getNumericRange(data: any[], field: string): { min: number; max: number } | null {
  if (!data || !field) return null;
  
  const numbers = data
    .map(row => row[field])
    .filter(v => v !== null && v !== undefined)
    .map(v => typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, '')))
    .filter(n => !isNaN(n) && isFinite(n));
  
  if (numbers.length === 0) return null;
  
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
}

// Sayıyı okunabilir formata çevir (K, M, B)
export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString('tr-TR');
}

// Alan tipi etiketi
export function getFieldTypeLabel(type: FieldType): string {
  switch (type) {
    case 'date': return '📅';
    case 'number': return '🔢';
    case 'boolean': return '☑️';
    default: return '📝';
  }
}

// Alan tipi rengi
export function getFieldTypeColor(type: FieldType): string {
  switch (type) {
    case 'number': return 'text-blue-600';
    case 'date': return 'text-amber-600';
    case 'boolean': return 'text-green-600';
    default: return 'text-gray-600';
  }
}
