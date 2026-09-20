import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCompatibleStaffAssignments, areServicesOverlapping, type StagedServiceWithAssignment } from './staffAssignmentEngine';

test('areServicesOverlapping accurately detects overlap', () => {
  // A: 0 to 30, B: 30 to 60 -> contiguous, no overlap
  assert.equal(areServicesOverlapping(0, 30, 30, 30), false);

  // A: 0 to 30, B: 15 to 45 -> overlaps
  assert.equal(areServicesOverlapping(0, 30, 15, 30), true);

  // A: 0 to 60, B: 0 to 60 -> parallel exact same time -> overlaps
  assert.equal(areServicesOverlapping(0, 60, 0, 60), true);
});

test('Case 1: Normal service defaults to Any Professional and resolves to eligible professional', () => {
  const stagedServices: StagedServiceWithAssignment[] = [
    {
      id: 'stg-1',
      serviceId: 'srv-haircut',
      staffId: '',
      isExplicitStaff: false,
      startTime: 60,
      duration: 30
    }
  ];

  const stylists = [
    { id: '101', nameEn: 'Sally', nameAr: 'سالي' },
    { id: '102', nameEn: 'Fatima', nameAr: 'فاطمة' }
  ];

  const services = [
    { id: 'srv-haircut', nameEn: 'Haircut', nameAr: 'قص شعر', employeeAssignments: ['101', '102'] }
  ];

  const result = resolveCompatibleStaffAssignments(stagedServices, stylists, services);
  assert.equal(result.success, true);
  assert.equal(result.resolvedStaffMap.has('stg-1'), true);
  assert.ok(['101', '102'].includes(result.resolvedStaffMap.get('stg-1')!));
});

test('Case 2: Explicit professional override (Sally) is strictly preserved as a hard constraint', () => {
  const stagedServices: StagedServiceWithAssignment[] = [
    {
      id: 'stg-1',
      serviceId: 'srv-haircut',
      staffId: '101',
      isExplicitStaff: true,
      startTime: 60,
      duration: 30
    }
  ];

  const stylists = [
    { id: '101', nameEn: 'Sally', nameAr: 'سالي' },
    { id: '102', nameEn: 'Fatima', nameAr: 'فاطمة' }
  ];

  const services = [
    { id: 'srv-haircut', nameEn: 'Haircut', nameAr: 'قص شعر', employeeAssignments: ['101', '102'] }
  ];

  const result = resolveCompatibleStaffAssignments(stagedServices, stylists, services);
  assert.equal(result.success, true);
  assert.equal(result.resolvedStaffMap.get('stg-1'), '101'); // Must be Sally
});

test('Case 3: Parallel bundle with 3 services all defaulting to Any Professional resolves distinct staff', () => {
  const stagedServices: StagedServiceWithAssignment[] = [
    {
      id: 'stg-1',
      serviceId: 'srv-1',
      staffId: '',
      isExplicitStaff: false,
      startTime: 120,
      duration: 45
    },
    {
      id: 'stg-2',
      serviceId: 'srv-2',
      staffId: '',
      isExplicitStaff: false,
      startTime: 120,
      duration: 45
    },
    {
      id: 'stg-3',
      serviceId: 'srv-3',
      staffId: '',
      isExplicitStaff: false,
      startTime: 120,
      duration: 45
    }
  ];

  const stylists = [
    { id: '101', nameEn: 'Sally' },
    { id: '102', nameEn: 'Fatima' },
    { id: '103', nameEn: 'Layla' }
  ];

  const services = [
    { id: 'srv-1', employeeAssignments: ['101', '102', '103'] },
    { id: 'srv-2', employeeAssignments: ['101', '102', '103'] },
    { id: 'srv-3', employeeAssignments: ['101', '102', '103'] }
  ];

  const result = resolveCompatibleStaffAssignments(stagedServices, stylists, services);
  assert.equal(result.success, true);

  const staff1 = result.resolvedStaffMap.get('stg-1');
  const staff2 = result.resolvedStaffMap.get('stg-2');
  const staff3 = result.resolvedStaffMap.get('stg-3');

  // Distinct staff across all 3 parallel services
  assert.notEqual(staff1, staff2);
  assert.notEqual(staff2, staff3);
  assert.notEqual(staff1, staff3);
});

test('Case 4: MRV heuristic prevents greedy starvation (Service A only has Sally; Service B has Sally and Fatima)', () => {
  const stagedServices: StagedServiceWithAssignment[] = [
    {
      id: 'stg-b',
      serviceId: 'srv-b',
      staffId: '',
      isExplicitStaff: false,
      startTime: 120,
      duration: 30
    },
    {
      id: 'stg-a',
      serviceId: 'srv-a',
      staffId: '',
      isExplicitStaff: false,
      startTime: 120,
      duration: 30
    }
  ];

  const stylists = [
    { id: '101', nameEn: 'Sally' },
    { id: '102', nameEn: 'Fatima' }
  ];

  // Service A can ONLY be done by Sally (101). Service B can be done by Sally (101) or Fatima (102).
  const services = [
    { id: 'srv-a', nameEn: 'Complex Coloring', employeeAssignments: ['101'] },
    { id: 'srv-b', nameEn: 'Blowdry', employeeAssignments: ['101', '102'] }
  ];

  const result = resolveCompatibleStaffAssignments(stagedServices, stylists, services);
  assert.equal(result.success, true);
  // Service A MUST get Sally
  assert.equal(result.resolvedStaffMap.get('stg-a'), '101');
  // Service B MUST get Fatima
  assert.equal(result.resolvedStaffMap.get('stg-b'), '102');
});

test('Case 5: Explicit staff selection conflicts when second service in parallel bundle has no other options', () => {
  const stagedServices: StagedServiceWithAssignment[] = [
    {
      id: 'stg-1',
      serviceId: 'srv-blowdry',
      staffId: '101', // Sally explicitly selected for Blowdry
      isExplicitStaff: true,
      startTime: 120,
      duration: 30
    },
    {
      id: 'stg-2',
      serviceId: 'srv-coloring', // Only Sally can do this
      staffId: '',
      isExplicitStaff: false,
      startTime: 120,
      duration: 30
    }
  ];

  const stylists = [
    { id: '101', nameEn: 'Sally' },
    { id: '102', nameEn: 'Fatima' }
  ];

  const services = [
    { id: 'srv-blowdry', employeeAssignments: ['101', '102'] },
    { id: 'srv-coloring', nameEn: 'Coloring', employeeAssignments: ['101'] }
  ];

  const result = resolveCompatibleStaffAssignments(stagedServices, stylists, services);
  // Should fail because Sally is explicitly locked for Blowdry, leaving no one for Coloring
  assert.equal(result.success, false);
  assert.equal(result.reason, 'parallel_staff_conflict');
  assert.equal(result.conflictingItemId, 'stg-2');
});

test('Case 6: Sequential bundle allows same staff member across non-overlapping steps', () => {
  const stagedServices: StagedServiceWithAssignment[] = [
    {
      id: 'stg-1',
      serviceId: 'srv-step1',
      staffId: '',
      isExplicitStaff: false,
      startTime: 0,
      duration: 30
    },
    {
      id: 'stg-2',
      serviceId: 'srv-step2',
      staffId: '',
      isExplicitStaff: false,
      startTime: 30, // Starts after step 1 finishes
      duration: 30
    }
  ];

  // Only Sally exists in the whole salon
  const stylists = [
    { id: '101', nameEn: 'Sally' }
  ];

  const services = [
    { id: 'srv-step1', employeeAssignments: ['101'] },
    { id: 'srv-step2', employeeAssignments: ['101'] }
  ];

  const result = resolveCompatibleStaffAssignments(stagedServices, stylists, services);
  // Because they are sequential (non-overlapping), Sally CAN be assigned to both!
  assert.equal(result.success, true);
  assert.equal(result.resolvedStaffMap.get('stg-1'), '101');
  assert.equal(result.resolvedStaffMap.get('stg-2'), '101');
});
