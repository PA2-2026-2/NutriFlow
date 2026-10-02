const { AppError } = require('../errors/appError');
const { normalizePhone } = require('../utils/validators');
const { toPublicUser } = require('../utils/userPresenter');

const MAX_NAME_LENGTH = 100;

const PHOTO_SIGNATURES = [
  { extension: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
];

function detectImageExtension(buffer) {
  const match = PHOTO_SIGNATURES.find(({ bytes }) =>
    buffer.length >= bytes.length &&
    bytes.every((byte, index) => buffer[index] === byte),
  );

  return match ? match.extension : null;
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function normalizeOptionalNumber(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new AppError(`${fieldName} invalido.`, 400);
  }

  if (options.integer && !Number.isInteger(number)) {
    throw new AppError(`${fieldName} deve ser um numero inteiro.`, 400);
  }

  if (options.min !== undefined && number < options.min) {
    throw new AppError(`${fieldName} invalido.`, 400);
  }

  return number;
}

class UserService {
  constructor(userRepository, photoStorage, options = {}) {
    this.userRepository = userRepository;
    this.photoStorage = photoStorage;
    this.profileRepository = options.profileRepository;
    this.maxPhotoBytes = options.maxPhotoBytes;
  }

  async getMe(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('Usuario nao encontrado.', 404);
    }

    const publicUser = toPublicUser(user);

    if (this.profileRepository) {
      const patientProfile = user.profile === 'PATIENT'
        ? await this.profileRepository.findPatientWithNutritionistByUserId(userId)
        : await this.profileRepository.findPatientByUserId(userId);

      if (user.profile === 'PATIENT') {
        publicUser.nutritionist = patientProfile?.nutritionist || null;
      }

      if (patientProfile) {
        publicUser.age = patientProfile.age;
        publicUser.weight = patientProfile.weight;
        publicUser.height = patientProfile.height;
        publicUser.objective = patientProfile.objective;
        publicUser.restrictions = patientProfile.restrictions;
      }
    }

    return { user: publicUser };
  }

  async updateMe(userId, payload) {
    const data = {};

    if (payload.name !== undefined) {
      const name =
        typeof payload.name === 'string' ? payload.name.trim() : '';

      if (!name || name.length > MAX_NAME_LENGTH) {
        throw new AppError(
          `Informe um nome valido (ate ${MAX_NAME_LENGTH} caracteres).`,
          400,
        );
      }

      data.name = name;
    }

    if (payload.phone !== undefined) {
      const phone = normalizePhone(payload.phone);

      if (!phone.valid) {
        throw new AppError(
          'Telefone invalido. Informe DDD + numero (10 a 13 digitos).',
          400,
        );
      }

      data.phone = phone.value;
    }

    const hasProfileFields =
      payload.age !== undefined ||
      payload.weight !== undefined ||
      payload.height !== undefined ||
      payload.objective !== undefined ||
      payload.restrictions !== undefined;

    if (Object.keys(data).length === 0 && !hasProfileFields) {
      throw new AppError(
        'Informe ao menos um campo para atualizar.',
        400,
      );
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('Usuario nao encontrado.', 404);
    }

    let updated = user;

    if (Object.keys(data).length > 0) {
      updated = await this.userRepository.update(userId, data);
    }

    if (hasProfileFields) {
      if (!this.profileRepository) {
        throw new AppError(
          'Perfil do paciente nao esta configurado.',
          500,
        );
      }

      const profileData = {};

      if (payload.age !== undefined) {
        profileData.age = normalizeOptionalNumber(
          payload.age,
          'Idade',
          { integer: true, min: 0 },
        );
      }

      if (payload.weight !== undefined) {
        profileData.weight = normalizeOptionalNumber(
          payload.weight,
          'Peso',
          { min: 0 },
        );
      }

      if (payload.height !== undefined) {
        profileData.height = normalizeOptionalNumber(
          payload.height,
          'Altura',
          { min: 0 },
        );
      }

      if (payload.objective !== undefined) {
        profileData.objective = normalizeOptionalText(payload.objective);
      }

      if (payload.restrictions !== undefined) {
        profileData.restrictions = normalizeOptionalText(
          payload.restrictions,
        );
      }

      await this.profileRepository.updatePatientProfile(
        userId,
        profileData,
      );
    }

    const publicUser = toPublicUser(updated);

    if (this.profileRepository) {
      const patientProfile = updated.profile === 'PATIENT'
        ? await this.profileRepository.findPatientWithNutritionistByUserId(userId)
        : await this.profileRepository.findPatientByUserId(userId);

      if (updated.profile === 'PATIENT') {
        publicUser.nutritionist = patientProfile?.nutritionist || null;
      }

      if (patientProfile) {
        publicUser.age = patientProfile.age;
        publicUser.weight = patientProfile.weight;
        publicUser.height = patientProfile.height;
        publicUser.objective = patientProfile.objective;
        publicUser.restrictions = patientProfile.restrictions;
      }
    }

    return {
      message: 'Perfil atualizado com sucesso.',
      user: publicUser,
    };
  }

  async updatePhoto(userId, buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError(
        'Envie a imagem no corpo da requisicao.',
        400,
      );
    }

    if (this.maxPhotoBytes && buffer.length > this.maxPhotoBytes) {
      throw new AppError(
        'A foto excede o tamanho maximo permitido.',
        413,
      );
    }

    const extension = detectImageExtension(buffer);

    if (!extension) {
      throw new AppError(
        'Formato de imagem invalido. Use JPG ou PNG.',
        415,
      );
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('Usuario nao encontrado.', 404);
    }

    const previousPhotoUrl = user.profilePhotoUrl;
    const saved = await this.photoStorage.save(
      userId,
      buffer,
      extension,
    );

    let updated;

    try {
      updated = await this.userRepository.updatePhoto(
        userId,
        saved.url,
      );
    } catch (error) {
      await this.photoStorage.remove(saved.url).catch(() => {});
      throw error;
    }

    await this.photoStorage.remove(previousPhotoUrl).catch(() => {});

    return {
      message: 'Foto de perfil atualizada com sucesso.',
      profilePhotoUrl: updated.profilePhotoUrl,
      user: toPublicUser(updated),
    };
  }
}

module.exports = {
  UserService,
  detectImageExtension,
};