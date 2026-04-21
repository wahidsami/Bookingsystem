'use strict';

const VALID_EMPLOYEE_POSITIONS = [
  'accountant',
  'receptionist',
  'service_provider',
  'marketing',
  'manager',
  'other'
];

const normalizeEmployeePosition = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = `${value}`.trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized) {
    return null;
  }

  return VALID_EMPLOYEE_POSITIONS.includes(normalized) ? normalized : null;
};

module.exports = {
  VALID_EMPLOYEE_POSITIONS,
  normalizeEmployeePosition
};
