import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addRiyadhDays,
    formatRiyadhLongDate,
    formatRiyadhMonthDay,
    formatRiyadhTime,
    formatRiyadhWeekdayShort,
    getRiyadhDateKey,
    parseRiyadhDateKey,
} from '../utils/riyadhDate';
import {
    canMarkNoShow,
    canRequestTimeOff,
    canStartService,
    canViewBookingNotes,
    canViewClients,
} from '../utils/capabilities';
import { BARSPA_COLORS } from '../../constants/theme';

test('Riyadh Date Utility: computes consistent Riyadh calendar date keys', () => {
    const todayKey = getRiyadhDateKey();
    assert.match(todayKey, /^\d{4}-\d{2}-\d{2}$/, 'Date key format must be YYYY-MM-DD');

    const nextDayKey = addRiyadhDays(todayKey, 1);
    assert.match(nextDayKey, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(todayKey, nextDayKey);

    const prevDayKey = addRiyadhDays(nextDayKey, -1);
    assert.equal(todayKey, prevDayKey);
});

test('Riyadh Date Utility: bilingual date and weekday formatting (AR and EN)', () => {
    const dateKey = '2026-10-17';
    const parsed = parseRiyadhDateKey(dateKey);
    assert.equal(Number.isNaN(parsed.getTime()), false);

    // English formatting
    const weekdayEn = formatRiyadhWeekdayShort(dateKey, 'en');
    assert.ok(weekdayEn.length > 0);
    const monthDayEn = formatRiyadhMonthDay(dateKey, 'en');
    assert.ok(monthDayEn.length > 0);
    const longDateEn = formatRiyadhLongDate(dateKey, 'en');
    assert.ok(longDateEn.includes('2026') || longDateEn.includes('17'));

    // Arabic formatting
    const weekdayAr = formatRiyadhWeekdayShort(dateKey, 'ar');
    assert.ok(weekdayAr.length > 0);
    const monthDayAr = formatRiyadhMonthDay(dateKey, 'ar');
    assert.ok(monthDayAr.length > 0);
    const longDateAr = formatRiyadhLongDate(dateKey, 'ar');
    assert.ok(longDateAr.length > 0);
});

test('Riyadh Time Utility: Riyadh hour & AM/PM formatting with locale support', () => {
    // 14:30:00 Riyadh time (2:30 PM)
    const isoString = '2026-10-17T11:30:00.000Z'; // 11:30 UTC = 14:30 Riyadh (UTC+3)
    const formattedEn = formatRiyadhTime(isoString, 'en');
    assert.match(formattedEn, /2:30\s*PM/i);

    const formattedAr = formatRiyadhTime(isoString, 'ar');
    assert.ok(formattedAr.includes('2:30') || formattedAr.includes('٠٢:٣٠') || formattedAr.includes('م'));
});

test('Staff Capability Matrix: respects backend authorization permissions', () => {
    const fullStaffUser: any = {
        id: 'staff-1',
        role: 'staff',
        permissions: {
            can_start_service: true,
            can_mark_no_show: true,
            view_booking_notes: true,
            view_clients: true,
        },
        features: {
            timeOff: true,
        },
    };

    assert.equal(canStartService(fullStaffUser), true);
    assert.equal(canMarkNoShow(fullStaffUser), true);
    assert.equal(canRequestTimeOff(fullStaffUser), true);
    assert.equal(canViewBookingNotes(fullStaffUser), true);
    assert.equal(canViewClients(fullStaffUser), true);

    const restrictedStaffUser: any = {
        id: 'staff-2',
        role: 'staff',
        permissions: {
            can_start_service: false,
            can_mark_no_show: false,
            view_booking_notes: false,
            view_clients: false,
        },
        features: {
            timeOff: false,
        },
    };

    assert.equal(canStartService(restrictedStaffUser), false);
    assert.equal(canMarkNoShow(restrictedStaffUser), false);
    assert.equal(canRequestTimeOff(restrictedStaffUser), false);
    assert.equal(canViewBookingNotes(restrictedStaffUser), false);
    assert.equal(canViewClients(restrictedStaffUser), false);

    // Fallbacks for undefined permissions (permissive defaults for operational actions unless explicitly false)
    assert.equal(canStartService(null as any), true);
    assert.equal(canRequestTimeOff({ role: 'staff' } as any), false);
});

test('Appointment Multi-service Group Aggregation and Pricing', () => {
    const appointments: any[] = [
        {
            id: 'appt-1',
            bookingSessionId: 'session-100',
            bookingItemIndex: 1,
            startTime: '2026-10-17T14:30:00.000Z',
            endTime: '2026-10-17T15:30:00.000Z',
            price: 150,
            service: { name_en: 'Moroccan Bath', name_ar: 'حمام مغربي', finalPrice: 150 },
        },
        {
            id: 'appt-2',
            bookingSessionId: 'session-100',
            bookingItemIndex: 0,
            startTime: '2026-10-17T13:30:00.000Z',
            endTime: '2026-10-17T14:30:00.000Z',
            price: 200,
            service: { name_en: 'Deep Tissue Massage', name_ar: 'مساج عميق للأنسجة', finalPrice: 200 },
        },
    ];

    // Grouping logic mimicking ScheduleScreen
    const getGroupKey = (appt: any) => appt.bookingSessionId || appt.id;
    const grouped = new Map<string, any[]>();
    appointments.forEach((appt) => {
        const key = getGroupKey(appt);
        const curr = grouped.get(key) || [];
        curr.push(appt);
        grouped.set(key, curr);
    });

    assert.equal(grouped.size, 1);
    const items = grouped.get('session-100')!;
    assert.equal(items.length, 2);

    // Sort by item index
    items.sort((a, b) => a.bookingItemIndex - b.bookingItemIndex);
    assert.equal(items[0].id, 'appt-2');
    assert.equal(items[1].id, 'appt-1');

    // Total price
    const totalPrice = items.reduce((sum, item) => sum + (item.service.finalPrice || item.price), 0);
    assert.equal(totalPrice, 350);

    // Language-aware label
    const getServiceLabel = (item: any, lang: string) =>
        lang === 'ar' ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar);

    assert.equal(getServiceLabel(items[0], 'ar'), 'مساج عميق للأنسجة');
    assert.equal(getServiceLabel(items[0], 'en'), 'Deep Tissue Massage');
});

test('Appointment Lifecycle Status Transition Rules', () => {
    const isTerminal = (status: string) => ['completed', 'cancelled', 'no_show'].includes(status);
    const canStart = (status: string, hasPermission: boolean) => hasPermission && ['confirmed', 'arrived', 'checked_in', 'pending'].includes(status);
    const canComplete = (status: string, hasPermission: boolean) => hasPermission && status === 'started';
    const canMarkNoShowStatus = (status: string, hasPermission: boolean) => hasPermission && !isTerminal(status) && status !== 'started';

    assert.equal(isTerminal('completed'), true);
    assert.equal(isTerminal('no_show'), true);
    assert.equal(isTerminal('cancelled'), true);
    assert.equal(isTerminal('started'), false);
    assert.equal(isTerminal('confirmed'), false);

    assert.equal(canStart('confirmed', true), true);
    assert.equal(canStart('confirmed', false), false);
    assert.equal(canStart('started', true), false);
    assert.equal(canStart('completed', true), false);

    assert.equal(canComplete('started', true), true);
    assert.equal(canComplete('confirmed', true), false);

    assert.equal(canMarkNoShowStatus('confirmed', true), true);
    assert.equal(canMarkNoShowStatus('started', true), false); // Cannot mark no-show once service started
    assert.equal(canMarkNoShowStatus('completed', true), false);
});

test('BARSPA Brand Color Tokens Integrity', () => {
    assert.equal(BARSPA_COLORS.royalPurple, '#6537C0');
    assert.equal(BARSPA_COLORS.deepViolet, '#1D035F');
    assert.equal(BARSPA_COLORS.lavender, '#A379E2');
    assert.equal(BARSPA_COLORS.softLilac, '#E7DDFC');
    assert.equal(BARSPA_COLORS.status.confirmed.text, '#059669');
    assert.equal(BARSPA_COLORS.status.completed.text, '#4B5563');
});
