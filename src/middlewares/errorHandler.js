const { AppError } = require('../errors/appError');

function errorHandler(error, request, response, next) {
	if (response.headersSent) {
		next(error);
		return;
	}

	if (
		error instanceof SyntaxError &&
		error.type === 'entity.parse.failed'
	) {
		response.status(400).json({
			message: 'JSON invalido.',
		});

		return;
	}

	if (error?.code === 'P2002') {
		response.status(409).json({
			message: 'Registro duplicado. Verifique os dados informados.',
		});

		return;
	}

	if (error?.code === 'P2025') {
		response.status(404).json({
			message: 'Registro nao encontrado.',
		});

		return;
	}

	const statusCode =
		error instanceof AppError ? error.statusCode : 500;

	response.status(statusCode).json({
		message: error.message || 'Erro interno do servidor.',
	});
}

module.exports = {
	errorHandler,
};
