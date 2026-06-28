const {
  generateReportPdfBuffer,
  generateFallbackReportPdfBuffer,
  generateEmergencyReportPdfBuffer
} = require('./tenantReportPdfService');

jest.setTimeout(20000);

describe('tenantReportPdfService', () => {
  const basePayload = {
    tenantName: 'Refah Tenant',
    reportTitle: 'Overview',
    startDate: '2026-05-30',
    endDate: '2026-06-28',
    generatedAt: '2026-06-28T00:00:00.000Z',
    sections: ['overview', 'employees'],
    data: {
      overview: {
        totalRevenue: 123.45,
        totalTenantRevenue: 100,
        netRevenue: 95,
        totalBookings: 10,
        completedBookings: 8,
        cancelledBookings: 1,
        noShowBookings: 1,
        uniqueCustomers: 7
      },
      employees: [
        {
          name: 'Alice',
          totalBookings: 3,
          totalRevenueGenerated: 30,
          totalCommission: 5
        }
      ]
    }
  };

  it('generates a pdf buffer for the main report payload', async () => {
    const buffer = await generateReportPdfBuffer(basePayload);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('generates a fallback pdf buffer when rendering fails', async () => {
    const buffer = await generateFallbackReportPdfBuffer({
      tenantName: basePayload.tenantName,
      reportTitle: basePayload.reportTitle,
      startDate: basePayload.startDate,
      endDate: basePayload.endDate,
      generatedAt: basePayload.generatedAt,
      sections: basePayload.sections,
      errorMessage: 'Synthetic test'
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('generates an emergency pdf buffer when everything else fails', async () => {
    const buffer = await generateEmergencyReportPdfBuffer({
      tenantName: basePayload.tenantName,
      reportTitle: basePayload.reportTitle,
      startDate: basePayload.startDate,
      endDate: basePayload.endDate,
      generatedAt: basePayload.generatedAt,
      sections: basePayload.sections,
      errorMessage: 'Emergency synthetic test'
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(250);
  });
});
