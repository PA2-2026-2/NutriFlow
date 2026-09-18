const ROLE_MAP = {
	paciente: 'PATIENT',
	patient: 'PATIENT',
	patients: 'PATIENT',
	nutritionist: 'NUTRITIONIST',
	nutricionista: 'NUTRITIONIST',
	nutricionistas: 'NUTRITIONIST',
	admin: 'ADMIN',
	administrador: 'ADMIN',
	administradores: 'ADMIN',
};

function normalizeRole(value) {
	const normalized = String(value || '').trim();

	if (!normalized) {
		return '';
	}

	if (
		normalized === 'PATIENT' ||
		normalized === 'NUTRITIONIST' ||
		normalized === 'ADMIN'
	) {
		return normalized;
	}

	return ROLE_MAP[normalized.toLowerCase()] || '';
}

function toRoleLabel(value) {
	const normalized = normalizeRole(value);

	if (normalized === 'PATIENT') {
		return 'Paciente';
	}

	if (normalized === 'NUTRITIONIST') {
		return 'Nutricionista';
	}

	if (normalized === 'ADMIN') {
		return 'Administrador';
	}

	return '';
}

module.exports = {
	normalizeRole,
	toRoleLabel,
};
