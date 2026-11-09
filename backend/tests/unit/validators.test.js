const {
  validateCreate,
  validateReplace,
  validatePatch,
  validateAgentId,
  validateListQuery,
} = require('../../src/validators/agentValidator');
const ApiError = require('../../src/utils/ApiError');

const base = {
  fullName: 'Asha Rao',
  phoneNumber: '+919876543210',
  email: 'asha@example.com',
  serviceArea: 'Kanpur',
};

/** Runs `fn`, asserts it throws a 400 ApiError, and returns the sorted list of offending fields. */
function failingFields(fn) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    return (err.details || []).map((d) => d.field).sort();
  }
  throw new Error('expected validation to fail but it passed');
}

describe('validateCreate', () => {
  test('normalises whitespace, phone formatting and email case', () => {
    expect(
      validateCreate({
        fullName: '  Asha    Rao ',
        phoneNumber: '+91 98765-43210',
        email: ' ASHA@Example.COM ',
        serviceArea: '  Kanpur  ',
      })
    ).toEqual({ fullName: 'Asha Rao', phoneNumber: '+919876543210', email: 'asha@example.com', serviceArea: 'Kanpur' });
  });

  test('ignores unknown and read-only fields', () => {
    const out = validateCreate({ ...base, agentId: 'DA-FFFFFFFF', createdAt: 'x', isAdmin: true });
    expect(Object.keys(out).sort()).toEqual(['email', 'fullName', 'phoneNumber', 'serviceArea']);
  });

  test('reports every missing required field', () => {
    expect(failingFields(() => validateCreate({}))).toEqual(['email', 'fullName', 'phoneNumber', 'serviceArea']);
  });

  test.each([undefined, null, 'text', 42, []])('rejects a non-object body (%p)', (body) => {
    expect(failingFields(() => validateCreate(body))).toEqual(['body']);
  });

  test.each([
    ['fullName', 1234],
    ['fullName', 'A'],
    ['fullName', 'x'.repeat(101)],
    ['serviceArea', ''],
    ['email', 'plainaddress'],
    ['email', 'two@@example.com'],
    ['email', 'no-tld@example'],
    ['status', 'ACTIVE'],
    ['vehicleType', 'jetpack'],
  ])('rejects %s = %p', (field, value) => {
    expect(failingFields(() => validateCreate({ ...base, [field]: value }))).toEqual([field]);
  });

  test.each([
    ['9876543210', '9876543210'],
    ['+919876543210', '+919876543210'],
    ['+1 (415) 555-2671', '+14155552671'],
    ['98765 43210', '9876543210'],
  ])('accepts phone %p', (input, normalised) => {
    expect(validateCreate({ ...base, phoneNumber: input }).phoneNumber).toBe(normalised);
  });

  test.each(['12345', 'abcdefghij', '0987654321', '+0123456789', '+1234567890123456', '98765x3210'])(
    'rejects phone %p',
    (phone) => {
      expect(failingFields(() => validateCreate({ ...base, phoneNumber: phone }))).toEqual(['phoneNumber']);
    }
  );
});

describe('validateReplace (PUT)', () => {
  test('requires the core fields and status', () => {
    expect(failingFields(() => validateReplace({}))).toEqual(['email', 'fullName', 'phoneNumber', 'serviceArea', 'status']);
  });

  test('defaults vehicleType to "none" when omitted', () => {
    expect(validateReplace({ ...base, status: 'inactive' })).toMatchObject({ status: 'inactive', vehicleType: 'none' });
  });

  test('keeps an explicit vehicleType', () => {
    expect(validateReplace({ ...base, status: 'active', vehicleType: 'van' }).vehicleType).toBe('van');
  });
});

describe('validatePatch (PATCH)', () => {
  test('accepts any subset of mutable fields', () => {
    expect(validatePatch({ status: 'on_leave' })).toEqual({ status: 'on_leave' });
    expect(validatePatch({ email: 'NEW@example.com', vehicleType: 'car' })).toEqual({ email: 'new@example.com', vehicleType: 'car' });
  });

  test('rejects an empty body and a body with only unknown fields', () => {
    expect(failingFields(() => validatePatch({}))).toEqual(['body']);
    expect(failingFields(() => validatePatch({ agentId: 'DA-FFFFFFFF' }))).toEqual(['body']);
  });

  test('still validates supplied values', () => {
    expect(failingFields(() => validatePatch({ status: 'nope' }))).toEqual(['status']);
  });
});

describe('validateAgentId', () => {
  test('upper-cases valid ids', () => {
    expect(validateAgentId('da-1a2b3c4d')).toBe('DA-1A2B3C4D');
  });

  test.each(['', 'DA-123', 'DA-1A2B3C4DD', 'XX-1A2B3C4D', 'DA-GGGGGGGG', undefined])('rejects %p with a 400', (id) => {
    try {
      validateAgentId(id);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
    }
  });
});

describe('validateListQuery', () => {
  test('applies defaults', () => {
    expect(validateListQuery({})).toEqual({
      page: 1,
      limit: 10,
      sort: '-createdAt',
      status: undefined,
      serviceArea: undefined,
      search: undefined,
    });
  });

  test('parses and trims supplied values', () => {
    expect(
      validateListQuery({ page: '3', limit: '25', status: 'active', serviceArea: ' Kanpur ', search: ' asha ', sort: 'fullName' })
    ).toEqual({ page: 3, limit: 25, sort: 'fullName', status: 'active', serviceArea: 'Kanpur', search: 'asha' });
  });

  test.each([
    [{ page: '0' }, 'page'],
    [{ page: '-1' }, 'page'],
    [{ page: '1.5' }, 'page'],
    [{ page: 'abc' }, 'page'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ status: 'banned' }, 'status'],
    [{ sort: 'password' }, 'sort'],
    [{ sort: '-__proto__' }, 'sort'],
    [{ search: 'x'.repeat(101) }, 'search'],
  ])('rejects %j', (query, field) => {
    expect(failingFields(() => validateListQuery(query))).toEqual([field]);
  });

  test('rejects repeated or nested query parameters (NoSQL-operator injection)', () => {
    expect(failingFields(() => validateListQuery({ status: ['active', 'inactive'] }))).toEqual(['status']);
    expect(failingFields(() => validateListQuery({ status: { $ne: 'active' } }))).toEqual(['status']);
    expect(failingFields(() => validateListQuery({ serviceArea: { $regex: '.*' } }))).toEqual(['serviceArea']);
    expect(failingFields(() => validateListQuery({ search: { $gt: '' } }))).toEqual(['search']);
  });

  test('reports several problems at once', () => {
    expect(failingFields(() => validateListQuery({ page: 'x', limit: '0', status: 'nope' }))).toEqual(['limit', 'page', 'status']);
  });
});
