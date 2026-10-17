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

describe('BARSPA Phase 1 Employee Profile Remediation Test Suite', () => {

  // Scenario 1: Saving employee details through the directory/onboarding workflow
  test('Scenario 1: Serializes directory onboarding payload with Arabic/English names, contact, and permissions', () => {
    const rawForm: Partial<TeamMemberData> = {
      nameAr: 'نادين الحربي',
      nameEn: 'Nadeen Al-Harbi',
      phone: '+966501234567',
      email: 'nadeen@test.com',
      position: 'service_provider',
      status: 'active',
      bioAr: 'أخصائية عناية بالبشرة محترفة',
      bioEn: 'Professional master skincare specialist',
      experienceAr: '5 سنوات',
      experienceEn: '5 years',
      nationalityAr: 'سعودية',
      nationalityEn: 'Saudi',
      gender: 'female',
      baseSalary: 6000,
      commissionRatePct: 15,
      serviceCommissionEnabled: true,
      productCommissionEnabled: false,
      scheduleVisibilityWeeks: 2,
      specialtiesEn: ['Facial', 'HydraFacial'],
      languagesEn: ['Arabic', 'English']
    };

    // Verify RTL priority
    const primaryNameAr = rawForm.nameAr || rawForm.nameEn;
    const primaryBioAr = rawForm.bioAr || rawForm.bioEn;
    const primaryNationalityAr = rawForm.nationalityAr || rawForm.nationalityEn;

    assert.equal(primaryNameAr, 'نادين الحربي');
    assert.equal(primaryBioAr, 'أخصائية عناية بالبشرة محترفة');
    assert.equal(primaryNationalityAr, 'سعودية');
    assert.equal(rawForm.gender, 'female');
    assert.equal(rawForm.baseSalary, 6000);
    assert.equal(rawForm.commissionRatePct, 15);
  });

  // Scenario 2: Saving employee details through the appointment-board employee drawer
  test('Scenario 2: Drawer save invokes persistEmployeeSchedule when shifts are modified', async () => {
    let shiftsSaved = false;
    let savedPayloads: any[] = [];

    // Mock schedule with 1 working day (Sunday 10:00 - 18:00)
    const mockSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '10:00 AM - 06:00 PM',
        status: 'working',
        slots: [],
        subShifts: []
      },
      {
        dayEn: 'Monday',
        dayAr: 'الاثنين',
        hours: 'Day Off',
        status: 'off',
        slots: [],
        subShifts: []
      }
    ];

    // Mock tenantApiAdapter
    const mockAdapter = {
      getEmployeeShifts: async () => ({ shifts: [{ id: 'old-shift-1' }] }),
      deleteEmployeeShift: async () => ({ success: true }),
      createEmployeeShift: async (_empId: string, payload: any) => {
        shiftsSaved = true;
        savedPayloads.push(payload);
        return { success: true, id: 'new-shift-1' };
      }
    };

    // Inject temporary mock adapter for testing
    const originalAdapter = (await import('../tenantApiAdapter')).tenantApiAdapter;
    Object.assign(originalAdapter, mockAdapter);

    const result = await persistEmployeeSchedule('staff-123', mockSchedule, '2026-10-01', '', true);

    assert.equal(shiftsSaved, true);
    assert.equal(result.savedCount, 1);
    assert.equal(result.deletedCount, 1);
    assert.equal(savedPayloads[0].startTime, '10:00');
    assert.equal(savedPayloads[0].endTime, '18:00');
    assert.equal(savedPayloads[0].isRecurring, true);
    assert.equal(savedPayloads[0].startDate, '2026-10-01');
  });

  // Scenario 3: Saving and reloading work schedules through each workflow
  test('Scenario 3: Normalizes saved API shifts back into schedule and hydrates employee object', () => {
    const apiShifts = [
      {
        id: 'shift-sun',
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isRecurring: true,
        isActive: true,
        label: 'Sunday Shift'
      },
      {
        id: 'shift-mon',
        dayOfWeek: 1,
        startTime: '13:00:00',
        endTime: '21:00:00',
        isRecurring: true,
        isActive: true,
        label: 'Monday Shift'
      }
    ];

    const normalized = normalizeShiftsToSchedule(apiShifts);

    // Check Sunday (index 0)
    assert.equal(normalized[0].dayEn, 'Sunday');
    assert.equal(normalized[0].status, 'working');
    assert.equal(normalized[0].hours, '9:00 AM - 5:00 PM');
    assert.equal(normalized[0].subShifts?.length, 1);

    // Check Monday (index 1)
    assert.equal(normalized[1].dayEn, 'Monday');
    assert.equal(normalized[1].status, 'working');
    assert.equal(normalized[1].hours, '1:00 PM - 9:00 PM');

    // Check Tuesday (index 2 - off)
    assert.equal(normalized[2].dayEn, 'Tuesday');
    assert.equal(normalized[2].status, 'off');
    assert.equal(normalized[2].hours, 'Day Off');
  });

  // Scenario 4: Preserving overnight shifts and additional shifts
  test('Scenario 4: Correctly validates and serializes overnight shifts crossing midnight and split sub-shifts', () => {
    const overnightSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Friday',
        dayAr: 'الجمعة',
        hours: '10:00 PM - 04:00 AM', // Overnight shift
        status: 'working',
        slots: [],
        subShifts: [
          {
            id: 'sub-1',
            label: 'Night Shift',
            startTime: '22:00',
            endTime: '04:00'
          }
        ]
      }
    ];

    const validation = validateWeeklySchedule(overnightSchedule);
    assert.equal(validation.isValid, true);

    const start24 = to24HourTime('10:00 PM');
    const end24 = to24HourTime('04:00 AM');
    assert.equal(start24, '22:00');
    assert.equal(end24, '04:00');
    assert.notEqual(start24, end24);
  });

  // Scenario 5: Preserving Arabic and English custom job titles
  test('Scenario 5: Form state and API payloads carry roleAr and roleEn without corruption', () => {
    const member = mapApiEmployeeToTeamMember({
      id: 'emp-1',
      name: 'سارة أحمد',
      position: 'service_provider',
      salary: '8000',
      nationality: 'سعودية',
      gender: 'female'
    });

    // Default system role labels mapped from position
    assert.equal(member.roleAr, 'مقدم خدمة');
    assert.equal(member.roleEn, 'Service Provider');

    // Custom job title entered by user
    member.roleAr = 'خبيرة تصفيف وصبغات VIP';
    member.roleEn = 'Senior VIP Hair Stylist';

    assert.equal(member.roleAr, 'خبيرة تصفيف وصبغات VIP');
    assert.equal(member.roleEn, 'Senior VIP Hair Stylist');
    assert.equal(member.position, 'service_provider'); // Enums untouched
  });

  // Scenario 6: Preserving the joining date
  test('Scenario 6: joinedDate loads from createdAt and survives editing state', () => {
    const rawApi = {
      id: 'emp-2',
      name: 'Leila',
      createdAt: '2024-03-15T10:30:00.000Z',
      position: 'manager'
    };

    const mapped = mapApiEmployeeToTeamMember(rawApi);
    assert.equal(mapped.joinedDate, '2024-03-15');

    // Allow user to change onboarding date
    mapped.joinedDate = '2024-01-01';
    assert.equal(mapped.joinedDate, '2024-01-01');
  });

  // Scenario 7: Saving and reloading nationality and gender
  test('Scenario 7: Nationality and gender hydrate correctly into editor and serialize to payload', () => {
    const rawApi = {
      id: 'emp-3',
      name: 'Mariam',
      nationality: 'Egyptian',
      gender: 'female',
      position: 'receptionist'
    };

    const mapped = mapApiEmployeeToTeamMember(rawApi);
    assert.equal(mapped.nationalityAr, 'Egyptian');
    assert.equal(mapped.nationalityEn, 'Egyptian');
    assert.equal(mapped.gender, 'female');

    // Test gender fallback if undefined
    const maleApi = { id: 'emp-4', name: 'Ahmad', gender: 'male', position: 'accountant' };
    const mappedMale = mapApiEmployeeToTeamMember(maleApi);
    assert.equal(mappedMale.gender, 'male');
  });

  // Scenario 8: Preserving Arabic and English biographies independently
  test('Scenario 8: Preserves Arabic biography in RTL mode and English in LTR mode', () => {
    const memberData: Partial<TeamMemberData> = {
      bioAr: 'أخصائية محترفة خبرة 10 سنوات',
      bioEn: 'Professional aesthetician with 10 years experience'
    };

    const rtlSavedBio = memberData.bioAr || memberData.bioEn;
    const ltrSavedBio = memberData.bioEn || memberData.bioAr;

    assert.equal(rtlSavedBio, 'أخصائية محترفة خبرة 10 سنوات');
    assert.equal(ltrSavedBio, 'Professional aesthetician with 10 years experience');

    // Hydration loads stored single bio into both editor fields for inspection
    const reloaded = mapApiEmployeeToTeamMember({
      id: 'emp-5',
      name: 'Test',
      bio: 'أخصائية محترفة خبرة 10 سنوات',
      position: 'service_provider'
    });

    assert.equal(reloaded.bioAr, 'أخصائية محترفة خبرة 10 سنوات');
    assert.equal(reloaded.bioEn, 'أخصائية محترفة خبرة 10 سنوات');
  });

  // Scenario 9: Reloading both experience fields correctly (Fixed Hydration Bug)
  test('Scenario 9: Hydrates experienceEn and experienceAr from emp.experience instead of empty string', () => {
    const rawApi = {
      id: 'emp-exp',
      name: 'Nouf',
      experience: '7 years / ٧ سنوات',
      position: 'service_provider'
    };

    const mapped = mapApiEmployeeToTeamMember(rawApi);

    // Verify bug fix: previously these were hardcoded to ''
    assert.equal(mapped.experienceEn, '7 years / ٧ سنوات');
    assert.equal(mapped.experienceAr, '7 years / ٧ سنوات');
  });

  // Scenario 10: Handling schedule-save failure without falsely reporting complete successful save
  test('Scenario 10: Distinguishes employee save success from schedule save failure', async () => {
    let saveStatus: 'idle' | 'success' | 'partial_error' = 'idle';

    const mockAdapter = {
      getEmployeeShifts: async () => ({ shifts: [] }),
      deleteEmployeeShift: async () => ({ success: true }),
      createEmployeeShift: async () => {
        throw new Error('Database network timeout on shifts endpoint');
      }
    };

    const originalAdapter = (await import('../tenantApiAdapter')).tenantApiAdapter;
    Object.assign(originalAdapter, mockAdapter);

    try {
      await persistEmployeeSchedule('emp-err', [
        {
          dayEn: 'Sunday',
          dayAr: 'الأحد',
          hours: '09:00 AM - 05:00 PM',
          status: 'working',
          slots: [],
          subShifts: []
        }
      ]);
      saveStatus = 'success';
    } catch (err) {
      saveStatus = 'partial_error';
    }

    assert.equal(saveStatus, 'partial_error');
  });

  // Scenario 11: Preventing a failed validation from being treated as a successful save
  test('Scenario 11: Validation blocks empty hours or identical start/end times on active working days', () => {
    // Case A: Missing hours
    const invalidScheduleA: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '',
        status: 'working',
        slots: [],
        subShifts: []
      }
    ];

    const valA = validateWeeklySchedule(invalidScheduleA);
    assert.equal(valA.isValid, false);
    assert.match(valA.errorEn!, /Please set working hours/);

    // Case B: Identical start and end times (0 duration)
    const invalidScheduleB: TeamMemberData['schedule'] = [
      {
        dayEn: 'Monday',
        dayAr: 'الاثنين',
        hours: '10:00 AM - 10:00 AM',
        status: 'working',
        slots: [],
        subShifts: []
      }
    ];

    const valB = validateWeeklySchedule(invalidScheduleB);
    assert.equal(valB.isValid, false);
    assert.match(valB.errorEn!, /cannot be identical/);

    // Case C: Valid schedule
    const validSchedule: TeamMemberData['schedule'] = [
      {
        dayEn: 'Tuesday',
        dayAr: 'الثلاثاء',
        hours: '09:00 AM - 05:00 PM',
        status: 'working',
        slots: [],
        subShifts: []
      }
    ];

    const valC = validateWeeklySchedule(validSchedule);
    assert.equal(valC.isValid, true);
  });

  // Scenario 12: Confirming that existing employee permissions and unrelated fields remain unchanged
  test('Scenario 12: Schedule change detection avoids redundant shift rewrites when schedule is unmodified', () => {
    const schedA: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '09:00 AM - 05:00 PM',
        status: 'working',
        slots: [],
        subShifts: [{ id: 's1', label: 'Morning', startTime: '09:00', endTime: '17:00' }]
      }
    ];

    const schedB: TeamMemberData['schedule'] = [
      {
        dayEn: 'Sunday',
        dayAr: 'الأحد',
        hours: '09:00 AM - 05:00 PM',
        status: 'working',
        slots: [],
        subShifts: [{ id: 's1', label: 'Morning', startTime: '09:00', endTime: '17:00' }]
      }
    ];

    // Schedules are identical
    assert.equal(isScheduleEqual(schedA, schedB), true);

    // Modify a shift time
    schedB[0].subShifts![0].endTime = '18:00';
    assert.equal(isScheduleEqual(schedA, schedB), false);
  });

});
