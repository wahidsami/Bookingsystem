'use strict';

const VALID_EMPLOYEE_POSITIONS = [
  'accountant',
  'receptionist',
  'service_provider',
  'marketing',
  'manager',
  'other'
];

const DASHBOARD_ACCOUNT_ROLE_BY_POSITION = {
  accountant: 'accountant',
  receptionist: 'receptionist',
  marketing: 'marketing',
  manager: 'manager',
  other: 'custom'
};

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

const isServiceProviderPosition = (value) => normalizeEmployeePosition(value) === 'service_provider';

const isDashboardAccessPosition = (value) => {
  const normalized = normalizeEmployeePosition(value);
  return Boolean(normalized && normalized !== 'service_provider');
};

const getDashboardRoleKeyForEmployeePosition = (value) => {
  const normalized = normalizeEmployeePosition(value);
  if (!normalized || normalized === 'service_provider') {
    return null;
  }

  return DASHBOARD_ACCOUNT_ROLE_BY_POSITION[normalized] || 'custom';
};

module.exports = {
  VALID_EMPLOYEE_POSITIONS,
  normalizeEmployeePosition,
  isServiceProviderPosition,
  isDashboardAccessPosition,
  getDashboardRoleKeyForEmployeePosition
};
