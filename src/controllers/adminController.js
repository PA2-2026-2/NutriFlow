class AdminController {
	constructor(adminService) {
		this.adminService = adminService;
	}

	async getUsers(request, response) {
		const result = await this.adminService.getUsers(request.query);
		response.status(200).json(result);
	}

	async updateUser(request, response) {
		const result = await this.adminService.updateUser(
			request.params.userId,
			request.body || {},
		);
		response.status(200).json(result);
	}

	async updateUserStatus(request, response) {
		const result = await this.adminService.updateUserStatus(
			request.params.userId,
			request.body || {},
			request.user.sub,
		);
		response.status(200).json(result);
	}

	async deleteUser(request, response) {
		const result = await this.adminService.deleteUser(
			request.params.userId,
			request.user.sub,
		);
		response.status(200).json(result);
	}
}

module.exports = {
	AdminController,
};