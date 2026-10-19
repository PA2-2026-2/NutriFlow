
require('dotenv/config');

const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const tokenSecret =
  process.env.TOKEN_SECRET || 'nutriflow-dev-secret-change-me';

const photoStorageProvider =
  process.env.PHOTO_STORAGE_PROVIDER ||
  (nodeEnv === 'production' ? 'disabled' : 'local');

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

  if (!process.env.TOKEN_SECRET || tokenSecret.length < 32) {
    throw new Error(
      'TOKEN_SECRET deve conter pelo menos 32 caracteres em produção.'
    );
  }
}

if (!['local', 'disabled'].includes(photoStorageProvider)) {
  throw new Error(
    'PHOTO_STORAGE_PROVIDER deve ser "local" ou "disabled".'
  );
}

if (nodeEnv === 'production' && photoStorageProvider === 'local') {
  throw new Error(
    'O armazenamento local de fotos não é persistente em produção.'
  );
}

const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  frontendDir: path.join(__dirname, '..', 'frontend'),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, '..', 'uploads'),
  maxPhotoSizeBytes: 2 * 1024 * 1024,
  tokenSecret,
  databaseUrl,
  corsAllowedOrigins,
  photoStorageProvider,
};

module.exports = {
  config,
};
