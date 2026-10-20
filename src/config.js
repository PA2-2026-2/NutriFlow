
require('dotenv/config');

const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL);
const hasSupabaseAnonKey = Boolean(process.env.SUPABASE_ANON_KEY);
const hasSupabaseSecretKey = Boolean(process.env.SUPABASE_SECRET_KEY);
const photoStorageProvider =
  process.env.PHOTO_STORAGE_PROVIDER ||
  (hasSupabaseUrl && hasSupabaseSecretKey
    ? 'supabase'
    : nodeEnv === 'production'
      ? 'disabled'
      : 'local');

function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let parsed;

      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(
          'CORS_ALLOWED_ORIGINS deve conter origens HTTP(S) válidas.'
        );
      }

      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin ||
        (nodeEnv === 'production' && parsed.protocol !== 'https:')
      ) {
        throw new Error(
          'CORS_ALLOWED_ORIGINS deve conter origens válidas e sem caminhos.'
        );
      }

      return origin;
    });
}

const corsAllowedOrigins = parseAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS
);

if (nodeEnv === 'production') {
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error(
      'DATABASE_URL deve apontar para PostgreSQL em produção.'
    );
  }

  if (!hasSupabaseUrl || !hasSupabaseAnonKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_ANON_KEY devem estar configuradas para autenticação em produção.'
    );
  }
}

if (hasSupabaseUrl) {
  let supabaseUrl;
  try {
    supabaseUrl = new URL(process.env.SUPABASE_URL);
  } catch {
    throw new Error('SUPABASE_URL deve ser uma URL HTTP(S) válida.');
  }

  if (
    !['http:', 'https:'].includes(supabaseUrl.protocol) ||
    (nodeEnv === 'production' && supabaseUrl.protocol !== 'https:')
  ) {
    throw new Error('SUPABASE_URL deve usar HTTPS em produção.');
  }
}

const appBaseUrl = process.env.APP_BASE_URL
  ? process.env.APP_BASE_URL.replace(/\/+$/, '')
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://127.0.0.1:3000';

try {
  const parsedAppBaseUrl = new URL(appBaseUrl);
  if (
    !['http:', 'https:'].includes(parsedAppBaseUrl.protocol) ||
    parsedAppBaseUrl.origin !== appBaseUrl ||
    (nodeEnv === 'production' && parsedAppBaseUrl.protocol !== 'https:')
  ) {
    throw new Error();
  }
} catch {
  throw new Error('APP_BASE_URL deve ser uma origem HTTP(S) válida, sem caminho.');
}

if (!['local', 'disabled', 'supabase'].includes(photoStorageProvider)) {
  throw new Error(
    'PHOTO_STORAGE_PROVIDER deve ser "local", "disabled" ou "supabase".'
  );
}

if (nodeEnv === 'production' && photoStorageProvider === 'local') {
  throw new Error(
    'O armazenamento local de fotos não é persistente em produção.'
  );
}

if (photoStorageProvider === 'supabase') {
  if (!hasSupabaseUrl || !hasSupabaseSecretKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SECRET_KEY devem estar configuradas para armazenamento Supabase.'
    );
  }

  let supabaseUrl;
  try {
    supabaseUrl = new URL(process.env.SUPABASE_URL);
  } catch {
    throw new Error('SUPABASE_URL deve ser uma URL HTTP(S) válida.');
  }

  if (
    !['http:', 'https:'].includes(supabaseUrl.protocol) ||
    (nodeEnv === 'production' && supabaseUrl.protocol !== 'https:')
  ) {
    throw new Error('SUPABASE_URL deve usar HTTPS em produção.');
  }
}

const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  frontendDir: path.join(__dirname, '..', 'frontend'),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, '..', 'uploads'),
  maxPhotoSizeBytes: 5 * 1024 * 1024,
  databaseUrl,
  corsAllowedOrigins,
  photoStorageProvider,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  supabaseBucket: 'nutriflow-images',
  appBaseUrl,
};

module.exports = {
  config,
};
