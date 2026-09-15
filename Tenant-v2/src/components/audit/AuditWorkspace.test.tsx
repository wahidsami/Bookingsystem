import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import * as ReactDOMServer from 'react-dom/server';

// @ts-ignore
global.window = { fetch: () => Promise.resolve() } as any;
// @ts-ignore
global.localStorage = { getItem: () => null, setItem: () => {} } as any;

import AuditWorkspace from './AuditWorkspace';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';

// We override tenantApiAdapter methods for testing
const originalGetAuditLogs = tenantApiAdapter.getAuditLogs;
const originalGetAuditLog = tenantApiAdapter.getAuditLog;

test('renders audit page in English (loading state initially)', () => {
  const html = ReactDOMServer.renderToString(<AuditWorkspace lang="en" />);
  assert.match(html, /Audit &amp; Operations/); // Title is rendered
  assert.match(html, /Loading audit logs/); // Loading state is rendered
});

test('renders audit page in Arabic (loading state initially)', () => {
  const html = ReactDOMServer.renderToString(<AuditWorkspace lang="ar" />);
  assert.match(html, /سجل العمليات/); // Title is rendered in Arabic
  assert.match(html, /جاري التحميل/); // Loading state is rendered
});

// Note: To test the actual empty state or data state, we would typically need JSDOM or React Testing Library
// to await the useEffect hook and state changes. Since this project strictly uses `node:test` without JSDOM,
// we are verifying the initial render pass (request construction is implicit in the adapter, which we can mock).

test('api adapter constructs URL correctly', async () => {
  let requestedUrl = '';
  tenantApiAdapter.get = async (url: string) => {
    requestedUrl = url;
    return { success: true, data: { logs: [], pagination: { total: 0 } } };
  };

  await tenantApiAdapter.getAuditLogs({ entityType: 'Booking', page: 1, limit: 20 });
  assert.equal(requestedUrl, '/tenant/audit?entityType=Booking&page=1&limit=20');

  await tenantApiAdapter.getAuditByOperation('op_123');
  assert.equal(requestedUrl, '/tenant/audit/operation/op_123');
  
  // Restore
  tenantApiAdapter.getAuditLogs = originalGetAuditLogs;
  tenantApiAdapter.getAuditLog = originalGetAuditLog;
});
