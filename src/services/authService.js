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
	constructor(userRepository, supabaseAuthClient, appBaseUrl, photoStorage, publicConfig = {}, approvalRepository) {
		this.userRepository = userRepository;
		this.supabaseAuthClient = supabaseAuthClient;
		this.appBaseUrl = appBaseUrl;
		this.photoStorage = photoStorage;
		this.publicConfig = publicConfig;
		this.approvalRepository = approvalRepository;
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
				'Este perfil não pode ser criado pelo cadastro. Escolha Paciente ou Nutricionista.',
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
					requiresAdminApproval: profile === 'NUTRITIONIST',
				});
			}
		}

		return {
			message: profile === 'NUTRITIONIST'
				? 'Cadastro realizado! Enviamos um link de confirmação para seu e-mail. Após confirmar, seu cadastro será encaminhado para análise do administrador.'
				: 'Se o cadastro puder ser concluído, enviaremos uma confirmação para o e-mail informado.',
		};
	}

	async confirmEmail(token) {
		if (!token) {
			throw new AppError('Confirme seu e-mail pelo link enviado para sua caixa de entrada.', 401);
		}

		const { data, error } = await this.requireSupabaseAuth().getUser(token);
		if (error || !data?.user?.id) {
			if (error && ![401, 403].includes(Number(error.status))) {
				throw this.toAuthError(error, 'Não foi possível validar a confirmação agora.');
			}
			throw new AppError('Link inválido ou expirado. Solicite uma nova confirmação.', 401);
		}

		const authUser = data.user;
		if (!authUser.email_confirmed_at) {
			throw new AppError('Confirme seu e-mail antes de enviar o cadastro para análise.', 403);
		}

		let user =
			(await this.userRepository.findByAuthUserId(authUser.id)) ||
			(await this.userRepository.findById(authUser.id));
		if (!user && authUser.email) {
			const matchingProfile = await this.userRepository.findByEmail(
				normalizeEmail(authUser.email),
			);
			if (matchingProfile && !matchingProfile.authUserId) {
				user = await this.userRepository.linkAuthUser(matchingProfile.id, authUser.id);
			}
		}

		if (!user || normalizeEmail(user.email) !== normalizeEmail(authUser.email)) {
			throw new AppError('Perfil NutriFlow não encontrado para esta conta. Procure o suporte.', 403);
		}

		if (!user.requiresAdminApproval) {
			return {
				message: 'E-mail confirmado com sucesso. Agora você já pode entrar no NutriFlow.',
				status: 'CONFIRMED',
			};
		}

		if (!this.approvalRepository) {
			throw new AppError('Não foi possível registrar a solicitação. Tente novamente.', 503);
		}

		const application = await this.approvalRepository.upsertPending(user.id);
		const resultByStatus = {
			PENDING: 'E-mail confirmado com sucesso! Seu cadastro foi enviado para análise do administrador. Você receberá uma atualização quando houver uma decisão.',
			APPROVED: 'Seu cadastro foi aprovado! Agora você já pode acessar o NutriFlow.',
			REJECTED: 'Sua solicitação de cadastro foi recusada. Consulte o motivo informado pela administração.',
		};
		const reason = application.decisionReason
			? ` Motivo: ${application.decisionReason}`
			: '';
		return {
			message: `${resultByStatus[application.status] || resultByStatus.PENDING}${application.status === 'REJECTED' ? reason : ''}`,
			status: application.status,
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

		if (user.requiresAdminApproval) {
			if (!this.approvalRepository) {
				throw new AppError('Não foi possível verificar a aprovação administrativa.', 503);
			}

			let application = await this.approvalRepository.findByUserId(user.id);
			if (!application) {
				const { data: verifiedData, error: verificationError } =
					await this.requireSupabaseAuth().getUser(data.session.access_token);
				const verifiedUser = verifiedData?.user;
				if (verificationError) {
					throw this.toAuthError(
						verificationError,
						'Não foi possível validar seu e-mail agora. Tente novamente.',
					);
				}
				if (
					!verifiedUser?.email_confirmed_at ||
					verifiedUser.id !== data.user.id ||
					normalizeEmail(verifiedUser.email) !== normalizeEmail(user.email)
				) {
					throw new AppError('Confirme seu e-mail antes de enviar o cadastro para análise.', 401);
				}

				application = await this.approvalRepository.upsertPending(user.id);
			}

			if (application?.status === 'REJECTED') {
				const reason = application.decisionReason
					? ` Motivo: ${application.decisionReason}`
					: '';
				throw new AppError(
					`Sua solicitação de cadastro foi recusada. Consulte o motivo informado pela administração.${reason}`,
					403,
				);
			}
			if (application?.status !== 'APPROVED') {
				throw new AppError(
					'Seu e-mail já foi confirmado, mas seu acesso ainda depende da aprovação do administrador.',
					403,
				);
			}
		}

		if (!user.isActive) {
			throw new AppError(
				'Sua conta esta bloqueada. Procure o administrador da plataforma.',
				403,
			);
		}

		return {
			message: user.requiresAdminApproval
				? 'Seu cadastro foi aprovado! Agora você já pode acessar o NutriFlow.'
				: 'Login realizado com sucesso.',
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
			throw new AppError('Usuário não encontrado.', 404);
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
