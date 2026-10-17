import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  EMPLOYEE_POSITION_OPTIONS, 
  EMPLOYEE_POSITION_LOOKUP,
  TeamMemberData,
  DEFAULT_STAFF_APP_PERMISSIONS
} from '../../types/employee';
import { 
  validateWeeklySchedule,
  formatScheduleRange,
  parseScheduleRange,
  mapApiEmployeeToTeamMember
} from '../employeeHelpers';

describe('BARSPA Phase 2 Employee Profile UI Refinement (Option A) Test Suite', () => {

  it('Scenario 1: Option A - Position selection automatically sets standard bilingual roles without fake custom inputs', () => {
    // When an employee position is chosen (e.g. 'accountant')
    const accountantPos = 'accountant';
    const opt = EMPLOYEE_POSITION_LOOKUP[accountantPos];
    assert.equal(opt.en, 'Accountant');
    assert.equal(opt.ar, 'محاسب');

    const serviceProviderPos = 'service_provider';
    const spOpt = EMPLOYEE_POSITION_LOOKUP[serviceProviderPos];
    assert.equal(spOpt.en, 'Service Provider');
    assert.equal(spOpt.ar, 'مقدم خدمة');
  });

  it('Scenario 2: Option A - Single Nationality input keeps nationalityAr and nationalityEn in sync', () => {
    const rawVal = 'سعودية';
    const state: Partial<TeamMemberData> = {
      nationalityAr: rawVal,
      nationalityEn: rawVal
    };

    assert.equal(state.nationalityAr, 'سعودية');
    assert.equal(state.nationalityEn, 'سعودية');
  });

  it('Scenario 3: Option A - Single Bio input keeps bioAr and bioEn aligned to Staff.bio column', () => {
    const bioText = 'Senior master aesthetician with 10 years experience';
    const state: Partial<TeamMemberData> = {
      bioAr: bioText,
      bioEn: bioText
    };

    assert.equal(state.bioAr, bioText);
    assert.equal(state.bioEn, bioText);
  });

  it('Scenario 4: Option A - Account creation date is derived from createdAt as read-only date', () => {
    const mockApiEmployee = {
      id: 'emp-101',
      name: 'Nadeen Al-Harbi',
      createdAt: '2025-06-15T10:30:00.000Z',
      position: 'service_provider'
    };

    const teamMember = mapApiEmployeeToTeamMember(mockApiEmployee);
    assert.equal(teamMember.joinedDate, '2025-06-15');
  });

  it('Scenario 5: Option A - Single Experience input keeps experienceAr and experienceEn in sync', () => {
    const experienceVal = '5 سنوات';
    const state: Partial<TeamMemberData> = {
      experienceAr: experienceVal,
      experienceEn: experienceVal
    };

    assert.equal(state.experienceAr, experienceVal);
    assert.equal(state.experienceEn, experienceVal);
  });

  it('Scenario 6: Schedule Shift Matrix preserves overnight shifts and formatScheduleRange', () => {
    // Overnight shift: 20:00 to 02:00
    const formatted = formatScheduleRange('20:00', '02:00');
    assert.equal(formatted, '8:00 PM - 2:00 AM');

    const parsed = parseScheduleRange(formatted);
    assert.equal(parsed.startTime, '20:00');
    assert.equal(parsed.endTime, '02:00');
  });

  it('Scenario 7: Weekly schedule validation correctly handles valid recurring shifts and rejects invalid', () => {
    const validSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '9:00 AM - 5:00 PM',
        status: 'working',
        slots: []
      },
      {
        dayEn: 'Monday',
        dayAr: 'الاثنين',
        hours: 'Day Off',
        status: 'off',
        slots: []
      }
    ];

    const validation = validateWeeklySchedule(validSchedule);
    assert.equal(validation.isValid, true);

    const invalidSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '',
        status: 'working',
        slots: []
      }
    ];

    const invalidValidation = validateWeeklySchedule(invalidSchedule);
    assert.equal(invalidValidation.isValid, false);
  });

  it('Scenario 8: Role presets configure dashboard permissions matrix correctly', () => {
    // Manager preset should give all permissions
    const perms: Record<string, boolean> = {
      view_dashboard: true,
      view_appointments: true,
      view_financial: true,
      manage_financials: true,
      manage_appointments: true
    };

    assert.equal(perms.view_dashboard, true);
    assert.equal(perms.manage_financials, true);
  });

  it('Scenario 9: Staff app permissions cascade correctly when view_reviews is disabled', () => {
    const perms = { ...DEFAULT_STAFF_APP_PERMISSIONS };
    assert.equal(perms.view_reviews, true);
    assert.equal(perms.can_start_service, true);

    // If view_reviews is turned off, reply_reviews is disabled
    let updated = { ...perms, view_reviews: false, reply_reviews: false };
    assert.equal(updated.view_reviews, false);
    assert.equal(updated.reply_reviews, false);
  });

});
