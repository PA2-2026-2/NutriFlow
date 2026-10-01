require('dotenv/config');

const path = require('path');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  frontendDir: path.join(__dirname, '..', 'frontend'),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, '..', 'uploads'),
  maxPhotoSizeBytes: 2 * 1024 * 1024,
  tokenSecret: process.env.TOKEN_SECRET || 'nutriflow-dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
};

module.exports = {
  config,
};
