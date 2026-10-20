const { AppError } = require('../errors/appError');
const { SELF_REGISTRATION_ROLES, normalizeRole } = require('../constants/roles');
const { toPublicUser } = require('../utils/userPresenter');
const { presentPhoto } = require('../utils/photoPresenter');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
	return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeText(value) {
	return String(value || '').trim();
}

class AuthService {
	constructor(userRepository, supabaseAuthClient, appBaseUrl, photoStorage, publicConfig = {}) {
		this.userRepository = userRepository;
		this.supabaseAuthClient = supabaseAuthClient;
		this.appBaseUrl = appBaseUrl;
		this.photoStorage = photoStorage;
		this.publicConfig = publicConfig;
	}

	getPublicConfig() {
		if (!this.supabaseAuthClient || !this.publicConfig.url || !this.publicConfig.anonKey) {
			throw new AppError(
				'Autenticação indisponível. Configure SUPABASE_URL e SUPABASE_ANON_KEY.',
				503,
			);
		}

		return {
			url: this.publicConfig.url,
			anonKey: this.publicConfig.anonKey,
		};
	}

	requireSupabaseAuth() {
		if (!this.supabaseAuthClient) {
			throw new AppError(
				'Autenticação indisponível. Configure SUPABASE_URL e SUPABASE_ANON_KEY.',
				503,
			);
		}

		return this.supabaseAuthClient.auth;
	}

	getRedirectUrl(path, baseUrl = this.appBaseUrl) {
		return new URL(path, `${baseUrl}/`).toString();
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

		if (!isValidEmail(email)) {
			throw new AppError('Informe um endereço de e-mail válido.', 400);
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
		if (existingUser?.authUserId) {
			return {
				message: 'Se o cadastro puder ser concluído, enviaremos uma confirmação para o e-mail informado.',
			};
		}

		const profile = existingUser?.profile || role;
		const { data, error } = await this.requireSupabaseAuth().signUp({
			email,
			password,
			options: {
				emailRedirectTo: this.getRedirectUrl('/auth/confirm'),
				data: { name: existingUser?.name || name, profile },
			},
		});

		if (error) {
			if (
				error.code === 'user_already_exists' ||
				error.message?.toLowerCase().includes('already registered')
			) {
				return {
					message: 'Se o cadastro puder ser concluído, enviaremos uma confirmação para o e-mail informado.',
				};
			}

			throw this.toAuthError(error, 'Não foi possível realizar o cadastro. Tente novamente.');
		}

		const authUser = data?.user;
		if (data?.session || authUser?.email_confirmed_at) {
			throw new AppError(
				'Confirmação de e-mail desabilitada no Supabase. Habilite-a antes de aceitar cadastros.',
				503,
			);
		}

		if (!authUser?.id) {
			throw new AppError('Não foi possível concluir o cadastro no Supabase. Tente novamente.', 502);
		}

		if (authUser.identities?.length !== 0) {
			if (existingUser) {
				await this.userRepository.linkAuthUser(existingUser.id, authUser.id);
			} else {
				await this.userRepository.create({
					id: authUser.id,
					name,
					email,
					profile,
					passwordHash: '',
				});
			}
		}

		return {
			message: 'Se o cadastro puder ser concluído, enviaremos uma confirmação para o e-mail informado.',
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

		if (!isValidEmail(email)) {
			throw new AppError('Informe um endereço de e-mail válido.', 400);
		}

		const { data, error } = await this.requireSupabaseAuth()
			.signInWithPassword({ email, password });

		if (error) {
			if (error?.code === 'email_not_confirmed' || error?.message?.toLowerCase().includes('email not confirmed')) {
				throw new AppError('Confirme seu e-mail antes de entrar.', 401);
			}

			if (error?.code === 'invalid_credentials') {
				throw new AppError('E-mail ou senha inválidos.', 401);
			}

			throw this.toAuthError(error, 'Não foi possível autenticar agora. Tente novamente.');
		}

		if (!data?.session || !data?.user) {
			throw new AppError('Não foi possível iniciar a sessão. Tente novamente.', 502);
		}

		if (!data.user.email_confirmed_at) {
			throw new AppError('Confirme seu e-mail antes de entrar.', 401);
		}

		let user =
			(await this.userRepository.findByAuthUserId(data.user.id)) ||
			(await this.userRepository.findById(data.user.id));
		if (!user && data.user.email) {
			const matchingEmailProfile = await this.userRepository.findByEmail(
				normalizeEmail(data.user.email),
			);
			if (matchingEmailProfile && !matchingEmailProfile.authUserId) {
				user = await this.userRepository.linkAuthUser(
					matchingEmailProfile.id,
					data.user.id,
				);
			}
		}

		if (!user || normalizeEmail(user.email) !== normalizeEmail(data.user.email)) {
			throw new AppError(
				'Perfil NutriFlow não encontrado para esta conta. Procure o suporte.',
				403,
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
			token: data.session.access_token,
			refreshToken: data.session.refresh_token,
			user: await presentPhoto(this.photoStorage, toPublicUser(user)),
		};
	}

	async requestPasswordReset(payload) {
		const email = normalizeEmail(payload.email);
		if (!isValidEmail(email)) {
			throw new AppError('Informe um endereço de e-mail válido.', 400);
		}

		const { error } = await this.requireSupabaseAuth().resetPasswordForEmail(
			email,
			{ redirectTo: this.getRedirectUrl('/reset-password') },
		);

		if (error) {
			throw this.toAuthError(
				error,
				'Não foi possível enviar as instruções agora. Tente novamente mais tarde.',
			);
		}

		return {
			message: 'Se houver uma conta associada a esse endereço, enviaremos as instruções de recuperação.',
		};
	}

	async resendConfirmation(payload) {
		const email = normalizeEmail(payload.email);
		if (!isValidEmail(email)) {
			throw new AppError('Informe um endereço de e-mail válido.', 400);
		}

		const { error } = await this.requireSupabaseAuth().resend({
			type: 'signup',
			email,
			options: { emailRedirectTo: this.getRedirectUrl('/auth/confirm') },
		});

		if (error) {
			throw this.toAuthError(
				error,
				'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.',
			);
		}

		return {
			message: 'Se houver uma conta pendente de confirmação, enviaremos um novo e-mail.',
		};
	}

	toAuthError(error, fallback) {
		const status = Number(error?.status);
		const lowerMessage = String(error?.message || '').toLowerCase();

		if (
			error?.code === 'email_not_confirmed' ||
			lowerMessage.includes('email not confirmed')
		) {
			return new AppError('Confirme seu e-mail antes de entrar.', 401);
		}

		if (status === 429) {
			return new AppError('Muitas tentativas. Aguarde um pouco e tente novamente.', 429);
		}

		if (status >= 500 || !status) {
			return new AppError(fallback, 502);
		}

		if (error?.code === 'weak_password') {
			return new AppError('A senha deve ter pelo menos 8 caracteres.', 400);
		}

		if (
			error?.code === 'invalid_credentials' ||
			(fallback === 'E-mail ou senha inválidos.' && [400, 401].includes(status))
		) {
			return new AppError('E-mail ou senha inválidos.', 401);
		}

		return new AppError(fallback, status >= 400 && status < 500 ? status : 400);
	}

	async logout(token) {
		if (token) {
			const auth = this.requireSupabaseAuth();
			const { error } = await auth.admin.signOut(token, 'global');
			if (error && ![401, 403, 404].includes(error.status)) {
				throw this.toAuthError(error, 'Não foi possível encerrar a sessão.');
			}
		}

		return { message: 'Logout realizado com sucesso.' };
	}

	async me(userId) {
		const user = await this.userRepository.findById(userId);

		if (!user) {
			throw new AppError('Usuario nao encontrado.', 404);
		}

		return {
			user: await presentPhoto(this.photoStorage, toPublicUser(user)),
		};
	}
}

module.exports = {
	AuthService,
	isValidEmail,
	normalizeEmail,
};
