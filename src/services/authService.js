const { AppError } = require('../errors/appError');
const { normalizeRole, toRoleLabel } = require('../constants/roles');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function normalizeText(value) {
	return String(value || '').trim();
}

function toPublicUser(user) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		profile: toRoleLabel(user.profile),
		role: normalizeRole(user.profile),
		isActive: user.isActive,
		createdAt: user.createdAt,
	};
}

class AuthService {
	constructor(userRepository, passwordService, tokenService) {
		this.userRepository = userRepository;
		this.passwordService = passwordService;
		this.tokenService = tokenService;
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

		// Vinculo com nutricionista, perfil de paciente/nutricionista
		// e demais dados de onboarding entram nas Sprints 2-3,
		// junto com os models PatientProfile e NutritionistProfile
		// no schema.

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
}

module.exports = {
	AuthService,
};
