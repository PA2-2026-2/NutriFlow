class AppError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = 'AppError';
		this.statusCode = statusCode;
	}
}

module.exports = {
	AppError,
};
