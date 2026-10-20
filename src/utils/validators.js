const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  const value = String(email || '');
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}


function normalizePhone(input) {
  if (input === null || input === undefined) {
    return { valid: true, value: null };
  }

  if (typeof input !== 'string' && typeof input !== 'number') {
    return { valid: false, value: null };
  }

  const raw = String(input).trim();

  if (raw === '') {
    return { valid: true, value: null };
  }

  if (!/^[\d\s()+.-]+$/.test(raw)) {
    return { valid: false, value: null };
  }

  const digits = raw.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 13) {
    return { valid: false, value: null };
  }

  return { valid: true, value: digits };
}

module.exports = {
  isValidEmail,
  normalizePhone,
};
