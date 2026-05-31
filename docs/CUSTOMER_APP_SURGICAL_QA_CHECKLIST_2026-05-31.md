# Customer App Surgical QA Checklist (2026-05-31)

Related docs:
- [Execution Board](d:/Waheed/Refah/Bookingsystem/docs/CUSTOMER_APP_SURGICAL_EXECUTION_BOARD_2026-05-31.md)
- [Remediation Plan](d:/Waheed/Refah/Bookingsystem/docs/CUSTOMER_APP_SURGICAL_REMEDIATION_PLAN_2026-05-31.md)

## How To Use
1. Mark each case `PASS` / `FAIL` / `BLOCKED`.
2. Attach evidence (video, screenshot, logs, request IDs).
3. Any `FAIL` in P0 blocks rollout wave progression.

---

## QA Metadata
| Field | Value |
|---|---|
| Build Version |  |
| Backend Version |  |
| Environment |  |
| Tester |  |
| Date |  |

---

## Phase 0: Baseline and Safety
| ID | Test Case | Priority | Result | Evidence | Notes |
|---|---|---|---|---|---|
| P0-01 | Baseline E2E recordings exist for 5 critical domains | P0 |  |  |  |
| P0-02 | Runtime guards prevent null-state crash in critical paths | P0 |  |  |  |
| P0-03 | Booking creation no longer fails with `bookingReference cannot be null` | P0 |  |  |  |

---

## Phase 1: Booking + Payment Integrity
| ID | Test Case | Priority | Result | Evidence | Notes |
|---|---|---|---|---|---|
| P1-01 | Single service, `at-center`, booking creation succeeds | P0 |  |  |  |
| P1-02 | Single service, `online-full`, payment required and succeeds | P0 |  |  |  |
| P1-03 | Single service, `booking-fee`, deposit payment succeeds | P0 |  |  |  |
| P1-04 | Multi-service, mixed methods, payable totals are correct | P0 |  |  |  |
| P1-05 | Multi-service payable flow does not duplicate charges on retry | P0 |  |  |  |
| P1-06 | Timeout/retry uses idempotency safely (no duplicate capture) | P0 |  |  |  |
| P1-07 | Payment ledger and displayed totals reconcile | P0 |  |  |  |
| P1-08 | Cancelled/failed payment does not leave inconsistent status | P0 |  |  |  |

---

## Phase 2: Auth + Session Hardening
| ID | Test Case | Priority | Result | Evidence | Notes |
|---|---|---|---|---|---|
| P2-01 | Email login persists across app restart | P0 |  |  |  |
| P2-02 | Google login persists across app restart | P0 |  |  |  |
| P2-03 | No random logout when app resumes from background | P0 |  |  |  |
| P2-04 | Token refresh race test (multiple API calls) remains stable | P0 |  |  |  |
| P2-05 | Expired token triggers refresh and recovery | P0 |  |  |  |
| P2-06 | Invalid refresh token triggers controlled logout only | P0 |  |  |  |
| P2-07 | Forgot password email link resets password successfully | P0 |  |  |  |
| P2-08 | New password works immediately after reset | P0 |  |  |  |

---

## Phase 3: Cart Contract Clarity
| ID | Test Case | Priority | Result | Evidence | Notes |
|---|---|---|---|---|---|
| P3-01 | Product cart badge shows product items only | P1 |  |  |  |
| P3-02 | Booking cart badge shows service items only | P1 |  |  |  |
| P3-03 | Product cart entry opens product cart consistently | P1 |  |  |  |
| P3-04 | Booking cart entry opens booking cart consistently | P1 |  |  |  |
| P3-05 | Empty product cart with service items shows booking cart CTA | P1 |  |  |  |
| P3-06 | Service details CTA is wired and actionable | P1 |  |  |  |
| P3-07 | Cart flow copy clearly distinguishes cart types | P1 |  |  |  |

---

## Phase 4: Notifications + Push
| ID | Test Case | Priority | Result | Evidence | Notes |
|---|---|---|---|---|---|
| P4-01 | Push token registers on login | P1 |  |  |  |
| P4-02 | Push token unregisters on logout | P1 |  |  |  |
| P4-03 | Foreground push appears correctly | P1 |  |  |  |
| P4-04 | Background push opens correct target screen | P1 |  |  |  |
| P4-05 | Notification unread count matches list/detail states | P1 |  |  |  |
| P4-06 | Mark-as-read is idempotent (no counter drift) | P1 |  |  |  |

---

## Phase 5: Gift Cards (General + Tenant)
| ID | Test Case | Priority | Result | Evidence | Notes |
|---|---|---|---|---|---|
| P5-01 | General gift claim token works exactly once | P1 |  |  |  |
| P5-02 | Tenant gift claim token works exactly once | P1 |  |  |  |
| P5-03 | Invalid token shows clear actionable error | P1 |  |  |  |
| P5-04 | Gift recharge updates wallet correctly | P1 |  |  |  |
| P5-05 | Gift send flow validates recipient correctly | P1 |  |  |  |
| P5-06 | Wallet history and current balance remain consistent | P1 |  |  |  |

---

## Rollout Gate Checklist
| Gate | Required | Result | Evidence |
|---|---|---|---|
| All P0 tests PASS | Yes |  |  |
| No unresolved P0/P1 blocker | Yes |  |  |
| Error rate within threshold for 24h canary | Yes |  |  |
| Payment success rate not degraded | Yes |  |  |
| Rollback validated | Yes |  |  |

---

## Defect Log
| Defect ID | Severity | Domain | Repro Steps | Expected | Actual | Status | Owner |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |
