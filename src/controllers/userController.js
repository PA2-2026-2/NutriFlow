const { AppError } = require('../errors/appError');

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'];

class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  async getMe(request, response) {
    const result = await this.userService.getMe(request.user.sub);
    response.status(200).json(result);
  }

  async updateMe(request, response) {
    const result = await this.userService.updateMe(
      request.user.sub,
      request.body || {},
    );
    response.status(200).json(result);
  }

  
  
  async updatePhoto(request, response) {
    if (request.is(PHOTO_MIME_TYPES) === false) {
      throw new AppError(
        'Formato nao suportado. Envie image/jpeg ou image/png.',
        415,
      );
    }

    const result = await this.userService.updatePhoto(
      request.user.sub,
      request.body,
    );
    response.status(200).json(result);
  }
}

module.exports = {
  UserController,
  PHOTO_MIME_TYPES,
};
