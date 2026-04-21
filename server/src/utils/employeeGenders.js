'use strict';

const VALID_EMPLOYEE_GENDERS = [
    'male',
    'female',
    'other',
    'prefer_not_to_say'
];

const normalizeEmployeeGender = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    const normalized = `${value}`.trim().toLowerCase().replace(/\s+/g, '_');
    if (!normalized) {
        return null;
    }

    return VALID_EMPLOYEE_GENDERS.includes(normalized) ? normalized : null;
};

module.exports = {
    VALID_EMPLOYEE_GENDERS,
    normalizeEmployeeGender
};
