# Rifah Multi-Tenant Platform

## Executive Summary

Rifah is a multi-tenant SaaS platform for salon and spa service providers in the Saudi Arabia market. The system architecture prioritizes tenant isolation, robust financial management, advanced booking operations, AI-driven recommendations, and full compliance with regional regulations. This document provides a comprehensive, implementation-ready technical specification without reference to generative coding platforms.

---

## System Architecture Overview

### Multi-Tenant Strategy

- **Database Isolation**: Each tenant operates in a separate PostgreSQL schema to guarantee data privacy and regulatory compliance.
- **API Context**: Every request processes tenant context, ensuring strict data segregation.
- **Namespaced Caching**: Redis is segmented by tenant identifier.
- **File Storage**: AWS S3 bucket structure uses tenant prefixes for organization.

### Shared Components

- Central authentication/authorization (OAuth/JWT)
- Integrated payment processing supporting Stripe and local gateways
- AI/ML engine with tenant data isolation for predictions and recommendations
- Unified admin monitoring dashboard

### Technology Stack

- **Frontend**: Next.js 14, React Native, Tailwind CSS, Shadcn UI
- **Backend**: Node.js 20, Express.js, PostgreSQL, Redis, Bull (job queue), AWS S3
- **AI/ML**: Hugging Face Transformers (Arabic support), TensorFlow/PyTorch, custom ML pipelines
- **Infrastructure**: AWS/GCP, Docker, Kubernetes, GitHub Actions, DataDog, ELK Stack


## Database Schema (Multi-Tenant)

### Key Tables

**Shared Schema**:
- `auth_users`: User authentication and roles
- `tenants`: Company information and plan type
- `subscriptions`: Billing cycle and payment status
- `payments`: Transactions log

**Tenant Schema (repeated per tenant)**:
- `services`: Service definitions (Arabic/English)
- `staff_members`: Employee directory
- `appointments`: Booking records
- `customers`: Client profiles
- `transactions`: Service payments
- `customer_preferences`: Profiled preferences
- `reviews_ratings`: Ratings and feedback
- `packages`: Bundled offerings
- `staff_schedule`: Work calendar
- `ai_recommendations`: Individualized offers
- `audit_logs`: Security traces

### Technical Notes

Every API call attaches tenant context, querying `tenant_{tenantId}` schema. Strict role-based access controls (RBAC) prevent cross-tenant visibility. Caching, AI training, and file storage are always tenant-specific.

---

## Core Feature Implementation Strategy

### 1. Smart Booking System

- NLP-powered, bilingual (Arabic/English) search for services
- Real-time AI recommendations on preferred staff, optimal slots, bundles
- Integrated payment with dynamic pricing engine
- No-show prediction and auto-rescheduling

**Key Backend Services:**
- `BookingService`: Booking logic, staff availability checks
- `RecommendationEngine`: AI scoring and affinity models
- `AppointmentQueueManager`: Queue and batch processing

### 2. Appointment Management

- Calendar interface with independence for each tenant
- Smart queue and auto-rescheduling logic
- Holiday, break, leave tracking for staff
- Waitlist management driven by AI-match algorithms

### 3. Staff Management and Payroll

- Expertise metrics, customer satisfaction analytics
- Automated commission and payroll workflows
- Training, certification, and absence logging
- Staff ranking and performance predictions

### 4. Financial Management

- Real-time dashboards for revenue, expenses, and forecasting
- AI-driven dynamic pricing (time, demand, seasonal, occupancy)
- Withdrawal management via local payment APIs
- Per-tenant tax reporting and compliance

### 5. Notifications and WhatsApp Automation

- Multi-channel, multi-language notification orchestration (Email, SMS, WhatsApp, Push)
- WhatsApp bot with NLP for appointments, cancellations, and reviews
- Channel preferences/timing optimization via ML
- Tenant branding (name, logo) in communications

---

## API Design

### Key Endpoints

- `/auth/register` - Tenant owner registration
- `/auth/login`
- `/auth/logout`
- `/api/v1/bookings/search` - Find slots
- `/api/v1/bookings/create` - Place booking
- `/api/v1/bookings/:id`
- `/api/v1/bookings/:id/cancel`
- `/api/v1/availability/:staffId`
- `/api/v1/staff`
- `/api/v1/staff/:id/performance`
- `/api/v1/dashboard/revenue`
- `/api/v1/notifications/send`
- `/webhooks/whatsapp` - Bot integration

All endpoints enforce authentication and tenant isolation; admin privileges controlled by RBAC.

---

## Deployment Guide

### Docker Compose Example

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: rifah_shared
      POSTGRES_USER: rifah_user
      POSTGRES_PASSWORD: dev_password
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://rifah_user:dev_password@postgres:5432/rifah_shared
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
volumes:
  postgres_data:
```

### Key Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/rifah_shared
REDIS_URL=redis://localhost:6379
NODE_ENV=production
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
TWILIO_ACCOUNT_SID=AC_xxx
TWILIO_WHATSAPP_NUMBER=+966xxx
AWS_REGION=us-east-1
AWS_ACCESS_KEY=xxx
SENDGRID_API_KEY=SG.xxx
OPENAI_API_KEY=sk-xxx
```

---

## Testing and Quality Assurance

- Extensive unit tests for booking, payment, and pricing engines
- Integration and end-to-end isolation tests to validate per-tenant security
- Load tests targeting 1000 concurrent bookings, WhatsApp bot latency <2s
- Security verification for JWT, authorization, and API rate limiting

---

## Security and Compliance

- Tenant isolation at database/schema, API, and cache layers
- Data encryption at rest (PostgreSQL, S3), TLS in transit
- PCI-DSS and Saudi SAMA payment rules
- GDPR/SDPL support: data access, deletion, right to be forgotten
- Automated audit logging, vulnerability scanning

---

## Implementation Roadmap (Phased, 20 Weeks)

| Phase | Duration   | Key Output                        |
|-------|------------|-----------------------------------|
| 1     | 2 weeks    | Core infra, DB setup, auth         |
| 2     | 2 weeks    | Booking system, smart recommend    |
| 3     | 2 weeks    | Payments, Stripe/local integration |
| 4     | 2 weeks    | Notifications engine, WhatsApp bot |
| 5     | 2 weeks    | Staff management, payroll          |
| 6     | 2 weeks    | Dynamic pricing algorithms         |
| 7     | 2 weeks    | Business dashboard, analytics      |
| 8     | 2 weeks    | ML features and segmentation       |
| 9     | 2 weeks    | Full system and security testing   |
| 10    | 2 weeks    | Deployment and scaling             |

---

## Frontend Component Breakdown

- **Owner Dashboard**: Revenue trends, booking calendar, staff analytics
- **Booking Interface**: Service, time, and staff selection
- **Staff Module**: Availability management, performance charts
- **Customer Portal**: Booking history, preferences, notifications

Designed for responsive performance and bilingual support (Arabic/English).

---

## Key Competitive Advantages

| Feature           | Fresha        | Rifah      |
|-------------------|--------------|------------|
| Fees              | 5.2%+30%     | 2.5%       |
| Hidden Fees       | Yes          | No         |
| AI Recommendations| Basic        | Advanced   |
| WhatsApp Bot      | No           | Yes        |
| Local Support     | Limited      | 24/7       |
| Dynamic Pricing   | No           | Yes        |
| Payroll Automation| No           | Yes        |

---

## Engineering Best Practices

- Each query and model namespaced by tenant identifier
- Database migrations use both global and tenant schema templates
- CI/CD includes test, build, and deploy checks
- All business logic written with tenant context enforced
- Secure secrets and deployment automation

---

## Success Metrics

- Register new tenants and users securely
- Place and manage bookings with correct isolation
- Process and confirm payments (Stripe, Saudi gateways)
- Send, track, and optimize multi-channel notifications
- WhatsApp bot accurately processes Arabic and English
- Owner dashboard reflects real-time, AI-driven analytics
- Meet or exceed benchmarks for test and deployment coverage

---

## Next Steps

1. Start with foundation: database and authentication
2. Build core booking and financial flows
3. Add notification and messaging integration
4. Complete staff management and payroll
5. Finalize all business dashboards and analytics
6. Test, secure, and deploy for production


