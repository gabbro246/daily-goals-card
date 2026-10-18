import { copyFileSync } from 'node:fs';
copyFileSync('src/daily-goals-card.js','dist/daily-goals-card.js');
console.log('Built dist/daily-goals-card.js (no external dependencies)');
