const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PUBLIC_BASE_PATH = '/uploads/profile-photos';
const SAFE_FILENAME = /^[A-Za-z0-9-]+\.(jpg|png)$/;


class PhotoStorage {
  constructor({ uploadsDir }) {
    this.directory = path.join(uploadsDir, 'profile-photos');
  }

  async save(userId, buffer, extension) {
    await fs.promises.mkdir(this.directory, { recursive: true });

    const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.${extension}`;

    await fs.promises.writeFile(path.join(this.directory, filename), buffer, {
      flag: 'wx',
    });

    return { filename, url: `${PUBLIC_BASE_PATH}/${filename}` };
  }

  
  
  async remove(url) {
    const value = String(url || '');

    if (!value.startsWith(`${PUBLIC_BASE_PATH}/`)) {
      return;
    }

    const filename = path.basename(value);

    if (!SAFE_FILENAME.test(filename)) {
      return;
    }

    try {
      await fs.promises.unlink(path.join(this.directory, filename));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

module.exports = {
  PhotoStorage,
  PUBLIC_BASE_PATH,
};
