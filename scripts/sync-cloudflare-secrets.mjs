import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// En desarrollo local no es necesario sincronizar secretos.
if (!url && !secretKey) {
  console.log('Cloudflare secrets: local build, synchronization skipped');
  process.exit(0);
}

if (!url || !secretKey) {
  console.error('Cloudflare secrets: SUPABASE_URL y SUPABASE_SECRET_KEY son obligatorias');
  process.exit(1);
}

const directory = await mkdtemp(join(tmpdir(), 'cotizaciones-secrets-'));
const secretsFile = join(directory, 'secrets.json');

try {
  await writeFile(
    secretsFile,
    JSON.stringify({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey }),
    { mode: 0o600 }
  );

  const result = spawnSync(
    'npx',
    ['wrangler', 'secret', 'bulk', secretsFile],
    { stdio: 'inherit', env: process.env }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log('Cloudflare secrets: synchronized');
} finally {
  await rm(directory, { recursive: true, force: true });
}
