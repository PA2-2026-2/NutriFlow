const crypto = require('crypto');

function createMockSupabaseAuthClient() {
	const usersByEmail = new Map();
	const usersById = new Map();
	const sessions = new Map();
	const revokedTokens = new Set();
	const resetRequests = [];
	const confirmationRequests = [];
	const signupRequests = [];

	function createSession(user) {
		const access_token = `test-access-${crypto.randomUUID()}`;
		const refresh_token = `test-refresh-${crypto.randomUUID()}`;
		sessions.set(access_token, user);
		return { access_token, refresh_token, token_type: 'bearer', user };
	}

	function makeUser({ id, email, password, name = 'Usuário de teste', profile = 'PATIENT', confirmed = false }) {
		const user = {
			id: id || crypto.randomUUID(),
			email,
			email_confirmed_at: confirmed ? new Date().toISOString() : null,
			identities: [{ id: id || crypto.randomUUID() }],
			user_metadata: { name, profile },
		};
		usersByEmail.set(email.toLowerCase(), { user, password });
		usersById.set(user.id, user);
		return user;
	}

	const auth = {
		admin: {
			async signOut(token) {
				if (!sessions.has(token)) {
					return { error: { status: 401, message: 'Invalid token' } };
				}
				revokedTokens.add(token);
				return { error: null };
			},
		},

		async signUp({ email, password, options }) {
			signupRequests.push({ email, password, options });
			const key = email.toLowerCase();
			if (usersByEmail.has(key)) {
				return {
					data: {
						user: { ...usersByEmail.get(key).user, identities: [] },
						session: null,
					},
					error: null,
				};
			}

			const user = makeUser({
				email,
				password,
				name: options?.data?.name,
				profile: options?.data?.profile,
			});
			return { data: { user, session: null }, error: null };
		},

		async signInWithPassword({ email, password }) {
			const account = usersByEmail.get(email.toLowerCase());
			if (!account || account.password !== password) {
				return {
					data: { user: null, session: null },
					error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
				};
			}
			if (!account.user.email_confirmed_at) {
				return {
					data: { user: null, session: null },
					error: { status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' },
				};
			}
			return { data: { user: account.user, session: createSession(account.user) }, error: null };
		},

		async getUser(token) {
			const user = sessions.get(token);
			if (!user || revokedTokens.has(token)) {
				return { data: { user: null }, error: { status: 401, message: 'Invalid token' } };
			}
			return { data: { user }, error: null };
		},

		async resetPasswordForEmail(email, options) {
			resetRequests.push({ email, options });
			return { data: {}, error: null };
		},

		async resend(request) {
			confirmationRequests.push(request);
			return { data: {}, error: null };
		},

		async updateUser({ password }) {
			return { data: { user: { password } }, error: null };
		},
	};

	return {
		auth,
		mock: {
			seedUser: makeUser,
			confirmEmail(email) {
				const account = usersByEmail.get(email.toLowerCase());
				if (account) {
					account.user.email_confirmed_at = new Date().toISOString();
				}
			},
			resetRequests,
			confirmationRequests,
			signupRequests,
			sessions,
			revokedTokens,
			usersByEmail,
			usersById,
		},
	};
}

module.exports = { createMockSupabaseAuthClient };
