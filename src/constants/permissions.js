const { ROLES } = require('./roles');


const ANY_ROLE = Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST, ROLES.ADMIN]);
const ADMIN_ONLY = Object.freeze([ROLES.ADMIN]);
const PATIENT_ONLY = Object.freeze([ROLES.PATIENT]);
const NUTRITIONIST_ONLY = Object.freeze([ROLES.NUTRITIONIST]);


const PUBLIC_ROUTES = Object.freeze([
  'GET /health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/logout',
]);


const PROTECTED_ROUTES = Object.freeze({
  'GET /api/auth/me': ANY_ROLE,

  'GET /api/users/me': ANY_ROLE,
  'PUT /api/users/me': ANY_ROLE,
  'POST /api/users/me/photo': ANY_ROLE,

  'POST /api/patients/me/nutritionist': PATIENT_ONLY,
  'POST /api/patients/:id/measurements': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/patients': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/foods': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/meal-plans': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/meal-plans': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/link-patient': NUTRITIONIST_ONLY,

  'GET /api/admin/users': ADMIN_ONLY,
  'GET /api/admin/summary': ADMIN_ONLY,
  'PUT /api/admin/users/:userId': ADMIN_ONLY,
  'PATCH /api/admin/users/:userId/status': ADMIN_ONLY,
  'DELETE /api/admin/users/:userId': ADMIN_ONLY,
});

function getAllowedRoles(routeKey) {
  const roles = PROTECTED_ROUTES[routeKey];

  if (!roles) {
    throw new Error(
      `Rota sem permissao declarada na matriz (src/constants/permissions.js): ${routeKey}`,
    );
  }

  return roles;
}

module.exports = {
  ROLES,
  PUBLIC_ROUTES,
  PROTECTED_ROUTES,
  getAllowedRoles,
};