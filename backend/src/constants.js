module.exports = {
  STATUSES: ['active', 'inactive', 'on_leave'],
  VEHICLE_TYPES: ['bicycle', 'motorbike', 'scooter', 'car', 'van', 'none'],
  SORT_FIELDS: ['createdAt', 'updatedAt', 'fullName', 'serviceArea', 'status'],
  AGENT_ID_PATTERN: /^DA-[0-9A-F]{8}$/,
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};
