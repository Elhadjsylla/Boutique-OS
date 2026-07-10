import { formatMontantCompact } from './src/lib/format';

const tests = [
  850,
  45000,
  450000,
  2500000,
  1000000000
];

tests.forEach(t => console.log(`${t} -> ${formatMontantCompact(t)}`));
