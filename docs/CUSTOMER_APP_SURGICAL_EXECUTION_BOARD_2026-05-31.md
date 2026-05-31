# Customer App Surgical Execution Board (2026-05-31)

Related strategy doc:
- [CUSTOMER_APP_SURGICAL_REMEDIATION_PLAN_2026-05-31.md](d:/Waheed/Refah/Bookingsystem/docs/CUSTOMER_APP_SURGICAL_REMEDIATION_PLAN_2026-05-31.md)

## Status Legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Ready for QA`
- `Done`

---

## Program Overview
| Phase | Title | Priority | Status | Owner | ETA | Dependency |
|---|---|---|---|---|---|---|
| 0 | Safety Baseline and Freeze | P0 | In Progress | Engineering Lead + QA Lead | 2026-06-01 | None |
| 1 | Payment and Booking Transaction Integrity | P0 | Not Started | Backend Lead + Mobile Lead | 2026-06-06 | Phase 0 |
| 2 | Auth and Session Hardening | P0 | Not Started | Mobile Lead + Backend Lead | 2026-06-10 | Phase 1 (partial) |
| 3 | Cart Architecture and UX Contract Clarity | P1 | In Progress | Mobile Lead + Product Designer | 2026-06-11 | Phase 1 |
| 4 | Notifications and Push Reliability | P1 | Not Started | Mobile Lead + Backend Lead | 2026-06-13 | Phase 2 |
| 5 | Gift Card Domain Hardening | P1 | Not Started | Backend Lead + Mobile Lead | 2026-06-16 | Phase 1, Phase 2 |

---

## Phase 0: Safety Baseline and Freeze
| Work Item | Priority | Status | Owner | ETA | PR/Commit | QA Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Create remediation branch and lock risky merges | P0 | In Progress | Engineering Lead | 2026-05-31 |  |  | Freeze high-risk merges until Phase 1 done |
| Capture baseline E2E recordings for 5 critical domains | P0 | In Progress | QA Lead | 2026-06-01 |  |  | Record before/after for regression proof |
| Add temporary runtime guards on critical null paths | P0 | Not Started | Backend Lead | 2026-06-01 |  |  | Include payment + booking input guards |
| Confirm booking reference patch deployed in backend runtime | P0 | In Progress | Backend Lead | 2026-06-01 |  |  | Model hook changed to `beforeValidate` |

Exit Criteria:
1. Baseline suite exists and is reproducible.
2. No unresolved P0 crash in booking/payment path.

---

## Phase 1: Payment and Booking Transaction Integrity
| Work Item | Priority | Status | Owner | ETA | PR/Commit | QA Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Design booking-session payment API contract | P0 | Not Started | Backend Lead | 2026-06-02 |  |  | ADR required before coding |
| Implement backend booking-session payment endpoint | P0 | Not Started | Backend Lead | 2026-06-04 |  |  | Keep old endpoint for compatibility |
| Add idempotency key + unique constraints for capture | P0 | Not Started | Backend Lead | 2026-06-04 |  |  | DB + service layer |
| Add payment state machine (`initiated/authorized/captured/failed`) | P0 | Not Started | Backend Lead | 2026-06-05 |  |  | Expose status to mobile |
| Client integration for session-level payment | P0 | Not Started | Mobile Lead | 2026-06-06 |  |  | Fallback gated by flag |
| Handle partial failures + retry-safe UX | P0 | Not Started | Mobile Lead | 2026-06-06 |  |  | Retry token + user-safe messaging |
| Ledger reconciliation checks and audit logs | P0 | Not Started | Backend Lead | 2026-06-06 |  |  | Daily reconciliation report query |

Exit Criteria:
1. No duplicate capture in idempotency tests.
2. Multi-item payable sessions complete without manual per-item workaround.

---

## Phase 2: Auth and Session Hardening
| Work Item | Priority | Status | Owner | ETA | PR/Commit | QA Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Define client auth state machine and transitions | P0 | Not Started | Mobile Lead | 2026-06-07 |  |  | Diagram + transition tests |
| Implement single refresh coordinator (no refresh race) | P0 | Not Started | Mobile Lead | 2026-06-08 |  |  | One in-flight refresh gate |
| Add refresh retry/backoff and authoritative logout policy | P0 | Not Started | Mobile Lead + Backend Lead | 2026-06-09 |  |  | Avoid false logout on transient failures |
| Normalize Google onboarding completion path | P1 | Not Started | Mobile Lead | 2026-06-10 |  |  | Collapse branch complexity |
| Add auth telemetry (refresh failures, token age, forced logout count) | P1 | Not Started | Backend Lead | 2026-06-10 |  |  | Dashboard widgets mandatory |

Exit Criteria:
1. No random logout under network fluctuation test.
2. Stable login persistence across restart and resume.

---

## Phase 3: Cart Architecture and UX Contract Clarity
| Work Item | Priority | Status | Owner | ETA | PR/Commit | QA Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Publish cart taxonomy in UX copy (Product Cart vs Booking Cart) | P1 | In Progress | Product Designer + Mobile Lead | 2026-06-07 |  |  | badges added in tabs |
| Ensure badge-to-destination consistency in all entry points | P1 | In Progress | Mobile Lead | 2026-06-08 |  |  | tenant icon semantics fixed |
| Add global quick switcher between cart types | P1 | Not Started | Mobile Lead | 2026-06-09 |  |  | in Home/More or header layer |
| Add pre-checkout scope summary per cart type | P1 | Not Started | Mobile Lead | 2026-06-10 |  |  | financial clarity step |
| Remove or wire all dead cart-related CTAs | P1 | In Progress | Mobile Lead | 2026-06-07 |  |  | service details CTA wired |

Exit Criteria:
1. No entry point opens an unexpected cart type.
2. User can always locate both carts in 1-2 taps.

---

## Phase 4: Notifications and Push Reliability
| Work Item | Priority | Status | Owner | ETA | PR/Commit | QA Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Implement unified notification state reducer | P1 | Not Started | Mobile Lead | 2026-06-11 |  |  | single source of truth |
| De-duplicate read marking and reconcile counters | P1 | Not Started | Mobile Lead | 2026-06-12 |  |  | race-safe updates |
| Harden push token lifecycle (rotate, re-register, stale cleanup) | P1 | Not Started | Backend Lead + Mobile Lead | 2026-06-12 |  |  | includes auth transitions |
| Add telemetry for delivery/open/read funnel | P2 | Not Started | Backend Lead | 2026-06-13 |  |  | alerts on abnormal drop |

Exit Criteria:
1. Read/unread counters remain consistent across list/detail/open.
2. Push token registration stability verified across login/logout.

---

## Phase 5: Gift Card Domain Hardening
| Work Item | Priority | Status | Owner | ETA | PR/Commit | QA Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Define gift token type/scope/origin contract | P1 | Not Started | Backend Lead | 2026-06-12 |  |  | publish contract doc |
| Add strict token validation and endpoint routing by type | P1 | Not Started | Backend Lead + Mobile Lead | 2026-06-13 |  |  | no ambiguous fallback |
| Add claim idempotency and anti-replay checks | P1 | Not Started | Backend Lead | 2026-06-14 |  |  | required for finance safety |
| Harden wallet consistency checks post claim/recharge/send | P1 | Not Started | Backend Lead + QA Lead | 2026-06-15 |  |  | reconcile before/after balances |
| Improve failure messaging with actionable user guidance | P2 | Not Started | Mobile Lead | 2026-06-16 |  |  | localized messages |

Exit Criteria:
1. No ambiguous token path.
2. Wallet balances deterministic after each operation.

---

## Cross-Cutting Gates (Must Pass Before Release)
| Gate | Status | Evidence |
|---|---|---|
| Lint and type checks clean | Not Started |  |
| Critical-path unit tests pass | Not Started |  |
| Integration tests pass (booking/payment/auth/notifications/gifts) | Not Started |  |
| E2E regression suite pass | Not Started |  |
| Feature flags and rollback paths verified | Not Started |  |
| Monitoring dashboards and alerts configured | Not Started |  |

---

## Release Waves
| Wave | Scope | Flag Set | Status | Notes |
|---|---|---|---|---|
| Wave 1 | Internal test tenants | All new flags ON internal only | Not Started | Target 2026-06-16 |
| Wave 2 | 5% rollout | P0 flags only | Not Started | Target 2026-06-17 |
| Wave 3 | 25% rollout | P0 + selected P1 | Not Started | Target 2026-06-19 |
| Wave 4 | 100% rollout | Full target set | Not Started | Target 2026-06-22 |

---

## Active Risks / Blockers Log
| Date | Risk/Blocker | Severity | Owner | Mitigation | Status |
|---|---|---|---|---|---|
| 2026-05-31 | Session-level payment endpoint not yet available | P0 |  | Implement in Phase 1 | Open |
| 2026-05-31 | Multi-payable service sessions need per-appointment payment fallback | P0 |  | Temporary guided fallback in Appointments | Mitigated |
| 2026-05-31 | Git index lock intermittently blocks commits on local env | P2 |  | Release lock procedure and process cleanup | Open |

---

## Change Log
- 2026-05-31: Initial execution board created.
- 2026-05-31: Owners, ETAs, sequencing, and rollout dates populated.

---

## 10-Day Kickoff Sprint Plan (Execution-Ready)
| Day | Focus | Deliverables |
|---|---|---|
| Day 1 (2026-06-01) | Phase 0 closeout | baseline E2E evidence, freeze controls, runtime guard patch |
| Day 2 | Phase 1 design | booking-session payment API contract + ADR |
| Day 3 | Phase 1 backend build | endpoint scaffold + idempotency persistence |
| Day 4 | Phase 1 backend finalize | payment state machine + ledger hooks |
| Day 5 | Phase 1 mobile integration | session payment wiring + guarded fallback |
| Day 6 | Phase 1 QA | payment matrix E2E + reconciliation checks |
| Day 7 | Phase 2 auth core | refresh coordinator + state machine |
| Day 8 | Phase 2 auth completion | retry/backoff + Google flow normalization |
| Day 9 | Phase 3/4 overlap | cart UX contract polish + notification reducer |
| Day 10 | Phase 4/5 handoff | push lifecycle patch + gift token contract draft |

Sprint Acceptance:
1. All P0 items in Phase 1 are `Ready for QA` or `Done`.
2. No unresolved blocker in payment/booking integrity.
