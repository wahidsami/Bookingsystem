import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentWorkspace from '../AppointmentWorkspace';
import SchedulerGrid from '../SchedulerGrid';
import * as tenantAuth from '../../../hooks/useTenantAuth';
import { tenantApiAdapter } from '../../../lib/tenantApiAdapter';

// Mock the API adapter
jest.mock('../../../lib/tenantApiAdapter', () => ({
  tenantApiAdapter: {
    getEmployees: jest.fn(),
    getServices: jest.fn().mockResolvedValue({ services: [] }),
    getCustomers: jest.fn().mockResolvedValue({ customers: [] }),
    getProducts: jest.fn().mockResolvedValue({ products: [] }),
    getPackages: jest.fn().mockResolvedValue({ packages: [] }),
    getAppointmentsBoard: jest.fn()
  }
}));

// Mock useTenantAuth
jest.mock('../../../hooks/useTenantAuth', () => ({
  useTenantAuth: jest.fn()
}));

// Mock SchedulerGrid
const mockSchedulerGrid = jest.fn();
jest.mock('../SchedulerGrid', () => {
  return function MockSchedulerGrid(props: any) {
    mockSchedulerGrid(props);
    return <div data-testid="mock-scheduler-grid" />;
  };
});

describe('AppointmentWorkspace Availability Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSchedulerGrid.mockClear();
    (tenantAuth.useTenantAuth as jest.Mock).mockReturnValue({
      tenant: { id: 'test-tenant' },
      tenantSettings: { timezone: 'Asia/Riyadh' },
      user: { id: 'test-user' }
    });
  });

  const renderWorkspace = () => {
    return render(<AppointmentWorkspace lang="en" onQuickAction={jest.fn()} />);
  };

  it('computes availability based on current time and subShifts', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T10:30:00')); // Monday
    
    (tenantApiAdapter.getEmployees as jest.Mock).mockResolvedValue({
      employees: [
        {
          id: 'emp-1',
          nameEn: 'Active Staff',
          status: 'active',
          schedule: [
            {
              dayEn: 'Monday',
              status: 'working',
              subShifts: [
                { startTime: '09:00', endTime: '12:00' },
                { startTime: '13:00', endTime: '17:00' }
              ]
            }
          ]
        },
        {
          id: 'emp-2',
          nameEn: 'Before Shift Staff',
          status: 'active',
          schedule: [
            {
              dayEn: 'Monday',
              status: 'working',
              subShifts: [
                { startTime: '13:00', endTime: '17:00' }
              ]
            }
          ]
        },
        {
          id: 'emp-3',
          nameEn: 'No Shift Staff',
          status: 'active',
          schedule: []
        }
      ]
    });

    (tenantApiAdapter.getAppointmentsBoard as jest.Mock).mockResolvedValue({
      appointments: [],
      breaks: []
    });

    renderWorkspace();

    await waitFor(() => {
      expect(mockSchedulerGrid).toHaveBeenCalled();
    });

    // Wait until columns have been mapped from liveStylists (length > 0)
    await waitFor(() => {
      const lastCall = mockSchedulerGrid.mock.calls[mockSchedulerGrid.mock.calls.length - 1][0];
      expect(lastCall.columns.length).toBeGreaterThan(0);
    });

    const finalProps = mockSchedulerGrid.mock.calls[mockSchedulerGrid.mock.calls.length - 1][0];
    const columns = finalProps.columns;

    const emp1 = columns.find((c: any) => c.resourceId === 'emp-1');
    const emp2 = columns.find((c: any) => c.resourceId === 'emp-2');
    const emp3 = columns.find((c: any) => c.resourceId === 'emp-3');

    expect(emp1.availability).toBe('available');
    expect(emp2.availability).toBe('unavailable');
    expect(emp3.availability).toBe('unavailable');
    
    jest.useRealTimers();
  });
  
  it('computes break availability when overlapping with blocked appointment', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T14:30:00')); // Monday

    (tenantApiAdapter.getEmployees as jest.Mock).mockResolvedValue({
      employees: [
        {
          id: 'emp-break',
          nameEn: 'Break Staff',
          status: 'active',
          schedule: [
            {
              dayEn: 'Monday',
              status: 'working',
              subShifts: [
                { startTime: '09:00', endTime: '17:00' }
              ]
            }
          ]
        }
      ]
    });

    (tenantApiAdapter.getAppointmentsBoard as jest.Mock).mockResolvedValue({
      appointments: [],
      breaks: [
        {
          id: 'brk-1',
          staffId: 'emp-break',
          startTime: '14:00',
          endTime: '15:00',
          label: 'Lunch Break'
        }
      ]
    });

    renderWorkspace();

    await waitFor(() => {
      const lastCall = mockSchedulerGrid.mock.calls[mockSchedulerGrid.mock.calls.length - 1][0];
      const col = lastCall.columns.find((c: any) => c.resourceId === 'emp-break');
      // Wait for it to be set to break
      if (!col || col.availability !== 'break') throw new Error('Not ready');
      expect(col.availability).toBe('break');
    });

    jest.useRealTimers();
  });

  it('maps live staffStatuses correctly to UI columns', async () => {
    (tenantApiAdapter.getEmployees as jest.Mock).mockResolvedValue({
      employees: [
        { id: 'emp-1', nameEn: 'Staff 1', status: 'active', schedule: [] },
        { id: 'emp-2', nameEn: 'Staff 2', status: 'active', schedule: [] },
        { id: 'emp-3', nameEn: 'Staff 3', status: 'active', schedule: [] },
        { id: 'emp-4', nameEn: 'Staff 4', status: 'active', schedule: [] },
        { id: 'emp-5', nameEn: 'Staff 5', status: 'active', schedule: [] }
      ]
    });

    (tenantApiAdapter.getAppointmentsBoard as jest.Mock).mockResolvedValue({
      appointments: [],
      breaks: [],
      staffStatuses: {
        'emp-1': 'active',
        'emp-2': 'busy',
        'emp-3': 'break',
        'emp-4': 'time_off',
        'emp-5': 'off'
      }
    });

    renderWorkspace();

    await waitFor(() => {
      const lastCall = mockSchedulerGrid.mock.calls[mockSchedulerGrid.mock.calls.length - 1]?.[0];
      if (!lastCall || lastCall.columns.length < 5) throw new Error('Not ready');
      
      const c1 = lastCall.columns.find((c: any) => c.resourceId === 'emp-1');
      if (!c1.statusLabel) throw new Error('Status label not set yet');
    });

    const finalProps = mockSchedulerGrid.mock.calls[mockSchedulerGrid.mock.calls.length - 1][0];
    const columns = finalProps.columns;

    const emp1 = columns.find((c: any) => c.resourceId === 'emp-1');
    expect(emp1.statusLabel).toBe('Active');
    expect(emp1.statusTone).toBe('active');

    const emp2 = columns.find((c: any) => c.resourceId === 'emp-2');
    expect(emp2.statusLabel).toBe('Busy');
    expect(emp2.statusTone).toBe('active');

    const emp3 = columns.find((c: any) => c.resourceId === 'emp-3');
    expect(emp3.statusLabel).toBe('Break');
    expect(emp3.statusTone).toBe('break');

    const emp4 = columns.find((c: any) => c.resourceId === 'emp-4');
    expect(emp4.statusLabel).toBe('Time Off');
    expect(emp4.statusTone).toBe('off');

    const emp5 = columns.find((c: any) => c.resourceId === 'emp-5');
    expect(emp5.statusLabel).toBe('Off');
    expect(emp5.statusTone).toBe('off');
  });
});
