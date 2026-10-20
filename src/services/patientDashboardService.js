const { AppError } = require('../errors/appError');

const MEAL_TYPES = new Set([
	'Cafe da manha',
	'Lanche da manha',
	'Almoco',
	'Lanche da tarde',
	'Jantar',
	'Ceia',
]);

const MEASUREMENT_FIELDS = [
	['weightKg', 'Peso', 'kg'],
	['heightCm', 'Altura', 'cm'],
	['bodyFatPercent', 'Gordura corporal', '%'],
	['neckCircumferenceCm', 'Pescoço', 'cm'],
	['chestCircumferenceCm', 'Tórax', 'cm'],
	['waistCircumferenceCm', 'Cintura', 'cm'],
	['hipCircumferenceCm', 'Quadril', 'cm'],
	['armCircumferenceCm', 'Braço', 'cm'],
	['thighCircumferenceCm', 'Coxa', 'cm'],
	['calfCircumferenceCm', 'Panturrilha', 'cm'],
	['tricepsSkinfoldMm', 'Dobra tricipital', 'mm'],
	['bicepsSkinfoldMm', 'Dobra bicipital', 'mm'],
	['subscapularSkinfoldMm', 'Dobra subescapular', 'mm'],
	['suprailiacSkinfoldMm', 'Dobra supra-ilíaca', 'mm'],
	['abdominalSkinfoldMm', 'Dobra abdominal', 'mm'],
	['thighSkinfoldMm', 'Dobra da coxa', 'mm'],
	['calfSkinfoldMm', 'Dobra da panturrilha', 'mm'],
];

function startOfLocalDay(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateLabel(date) {
	return new Intl.DateTimeFormat('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(date);
}

function percent(value, target) {
	return target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
}

function formatWeight(value) {
	return value === null || value === undefined ? '--' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}kg`;
}

function presentMeasurements(measurements) {
	const entries = measurements.map((entry) => {
		const items = MEASUREMENT_FIELDS
			.filter(([field]) => entry[field] !== null && entry[field] !== undefined)
			.map(([field, label, unit]) => ({
				label,
				value: entry[field],
				valueLabel: `${entry[field]} ${unit}`,
			}));

		if (entry.notes) {
			items.push({
				label: 'Observações',
				value: entry.notes,
				valueLabel: entry.notes,
			});
		}

		return {
			id: entry.id,
			date: entry.recordedAt,
			dateLabel: toDateLabel(entry.recordedAt),
			items,
		};
	});

	const latestItems = new Map();
	for (const entry of [...entries].reverse()) {
		for (const item of entry.items) {
			if (!latestItems.has(item.label)) {
				latestItems.set(item.label, {
					...item,
					dateLabel: entry.dateLabel,
				});
			}
		}
	}

	return {
		latest: [...latestItems.values()],
		history: [...entries].reverse().map(({ id, date, dateLabel, items }) => ({
			id,
			date,
			dateLabel,
			items,
		})),
	};
}

function buildWeightSummary(profile, manualEntries, measurements) {
	const entries = [
		...manualEntries.map((entry) => ({
			date: entry.recordedAt,
			weight: entry.weightKg,
			note: entry.note,
		})),
		...measurements
			.filter((entry) => entry.weightKg !== null && entry.weightKg !== undefined)
			.map((entry) => ({
				date: entry.recordedAt,
				weight: entry.weightKg,
				note: entry.notes || '',
			})),
	].sort((first, second) => new Date(first.date) - new Date(second.date));

	const latest = entries[entries.length - 1];
	const previous = entries[entries.length - 2];
	const current = latest?.weight ?? profile?.weight ?? null;
	const variation = latest && previous ? latest.weight - previous.weight : null;
	const lastWeek = entries.filter((entry) => Date.now() - new Date(entry.date).getTime() <= 7 * 86400000);
	const average = lastWeek.length
		? lastWeek.reduce((sum, entry) => sum + entry.weight, 0) / lastWeek.length
		: null;
	const trend = variation === null || variation === 0
		? 'Estável'
		: variation > 0 ? 'Subindo' : 'Descendo';
	const history = [...entries].reverse().map((entry, index, reversed) => {
		const newer = reversed[index - 1];
		const change = newer ? entry.weight - newer.weight : null;
		return {
			dateLabel: toDateLabel(new Date(entry.date)),
			weightLabel: formatWeight(entry.weight),
			variationLabel: change === null ? '--' : `${change > 0 ? '+' : ''}${change.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}kg`,
			note: entry.note,
		};
	});

	return {
		labels: entries.slice(-7).map((entry) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(entry.date))),
		values: entries.slice(-7).map((entry) => entry.weight),
		currentLabel: formatWeight(current),
		targetLabel: '--',
		initialLabel: formatWeight(entries[0]?.weight ?? profile?.weight),
		variationLabel: variation === null ? '--' : `${variation > 0 ? '+' : ''}${variation.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}kg`,
		weeklyAverageLabel: average === null ? '--' : formatWeight(average),
		paceLabel: trend,
		trendLabel: trend,
		history,
	};
}

function buildPlan(plan) {
	if (!plan) {
		return null;
	}

	const sectionMap = new Map();
	for (const item of plan.items) {
		const section = sectionMap.get(item.mealTime) || [];
		section.push(`${item.food.name} (${item.quantity}g)`);
		sectionMap.set(item.mealTime, section);
	}

	return {
		title: plan.title,
		sections: [...sectionMap.entries()].map(([slotLabel, foods]) => ({
			slotLabel,
			title: foods.join(', '),
			description: plan.notes || 'Porções conforme a quantidade indicada.',
		})),
	};
}

class PatientDashboardService {
	constructor(repository) {
		this.repository = repository;
	}

	async getDashboard(userId) {
		const record = await this.repository.findDashboardData(userId);
		if (!record || record.profile !== 'PATIENT') {
			throw new AppError('Perfil do paciente nao encontrado.', 404);
		}

		const profile = record.patientProfile;
		const now = new Date();
		const todayStart = startOfLocalDay(now);
		const mealsToday = (record.mealEntries || []).filter((entry) => entry.loggedAt >= todayStart);
		const totals = mealsToday.reduce((sum, entry) => {
			for (const field of ['calories', 'protein', 'carbs', 'fats', 'fiber', 'waterMl']) {
				sum[field] += entry[field];
			}
			return sum;
		}, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, waterMl: 0 });

		const activePlan = record.mealPlansAsPatient?.[0] || null;
		const targets = activePlan
			? { calories: activePlan.calories, protein: activePlan.protein, carbs: activePlan.carbs, fats: activePlan.fats }
			: { calories: 0, protein: 0, carbs: 0, fats: 0 };
		const weeklyCalories = Array.from({ length: 7 }, (_, index) => {
			const date = new Date(todayStart);
			date.setDate(date.getDate() - 6 + index);
			const end = new Date(date);
			end.setDate(end.getDate() + 1);
			const calories = (record.mealEntries || [])
				.filter((entry) => entry.loggedAt >= date && entry.loggedAt < end)
				.reduce((sum, entry) => sum + entry.calories, 0);
			const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
				.format(date)
				.replace('.', '');
			return {
				label,
				calories,
				percent: percent(calories, targets.calories),
			};
		});

		const meals = mealsToday
			.sort((first, second) => first.loggedAt - second.loggedAt)
			.map((entry) => ({
				id: entry.id,
				timeLabel: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(entry.loggedAt),
				mealType: entry.mealType,
				title: entry.title,
				description: entry.description,
				calories: entry.calories,
				protein: entry.protein,
				carbs: entry.carbs,
				fats: entry.fats,
				fiber: entry.fiber,
				waterMl: entry.waterMl,
			}));

		const historyByDate = new Map();
		for (const entry of record.mealEntries || []) {
			const dateKey = toDateLabel(entry.loggedAt);
			const day = historyByDate.get(dateKey) || { calories: 0, date: entry.loggedAt };
			day.calories += entry.calories;
			historyByDate.set(dateKey, day);
		}

		const measurements = profile?.measurements || [];
		const foods = await this.repository.listFoods();
		const manualWeightEntries = record.weightEntries || [];
		const latestWeight = [
			...manualWeightEntries.map((entry) => ({
				recordedAt: entry.recordedAt,
				weightKg: entry.weightKg,
			})),
			...measurements
				.filter((entry) => entry.weightKg !== null && entry.weightKg !== undefined)
				.map((entry) => ({
					recordedAt: entry.recordedAt,
					weightKg: entry.weightKg,
				})),
		].sort((first, second) => second.recordedAt - first.recordedAt)[0];

		return {
			setupRequired: !profile?.nutritionistId,
			patient: {
				id: record.id,
				name: record.name,
				email: record.email,
				profile: 'Paciente',
				role: 'PATIENT',
				age: profile?.age ?? null,
				weight: latestWeight?.weightKg ?? profile?.weight ?? null,
				height: profile?.height ?? null,
				objective: profile?.objective ?? null,
				restrictions: profile?.restrictions ?? null,
				nutritionist: profile?.nutritionist ?? null,
			},
			foods,
			overview: {
				adherencePercent: percent(totals.calories, targets.calories),
				caloriesConsumed: totals.calories,
				caloriesTarget: targets.calories,
				fiber: totals.fiber,
				waterLiters: Number((totals.waterMl / 1000).toFixed(1)),
				macros: [
					{ label: 'Proteinas', value: totals.protein, progress: percent(totals.protein, targets.protein), note: targets.protein ? `de ${Math.round(targets.protein)}g` : 'Sem meta definida' },
					{ label: 'Carboidratos', value: totals.carbs, progress: percent(totals.carbs, targets.carbs), note: targets.carbs ? `de ${Math.round(targets.carbs)}g` : 'Sem meta definida' },
					{ label: 'Gorduras', value: totals.fats, progress: percent(totals.fats, targets.fats), note: targets.fats ? `de ${Math.round(targets.fats)}g` : 'Sem meta definida' },
				],
				weeklyCalories,
			},
			goals: {
				items: targets.calories > 0
					? [{ label: 'Meta diária de calorias', valueLabel: `${Math.round(targets.calories)} kcal`, percent: percent(totals.calories, targets.calories) }]
					: [],
				focusTitle: profile?.objective ? `Foco atual: ${profile.objective}` : 'Defina um objetivo com sua nutricionista.',
				observationNote: profile?.restrictions || 'Sem observacoes clinicas registradas ate o momento.',
			},
			meals,
			history: [...historyByDate.entries()]
				.map(([dateLabel, day]) => ({
					dateLabel,
					planLabel: activePlan?.title || 'Registros alimentares',
					caloriesLabel: `${day.calories} kcal`,
					checkInLabel: targets.calories > 0 && day.calories >= targets.calories * 0.8 ? 'Completo' : 'Parcial',
					sortDate: day.date,
				}))
				.sort((first, second) => second.sortDate - first.sortDate)
				.map(({ sortDate, ...day }) => day),
			plan: buildPlan(activePlan),
			bodyMeasurements: presentMeasurements(measurements),
			weight: buildWeightSummary(profile, record.weightEntries || [], measurements),
			clinical: {
				nextAppointment: null,
				checklist: [],
				insight: profile?.objective
					? `Continue acompanhando seu objetivo: ${profile.objective}.`
					: 'Converse com sua nutricionista para definir seu foco.',
			},
			chat: {
				responseTimeLabel: profile?.nutritionist ? 'Chat disponivel' : 'Sem nutricionista vinculada',
				quickReplies: [],
				messages: [],
			},
		};
	}

	async createMeal(userId, payload) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			throw new AppError('Informe os dados da refeicao.', 400);
		}
		const profile = await this.repository.findPatientProfile(userId);
		if (!profile?.nutritionistId) {
			throw new AppError('Conecte sua conta a um nutricionista antes de registrar refeicoes.', 403);
		}

		const title = typeof payload.title === 'string' ? payload.title.trim() : '';
		const description = typeof payload.description === 'string' ? payload.description.trim() : '';
		const loggedAt = new Date(payload.loggedAt);
		if (!MEAL_TYPES.has(payload.mealType)) {
			throw new AppError('Selecione um tipo de refeicao valido.', 400);
		}
		if (title.length < 3 || title.length > 80) {
			throw new AppError('Informe um titulo com 3 a 80 caracteres.', 400);
		}
		if (description.length > 280) {
			throw new AppError('A descricao da refeicao deve ter ate 280 caracteres.', 400);
		}
		if (Number.isNaN(loggedAt.getTime()) || loggedAt.getTime() > Date.now() + 5 * 60000) {
			throw new AppError('Horario invalido para o registro da refeicao.', 400);
		}

		const data = { calories: 2500, protein: 250, carbs: 350, fats: 180, fiber: 80, waterMl: 2000 };
		for (const [field, max] of Object.entries(data)) {
			if (!Number.isInteger(payload[field]) || payload[field] < 0 || payload[field] > max) {
				throw new AppError(`${field} deve ser um numero inteiro entre 0 e ${max}.`, 400);
			}
			data[field] = payload[field];
		}

		await this.repository.createMealEntry(userId, {
			mealType: payload.mealType,
			title,
			description,
			loggedAt,
			...data,
		});
		return { message: 'Refeicao registrada com sucesso.' };
	}

	async createWeight(userId, payload) {
		const profile = await this.repository.findPatientProfile(userId);
		if (!profile?.nutritionistId) {
			throw new AppError('Conecte sua conta a um nutricionista antes de registrar peso.', 403);
		}
		const weightKg = Number(payload?.weight);
		const recordedAt = new Date(payload?.recordedAt);
		const note = typeof payload?.note === 'string' ? payload.note.trim() : '';
		if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350) {
			throw new AppError('O peso precisa ficar entre 20kg e 350kg.', 400);
		}
		if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > Date.now() + 5 * 60000) {
			throw new AppError('Data invalida para o registro de peso.', 400);
		}
		if (note.length > 180) {
			throw new AppError('A observacao deve ter ate 180 caracteres.', 400);
		}
		await this.repository.createWeightEntry(userId, { weightKg, recordedAt, note });
		return { message: 'Peso semanal registrado com sucesso.' };
	}
}

module.exports = { PatientDashboardService };