const { normalizeRole, toRoleLabel } = require('../constants/roles');


function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: toRoleLabel(user.profile),
    role: normalizeRole(user.profile),
    isActive: user.isActive,
    phone: user.phone || null,
    profilePhotoUrl: user.profilePhotoUrl || null,
    createdAt: user.createdAt,
  };
}

module.exports = {
  toPublicUser,
};
