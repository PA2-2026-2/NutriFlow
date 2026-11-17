function heightInMeters(height) {
	const value = Number(height);
	if (!Number.isFinite(value) || value <= 0) {
		return null;
	}

	const meters = value <= 3 ? value : value / 100;
	return meters >= 0.3 && meters <= 3 ? meters : null;
}

function classifyAdultBmi(value) {
	if (!Number.isFinite(value) || value <= 0) {
		return null;
	}
	if (value < 18.5) return 'Baixo peso';
	if (value < 25) return 'Peso adequado';
	if (value < 30) return 'Sobrepeso';
	if (value < 35) return 'Obesidade grau I';
	if (value < 40) return 'Obesidade grau II';
	return 'Obesidade grau III';
}

function calculateBmi(weightKg, height, age) {
	const weight = Number(weightKg);
	const heightMeters = heightInMeters(height);
	if (!Number.isFinite(weight) || weight < 1 || weight > 500 || !heightMeters) {
		return { value: null, valueLabel: '--', classification: null };
	}

	const value = weight / (heightMeters * heightMeters);
	return {
		value: Number(value.toFixed(2)),
		valueLabel: `${value.toFixed(2).replace('.', ',')} kg/m²`,
		classification: Number.isInteger(age) && age >= 18
			? classifyAdultBmi(value)
			: null,
	};
}

function buildBmiHistory(entries, age, fallbackHeight) {
	let latestHeight = heightInMeters(fallbackHeight) ? fallbackHeight : null;
	const datedEntries = entries
		.map((entry) => ({
			entry,
			date: new Date(entry.recordedAt || entry.date),
		}))
		.filter(({ date }) => !Number.isNaN(date.getTime()))
		.sort((first, second) => first.date - second.date
			|| Number(Boolean(second.entry.heightCm ?? second.entry.height))
			- Number(Boolean(first.entry.heightCm ?? first.entry.height)));

	return datedEntries.flatMap(({ entry, date }) => {
		const height = entry.heightCm ?? entry.height;
		if (heightInMeters(height)) {
			latestHeight = height;
		}
		const weightKg = entry.weightKg ?? entry.weight;
		const result = calculateBmi(weightKg, height ?? latestHeight, age);
		return result.value === null ? [] : [{
			date: date.toISOString(),
			dateLabel: new Intl.DateTimeFormat('pt-BR').format(date),
			weightKg,
			...result,
		}];
	});
}

function buildBmiSummary(entries, age, profileWeight, profileHeight) {
	const history = buildBmiHistory(entries, age, profileHeight);
	const current = history.at(-1) || {
		date: null,
		dateLabel: null,
		weightKg: profileWeight ?? null,
		...calculateBmi(profileWeight, profileHeight, age),
	};
	return { current, history: [...history].reverse() };
}

module.exports = {
	buildBmiHistory,
	buildBmiSummary,
	calculateBmi,
	classifyAdultBmi,
	heightInMeters,
};