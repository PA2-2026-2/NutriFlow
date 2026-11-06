const { AppError } = require('../errors/appError');

function toDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} inválida.`, 400);
  }
  return date;
}

function toUtcDateOnly(value, label) {
  const date = toDate(value, label);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new AppError(`O campo ${label.toLowerCase()} deve conter um número válido.`, 400);
  }
  return number;
}

function buildChallengeStatus(startDate, endDate) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'AGENDADO';
  if (now > end) return 'CONCLUIDO';
  return 'EM_ANDAMENTO';
}

function calculatePeriodDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
  return days;
}

function calculateParticipantProgress(challenge, participation) {
  const checkIns = (participation?.checkIns || []).filter((entry) => {
    const date = new Date(entry.checkInDate);
    return date >= new Date(challenge.startDate) && date <= new Date(challenge.endDate);
  });

  if (!checkIns.length) {
    return 0;
  }

  const totalDays = calculatePeriodDays(challenge.startDate, challenge.endDate);
  const completedDays = checkIns.filter((entry) => entry.completed).length;
  const goalTarget = challenge.goalTarget;

  if (typeof goalTarget === 'number' && Number.isFinite(goalTarget) && goalTarget > 0) {
    const completedValue = checkIns.reduce((sum, entry) => sum + (Number(entry.recordedValue) || 0), 0);
    const valueProgress = (completedValue / (goalTarget * totalDays)) * 100;
    return Math.min(100, Math.max(0, valueProgress));
  }

  return Math.min(100, Math.max(0, (completedDays / totalDays) * 100));
}

function serializeCheckIn(entry) {
  return {
    id: entry.id,
    participationId: entry.participationId,
    patientId: entry.patientId,
    checkInDate: entry.checkInDate,
    completed: Boolean(entry.completed),
    recordedValue: entry.recordedValue == null ? null : Number(entry.recordedValue),
    notes: entry.notes || '',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function serializeParticipant(participant, challenge) {
  const progress = calculateParticipantProgress(challenge, participant);
  return {
    id: participant.id,
    challengeId: participant.challengeId,
    patientId: participant.patientId,
    patient: participant.patient?.name || '',
    enrolledAt: participant.enrolledAt,
    status: participant.status,
    progress: Number(progress.toFixed(2)),
    checkIns: (participant.checkIns || []).map(serializeCheckIn),
  };
}

function serializeChallenge(challenge, currentPatientId = null) {
  const allParticipants = (challenge.participants || []).map((participant) => serializeParticipant(participant, challenge));
  const participants = currentPatientId
    ? allParticipants.filter((participant) => participant.patientId === currentPatientId)
    : allParticipants;
  const averageProgress = participants.length
    ? participants.reduce((sum, participant) => sum + Number(participant.progress || 0), 0) / participants.length
    : 0;

  return {
    id: challenge.id,
    nutritionistId: challenge.nutritionistId,
    title: challenge.title,
    description: challenge.description || '',
    category: challenge.category || 'GERAL',
    goalDescription: challenge.goalDescription,
    goalTarget: challenge.goalTarget == null ? null : Number(challenge.goalTarget),
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    status: challenge.status || buildChallengeStatus(challenge.startDate, challenge.endDate),
    isActive: challenge.isActive !== false,
    participantCount: allParticipants.length,
    averageProgress: Number(averageProgress.toFixed(2)),
    enrolled: currentPatientId ? participants.some((participant) => participant.patientId === currentPatientId) : undefined,
    participants,
  };
}

class ChallengeService {
  constructor(repository, profileRepository) {
    this.repository = repository;
    this.profileRepository = profileRepository;
  }

  async listForNutritionist(nutritionistId) {
    const challenges = await this.repository.listForNutritionist(nutritionistId);
    return {
      challenges: challenges.map((challenge) => serializeChallenge(challenge)),
    };
  }

  async createForNutritionist(nutritionistId, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AppError('Informe os dados do desafio.', 400);
    }

    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      throw new AppError('Informe o título do desafio.', 400);
    }

    const goalDescription = typeof payload.goalDescription === 'string' ? payload.goalDescription.trim() : '';
    if (!goalDescription) {
      throw new AppError('Informe a descrição da meta.', 400);
    }

    const startDate = toDate(payload.startDate, 'Data inicial');
    const endDate = toDate(payload.endDate, 'Data final');
    if (endDate <= startDate) {
      throw new AppError('A data final deve ser posterior à data inicial.', 400);
    }

    const goalTarget = payload.goalTarget == null ? null : normalizeNumber(payload.goalTarget, 'Meta');
    if (goalTarget != null && goalTarget <= 0) {
      throw new AppError('O valor alvo da meta deve ser maior que zero.', 400);
    }

    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const category = typeof payload.category === 'string' ? payload.category.trim() : 'GERAL';

    const challenge = await this.repository.create({
      nutritionistId,
      title,
      description: description || null,
      category: category || 'GERAL',
      goalDescription,
      goalTarget,
      startDate,
      endDate,
      status: buildChallengeStatus(startDate, endDate),
      isActive: true,
    });

    return { challenge: serializeChallenge(challenge) };
  }

  async updateForNutritionist(nutritionistId, challengeId, payload) {
    const challenge = await this.repository.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      throw new AppError('Desafio não encontrado.', 404);
    }
    if (challenge.nutritionistId !== nutritionistId) {
      throw new AppError('Este desafio não pertence ao nutricionista atual.', 403);
    }

    const nextPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const nextTitle = typeof nextPayload.title === 'string' ? nextPayload.title.trim() : challenge.title;
    const nextDescription = nextPayload.description == null ? challenge.description : String(nextPayload.description).trim();
    const nextCategory = nextPayload.category == null ? challenge.category : String(nextPayload.category).trim() || 'GERAL';
    const nextGoalDescription = typeof nextPayload.goalDescription === 'string' ? nextPayload.goalDescription.trim() : challenge.goalDescription;
    const nextGoalTarget = nextPayload.goalTarget == null ? challenge.goalTarget : normalizeNumber(nextPayload.goalTarget, 'Meta');
    const startDate = toDate(nextPayload.startDate || challenge.startDate, 'Data inicial');
    const endDate = toDate(nextPayload.endDate || challenge.endDate, 'Data final');

    if (endDate <= startDate) {
      throw new AppError('A data final deve ser posterior à data inicial.', 400);
    }

    const updated = await this.repository.update(challengeId, {
      title: nextTitle || challenge.title,
      description: nextDescription || null,
      category: nextCategory || 'GERAL',
      goalDescription: nextGoalDescription || challenge.goalDescription,
      goalTarget: nextGoalTarget != null && nextGoalTarget > 0 ? nextGoalTarget : null,
      startDate,
      endDate,
      status: buildChallengeStatus(startDate, endDate),
      updatedAt: new Date(),
    });

    return { challenge: serializeChallenge(updated) };
  }

  async deleteForNutritionist(nutritionistId, challengeId) {
    const challenge = await this.repository.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      throw new AppError('Desafio não encontrado.', 404);
    }
    if (challenge.nutritionistId !== nutritionistId) {
      throw new AppError('Este desafio não pertence ao nutricionista atual.', 403);
    }

    const participantCount = await this.repository.countParticipants(challengeId);
    const checkInCount = await this.repository.countCheckIns(challengeId);

    const archived = participantCount > 0 || checkInCount > 0;
    await this.repository.update(challengeId, {
      isActive: false,
      status: 'ENCERRADO',
    });

    return {
      archived,
      deleted: true,
    };
  }

  async listForPatient(patientId) {
    const profile = await this.profileRepository.findPatientWithNutritionistByUserId(patientId);
    if (!profile || !profile.nutritionistId) {
      throw new AppError('Você ainda não está vinculado a um nutricionista.', 403);
    }

    const challenges = await this.repository.listForPatient(profile.nutritionistId);
    return {
      challenges: challenges.map((challenge) => serializeChallenge(challenge, patientId)),
    };
  }

  async enrollPatient(patientId, challengeId, requestingNutritionistId = null) {
    const challenge = await this.repository.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      throw new AppError('Desafio não encontrado.', 404);
    }

    if (
      requestingNutritionistId &&
      challenge.nutritionistId !== requestingNutritionistId
    ) {
      throw new AppError('Desafio não encontrado.', 404);
    }

    if (typeof patientId !== 'string' || !patientId.trim()) {
      throw new AppError('Informe o paciente para inscricao.', 400);
    }

    const patientProfile = await this.profileRepository.findPatientWithUserByUserId(patientId);
    if (
      !patientProfile ||
      patientProfile.user.profile !== 'PATIENT' ||
      patientProfile.nutritionistId !== challenge.nutritionistId
    ) {
      throw new AppError('Este desafio não pertence ao seu nutricionista.', 403);
    }
    if (new Date(challenge.endDate) < new Date()) {
      throw new AppError('Este desafio já foi encerrado.', 400);
    }

    const existing = await this.repository.findParticipant(challengeId, patientId);
    if (existing) {
      throw new AppError('Você já está inscrito neste desafio.', 409);
    }

    const participant = await this.repository.createParticipant({
      challengeId,
      patientId,
      status: 'INSCRITO',
      progress: 0,
    });

    const enrichedChallenge = {
      ...challenge,
      participants: [...(challenge.participants || []), participant],
    };

    return {
      participant: serializeParticipant(participant, enrichedChallenge),
      challenge: serializeChallenge(enrichedChallenge, patientId),
    };
  }

  async getCheckInsForPatient(patientId, challengeId) {
    const challenge = await this.repository.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      throw new AppError('Desafio não encontrado.', 404);
    }

    const participation = await this.repository.findParticipant(challengeId, patientId);
    if (!participation) {
      throw new AppError('Você não está inscrito neste desafio.', 403);
    }

    const checkIns = await this.repository.listCheckInsForParticipation(participation.id);
    return {
      challengeId,
      checkIns: checkIns.map(serializeCheckIn),
    };
  }

  async createCheckIn(patientId, challengeId, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AppError('Informe os dados do check-in.', 400);
    }

    const challenge = await this.repository.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      throw new AppError('Desafio não encontrado.', 404);
    }

    const participation = await this.repository.findParticipant(challengeId, patientId);
    if (!participation) {
      throw new AppError('Você não está inscrito neste desafio.', 403);
    }

    const checkInDate = toUtcDateOnly(payload.checkInDate || new Date(), 'Data do check-in');
    const startDate = new Date(challenge.startDate);
    const endDate = new Date(challenge.endDate);
    if (checkInDate < startDate || checkInDate > endDate) {
      throw new AppError('O check-in deve ser realizado durante o período do desafio.', 400);
    }

    const existing = await this.repository.findCheckInByParticipationAndDate(participation.id, new Date(checkInDate.getTime()));
    if (existing) {
      throw new AppError('Ja existe um check-in para este dia.', 409);
    }

    const recordedValue = payload.recordedValue == null ? null : normalizeNumber(payload.recordedValue, 'Valor registrado');
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
    const completed = payload.completed === true || (typeof recordedValue === 'number' && challenge.goalTarget != null && recordedValue >= Number(challenge.goalTarget));

    const checkIn = await this.repository.createCheckIn({
      participationId: participation.id,
      patientId,
      checkInDate,
      completed,
      recordedValue,
      notes: notes || null,
    });

    const updatedParticipation = await this.repository.updateParticipant(participation.id, {
      progress: calculateParticipantProgress(challenge, {
        ...participation,
        checkIns: [...(participation.checkIns || []), checkIn],
      }),
      status: completed ? 'EM_ANDAMENTO' : participation.status,
      updatedAt: new Date(),
    });

    return {
      checkIn: serializeCheckIn(checkIn),
      participation: serializeParticipant(updatedParticipation, { ...challenge, participants: [{ ...updatedParticipation, patient: participation.patient }] }),
    };
  }

  async completeChallenge(patientId, challengeId) {
    const challenge = await this.repository.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      throw new AppError('Desafio não encontrado.', 404);
    }

    const participation = await this.repository.findParticipant(challengeId, patientId);
    if (!participation) {
      throw new AppError('Você não está inscrito neste desafio.', 403);
    }

    const updated = await this.repository.updateParticipant(participation.id, {
      status: 'CONCLUIDO',
      progress: 100,
    });

    return {
      challengeId,
      participant: serializeParticipant(updated, challenge),
    };
  }
}

module.exports = {
  ChallengeService,
};
