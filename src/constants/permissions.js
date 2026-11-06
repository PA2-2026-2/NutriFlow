const { ROLES } = require('./roles');


const ANY_ROLE = Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST, ROLES.ADMIN]);
const ADMIN_ONLY = Object.freeze([ROLES.ADMIN]);
const PATIENT_ONLY = Object.freeze([ROLES.PATIENT]);
const NUTRITIONIST_ONLY = Object.freeze([ROLES.NUTRITIONIST]);


const PUBLIC_ROUTES = Object.freeze([
  'GET /health',
  'GET /api/vendor/supabase.js',
  'GET /api/auth/config',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/password-reset',
  'POST /api/auth/resend-confirmation',
  'POST /api/auth/confirm-email',
  'POST /api/auth/logout',
]);


const PROTECTED_ROUTES = Object.freeze({
  'GET /api/auth/me': ANY_ROLE,

  'GET /api/users/me': ANY_ROLE,
  'PUT /api/users/me': ANY_ROLE,
  'POST /api/users/me/photo': ANY_ROLE,

  'POST /api/patients/me/nutritionist': PATIENT_ONLY,
  'POST /api/patients/:id/measurements': NUTRITIONIST_ONLY,
  'PUT /api/patients/:id/measurements/:measurementId': NUTRITIONIST_ONLY,
  'PATCH /api/patients/:id/measurements/:measurementId': NUTRITIONIST_ONLY,
  'DELETE /api/patients/:id/measurements/:measurementId': NUTRITIONIST_ONLY,
  'GET /api/patients/:id/measurements': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /api/patients/goals': PATIENT_ONLY,
  'GET /api/patients/goals/:goalId': PATIENT_ONLY,
  'POST /api/patients/goals/:goalId/progress': PATIENT_ONLY,
  'GET /api/patient/dashboard': PATIENT_ONLY,
  'GET /api/patient/chat': PATIENT_ONLY,
  'POST /api/patient/meals': PATIENT_ONLY,
  'POST /api/patient/messages': PATIENT_ONLY,
  'POST /api/patient/weights': PATIENT_ONLY,
  'GET /api/nutritionist/patients': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/foods': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/meal-plans': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/meal-plans': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/link-patient': NUTRITIONIST_ONLY,
  'GET /api/nutritionists/patients': NUTRITIONIST_ONLY,
  'GET /api/nutritionists/foods': NUTRITIONIST_ONLY,
  'GET /api/nutritionists/meal-plans': NUTRITIONIST_ONLY,
  'POST /api/nutritionists/meal-plans': NUTRITIONIST_ONLY,
  'POST /api/nutritionists/link-patient': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/goals': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/goals': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/goals/:goalId': NUTRITIONIST_ONLY,
  'PUT /api/nutritionist/goals/:goalId': NUTRITIONIST_ONLY,
  'PATCH /api/nutritionist/goals/:goalId/status': NUTRITIONIST_ONLY,
  'GET /api/nutritionists/goals': NUTRITIONIST_ONLY,
  'POST /api/nutritionists/goals': NUTRITIONIST_ONLY,
  'GET /api/nutritionists/goals/:goalId': NUTRITIONIST_ONLY,
  'PUT /api/nutritionists/goals/:goalId': NUTRITIONIST_ONLY,
  'PATCH /api/nutritionists/goals/:goalId/status': NUTRITIONIST_ONLY,
  'GET /api/nutritionist/challenges': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/challenges': NUTRITIONIST_ONLY,
  'PUT /api/nutritionist/challenges/:challengeId': NUTRITIONIST_ONLY,
  'PATCH /api/nutritionist/challenges/:challengeId': NUTRITIONIST_ONLY,
  'DELETE /api/nutritionist/challenges/:challengeId': NUTRITIONIST_ONLY,
  'POST /api/nutritionist/challenges/:challengeId/participants': NUTRITIONIST_ONLY,
  'GET /api/nutritionists/challenges': NUTRITIONIST_ONLY,
  'POST /api/nutritionists/challenges': NUTRITIONIST_ONLY,
  'PUT /api/nutritionists/challenges/:challengeId': NUTRITIONIST_ONLY,
  'PATCH /api/nutritionists/challenges/:challengeId': NUTRITIONIST_ONLY,
  'DELETE /api/nutritionists/challenges/:challengeId': NUTRITIONIST_ONLY,
  'POST /api/nutritionists/challenges/:challengeId/participants': NUTRITIONIST_ONLY,
  'GET /api/patient/challenges': PATIENT_ONLY,
  'POST /api/patient/challenges/:challengeId/enroll': PATIENT_ONLY,
  'GET /api/patient/challenges/:challengeId/checkins': PATIENT_ONLY,
  'POST /api/patient/challenges/:challengeId/checkins': PATIENT_ONLY,
  'PATCH /api/patient/challenges/:challengeId/complete': PATIENT_ONLY,
  'GET /api/patients/challenges': PATIENT_ONLY,
  'POST /api/patients/challenges/:challengeId/enroll': PATIENT_ONLY,
  'GET /api/patients/challenges/:challengeId/checkins': PATIENT_ONLY,
  'POST /api/patients/challenges/:challengeId/checkins': PATIENT_ONLY,
  'GET /api/appointments': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'POST /api/appointments': NUTRITIONIST_ONLY,
  'PUT /api/appointments/:id': NUTRITIONIST_ONLY,

  'POST /chat/messages': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'POST /api/chat/messages': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /chat/messages': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /api/chat/messages': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /chat/messages/:messageId/audio': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /api/chat/messages/:messageId/audio': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /chat/conversations': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /api/chat/conversations': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /chat/conversations/:conversationId/messages': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),
  'GET /api/chat/conversations/:conversationId/messages': Object.freeze([ROLES.PATIENT, ROLES.NUTRITIONIST]),

  'GET /api/admin/users': ADMIN_ONLY,
  'GET /api/admin/nutritionist-requests': ADMIN_ONLY,
  'PATCH /api/admin/nutritionist-requests/:requestId': ADMIN_ONLY,
  'GET /api/admin/summary': ADMIN_ONLY,
  'GET /api/admin/foods': ADMIN_ONLY,
  'POST /api/admin/foods': ADMIN_ONLY,
  'DELETE /api/admin/foods/:foodId': ADMIN_ONLY,
  'PUT /api/admin/users/:userId': ADMIN_ONLY,
  'PATCH /api/admin/users/:userId/status': ADMIN_ONLY,
  'DELETE /api/admin/users/:userId': ADMIN_ONLY,
});

function getAllowedRoles(routeKey) {
  const roles = PROTECTED_ROUTES[routeKey];

  if (!roles) {
    throw new Error(
      `Rota sem permissão declarada na matriz (src/constants/permissions.js): ${routeKey}`,
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