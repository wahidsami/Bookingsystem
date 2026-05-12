# Missing Third-Party Services Provider Guide (Refah)

Last updated: April 26, 2026

## Purpose
This document lists suggested providers for the parts that are still missing in our system integrations, and explains what each provider offers.

## Current Status In Our System
- Connected now: OpenAI (`aiContentAssistant`)
- Not connected yet:
- WhatsApp business messaging (`whatsappNotifications`)
- Promotional email sending (`promotionalEmails`)
- Optional future channels: SMS and Voice

## Missing Parts And Suggested Providers

### 1) WhatsApp Business API (Missing)

#### A) Twilio
- Website: https://www.twilio.com/en-us/whatsapp
- Pricing: https://www.twilio.com/en-us/whatsapp/pricing
- What they provide:
- WhatsApp API access through Twilio platform
- Meta pass-through billing + Twilio platform fee
- Strong developer docs and quick API onboarding
- Also supports SMS and Voice if needed later
- Good for us if:
- We want fast implementation with one global CPaaS provider

#### B) 360dialog
- Website: https://www.360dialog.com/contact
- What they provide:
- WhatsApp-focused API provider (Meta partner)
- Fast onboarding for WhatsApp-only use cases
- Partner-oriented model for SaaS platforms
- Good for us if:
- We want a WhatsApp-specialized provider and simpler scope

#### C) Unifonic
- Website: https://www.unifonic.com/en/pricing
- What they provide:
- Regional provider with strong GCC/MENA presence
- WhatsApp channel plus other communication channels
- Localized commercial support
- Good for us if:
- We want local/regional support and commercial flexibility in KSA/GCC

#### D) Infobip
- Website: https://www.infobip.com/whatsapp-business/api
- What they provide:
- Enterprise-grade WhatsApp API and omnichannel platform
- Managed onboarding and strong operations tooling
- Good for us if:
- We want an enterprise vendor for scale and multi-channel growth

#### E) Vonage
- Website: https://www.vonage.com/communications-apis/messages/pricing/
- What they provide:
- WhatsApp via Messages API
- Combined model: Meta fee + Vonage platform fee
- SMS/Voice expansion path
- Good for us if:
- We want a global CPaaS alternative to Twilio

### 2) Promotional Email Provider (Missing)

#### A) Resend
- Pricing: https://resend.com/pricing
- Enterprise: https://resend.com/enterprise
- Contact: https://resend.com/contact
- What they provide:
- Transactional and campaign email APIs
- Clear pricing and straightforward integration
- Already aligned with our backend direction (Resend setup exists in code)
- Good for us if:
- We want fastest path with minimal migration risk

#### B) Twilio SendGrid
- Product: https://www.twilio.com/en-us/products/email-api
- Pricing: https://sendgrid.com/en-us/pricing
- What they provide:
- Mature high-volume email delivery platform
- Marketing and deliverability tooling
- Enterprise support options
- Good for us if:
- We expect very high email volumes and advanced deliverability controls

### 3) Optional Future Channels (Not required now)
- SMS and Voice can be added later through:
- Twilio
- Vonage
- Unifonic
- Infobip

## Recommended Shortlist For Refah
- Primary shortlist:
- Twilio (WhatsApp) + Resend (Email): fastest technical onboarding
- Unifonic (WhatsApp) + Resend (Email): strong regional support path
- Infobip (WhatsApp + Email/SMS stack): single enterprise vendor approach

## Quick Decision Criteria
- Time to go live
- API simplicity and developer experience
- Country pricing for Saudi/GCC traffic
- Support SLA and escalation process
- Whether owner wants one vendor or best-of-breed split

## Minimum Questions To Ask Each Provider
- WhatsApp:
- Full fee breakdown (provider fee + Meta pass-through) by message category
- Template approval flow and expected activation timelines
- Delivery reports/webhooks and failed-delivery diagnostics
- Email:
- Cost per 1,000 messages, overage model, warm-up support
- Deliverability support (SPF/DKIM/DMARC guidance)
- API limits, webhook reliability, and SLA
- Commercial:
- Contract length, minimum commitment, and volume discounts
- Support channels and response times

## Practical Next Step
Owner can contact 2 to 3 providers in parallel (for example Twilio, Unifonic, and 360dialog for WhatsApp; Resend and SendGrid for email), request formal quotes, then finalize based on commercial + technical fit.
