const { AppError } = require('../errors/appError');
const { SELF_REGISTRATION_ROLES, normalizeRole } = require('../constants/roles');
const { toPublicUser } = require('../utils/userPresenter');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function normalizeText(value) {
	return String(value || '').trim();
}

class AuthService {
	constructor(userRepository, passwordService, tokenService, sessionService) {
		this.userRepository = userRepository;
		this.passwordService = passwordService;
		this.tokenService = tokenService;
		this.sessionService = sessionService;
	}

	async register(payload) {
		const name = normalizeText(payload.name);
		const email = normalizeEmail(payload.email);
		const role = normalizeRole(payload.role || payload.profile);
		const password = String(payload.password || '');

		if (!name || !email || !role || !password) {
			throw new AppError(
				'Preencha nome, e-mail, perfil e senha.',
				400,
			);
		}

		
		if (!SELF_REGISTRATION_ROLES.includes(role)) {
			throw new AppError(
				'Este perfil nao pode ser criado pelo cadastro. Escolha Paciente ou Nutricionista.',
				403,
			);
		}

		if (password.length < 8) {
			throw new AppError(
				'A senha precisa ter pelo menos 8 caracteres.',
				400,
			);
		}

		const existingUser = await this.userRepository.findByEmail(email);

		if (existingUser) {
			throw new AppError(
				'Ja existe uma conta com este e-mail.',
				409,
			);
		}

		const user = await this.userRepository.create({
			name,
			email,
			profile: role,
			passwordHash: this.passwordService.hash(password),
		});

		return {
			message: 'Cadastro realizado com sucesso.',
			token: this.tokenService.create(user),
			user: toPublicUser(user),
		};
	}

	async login(payload) {
		const email = normalizeEmail(payload.email);
		const password = String(payload.password || '');

		if (!email || !password) {
			throw new AppError(
				'Informe e-mail e senha.',
				400,
			);
		}

		const user = await this.userRepository.findByEmail(email);

		if (
			!user ||
			!this.passwordService.verify(password, user.passwordHash)
		) {
			throw new AppError(
				'E-mail ou senha invalidos.',
				401,
			);
		}

		if (!user.isActive) {
			throw new AppError(
				'Sua conta esta bloqueada. Procure o administrador da plataforma.',
				403,
			);
		}

		return {
			message: 'Login realizado com sucesso.',
			token: this.tokenService.create(user),
			user: toPublicUser(user),
		};
	}

	
	
	async logout(token) {
		if (token) {
			const payload = this.tokenService.verify(token);

			if (payload) {
				this.sessionService.revoke(token, payload.exp);
			}
		}

		return { message: 'Logout realizado com sucesso.' };
	}

	async me(userId) {
		const user = await this.userRepository.findById(userId);

		if (!user) {
			throw new AppError('Usuario nao encontrado.', 404);
		}

		return { user: toPublicUser(user) };
	}
}

module.exports = {
	AuthService,
};
