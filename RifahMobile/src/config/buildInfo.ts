/**
 * BarSpa Customer App 2.0 — Build Provenance & Identity
 * Records exact build provenance to ensure full transparency and eliminate stale artifact ambiguity.
 */

import { getApiUrl, getServerUrl } from './env';

export const BUILD_PROVENANCE = {
  appName: 'BarSpa',
  appVersion: '2.0.0',
  versionCode: 2,
  gitCommit: 'a1f54433f516cc0dea68f3c093d1d71072dfcafd',
  gitBranch: 'main',
  buildDate: '2026-09-17',
  projectPath: 'D:/Waheed/Refah/Bookingsystem/RifahMobile',
  bundleIdentifier: 'com.refah.mobile',
  getApiUrl: () => getApiUrl(),
  getServerUrl: () => getServerUrl(),
  getFormattedSummary: () => {
    return `BarSpa v2.0.0 (Build 2) | Commit: a1f5443 | API: ${getApiUrl()}`;
  }
};
