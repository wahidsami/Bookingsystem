import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isQueuedStandaloneServiceSelected,
  removeStandaloneQueuedService,
  calculateGroupStagedPricing,
  type MinimalStagedItem
} from '../../lib/bundleStagingHelpers';
import {
  isStylistAvailableForServiceItem,
  getEligibleStylistsForServiceItem,
  type StylistRecord,
  type ServiceWithAssignments
} from '../../lib/staffAssignmentEngine';
import type { StaffShiftRecord } from '../../lib/employeeDutyHours';

test('Group Booking Service Add Interaction Suite', async (t) => {
  const organizerId = 'part-organizer';
  const participant2Id = 'part-sara';

  const groupParticipants = [
    { id: organizerId, name: 'abeer User', isOrganizer: true },
    { id: participant2Id, name: 'sara', isOrganizer: false }
  ];

  const moroccanMassageService = {
    id: 'srv-moroccan',
    nameEn: 'Moroccan Massage',
    nameAr: 'مساج مغربي',
    category: 'massage',
    price: 350,
    finalPrice: 350,
    duration: 60,
    variants: [
      {
        id: 'var-moroccan-royal',
        nameEn: 'Royal Moroccan Massage 90min',
        nameAr: 'مساج مغربي ملكي 90 دقيقة',
        price: 450,
        finalPrice: 450,
        duration: 90
      }
    ],
    employeeAssignments: ['101', '102']
  };

  const thaiTherapyService = {
    id: 'srv-thai',
    nameEn: 'Thai Therapy',
    nameAr: 'علاج تايلندي',
    category: 'therapy',
    price: 300,
    finalPrice: 300,
    duration: 45,
    variants: [],
    employeeAssignments: ['102']
  };

  const stylists: StylistRecord[] = [
    { id: '101', nameEn: 'Sally', nameAr: 'سالي', status: 'active' },
    { id: '102', nameEn: 'Fatima', nameAr: 'فاطمة', status: 'active' }
  ];

  const shifts: StaffShiftRecord[] = [
    { staffId: '101', specificDate: '2026-10-17', startTime: '12:00', endTime: '20:00', isActive: true },
    { staffId: '102', specificDate: '2026-10-17', startTime: '09:00', endTime: '17:00', isActive: true }
  ];

  const testDate = new Date('2026-10-17T09:00:00Z');
  const boardStartHour = 9;

  // Simulate handleToggleServiceSelection state machine
  class DrawerStateSimulator {
    stagedServices: MinimalStagedItem[] = [];
    activeParticipantId: string = organizerId;
    currentStartTime: number = 60; // 10:00 AM (offset 60)
    currentStaffId: string = '';

    get activeParticipantNextStartTime() {
      const activePart = groupParticipants.find(p => p.id === this.activeParticipantId);
      let nextTime = typeof (activePart as any)?.startTime === 'number'
        ? (activePart as any).startTime
        : this.currentStartTime;
      const participantStaged = this.stagedServices.filter(
        s => (s.participantId || groupParticipants[0]?.id) === this.activeParticipantId
      );
      if (participantStaged.length > 0) {
        const latestEndTime = Math.max(...participantStaged.map(s => Number(s.startTime || 0) + Number(s.duration || 0)));
        if (Number.isFinite(latestEndTime) && latestEndTime > 0) {
          nextTime = latestEndTime;
        }
      }
      return nextTime;
    }

    isQueued(serviceId: string, variantId?: string | null) {
      return isQueuedStandaloneServiceSelected(
        this.stagedServices,
        serviceId,
        variantId,
        this.activeParticipantId
      );
    }

    toggleService(service: any, variant?: any) {
      const isSelected = this.isQueued(service.id, variant?.id);
      if (isSelected) {
        this.stagedServices = removeStandaloneQueuedService(
          this.stagedServices,
          service.id,
          variant?.id,
          this.activeParticipantId
        );
      } else {
        const resolvedVariant = variant || null;
        const nextStartTime = this.activeParticipantNextStartTime;
        const resolvedDuration = resolvedVariant?.duration || service.duration || 30;

        const targetStylist = this.currentStaffId
          ? stylists.find(s => String(s.id) === String(this.currentStaffId))
          : null;

        const isCurrentStaffAvailable = targetStylist
          ? isStylistAvailableForServiceItem({
              stylist: targetStylist,
              service,
              item: {
                id: 'new-staged-check',
                startTime: nextStartTime,
                duration: resolvedDuration,
                participantId: this.activeParticipantId
              },
              selectedDate: testDate,
              boardStartHour,
              tenantShifts: shifts,
              stagedServices: this.stagedServices
            }).available
          : false;

        const initialStaffId = isCurrentStaffAvailable ? this.currentStaffId : '';
        const basePrice = resolvedVariant?.finalPrice ?? resolvedVariant?.price ?? service.finalPrice ?? service.price ?? 0;

        const newItem: MinimalStagedItem = {
          id: `stg-${Date.now()}-${Math.random()}`,
          itemType: 'service',
          serviceId: service.id,
          variantId: resolvedVariant?.id || null,
          startTime: nextStartTime,
          duration: resolvedDuration,
          basePrice,
          finalPrice: basePrice,
          participantId: this.activeParticipantId,
          ...(initialStaffId ? { staffId: initialStaffId } : {})
        };

        this.stagedServices = [...this.stagedServices, newItem];
      }
    }
  }

  // Test 1: Clicking Add on unselected service adds it to active participant queue
  await t.test('Test 1: Clicking Add on unselected service successfully queues it for active participant', () => {
    const sim = new DrawerStateSimulator();
    assert.equal(sim.isQueued('srv-moroccan'), false);

    // Click Add
    sim.toggleService(moroccanMassageService, null);

    assert.equal(sim.isQueued('srv-moroccan'), true);
    assert.equal(sim.stagedServices.length, 1);
    assert.equal(sim.stagedServices[0].serviceId, 'srv-moroccan');
    assert.equal(sim.stagedServices[0].participantId, organizerId);
    assert.equal(sim.stagedServices[0].basePrice, 350);
  });

  // Test 2: Clicking Add on a service variant queues the specific variant with correct duration & price
  await t.test('Test 2: Clicking Add on a service variant queues specific variant', () => {
    const sim = new DrawerStateSimulator();
    const royalVariant = moroccanMassageService.variants[0];

    sim.toggleService(moroccanMassageService, royalVariant);

    assert.equal(sim.isQueued('srv-moroccan', royalVariant.id), true);
    assert.equal(sim.isQueued('srv-moroccan', null), false); // Standalone parent is not queued
    assert.equal(sim.stagedServices.length, 1);
    assert.equal(sim.stagedServices[0].variantId, royalVariant.id);
    assert.equal(sim.stagedServices[0].basePrice, 450);
    assert.equal(sim.stagedServices[0].duration, 90);
  });

  // Test 3: Financial summaries recalculate correctly upon service addition
  await t.test('Test 3: Financial summaries and ZATCA VAT recalculate accurately upon adding service', () => {
    const sim = new DrawerStateSimulator();

    // Add Moroccan massage (350 SAR) for organizer
    sim.toggleService(moroccanMassageService, null);

    const summary = calculateGroupStagedPricing(groupParticipants, sim.stagedServices as any, []);
    assert.equal(summary.subtotal, 350);
    assert.equal(summary.vat, 52.5); // 15% VAT
    assert.equal(summary.total, 402.5);

    const orgBreakdown = summary.participantBreakdowns.find(p => p.participantId === organizerId);
    assert.equal(orgBreakdown?.serviceCount, 1);
    assert.equal(orgBreakdown?.subtotal, 350);
  });

  // Test 4: Participant isolation: adding for organizer does NOT mark as selected for participant 2
  await t.test('Test 4: Adding for organizer leaves participant 2 unselected', () => {
    const sim = new DrawerStateSimulator();

    // Organizer adds Moroccan massage
    sim.activeParticipantId = organizerId;
    sim.toggleService(moroccanMassageService, null);
    assert.equal(sim.isQueued('srv-moroccan'), true);

    // Switch to Sara (participant 2)
    sim.activeParticipantId = participant2Id;
    assert.equal(sim.isQueued('srv-moroccan'), false); // Sara does NOT have it selected

    // Sara adds Thai therapy
    sim.toggleService(thaiTherapyService, null);
    assert.equal(sim.isQueued('srv-thai'), true);

    // Switch back to organizer
    sim.activeParticipantId = organizerId;
    assert.equal(sim.isQueued('srv-moroccan'), true);
    assert.equal(sim.isQueued('srv-thai'), false); // Organizer does NOT have Thai therapy

    // Total staged services is 2 (1 for each participant)
    assert.equal(sim.stagedServices.length, 2);

    // Verify consolidated group billing
    // Organizer: 350 SAR. Sara: 300 SAR. Subtotal = 650 SAR. VAT (15%) = 97.5 SAR. Total = 747.5 SAR.
    const groupSummary = calculateGroupStagedPricing(groupParticipants, sim.stagedServices as any, []);
    assert.equal(groupSummary.subtotal, 650);
    assert.equal(groupSummary.vat, 97.5);
    assert.equal(groupSummary.total, 747.5);
    assert.equal(groupSummary.participantBreakdowns.length, 2);
  });

  // Test 5: Clicking Add again (toggle) removes the service from that participant only
  await t.test('Test 5: Toggling a service removes it from active participant without affecting others', () => {
    const sim = new DrawerStateSimulator();

    // Both add Moroccan massage
    sim.activeParticipantId = organizerId;
    sim.toggleService(moroccanMassageService, null);

    sim.activeParticipantId = participant2Id;
    sim.toggleService(moroccanMassageService, null);
    assert.equal(sim.stagedServices.length, 2);

    // Organizer toggles off (removes) Moroccan massage
    sim.activeParticipantId = organizerId;
    sim.toggleService(moroccanMassageService, null);

    assert.equal(sim.isQueued('srv-moroccan'), false);
    assert.equal(sim.stagedServices.length, 1);
    assert.equal(sim.stagedServices[0].participantId, participant2Id); // Sara's copy remains!
  });

  // Test 6: Availability awareness is preserved: eligible providers are accurately filtered
  await t.test('Test 6: Queued service evaluates eligible available providers correctly', () => {
    const sim = new DrawerStateSimulator();
    sim.activeParticipantId = organizerId;
    sim.currentStartTime = 60; // 10:00 AM: Sally starts at 12:00 PM, Fatima starts at 09:00 AM

    sim.toggleService(moroccanMassageService, null);
    const queuedItem = sim.stagedServices[0];

    // Check eligible stylists for this queued item
    const eligibleStylists = getEligibleStylistsForServiceItem({
      stylists,
      service: moroccanMassageService,
      item: {
        id: queuedItem.id!,
        startTime: queuedItem.startTime!,
        duration: queuedItem.duration!,
        participantId: queuedItem.participantId!
      },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: shifts
    });

    // Only Fatima is eligible & on-duty at 10:00 AM; Sally is excluded
    assert.equal(eligibleStylists.length, 1);
    assert.equal(eligibleStylists[0].id, '102'); // Fatima
  });
});
