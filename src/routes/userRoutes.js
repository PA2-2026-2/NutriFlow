const express = require('express');
const { AppError } = require('../errors/appError');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');
const { PHOTO_MIME_TYPES } = require('../controllers/userController');


function createPhotoBodyParser(maxPhotoBytes) {
  const parser = express.raw({ type: PHOTO_MIME_TYPES, limit: maxPhotoBytes });
  const limitInMb = +(maxPhotoBytes / (1024 * 1024)).toFixed(1);

  return function photoBodyParser(request, response, next) {
    parser(request, response, (error) => {
      if (error?.type === 'entity.too.large') {
        next(new AppError(`A foto deve ter no maximo ${limitInMb} MB.`, 413));
        return;
      }

      next(error);
    });
  };
}

function createUserRoutes(userController, authenticate, { maxPhotoBytes }) {
  const router = express.Router();

  router.use(authenticate);

  router.get(
    '/me',
    authorize('GET /api/users/me'),
    asyncHandler(userController.getMe.bind(userController)),
  );

  router.put(
    '/me',
    authorize('PUT /api/users/me'),
    asyncHandler(userController.updateMe.bind(userController)),
  );

  router.post(
    '/me/photo',
    authorize('POST /api/users/me/photo'),
    createPhotoBodyParser(maxPhotoBytes),
    asyncHandler(userController.updatePhoto.bind(userController)),
  );

  return router;
}

module.exports = {
  createUserRoutes,
};
