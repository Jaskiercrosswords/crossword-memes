'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const docx = 'C:/Users/azali/OneDrive/Desktop/Проекты/Кроссворд/кроссворд.docx';
const tmp = path.join(os.tmpdir(), 'cw_' + Date.now());
fs.mkdirSync(tmp, { recursive: true });
const zipTmp = tmp + '.zip';
fs.copyFileSync(docx, zipTmp);
execFileSync('powershell', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath "' + zipTmp + '" -DestinationPath "' + tmp + '" -Force'], { stdio: 'ignore' });
const xml = fs.readFileSync(path.join(tmp, 'word', 'document.xml'), 'utf8');
let text = xml
  .replace(/<w:p[^>]*>/g, '\n')
  .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
process.stdout.write(text.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => (i + 1) + ': ' + l).join('\n'));