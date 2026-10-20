const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('../errors/appError');

const PHOTO_PREFIX = 'profile-photos';
const SAFE_OBJECT_KEY =
  /^profile-photos\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(jpg|png|webp)$/;
const MIME_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const SIGNED_URL_TTL_SECONDS = 60 * 60;

class SupabasePhotoStorage {
  constructor({ url, secretKey, bucket = 'nutriflow-images', client }) {
    this.client =
      client ||
      createClient(url, secretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    this.bucket = bucket;
  }

  async save(userId, buffer, extension) {
    const objectKey = `${PHOTO_PREFIX}/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(objectKey, buffer, {
        contentType: MIME_TYPES[extension],
        upsert: false,
      });

    if (error) {
      throw new AppError('Não foi possível armazenar a foto.', 502);
    }

    return { filename: objectKey, url: objectKey };
  }

  async getUrl(objectKey) {
    if (!objectKey) {
      return null;
    }

    if (!SAFE_OBJECT_KEY.test(objectKey)) {
      return null;
    }

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new AppError('Não foi possível disponibilizar a foto.', 502);
    }

    return data.signedUrl;
  }

  async remove(objectKey) {
    if (!SAFE_OBJECT_KEY.test(String(objectKey || ''))) {
      return;
    }

    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([objectKey]);

    if (error) {
      throw new AppError('Não foi possível remover a foto armazenada.', 502);
    }
  }
}

module.exports = {
  SupabasePhotoStorage,
  SAFE_OBJECT_KEY,
  SIGNED_URL_TTL_SECONDS,
};
