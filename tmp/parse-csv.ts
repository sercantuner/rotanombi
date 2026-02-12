// Quick CSV parser to extract widget keys
import { readFileSync } from 'fs';

const content = readFileSync('tmp/widgets-export.csv', 'utf-8');

// Find all lines starting with UUID pattern and extract widget_key (2nd field)
const lines = content.split('\n');
const widgetKeys: string[] = [];

for (const line of lines) {
  const match = line.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12});(ai_[^;]+);([^;]+);/);
  if (match) {
    widgetKeys.push(`${match[1]}|${match[2]}|${match[3]}`);
  }
}

console.log('=== CSV Widget Keys ===');
console.log(`Total: ${widgetKeys.length}`);
widgetKeys.forEach(k => console.log(k));
