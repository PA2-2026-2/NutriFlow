class PatientController {
        constructor(patientService) {
                this.patientService = patientService;
        }

        async setNutritionist(request, response) {
                const result = await this.patientService.setNutritionist(
                        request.user.sub,
                        request.body || {},
                );
                response.status(200).json(result);
        }

        async getLinkedPatients(request, response) {
                const result = await this.patientService.getLinkedPatients(
                        request.user.sub,
                );
                response.status(200).json(result);
        }

        async linkPatient(request, response) {
                const result = await this.patientService.linkPatient(
                        request.user.sub,
                        request.body || {},
                );
                response.status(200).json(result);
        }

        async recordMeasurement(request, response) {
                const result = await this.patientService.recordMeasurement(
                        request.user.sub,
                        request.params.id,
                        request.body || {},
                );
                response.status(201).json({ measurement: result });
        }

        async updateMeasurement(request, response) {
                const result = await this.patientService.updateMeasurement(
                        request.user.sub,
                        request.params.id,
                        request.params.measurementId,
                        request.body || {},
                        { partial: request.method === 'PATCH' },
                );
                response.status(200).json({ measurement: result });
        }

        async deleteMeasurement(request, response) {
                const result = await this.patientService.deleteMeasurement(
                        request.user.sub,
                        request.params.id,
                        request.params.measurementId,
                );
                response.status(200).json(result);
        }

        async getMeasurements(request, response) {
                const result = await this.patientService.getMeasurements(
                        request.user.sub,
                        request.user.profile,
                        request.params.id,
                );
                response.status(200).json(result);
        }

        linkNutritionist(request, response) {
                return this.setNutritionist(request, response);
        }
}

module.exports = {
        PatientController,
};