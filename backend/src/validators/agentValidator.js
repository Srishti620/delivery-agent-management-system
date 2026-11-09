const ApiError = require('../utils/ApiError');
const {
  STATUSES,
  VEHICLE_TYPES,
  SORT_FIELDS,
  AGENT_ID_PATTERN,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../constants');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Indian mobile number: 10 digits starting with 6-9, optionally written with +91, 91 or 0 in front.
const INDIAN_MOBILE_RE = /^(?:\+?91|0)?([6-9]\d{9})$/;
const PHONE_ERROR = 'Enter a valid 10 digit number';

const fail = (details) => {
  throw new ApiError(400, 'Validation failed', details);
};
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* ---------- body fields: each rule returns { value } or { error } ---------- */

const text = (name, min, max) => (raw) => {
  if (typeof raw !== 'string') return { error: `${name} must be a string` };
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < min || value.length > max) {
    return { error: `${name} must be between ${min} and ${max} characters` };
  }
  return { value };
};

const oneOf = (name, allowed) => (raw) => {
  if (typeof raw !== 'string' || !allowed.includes(raw)) {
    return { error: `${name} must be one of: ${allowed.join(', ')}` };
  }
  return { value: raw };
};

const fieldRules = {
  fullName: text('fullName', 2, 100),
  phoneNumber: (raw) => {
    if (typeof raw !== 'string') return { error: PHONE_ERROR };
    const cleaned = raw.replace(/[\s\-().]/g, '');
    const match = cleaned.match(INDIAN_MOBILE_RE);
    if (!match) return { error: PHONE_ERROR };
    // Always stored as +91XXXXXXXXXX so the same number can never be saved twice in different formats.
    return { value: `+91${match[1]}` };
  },
  email: (raw) => {
    if (typeof raw !== 'string') return { error: 'email must be a string' };
    const value = raw.trim().toLowerCase();
    if (value.length > 254 || !EMAIL_RE.test(value)) return { error: 'email must be a valid email address' };
    return { value };
  },
  serviceArea: text('serviceArea', 2, 100),
  status: oneOf('status', STATUSES),
  vehicleType: oneOf('vehicleType', VEHICLE_TYPES),
};

const MUTABLE_FIELDS = Object.keys(fieldRules);
const CORE_FIELDS = ['fullName', 'phoneNumber', 'email', 'serviceArea'];

/** Validates + normalises a request body. Unknown / read-only fields (agentId, timestamps) are ignored. */
function parseBody(body, { required = [], requireAtLeastOne = false } = {}) {
  if (!isPlainObject(body)) fail([{ field: 'body', message: 'Request body must be a JSON object' }]);

  const errors = [];
  const out = {};
  for (const field of MUTABLE_FIELDS) {
    const raw = body[field];
    if (raw === undefined) {
      if (required.includes(field)) {
        errors.push({ field, message: field === 'phoneNumber' ? PHONE_ERROR : `${field} is required` });
      }
      continue;
    }
    const result = fieldRules[field](raw);
    if (result.error) errors.push({ field, message: result.error });
    else out[field] = result.value;
  }
  if (!errors.length && requireAtLeastOne && Object.keys(out).length === 0) {
    errors.push({ field: 'body', message: `Provide at least one of: ${MUTABLE_FIELDS.join(', ')}` });
  }
  if (errors.length) fail(errors);
  return out;
}

/** POST: core fields required; status / vehicleType fall back to schema defaults. */
const validateCreate = (body) => parseBody(body, { required: CORE_FIELDS });

/** PUT: full replacement of all mutable fields (vehicleType resets to 'none' if omitted). */
function validateReplace(body) {
  const out = parseBody(body, { required: [...CORE_FIELDS, 'status'] });
  if (out.vehicleType === undefined) out.vehicleType = 'none';
  return out;
}

/** PATCH: any subset of mutable fields, at least one. */
const validatePatch = (body) => parseBody(body, { requireAtLeastOne: true });

/* ---------- path + query ---------- */

function validateAgentId(raw) {
  const id = String(raw || '').toUpperCase();
  if (!AGENT_ID_PATTERN.test(id)) {
    throw new ApiError(400, 'Invalid agent id format. Expected something like DA-1A2B3C4D');
  }
  return id;
}

function intParam(name, raw, fallback, min, max, errors) {
  if (raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    errors.push({ field: name, message: `${name} must be a positive integer` });
    return fallback;
  }
  const n = Number(raw);
  if (n < min || n > max) {
    errors.push({ field: name, message: `${name} must be between ${min} and ${max}` });
    return fallback;
  }
  return n;
}

function stringParam(name, raw, errors) {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string') {
    errors.push({ field: name, message: `${name} must be a single text value` });
    return undefined;
  }
  const value = raw.trim();
  if (value.length > 100) {
    errors.push({ field: name, message: `${name} must be at most 100 characters` });
    return undefined;
  }
  return value || undefined;
}

/** Returns a normalised query: { page, limit, sort, status?, serviceArea?, search? }. */
function validateListQuery(query) {
  const errors = [];
  const page = intParam('page', query.page, DEFAULT_PAGE, 1, 1_000_000, errors);
  const limit = intParam('limit', query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT, errors);

  const status = stringParam('status', query.status, errors);
  if (status && !STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `status must be one of: ${STATUSES.join(', ')}` });
  }

  const serviceArea = stringParam('serviceArea', query.serviceArea, errors);
  const search = stringParam('search', query.search, errors);

  let sort = '-createdAt';
  if (query.sort !== undefined && query.sort !== '') {
    const field = typeof query.sort === 'string' ? query.sort.replace(/^-/, '') : null;
    if (!field || !SORT_FIELDS.includes(field)) {
      errors.push({ field: 'sort', message: `sort must be one of: ${SORT_FIELDS.join(', ')} (prefix with - for descending)` });
    } else {
      sort = query.sort;
    }
  }

  if (errors.length) fail(errors);
  return { page, limit, sort, status, serviceArea, search };
}

module.exports = {
  validateCreate,
  validateReplace,
  validatePatch,
  validateAgentId,
  validateListQuery,
};