const { createClient } = require('@supabase/supabase-js');

function createSupabaseAuthClient(url, anonKey) {
	if (!url || !anonKey) {
		return null;
	}

	return createClient(url, anonKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false,
			flowType: 'implicit',
		},
	});
}

module.exports = {
	createSupabaseAuthClient,
};
