import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    'Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las variables de compilación de Cloudflare.'
  );
  process.exit(1);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cotizaciones-deploy-'));
const secretsFile = join(temporaryDirectory, 'secrets.json');

try {
  await writeFile(
    secretsFile,
    JSON.stringify({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SECRET_KEY: supabaseSecretKey,
    }),
    { mode: 0o600 }
  );

  const result = spawnSync(
    'npx',
    ['wrangler', 'deploy', '--secrets-file', secretsFile],
    { stdio: 'inherit', env: process.env }
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
