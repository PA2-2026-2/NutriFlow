function asyncHandler(handler) {
	return async (request, response, next) => {
		try {
			await handler(request, response, next);
		} catch (error) {
			next(error);
		}
	};
}

module.exports = {
	asyncHandler,
};
