class NutritionalGoalController {
  constructor(service) {
    this.service = service;
  }

  async listForPatient(request, response) {
    response.status(200).json(await this.service.listForPatient(request.user.sub));
  }

  async getForPatient(request, response) {
    response.status(200).json(
      await this.service.getForPatient(request.user.sub, request.params.goalId),
    );
  }

  async recordProgress(request, response) {
    response.status(201).json(
      await this.service.recordProgress(
        request.user.sub,
        request.params.goalId,
        request.body || {},
      ),
    );
  }

  async listForNutritionist(request, response) {
    response.status(200).json(
      await this.service.listForNutritionist(request.user.sub, {
        patientId: request.query.patientId,
        category: request.query.category,
        status: request.query.status,
      }),
    );
  }

  async getForNutritionist(request, response) {
    response.status(200).json(
      await this.service.getForNutritionist(request.user.sub, request.params.goalId),
    );
  }

  async create(request, response) {
    response.status(201).json(
      await this.service.createForNutritionist(request.user.sub, request.body || {}),
    );
  }

  async update(request, response) {
    response.status(200).json(
      await this.service.updateForNutritionist(
        request.user.sub,
        request.params.goalId,
        request.body || {},
      ),
    );
  }

  async updateStatus(request, response) {
    response.status(200).json(
      await this.service.updateStatusForNutritionist(
        request.user.sub,
        request.params.goalId,
        request.body || {},
      ),
    );
  }
}

module.exports = { NutritionalGoalController };
