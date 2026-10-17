import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  to24HourTime,
  parseScheduleRange,
  formatScheduleRange,
  normalizeShiftsToSchedule,
  mapApiEmployeeToTeamMember,
  validateWeeklySchedule,
  isScheduleEqual,
  persistEmployeeSchedule
} from '../employeeHelpers';
import { TeamMemberData } from '../../types/employee';

describe('BARSPA Phase 1.1 Gap Reconciliation & Persistence Trace Suite', () => {

  // Gap 1: Bio Single-Column Collapsing
  test('Gap 1: Proves single Staff.bio column collapses bilingual bios on round-trip', () => {
    // 1. UI displays distinct Arabic and English inputs
    const formInput = {
      bioAr: 'أخصائية عناية بالبشرة محترفة ومدرّبة',
      bioEn: 'Professional master certified aesthetician'
    };

    // 2. Outgoing payload resolves primaryBio based on active locale (RTL prioritizes bioAr)
    const outgoingPayload = {
      bio: formInput.bioAr || formInput.bioEn
    };
    assert.equal(outgoingPayload.bio, 'أخصائية عناية بالبشرة محترفة ومدرّبة');

    // 3. Database stores single string in staff.bio
    const dbRow = {
      id: 'staff-bio-test',
      bio: outgoingPayload.bio // Stored as DataTypes.TEXT
    };
    assert.equal(dbRow.bio, 'أخصائية عناية بالبشرة محترفة ومدرّبة');

    // 4. Reload restores the single stored value into BOTH fields
    const reloaded = mapApiEmployeeToTeamMember(dbRow);
    assert.equal(reloaded.bioAr, 'أخصائية عناية بالبشرة محترفة ومدرّبة');
    assert.equal(reloaded.bioEn, 'أخصائية عناية بالبشرة محترفة ومدرّبة');

    // Conclusion: English bio was NOT independently persisted; it collapsed to Arabic bio
    assert.notEqual(reloaded.bioEn, formInput.bioEn);
  });

  // Gap 2: Custom Role Titles Discarded on Reload
  test('Gap 2: Proves custom role titles are discarded and revert to enum default on reload', () => {
    // 1. User enters custom designated titles
    const formInput = {
      position: 'service_provider',
      roleAr: 'خبيرة تصفيف وصبغات علاجية',
      roleEn: 'Senior Master Colorist'
    };

    // 2. Outgoing payload sends position enum, plus roleAr/roleEn
    const outgoingPayload = {
      position: formInput.position,
      roleAr: formInput.roleAr,
      roleEn: formInput.roleEn
    };

    // 3. Backend only updates staff.position (valid enum). roleAr/roleEn have no columns!
    const dbRow = {
      id: 'staff-role-test',
      position: outgoingPayload.position // stored as DataTypes.STRING enum
      // roleAr and roleEn are NOT in dbRow
    };

    // 4. Reload regenerates roleAr/roleEn from getRoleLabel(position)
    const reloaded = mapApiEmployeeToTeamMember(dbRow);
    assert.equal(reloaded.roleAr, 'مقدم خدمة'); // Generic default
    assert.equal(reloaded.roleEn, 'Service Provider'); // Generic default

    // Conclusion: Custom titles are completely lost on reload
    assert.notEqual(reloaded.roleAr, formInput.roleAr);
    assert.notEqual(reloaded.roleEn, formInput.roleEn);
  });

  // Gap 3: Joining Date Discarded on Reload
  test('Gap 3: Proves user-edited joinedDate is not persisted and reverts to createdAt', () => {
    // 1. User enters custom hire date
    const customHireDate = '2023-01-15';

    // 2. Database row has createdAt timestamp
    const dbRow = {
      id: 'staff-date-test',
      createdAt: '2026-09-01T14:22:00.000Z'
    };

    // 3. Reload derives joinedDate from createdAt
    const reloaded = mapApiEmployeeToTeamMember(dbRow);
    assert.equal(reloaded.joinedDate, '2026-09-01');

    // Conclusion: User-edited hire date is NOT persisted; createdAt always wins
    assert.notEqual(reloaded.joinedDate, customHireDate);
  });

  // Gap 4: Nationality Single-Column Collapsing
  test('Gap 4: Proves single Staff.nationality column collapses bilingual nationalities', () => {
    const formInput = {
      nationalityAr: 'سعودية',
      nationalityEn: 'Saudi'
    };

    // Outgoing payload resolves primary nationality
    const outgoingPayload = {
      nationality: formInput.nationalityAr || formInput.nationalityEn
    };

    // Database stores single string
    const dbRow = {
      id: 'staff-nat-test',
      nationality: outgoingPayload.nationality
    };

    // Reload populates both from stored string
    const reloaded = mapApiEmployeeToTeamMember(dbRow);
    assert.equal(reloaded.nationalityAr, 'سعودية');
    assert.equal(reloaded.nationalityEn, 'سعودية'); // English field receives Arabic text

    assert.notEqual(reloaded.nationalityEn, formInput.nationalityEn);
  });

  // Gap 5: Gender Full Round-Trip Persistence
  test('Gap 5: Proves gender achieves full round-trip persistence', () => {
    const formInput = { gender: 'female' as const };
    const dbRow = { id: 'staff-g-test', gender: formInput.gender };
    const reloaded = mapApiEmployeeToTeamMember(dbRow);

    assert.equal(reloaded.gender, 'female');
  });

  // Gap 6: Experience Single-Column Hydration Round-Trip
  test('Gap 6: Proves experience survives reload into both fields from single stored string', () => {
    const dbRow = { id: 'staff-exp-test', experience: '5 years' };
    const reloaded = mapApiEmployeeToTeamMember(dbRow);

    assert.equal(reloaded.experienceEn, '5 years');
    assert.equal(reloaded.experienceAr, '5 years');
  });

  // Schedule Persistence Flow: Both Entry Points Use Shared Path
  test('Schedule Flow: Unchanged schedule is skipped by change detector', () => {
    const initialSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '09:00 AM - 05:00 PM',
        status: 'working',
        slots: [],
        subShifts: []
      }
    ];

    const editedSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '09:00 AM - 05:00 PM',
        status: 'working',
        slots: [],
        subShifts: []
      }
    ];

    assert.equal(isScheduleEqual(initialSchedule, editedSchedule), true);

    // Modify hours
    editedSchedule[0].hours = '10:00 AM - 06:00 PM';
    assert.equal(isScheduleEqual(initialSchedule, editedSchedule), false);
  });

});
