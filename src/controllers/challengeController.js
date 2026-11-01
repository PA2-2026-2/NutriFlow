class ChallengeController {
  constructor(challengeService) {
    this.challengeService = challengeService;
  }

  async list(request, response) {
    const result = await this.challengeService.listForNutritionist(request.user.sub);
    response.status(200).json(result);
  }

  async listForPatient(request, response) {
    const result = await this.challengeService.listForPatient(request.user.sub);
    response.status(200).json(result);
  }

  async create(request, response) {
    const result = await this.challengeService.createForNutritionist(request.user.sub, request.body || {});
    response.status(201).json(result);
  }

  async update(request, response) {
    const result = await this.challengeService.updateForNutritionist(request.user.sub, request.params.challengeId, request.body || {});
    response.status(200).json(result);
  }

  async remove(request, response) {
    const result = await this.challengeService.deleteForNutritionist(request.user.sub, request.params.challengeId);
    response.status(200).json(result);
  }

  async addParticipant(request, response) {
    const result = await this.challengeService.enrollPatient(request.body.patientId || request.user.sub, request.params.challengeId);
    response.status(201).json(result);
  }

  async enroll(request, response) {
    const result = await this.challengeService.enrollPatient(request.user.sub, request.params.challengeId);
    response.status(201).json(result);
  }

  async getCheckIns(request, response) {
    const result = await this.challengeService.getCheckInsForPatient(request.user.sub, request.params.challengeId);
    response.status(200).json(result);
  }

  async createCheckIn(request, response) {
    const result = await this.challengeService.createCheckIn(request.user.sub, request.params.challengeId, request.body || {});
    response.status(201).json(result);
  }

  async complete(request, response) {
    const result = await this.challengeService.completeChallenge(request.user.sub, request.params.challengeId);
    response.status(200).json(result);
  }
}

module.exports = {
  ChallengeController,
};
