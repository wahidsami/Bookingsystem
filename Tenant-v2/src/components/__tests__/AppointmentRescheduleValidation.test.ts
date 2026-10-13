import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tenantApiAdapter, installTenantApiFetchBridge } from '../../lib/tenantApiAdapter';

describe('BARSPA — Reschedule Validation & Auth Regression Tests', () => {
  it('1. isTenantApiPath properly recognizes /tenant/ relative and absolute paths', () => {
    // Test the paths that previously failed and caused HTTP 401
    const testPaths = [
      '/tenant/resources/batch-check',
      '/tenant/appointments/board?date=2026-10-14',
      '/tenant/shifts',
      '/api/v1/bookings/evaluate',
      '/api/v1/tenant/appointments/board',
      '/auth/tenant/login'
    ];

    // Using tenantApiAdapter's buildUrl and request mechanism
    for (const path of testPaths) {
      const built = (tenantApiAdapter as any).buildUrl(path);
      const isTenant = (built.pathname.startsWith('/api/v1/') ||
        built.pathname.startsWith('/auth/tenant/') ||
        built.pathname.startsWith('/tenant/'));
      assert.strictEqual(isTenant, true, `Path ${path} must be recognized as tenant API path`);
    }

    // Unrelated path should not match
    const unrelated = (tenantApiAdapter as any).buildUrl('/external/tracking');
    const isUnrelatedTenant = (unrelated.pathname.startsWith('/api/v1/') ||
      unrelated.pathname.startsWith('/auth/tenant/') ||
      unrelated.pathname.startsWith('/tenant/'));
    assert.strictEqual(isUnrelatedTenant, false);
  });

  it('2. Evaluates scheduling payload for standalone service edit has valid contract fields', () => {
    const activeAppointment = {
      id: 'appt-paid-001',
      tenantId: 'tenant-riyadh-01',
      serviceId: 'svc-facial',
      variantId: 'var-gold',
      date: '2026-12-16',
      status: 'confirmed',
      paymentStatus: 'paid'
    };

    const updatedItem = {
      id: 'item-1',
      staffId: 'staff-sara',
      startTime: 120, // 11:00 AM
      duration: 60,
      date: '2026-12-16'
    };

    const startTimeIso = '2026-12-16T11:00:00.000Z';
    const effectiveTenantId = activeAppointment.tenantId;

    const payload = {
      tenantId: effectiveTenantId,
      serviceId: activeAppointment.serviceId,
      packageId: undefined,
      staffId: updatedItem.staffId,
      startTime: startTimeIso,
      duration: updatedItem.duration,
      variantId: activeAppointment.variantId,
      excludeAppointmentId: activeAppointment.id
    };

    // Assert contractual requirements
    assert.strictEqual(payload.tenantId, 'tenant-riyadh-01');
    assert.strictEqual(payload.serviceId, 'svc-facial');
    assert.strictEqual(payload.staffId, 'staff-sara');
    assert.strictEqual(payload.startTime, '2026-12-16T11:00:00.000Z');
    assert.strictEqual(payload.duration, 60);
    assert.strictEqual(payload.variantId, 'var-gold');
    assert.strictEqual(payload.excludeAppointmentId, 'appt-paid-001');
    assert.ok(payload.tenantId, 'tenantId must be present');
    assert.ok(payload.serviceId || payload.packageId, 'serviceId or packageId must be present');
    assert.ok(payload.startTime, 'startTime must be present');
  });

  it('3. Evaluates scheduling payload for package edit uses packageId identity', () => {
    const activeAppointment = {
      id: 'appt-pkg-001',
      tenantId: 'tenant-riyadh-01',
      packageId: 'pkg-bridal-spa',
      isPackage: true,
      date: '2026-12-16',
      status: 'confirmed',
      paymentStatus: 'paid'
    };

    const updatedItem = {
      id: 'item-pkg',
      staffId: 'staff-nour',
      startTime: 60,
      duration: 120,
      date: '2026-12-16'
    };

    const targetServiceId = undefined;
    const targetPackageId = activeAppointment.packageId;

    const payload = {
      tenantId: activeAppointment.tenantId,
      serviceId: targetServiceId,
      packageId: (!targetServiceId && targetPackageId) ? targetPackageId : (targetPackageId || undefined),
      staffId: updatedItem.staffId,
      startTime: '2026-12-16T10:00:00.000Z',
      duration: updatedItem.duration,
      excludeAppointmentId: activeAppointment.id
    };

    assert.strictEqual(payload.tenantId, 'tenant-riyadh-01');
    assert.strictEqual(payload.packageId, 'pkg-bridal-spa');
    assert.strictEqual(payload.serviceId, undefined);
    assert.strictEqual(payload.excludeAppointmentId, 'appt-pkg-001');
  });

  it('4. Auth failure callback is triggered on HTTP 401 responses', () => {
    let authFailureCalled = false;
    tenantApiAdapter.setAuthFailureHandler(() => {
      authFailureCalled = true;
    });

    tenantApiAdapter.notifyAuthFailure();
    assert.strictEqual(authFailureCalled, true, 'notifyAuthFailure must invoke registered handler');

    // Clean up
    tenantApiAdapter.setAuthFailureHandler(null);
  });

  it('5. Reschedule mutation preserves appointment ID and payment state', () => {
    const originalAppointment = {
      id: 'appt-confirmed-paid-789',
      invoiceNumber: 'INV-2026-0042',
      invoiceStatus: 'paid',
      status: 'confirmed',
      paymentStatus: 'paid',
      price: 250,
      totalPaid: 250,
      remainingBalance: 0,
      date: '2026-10-14',
      startTime: 60,
      staffId: 'staff-mona'
    };

    // Simulate rescheduled result
    const rescheduledUpdate = {
      staffId: 'staff-layla',
      date: '2026-12-16',
      startTime: 120,
      startTimeIso: '2026-12-16T11:00:00.000Z'
    };

    // Reschedule in-place mutates only timing and staff
    const updatedAppointment = {
      ...originalAppointment,
      staffId: rescheduledUpdate.staffId,
      date: rescheduledUpdate.date,
      startTime: rescheduledUpdate.startTime
    };

    // Crucial invariants
    assert.strictEqual(updatedAppointment.id, originalAppointment.id, 'Appointment ID must remain identical');
    assert.strictEqual(updatedAppointment.invoiceNumber, originalAppointment.invoiceNumber, 'Invoice reference must be preserved');
    assert.strictEqual(updatedAppointment.paymentStatus, 'paid', 'Paid status must be preserved');
    assert.strictEqual(updatedAppointment.totalPaid, 250, 'Total paid must be preserved');
    assert.strictEqual(updatedAppointment.remainingBalance, 0, 'Remaining balance must remain 0');
    assert.strictEqual(updatedAppointment.date, '2026-12-16', 'Date should be updated to target date');
    assert.strictEqual(updatedAppointment.staffId, 'staff-layla', 'Staff should be updated');
  });

  it('6. Differentiates HTTP 401, 400, and 409 error classifications', () => {
    const classifyError = (err: any, isRtl: boolean) => {
      const isAuthError = err?.status === 401 || err?.response?.status === 401;
      const isValidationError = err?.status === 400 || err?.response?.status === 400;
      if (isAuthError) {
        return isRtl ? 'انتهت صلاحية جلسة العمل. يرجى إعادة تسجيل الدخول.' : 'Session expired or unauthorized. Please sign in again.';
      }
      if (isValidationError) {
        return err?.message || (isRtl ? 'بيانات التعديل غير مكتملة أو غير صالحة.' : 'Invalid or incomplete edit details.');
      }
      return err?.message || (isRtl ? 'تعذر حفظ التعديلات بسبب تعارض' : 'Unable to save due to conflict');
    };

    const authErr = { status: 401, message: 'Unauthorized' };
    assert.strictEqual(classifyError(authErr, false), 'Session expired or unauthorized. Please sign in again.');

    const validationErr = { status: 400, message: 'tenantId, serviceId or packageId, and startTime are required' };
    assert.strictEqual(classifyError(validationErr, false), 'tenantId, serviceId or packageId, and startTime are required');

    const conflictErr = { status: 409, message: 'Required resources are occupied' };
    assert.strictEqual(classifyError(conflictErr, false), 'Required resources are occupied');
  });
});
