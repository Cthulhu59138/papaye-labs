import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const writer = fileURLToPath(new URL('./export-worksheet.py', import.meta.url));

export function exportWorksheet(templateBytes, rows, decisions) {
  const overrides = rows.map(({id, priority, status, comment, decision}) => [id, priority, status, comment, decision]);
  const payload = JSON.stringify({
    template: Buffer.from(templateBytes).toString('base64'),
    rows: overrides, decisions,
  });
  return new Promise((resolve, reject) => {
    const child = execFile('python3', ['-I', writer], {
      encoding: 'buffer', timeout: 15000, maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout) => {
      if (error) reject(new Error('Le classeur ne peut pas être exporté.'));
      else resolve(stdout);
    });
    child.stdin.on('error', reject);
    child.stdin.end(payload);
  });
}
