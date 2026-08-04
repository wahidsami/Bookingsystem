--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: enum_activity_logs_action; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_activity_logs_action AS ENUM (
    'created',
    'updated',
    'deleted',
    'approved',
    'rejected',
    'suspended',
    'activated',
    'login',
    'logout',
    'password_change',
    'settings_change',
    'payment_received',
    'refund_issued',
    'document_uploaded',
    'document_verified'
);


ALTER TYPE public.enum_activity_logs_action OWNER TO postgres;

--
-- Name: enum_activity_logs_entityType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_activity_logs_entityType" AS ENUM (
    'tenant',
    'platform_user',
    'appointment',
    'transaction',
    'service',
    'staff',
    'super_admin',
    'system',
    'package'
);


ALTER TYPE public."enum_activity_logs_entityType" OWNER TO postgres;

--
-- Name: enum_activity_logs_performedByType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_activity_logs_performedByType" AS ENUM (
    'super_admin',
    'tenant_user',
    'platform_user',
    'system'
);


ALTER TYPE public."enum_activity_logs_performedByType" OWNER TO postgres;

--
-- Name: enum_admin_notifications_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_admin_notifications_severity AS ENUM (
    'info',
    'success',
    'warning',
    'danger'
);


ALTER TYPE public.enum_admin_notifications_severity OWNER TO postgres;

--
-- Name: enum_appointments_paymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_appointments_paymentStatus" AS ENUM (
    'pending',
    'deposit_paid',
    'fully_paid',
    'refunded',
    'partially_refunded'
);


ALTER TYPE public."enum_appointments_paymentStatus" OWNER TO postgres;

--
-- Name: enum_appointments_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_appointments_status AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'in_service',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE public.enum_appointments_status OWNER TO postgres;

--
-- Name: enum_auth_users_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_auth_users_role AS ENUM (
    'superadmin',
    'owner',
    'manager',
    'staff'
);


ALTER TYPE public.enum_auth_users_role OWNER TO postgres;

--
-- Name: enum_bill_payment_attempts_performedByType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_bill_payment_attempts_performedByType" AS ENUM (
    'tenant_user',
    'super_admin',
    'system',
    'payment_gateway'
);


ALTER TYPE public."enum_bill_payment_attempts_performedByType" OWNER TO postgres;

--
-- Name: enum_bill_payment_attempts_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_bill_payment_attempts_source AS ENUM (
    'public_payment_link',
    'admin_manual_reconciliation',
    'provider_webhook',
    'legacy_subscription_payment'
);


ALTER TYPE public.enum_bill_payment_attempts_source OWNER TO postgres;

--
-- Name: enum_bill_payment_attempts_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_bill_payment_attempts_status AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'already_paid',
    'expired',
    'duplicate_ignored'
);


ALTER TYPE public.enum_bill_payment_attempts_status OWNER TO postgres;

--
-- Name: enum_bills_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_bills_status AS ENUM (
    'DRAFT',
    'UNPAID',
    'FAILED',
    'PAID',
    'EXPIRED',
    'VOID'
);


ALTER TYPE public.enum_bills_status OWNER TO postgres;

--
-- Name: enum_bills_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_bills_type AS ENUM (
    'initial',
    'renewal',
    'upgrade'
);


ALTER TYPE public.enum_bills_type OWNER TO postgres;

--
-- Name: enum_booking_sessions_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_booking_sessions_status AS ENUM (
    'draft',
    'confirmed',
    'completed',
    'cancelled'
);


ALTER TYPE public.enum_booking_sessions_status OWNER TO postgres;

--
-- Name: enum_consultant_conversations_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_consultant_conversations_status AS ENUM (
    'open',
    'paused',
    'closed'
);


ALTER TYPE public.enum_consultant_conversations_status OWNER TO postgres;

--
-- Name: enum_consultant_reports_periodType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_consultant_reports_periodType" AS ENUM (
    'daily',
    'weekly',
    'monthly'
);


ALTER TYPE public."enum_consultant_reports_periodType" OWNER TO postgres;

--
-- Name: enum_consultant_snapshots_periodType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_consultant_snapshots_periodType" AS ENUM (
    'daily',
    'weekly',
    'monthly'
);


ALTER TYPE public."enum_consultant_snapshots_periodType" OWNER TO postgres;

--
-- Name: enum_customer_insights_loyaltyTier; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_customer_insights_loyaltyTier" AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


ALTER TYPE public."enum_customer_insights_loyaltyTier" OWNER TO postgres;

--
-- Name: enum_customer_invoice_events_fromStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_customer_invoice_events_fromStatus" AS ENUM (
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'REFUNDED',
    'VOID'
);


ALTER TYPE public."enum_customer_invoice_events_fromStatus" OWNER TO postgres;

--
-- Name: enum_customer_invoice_events_toStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_customer_invoice_events_toStatus" AS ENUM (
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'REFUNDED',
    'VOID'
);


ALTER TYPE public."enum_customer_invoice_events_toStatus" OWNER TO postgres;

--
-- Name: enum_customer_invoice_items_itemType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_customer_invoice_items_itemType" AS ENUM (
    'service',
    'product'
);


ALTER TYPE public."enum_customer_invoice_items_itemType" OWNER TO postgres;

--
-- Name: enum_customer_invoices_entityType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_customer_invoices_entityType" AS ENUM (
    'appointment',
    'order'
);


ALTER TYPE public."enum_customer_invoices_entityType" OWNER TO postgres;

--
-- Name: enum_customer_invoices_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_customer_invoices_status AS ENUM (
    'UNPAID',
    'PARTIALLY_PAID',
    'PAID',
    'REFUNDED',
    'VOID'
);


ALTER TYPE public.enum_customer_invoices_status OWNER TO postgres;

--
-- Name: enum_gift_card_codes_scopeType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_gift_card_codes_scopeType" AS ENUM (
    'admin_global',
    'tenant_scoped'
);


ALTER TYPE public."enum_gift_card_codes_scopeType" OWNER TO postgres;

--
-- Name: enum_gift_card_codes_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_gift_card_codes_status AS ENUM (
    'issued',
    'partially_redeemed',
    'redeemed',
    'expired',
    'cancelled'
);


ALTER TYPE public.enum_gift_card_codes_status OWNER TO postgres;

--
-- Name: enum_gift_card_transactions_deliveryChannel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_gift_card_transactions_deliveryChannel" AS ENUM (
    'in_app',
    'email',
    'sms_whatsapp_future'
);


ALTER TYPE public."enum_gift_card_transactions_deliveryChannel" OWNER TO postgres;

--
-- Name: enum_gift_card_transactions_deliveryMode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_gift_card_transactions_deliveryMode" AS ENUM (
    'auto_wallet',
    'external_code'
);


ALTER TYPE public."enum_gift_card_transactions_deliveryMode" OWNER TO postgres;

--
-- Name: enum_gift_card_transactions_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_gift_card_transactions_status AS ENUM (
    'purchased',
    'sent_pending_claim',
    'sent_completed',
    'sent_completed_auto_wallet',
    'sent_pending_external_redeem',
    'redeemed',
    'partially_redeemed',
    'cancelled',
    'expired'
);


ALTER TYPE public.enum_gift_card_transactions_status OWNER TO postgres;

--
-- Name: enum_hot_deals_discount_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_hot_deals_discount_type AS ENUM (
    'percentage',
    'fixed_amount'
);


ALTER TYPE public.enum_hot_deals_discount_type OWNER TO postgres;

--
-- Name: enum_hot_deals_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_hot_deals_status AS ENUM (
    'pending',
    'approved',
    'active',
    'expired',
    'rejected',
    'paused'
);


ALTER TYPE public.enum_hot_deals_status OWNER TO postgres;

--
-- Name: enum_mobile_push_tokens_appType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_mobile_push_tokens_appType" AS ENUM (
    'customer',
    'staff'
);


ALTER TYPE public."enum_mobile_push_tokens_appType" OWNER TO postgres;

--
-- Name: enum_mobile_push_tokens_platform; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_mobile_push_tokens_platform AS ENUM (
    'ios',
    'android',
    'web',
    'unknown'
);


ALTER TYPE public.enum_mobile_push_tokens_platform OWNER TO postgres;

--
-- Name: enum_notification_delivery_logs_channel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_notification_delivery_logs_channel AS ENUM (
    'push',
    'inbox',
    'staff_message'
);


ALTER TYPE public.enum_notification_delivery_logs_channel OWNER TO postgres;

--
-- Name: enum_notification_delivery_logs_recipientType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_notification_delivery_logs_recipientType" AS ENUM (
    'customer',
    'staff'
);


ALTER TYPE public."enum_notification_delivery_logs_recipientType" OWNER TO postgres;

--
-- Name: enum_notification_delivery_logs_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_notification_delivery_logs_status AS ENUM (
    'queued',
    'sent',
    'failed',
    'skipped'
);


ALTER TYPE public.enum_notification_delivery_logs_status OWNER TO postgres;

--
-- Name: enum_orders_deliveryType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_orders_deliveryType" AS ENUM (
    'pickup',
    'delivery'
);


ALTER TYPE public."enum_orders_deliveryType" OWNER TO postgres;

--
-- Name: enum_orders_paymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_orders_paymentMethod" AS ENUM (
    'online',
    'cash_on_delivery',
    'pay_on_visit'
);


ALTER TYPE public."enum_orders_paymentMethod" OWNER TO postgres;

--
-- Name: enum_orders_paymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_orders_paymentStatus" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded',
    'partially_refunded'
);


ALTER TYPE public."enum_orders_paymentStatus" OWNER TO postgres;

--
-- Name: enum_orders_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_orders_status AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'ready_for_pickup',
    'shipped',
    'delivered',
    'completed',
    'cancelled',
    'refunded'
);


ALTER TYPE public.enum_orders_status OWNER TO postgres;

--
-- Name: enum_payment_idempotency_keys_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_payment_idempotency_keys_status AS ENUM (
    'processing',
    'completed',
    'failed'
);


ALTER TYPE public.enum_payment_idempotency_keys_status OWNER TO postgres;

--
-- Name: enum_payment_methods_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_payment_methods_type AS ENUM (
    'card',
    'wallet',
    'apple_pay',
    'stc_pay',
    'mada'
);


ALTER TYPE public.enum_payment_methods_type OWNER TO postgres;

--
-- Name: enum_payment_transactions_payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_payment_transactions_payment_method AS ENUM (
    'online',
    'cash',
    'card_pos',
    'wallet',
    'bank_transfer',
    'gift_card_code'
);


ALTER TYPE public.enum_payment_transactions_payment_method OWNER TO postgres;

--
-- Name: enum_payment_transactions_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_payment_transactions_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded',
    'cancelled'
);


ALTER TYPE public.enum_payment_transactions_status OWNER TO postgres;

--
-- Name: enum_payment_transactions_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_payment_transactions_type AS ENUM (
    'deposit',
    'remainder',
    'full',
    'refund'
);


ALTER TYPE public.enum_payment_transactions_type OWNER TO postgres;

--
-- Name: enum_platform_users_auth_provider; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_platform_users_auth_provider AS ENUM (
    'local',
    'google'
);


ALTER TYPE public.enum_platform_users_auth_provider OWNER TO postgres;

--
-- Name: enum_platform_users_gender; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_platform_users_gender AS ENUM (
    'male',
    'female',
    'other'
);


ALTER TYPE public.enum_platform_users_gender OWNER TO postgres;

--
-- Name: enum_platform_users_preferredLanguage; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_platform_users_preferredLanguage" AS ENUM (
    'en',
    'ar'
);


ALTER TYPE public."enum_platform_users_preferredLanguage" OWNER TO postgres;

--
-- Name: enum_services_giftType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_services_giftType" AS ENUM (
    'text',
    'product'
);


ALTER TYPE public."enum_services_giftType" OWNER TO postgres;

--
-- Name: enum_staff_breaks_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_staff_breaks_type AS ENUM (
    'lunch',
    'prayer',
    'cleaning',
    'other'
);


ALTER TYPE public.enum_staff_breaks_type OWNER TO postgres;

--
-- Name: enum_staff_schedule_overrides_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_staff_schedule_overrides_type AS ENUM (
    'override',
    'exception'
);


ALTER TYPE public.enum_staff_schedule_overrides_type OWNER TO postgres;

--
-- Name: enum_staff_time_off_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_staff_time_off_type AS ENUM (
    'vacation',
    'sick',
    'personal',
    'training',
    'other'
);


ALTER TYPE public.enum_staff_time_off_type OWNER TO postgres;

--
-- Name: enum_super_admins_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_super_admins_role AS ENUM (
    'super_admin',
    'admin',
    'support'
);


ALTER TYPE public.enum_super_admins_role OWNER TO postgres;

--
-- Name: enum_support_agents_presenceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_agents_presenceStatus" AS ENUM (
    'offline',
    'online',
    'away',
    'busy'
);


ALTER TYPE public."enum_support_agents_presenceStatus" OWNER TO postgres;

--
-- Name: enum_support_agents_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_agents_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.enum_support_agents_status OWNER TO postgres;

--
-- Name: enum_support_attachments_fileCategory; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_attachments_fileCategory" AS ENUM (
    'image',
    'pdf',
    'office',
    'zip'
);


ALTER TYPE public."enum_support_attachments_fileCategory" OWNER TO postgres;

--
-- Name: enum_support_attachments_uploadedByType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_attachments_uploadedByType" AS ENUM (
    'customer',
    'support_agent',
    'ai',
    'system'
);


ALTER TYPE public."enum_support_attachments_uploadedByType" OWNER TO postgres;

--
-- Name: enum_support_categories_scope; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_categories_scope AS ENUM (
    'global',
    'tenant'
);


ALTER TYPE public.enum_support_categories_scope OWNER TO postgres;

--
-- Name: enum_support_messages_contentFormat; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_messages_contentFormat" AS ENUM (
    'plain',
    'markdown',
    'html'
);


ALTER TYPE public."enum_support_messages_contentFormat" OWNER TO postgres;

--
-- Name: enum_support_messages_language; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_messages_language AS ENUM (
    'ar',
    'en'
);


ALTER TYPE public.enum_support_messages_language OWNER TO postgres;

--
-- Name: enum_support_messages_senderType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_messages_senderType" AS ENUM (
    'customer',
    'support_agent',
    'ai',
    'system'
);


ALTER TYPE public."enum_support_messages_senderType" OWNER TO postgres;

--
-- Name: enum_support_messages_visibility; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_messages_visibility AS ENUM (
    'public',
    'internal'
);


ALTER TYPE public.enum_support_messages_visibility OWNER TO postgres;

--
-- Name: enum_support_ticket_events_actorType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_ticket_events_actorType" AS ENUM (
    'customer',
    'support_agent',
    'ai',
    'system'
);


ALTER TYPE public."enum_support_ticket_events_actorType" OWNER TO postgres;

--
-- Name: enum_support_ticket_events_eventType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_ticket_events_eventType" AS ENUM (
    'ticket_created',
    'reply_added',
    'attachment_added',
    'assigned',
    'priority_changed',
    'status_changed',
    'closed',
    'reopened',
    'category_changed',
    'note_added'
);


ALTER TYPE public."enum_support_ticket_events_eventType" OWNER TO postgres;

--
-- Name: enum_support_ticket_events_fromPriority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_ticket_events_fromPriority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public."enum_support_ticket_events_fromPriority" OWNER TO postgres;

--
-- Name: enum_support_ticket_events_fromStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_ticket_events_fromStatus" AS ENUM (
    'draft',
    'open',
    'assigned',
    'in_progress',
    'waiting_for_customer',
    'waiting_for_support',
    'resolved',
    'closed',
    'reopened'
);


ALTER TYPE public."enum_support_ticket_events_fromStatus" OWNER TO postgres;

--
-- Name: enum_support_ticket_events_toPriority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_ticket_events_toPriority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public."enum_support_ticket_events_toPriority" OWNER TO postgres;

--
-- Name: enum_support_ticket_events_toStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_ticket_events_toStatus" AS ENUM (
    'draft',
    'open',
    'assigned',
    'in_progress',
    'waiting_for_customer',
    'waiting_for_support',
    'resolved',
    'closed',
    'reopened'
);


ALTER TYPE public."enum_support_ticket_events_toStatus" OWNER TO postgres;

--
-- Name: enum_support_tickets_language; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_tickets_language AS ENUM (
    'ar',
    'en'
);


ALTER TYPE public.enum_support_tickets_language OWNER TO postgres;

--
-- Name: enum_support_tickets_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_tickets_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.enum_support_tickets_priority OWNER TO postgres;

--
-- Name: enum_support_tickets_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_tickets_source AS ENUM (
    'dashboard',
    'ai',
    'api',
    'email',
    'mobile',
    'system'
);


ALTER TYPE public.enum_support_tickets_source OWNER TO postgres;

--
-- Name: enum_support_tickets_sourceChannel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_support_tickets_sourceChannel" AS ENUM (
    'customer_app',
    'tenant_dashboard',
    'support_portal',
    'email',
    'chat',
    'live_chat',
    'ai_assistant',
    'api',
    'system'
);


ALTER TYPE public."enum_support_tickets_sourceChannel" OWNER TO postgres;

--
-- Name: enum_support_tickets_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_support_tickets_status AS ENUM (
    'draft',
    'open',
    'assigned',
    'in_progress',
    'waiting_for_customer',
    'waiting_for_support',
    'resolved',
    'closed',
    'reopened'
);


ALTER TYPE public.enum_support_tickets_status OWNER TO postgres;

--
-- Name: enum_tenant_gift_card_settlements_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenant_gift_card_settlements_status AS ENUM (
    'pending',
    'partially_settled',
    'settled'
);


ALTER TYPE public.enum_tenant_gift_card_settlements_status OWNER TO postgres;

--
-- Name: enum_tenant_gift_card_transactions_deliveryChannel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_tenant_gift_card_transactions_deliveryChannel" AS ENUM (
    'in_app',
    'email',
    'sms_whatsapp_future'
);


ALTER TYPE public."enum_tenant_gift_card_transactions_deliveryChannel" OWNER TO postgres;

--
-- Name: enum_tenant_gift_card_transactions_deliveryMode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_tenant_gift_card_transactions_deliveryMode" AS ENUM (
    'auto_wallet',
    'external_code'
);


ALTER TYPE public."enum_tenant_gift_card_transactions_deliveryMode" OWNER TO postgres;

--
-- Name: enum_tenant_gift_card_transactions_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenant_gift_card_transactions_status AS ENUM (
    'purchased',
    'sent_pending_claim',
    'sent_completed',
    'sent_completed_auto_wallet',
    'sent_pending_external_redeem',
    'redeemed',
    'partially_redeemed',
    'cancelled',
    'expired'
);


ALTER TYPE public.enum_tenant_gift_card_transactions_status OWNER TO postgres;

--
-- Name: enum_tenant_settings_subscriptionTier; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_tenant_settings_subscriptionTier" AS ENUM (
    'basic',
    'pro',
    'premium'
);


ALTER TYPE public."enum_tenant_settings_subscriptionTier" OWNER TO postgres;

--
-- Name: enum_tenant_subscriptions_billingCycle; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_tenant_subscriptions_billingCycle" AS ENUM (
    'monthly',
    'sixMonth',
    'annual'
);


ALTER TYPE public."enum_tenant_subscriptions_billingCycle" OWNER TO postgres;

--
-- Name: enum_tenant_subscriptions_lastPaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_tenant_subscriptions_lastPaymentStatus" AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'refunded'
);


ALTER TYPE public."enum_tenant_subscriptions_lastPaymentStatus" OWNER TO postgres;

--
-- Name: enum_tenant_subscriptions_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenant_subscriptions_status AS ENUM (
    'trial',
    'active',
    'past_due',
    'expired',
    'cancelled',
    'suspended'
);


ALTER TYPE public.enum_tenant_subscriptions_status OWNER TO postgres;

--
-- Name: enum_tenant_wallet_ledger_entries_direction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenant_wallet_ledger_entries_direction AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE public.enum_tenant_wallet_ledger_entries_direction OWNER TO postgres;

--
-- Name: enum_tenant_wallet_ledger_entries_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenant_wallet_ledger_entries_type AS ENUM (
    'tenant_gift_credit',
    'tenant_gift_redeem_debit',
    'tenant_gift_refund_credit',
    'tenant_gift_admin_adjustment'
);


ALTER TYPE public.enum_tenant_wallet_ledger_entries_type OWNER TO postgres;

--
-- Name: enum_tenants_layoutTemplate; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_tenants_layoutTemplate" AS ENUM (
    'default',
    'modern',
    'classic',
    'elegant'
);


ALTER TYPE public."enum_tenants_layoutTemplate" OWNER TO postgres;

--
-- Name: enum_tenants_plan; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenants_plan AS ENUM (
    'free_trial',
    'basic',
    'pro',
    'enterprise'
);


ALTER TYPE public.enum_tenants_plan OWNER TO postgres;

--
-- Name: enum_tenants_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_tenants_status AS ENUM (
    'registered',
    'plan_selected',
    'pending_approval',
    'more_info_required',
    'payment_pending',
    'payment_success',
    'payment_failed',
    'payment_expired',
    'active',
    'rejected',
    'suspended',
    'inactive'
);


ALTER TYPE public.enum_tenants_status OWNER TO postgres;

--
-- Name: enum_transactions_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_transactions_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


ALTER TYPE public.enum_transactions_status OWNER TO postgres;

--
-- Name: enum_transactions_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_transactions_type AS ENUM (
    'booking',
    'product_purchase',
    'refund',
    'wallet_topup',
    'loyalty_redemption'
);


ALTER TYPE public.enum_transactions_type OWNER TO postgres;

--
-- Name: enum_usage_alerts_actionTaken; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_usage_alerts_actionTaken" AS ENUM (
    'none',
    'upgraded',
    'renewed',
    'dismissed',
    'ignored'
);


ALTER TYPE public."enum_usage_alerts_actionTaken" OWNER TO postgres;

--
-- Name: enum_usage_alerts_alertType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_usage_alerts_alertType" AS ENUM (
    'warning_80',
    'warning_95',
    'limit_reached',
    'limit_exceeded',
    'renewal_due_7',
    'renewal_due_3',
    'renewal_due_1',
    'renewal_overdue',
    'grace_period',
    'subscription_cancelled',
    'payment_failed'
);


ALTER TYPE public."enum_usage_alerts_alertType" OWNER TO postgres;

--
-- Name: enum_usage_alerts_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_usage_alerts_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public.enum_usage_alerts_priority OWNER TO postgres;

--
-- Name: enum_usage_alerts_resourceType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."enum_usage_alerts_resourceType" AS ENUM (
    'bookings',
    'staff',
    'services',
    'products',
    'storage',
    'subscription',
    'payment'
);


ALTER TYPE public."enum_usage_alerts_resourceType" OWNER TO postgres;

--
-- Name: enum_wallet_ledger_entries_direction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_wallet_ledger_entries_direction AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE public.enum_wallet_ledger_entries_direction OWNER TO postgres;

--
-- Name: enum_wallet_ledger_entries_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_wallet_ledger_entries_type AS ENUM (
    'topup',
    'gift_purchase',
    'gift_sent_debit',
    'gift_received_credit',
    'service_payment_debit',
    'product_payment_debit',
    'refund_credit',
    'admin_adjustment'
);


ALTER TYPE public.enum_wallet_ledger_entries_type OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: FeaturePricings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeaturePricings" (
    id uuid NOT NULL,
    "featureKey" character varying(64) NOT NULL,
    label character varying(128) NOT NULL,
    "unitLabel" character varying(64) NOT NULL,
    "unitPrice" numeric(12,6) DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public."FeaturePricings" OWNER TO postgres;

--
-- Name: COLUMN "FeaturePricings"."featureKey"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."FeaturePricings"."featureKey" IS 'System key for the feature (e.g. subscriptionFee, maxStaff)';


--
-- Name: COLUMN "FeaturePricings".label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."FeaturePricings".label IS 'Admin-facing display label';


--
-- Name: COLUMN "FeaturePricings"."unitLabel"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."FeaturePricings"."unitLabel" IS 'Label for the billed unit';


--
-- Name: COLUMN "FeaturePricings"."unitPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."FeaturePricings"."unitPrice" IS 'Price per billed unit in SAR';


--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id uuid NOT NULL,
    "entityType" public."enum_activity_logs_entityType" NOT NULL,
    "entityId" uuid,
    action public.enum_activity_logs_action NOT NULL,
    "performedByType" public."enum_activity_logs_performedByType" NOT NULL,
    "performedById" uuid,
    "performedByName" character varying(255),
    details jsonb DEFAULT '{}'::jsonb,
    "previousValue" jsonb,
    "newValue" jsonb,
    "ipAddress" character varying(255),
    "userAgent" character varying(255),
    "createdAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_notifications (
    id uuid NOT NULL,
    type character varying(255) NOT NULL,
    severity public.enum_admin_notifications_severity DEFAULT 'info'::public.enum_admin_notifications_severity NOT NULL,
    "titleAr" character varying(255) NOT NULL,
    "titleEn" character varying(255) NOT NULL,
    "messageAr" text NOT NULL,
    "messageEn" text NOT NULL,
    "entityType" character varying(255),
    "entityId" uuid,
    "actionUrl" character varying(255),
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp with time zone,
    "dedupeKey" character varying(255) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.admin_notifications OWNER TO postgres;

--
-- Name: admin_saved_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_saved_reports (
    id uuid NOT NULL,
    "createdByAdminId" uuid,
    "reportType" character varying(64) DEFAULT 'custom'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    dimensions jsonb DEFAULT '[]'::jsonb NOT NULL,
    metrics jsonb DEFAULT '[]'::jsonb NOT NULL,
    "grouping" character varying(64),
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "outputType" character varying(32) DEFAULT 'table'::character varying NOT NULL,
    "chartType" character varying(32),
    "reportConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "scheduleConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isFavorite" boolean DEFAULT false NOT NULL,
    "lastRunAt" timestamp with time zone,
    "nextRunAt" timestamp with time zone,
    "lastRunResult" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "runHistory" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "duplicatedFromId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.admin_saved_reports OWNER TO postgres;

--
-- Name: appointment_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment_events (
    id uuid NOT NULL,
    "appointmentId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "platformUserId" uuid,
    "actorType" character varying(32) DEFAULT 'customer'::character varying NOT NULL,
    "actorId" uuid,
    "eventType" character varying(64) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    "occurredAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.appointment_events OWNER TO postgres;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid NOT NULL,
    "bookingNumber" character varying(255),
    "serviceId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "requestedStaffId" uuid,
    "platformUserId" uuid,
    "customerId" uuid,
    "tenantId" uuid,
    "startTime" timestamp with time zone NOT NULL,
    "endTime" timestamp with time zone NOT NULL,
    status public.enum_appointments_status DEFAULT 'pending'::public.enum_appointments_status,
    "assignmentMode" character varying(255) DEFAULT 'unknown'::character varying NOT NULL,
    price numeric(10,2) NOT NULL,
    "rawPrice" numeric(10,2),
    "taxAmount" numeric(10,2),
    "platformFee" numeric(10,2),
    "tenantRevenue" numeric(10,2),
    "employeeRevenue" numeric(10,2),
    "employeeCommissionRate" numeric(5,2),
    "employeeCommission" numeric(10,2),
    "paymentStatus" public."enum_appointments_paymentStatus" DEFAULT 'pending'::public."enum_appointments_paymentStatus",
    "paymentMethod" character varying(255),
    "paidAt" timestamp with time zone,
    "customerReminderSentAt" timestamp with time zone,
    "noShowMarkedAt" timestamp with time zone,
    "customerConfirmationRequired" boolean DEFAULT false NOT NULL,
    "customerConfirmationStatus" character varying(24) DEFAULT 'not_required'::character varying NOT NULL,
    "customerConfirmedAt" timestamp with time zone,
    "inviteToken" character varying(128),
    "inviteExpiresAt" timestamp with time zone,
    notes text,
    "aiScore" numeric(5,2),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "depositAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "depositPaid" boolean DEFAULT false NOT NULL,
    "remainderAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "remainderPaid" boolean DEFAULT false NOT NULL,
    "totalPaid" numeric(10,2) DEFAULT 0 NOT NULL,
    "serviceVariantId" character varying(120),
    "serviceVariantName" character varying(255),
    "serviceVariantDescription" text,
    "serviceVariantDuration" integer,
    "bookingSessionId" uuid,
    "bookingReference" character varying(40),
    "bookingItemIndex" integer DEFAULT 0 NOT NULL,
    "serviceStartedAt" timestamp with time zone,
    "serviceCompletedAt" timestamp with time zone
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: COLUMN appointments."bookingNumber"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."bookingNumber" IS 'Human-friendly booking number for POS/reception lookup';


--
-- Name: COLUMN appointments."requestedStaffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."requestedStaffId" IS 'Staff explicitly chosen by the customer. Null means any available staff.';


--
-- Name: COLUMN appointments."tenantId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."tenantId" IS 'Tenant ID for faster queries (denormalized)';


--
-- Name: COLUMN appointments."assignmentMode"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."assignmentMode" IS 'Tracks how the assigned staff member was chosen';


--
-- Name: COLUMN appointments.price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments.price IS 'Final price charged to customer';


--
-- Name: COLUMN appointments."rawPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."rawPrice" IS 'Service base price (before tax and commission)';


--
-- Name: COLUMN appointments."taxAmount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."taxAmount" IS 'Tax amount (15% Saudi VAT)';


--
-- Name: COLUMN appointments."platformFee"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."platformFee" IS 'Commission taken by Rifah platform';


--
-- Name: COLUMN appointments."tenantRevenue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."tenantRevenue" IS 'Revenue for tenant (after platform fee, before employee commission)';


--
-- Name: COLUMN appointments."employeeRevenue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."employeeRevenue" IS 'Revenue attributed to employee (for commission calculation)';


--
-- Name: COLUMN appointments."employeeCommissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."employeeCommissionRate" IS 'Commission rate for employee at time of booking';


--
-- Name: COLUMN appointments."employeeCommission"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."employeeCommission" IS 'Commission amount for employee';


--
-- Name: COLUMN appointments."paymentStatus"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."paymentStatus" IS 'pending = no payment, deposit_paid = deposit paid, fully_paid = all paid';


--
-- Name: COLUMN appointments."paymentMethod"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."paymentMethod" IS 'Payment method used (cash, card, wallet)';


--
-- Name: COLUMN appointments."customerReminderSentAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."customerReminderSentAt" IS 'When the latest customer reminder was sent';


--
-- Name: COLUMN appointments."noShowMarkedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."noShowMarkedAt" IS 'When the appointment was auto-marked or manually marked as no-show';


--
-- Name: COLUMN appointments."customerConfirmationRequired"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."customerConfirmationRequired" IS 'Whether customer must confirm attendance from the app';


--
-- Name: COLUMN appointments."customerConfirmationStatus"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."customerConfirmationStatus" IS 'Customer confirmation state: not_required, pending, confirmed, declined';


--
-- Name: COLUMN appointments."customerConfirmedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."customerConfirmedAt" IS 'When the customer responded to appointment confirmation';


--
-- Name: COLUMN appointments."inviteToken"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."inviteToken" IS 'Secure token for appointment invite deep links';


--
-- Name: COLUMN appointments."inviteExpiresAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments."inviteExpiresAt" IS 'Invite token expiry timestamp';


--
-- Name: auth_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role public.enum_auth_users_role DEFAULT 'owner'::public.enum_auth_users_role,
    "tenantId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.auth_users OWNER TO postgres;

--
-- Name: bill_payment_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bill_payment_attempts (
    id uuid NOT NULL,
    "billId" uuid NOT NULL,
    source public.enum_bill_payment_attempts_source DEFAULT 'public_payment_link'::public.enum_bill_payment_attempts_source NOT NULL,
    status public.enum_bill_payment_attempts_status DEFAULT 'pending'::public.enum_bill_payment_attempts_status NOT NULL,
    "paymentProvider" character varying(64),
    "paymentMethod" character varying(64),
    "paymentReference" character varying(128),
    "checkoutSessionId" character varying(128),
    "gatewayStatus" character varying(64),
    "requestedAmount" numeric(10,2),
    "capturedAmount" numeric(10,2),
    "failureReason" text,
    "idempotencyKey" character varying(191) NOT NULL,
    "processedAt" timestamp with time zone NOT NULL,
    "performedByType" public."enum_bill_payment_attempts_performedByType" DEFAULT 'system'::public."enum_bill_payment_attempts_performedByType" NOT NULL,
    "performedById" uuid,
    "performedByName" character varying(255),
    notes text,
    "gatewaySummary" jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.bill_payment_attempts OWNER TO postgres;

--
-- Name: bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bills (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "tenantSubscriptionId" uuid NOT NULL,
    "billNumber" character varying(32) NOT NULL,
    amount numeric(10,2) NOT NULL,
    "subtotalAmount" numeric(10,2),
    "platformMarkupRate" numeric(5,2),
    "platformMarkupAmount" numeric(10,2),
    "vatRate" numeric(5,2),
    "vatAmount" numeric(10,2),
    "discountAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(10,2),
    currency character varying(3) DEFAULT 'SAR'::character varying NOT NULL,
    "dueDate" date NOT NULL,
    status public.enum_bills_status DEFAULT 'UNPAID'::public.enum_bills_status NOT NULL,
    "paymentToken" character varying(64) NOT NULL,
    "paymentTokenExpiresAt" timestamp with time zone,
    "paidAt" timestamp with time zone,
    "invoiceIssuedAt" timestamp with time zone,
    "invoiceTitle" character varying(255),
    "invoiceTemplateMode" character varying(32) DEFAULT 'bilingual_ar_en'::character varying NOT NULL,
    "sellerSnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "buyerSnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "lineItemsSnapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "planSnapshot" jsonb DEFAULT '{}'::jsonb,
    "invoicePdfPath" character varying(255),
    "receiptPdfPath" character varying(255),
    "paymentProvider" character varying(64),
    "paymentReference" character varying(128),
    "paymentMethod" character varying(64),
    "paymentCapturedAmount" numeric(10,2),
    "paymentFailureReason" text,
    type public.enum_bills_type DEFAULT 'initial'::public.enum_bills_type NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bills_status_check CHECK (((status)::text = ANY (ARRAY['DRAFT'::text, 'UNPAID'::text, 'FAILED'::text, 'PAID'::text, 'EXPIRED'::text, 'VOID'::text])))
);


ALTER TABLE public.bills OWNER TO postgres;

--
-- Name: booking_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_sessions (
    id uuid NOT NULL,
    "bookingReference" character varying(40) NOT NULL,
    "tenantId" uuid NOT NULL,
    "platformUserId" uuid,
    status public.enum_booking_sessions_status DEFAULT 'draft'::public.enum_booking_sessions_status NOT NULL,
    "itemCount" integer DEFAULT 0 NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "platformFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "paymentMethod" character varying(255),
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.booking_sessions OWNER TO postgres;

--
-- Name: consultant_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultant_conversations (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "createdByUserId" uuid,
    "snapshotId" uuid,
    "reportId" uuid,
    title character varying(255) NOT NULL,
    topic character varying(128),
    status public.enum_consultant_conversations_status DEFAULT 'open'::public.enum_consultant_conversations_status NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    "searchText" text,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "lastMessageAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.consultant_conversations OWNER TO postgres;

--
-- Name: consultant_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultant_reports (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "snapshotId" uuid,
    "createdByUserId" uuid,
    "reportType" character varying(64) DEFAULT 'business_snapshot'::character varying NOT NULL,
    "analysisVersion" character varying(32) DEFAULT 'v1'::character varying NOT NULL,
    "snapshotHash" character varying(128) DEFAULT ''::character varying NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    "periodType" public."enum_consultant_reports_periodType" DEFAULT 'daily'::public."enum_consultant_reports_periodType" NOT NULL,
    "periodStart" timestamp with time zone NOT NULL,
    "periodEnd" timestamp with time zone NOT NULL,
    "outputFormat" character varying(32) DEFAULT 'json'::character varying NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    "reportData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "generatedAt" timestamp with time zone NOT NULL,
    status character varying(24) DEFAULT 'ready'::character varying NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.consultant_reports OWNER TO postgres;

--
-- Name: COLUMN consultant_reports."snapshotHash"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consultant_reports."snapshotHash" IS 'Stable hash of the input snapshot used to generate this analysis';


--
-- Name: consultant_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultant_snapshots (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "createdByUserId" uuid,
    "periodType" public."enum_consultant_snapshots_periodType" DEFAULT 'daily'::public."enum_consultant_snapshots_periodType" NOT NULL,
    "periodStart" timestamp with time zone NOT NULL,
    "periodEnd" timestamp with time zone NOT NULL,
    "generatedAt" timestamp with time zone NOT NULL,
    "datasetVersion" character varying(32) DEFAULT 'v1'::character varying NOT NULL,
    "snapshotHash" character varying(128) DEFAULT ''::character varying NOT NULL,
    currency character varying(3) DEFAULT 'SAR'::character varying NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    financial jsonb DEFAULT '{}'::jsonb NOT NULL,
    customers jsonb DEFAULT '{}'::jsonb NOT NULL,
    operations jsonb DEFAULT '{}'::jsonb NOT NULL,
    employees jsonb DEFAULT '[]'::jsonb NOT NULL,
    products jsonb DEFAULT '[]'::jsonb NOT NULL,
    "sourceCounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.consultant_snapshots OWNER TO postgres;

--
-- Name: COLUMN consultant_snapshots."snapshotHash"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consultant_snapshots."snapshotHash" IS 'Stable hash of the source snapshot payload';


--
-- Name: customer_insights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_insights (
    id uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "totalBookings" integer DEFAULT 0,
    "totalSpent" numeric(10,2) DEFAULT 0,
    "averageRating" numeric(3,2),
    "lastVisit" timestamp with time zone,
    "firstVisit" timestamp with time zone,
    "favoriteServices" uuid[] DEFAULT ARRAY[]::uuid[],
    "favoriteStaff" uuid[] DEFAULT ARRAY[]::uuid[],
    "preferredTimes" character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[],
    "loyaltyTier" public."enum_customer_insights_loyaltyTier" DEFAULT 'bronze'::public."enum_customer_insights_loyaltyTier",
    "tenantLoyaltyPoints" integer DEFAULT 0,
    notes text,
    tags character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[],
    "noShowCount" integer DEFAULT 0,
    "cancellationCount" integer DEFAULT 0,
    "averageBookingValue" numeric(10,2) DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.customer_insights OWNER TO postgres;

--
-- Name: customer_invoice_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_invoice_events (
    id uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "eventType" character varying(64) NOT NULL,
    "fromStatus" public."enum_customer_invoice_events_fromStatus",
    "toStatus" public."enum_customer_invoice_events_toStatus",
    "triggerSource" character varying(64) NOT NULL,
    "actorType" character varying(32),
    "actorId" uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.customer_invoice_events OWNER TO postgres;

--
-- Name: customer_invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_invoice_items (
    id uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "itemType" public."enum_customer_invoice_items_itemType" NOT NULL,
    "itemRefId" uuid,
    "nameEn" character varying(255) NOT NULL,
    "nameAr" character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" numeric(10,2) DEFAULT 0 NOT NULL,
    "lineTotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.customer_invoice_items OWNER TO postgres;

--
-- Name: customer_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_invoices (
    id uuid NOT NULL,
    "invoiceNumber" character varying(64) NOT NULL,
    "tenantId" uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    "entityType" public."enum_customer_invoices_entityType" NOT NULL,
    "entityId" uuid NOT NULL,
    status public.enum_customer_invoices_status DEFAULT 'UNPAID'::public.enum_customer_invoices_status NOT NULL,
    currency character varying(8) DEFAULT 'SAR'::character varying NOT NULL,
    "subtotalAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "vatAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "paidAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "dueAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "paymentMethodSnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "paymentStatusSnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "invoicePdfPath" character varying(1000),
    "receiptPdfPath" character varying(1000),
    "issuedAt" timestamp with time zone NOT NULL,
    "paidAt" timestamp with time zone,
    "lastEmailedAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "discountAmount" numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.customer_invoices OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    phone character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    preferences jsonb DEFAULT '{}'::jsonb,
    "totalSpent" numeric(10,2) DEFAULT 0,
    "loyaltyPoints" integer DEFAULT 0,
    "totalBookings" integer DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: gift_card_code_redemptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_card_code_redemptions (
    id uuid NOT NULL,
    "giftCardCodeId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "appointmentId" uuid,
    "orderId" uuid,
    "posInvoiceId" uuid,
    "redeemedAmount" numeric(10,2) NOT NULL,
    "remainingAfter" numeric(10,2) NOT NULL,
    "redeemedByStaffId" uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.gift_card_code_redemptions OWNER TO postgres;

--
-- Name: gift_card_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_card_codes (
    id uuid NOT NULL,
    code character varying(64) NOT NULL,
    "scopeType" public."enum_gift_card_codes_scopeType" NOT NULL,
    "tenantId" uuid,
    "sourceGiftCardTransactionId" uuid,
    "sourceTenantGiftCardTransactionId" uuid,
    "initialAmount" numeric(10,2) NOT NULL,
    "remainingAmount" numeric(10,2) NOT NULL,
    currency character varying(8) DEFAULT 'SAR'::character varying NOT NULL,
    "recipientEmail" character varying(255),
    "recipientPhone" character varying(64),
    status public.enum_gift_card_codes_status DEFAULT 'issued'::public.enum_gift_card_codes_status NOT NULL,
    "expiresAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.gift_card_codes OWNER TO postgres;

--
-- Name: gift_card_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_card_packages (
    id uuid NOT NULL,
    title_en character varying(255) NOT NULL,
    title_ar character varying(255) NOT NULL,
    description_en text,
    description_ar text,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "priceAmount" numeric(10,2) NOT NULL,
    "walletCreditAmount" numeric(10,2) NOT NULL,
    "bonusAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "imageUrl" character varying(255),
    "startsAt" timestamp with time zone,
    "endsAt" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdByAdminId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.gift_card_packages OWNER TO postgres;

--
-- Name: gift_card_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_card_transactions (
    id uuid NOT NULL,
    "senderPlatformUserId" uuid,
    "recipientPlatformUserId" uuid,
    "recipientEmail" character varying(255),
    "recipientPhone" character varying(255),
    "packageId" uuid NOT NULL,
    "purchaseAmount" numeric(10,2) NOT NULL,
    "creditAmount" numeric(10,2) NOT NULL,
    "bonusAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalCreditAmount" numeric(10,2) NOT NULL,
    status public.enum_gift_card_transactions_status DEFAULT 'purchased'::public.enum_gift_card_transactions_status NOT NULL,
    "deliveryChannel" public."enum_gift_card_transactions_deliveryChannel" DEFAULT 'in_app'::public."enum_gift_card_transactions_deliveryChannel" NOT NULL,
    "claimToken" character varying(255),
    "claimedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "deliveryMode" public."enum_gift_card_transactions_deliveryMode",
    "giftCardCodeId" uuid,
    "recipientResolvedPlatformUserId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.gift_card_transactions OWNER TO postgres;

--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.global_settings (
    id uuid NOT NULL,
    "serviceCommissionRate" numeric(5,2) DEFAULT 10 NOT NULL,
    "productCommissionRate" numeric(5,2) DEFAULT 10 NOT NULL,
    "taxRate" numeric(5,2) DEFAULT 15 NOT NULL,
    "invoiceSellerNameAr" character varying(255),
    "invoiceSellerNameEn" character varying(255),
    "invoiceVatNumber" character varying(64),
    "invoiceCrNumber" character varying(64),
    "invoiceAddressAr" text,
    "invoiceAddressEn" text,
    "invoiceCity" character varying(255),
    "invoiceCountry" character varying(255) DEFAULT 'Saudi Arabia'::character varying NOT NULL,
    "invoiceEmail" character varying(255),
    "invoicePhone" character varying(255),
    "invoicePrefix" character varying(16) DEFAULT 'INV'::character varying NOT NULL,
    "invoiceFooterNoteAr" text,
    "invoiceFooterNoteEn" text,
    "invoiceLogoPath" character varying(255),
    "updatedBy" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.global_settings OWNER TO postgres;

--
-- Name: COLUMN global_settings."serviceCommissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."serviceCommissionRate" IS 'Platform commission rate for services (%)';


--
-- Name: COLUMN global_settings."productCommissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."productCommissionRate" IS 'Platform commission rate for products (%)';


--
-- Name: COLUMN global_settings."taxRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."taxRate" IS 'Global tax rate (VAT) (%)';


--
-- Name: COLUMN global_settings."invoiceSellerNameAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."invoiceSellerNameAr" IS 'Refah legal/business name in Arabic for invoice rendering';


--
-- Name: COLUMN global_settings."invoiceSellerNameEn"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."invoiceSellerNameEn" IS 'Refah legal/business name in English for invoice rendering';


--
-- Name: COLUMN global_settings."invoiceVatNumber"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."invoiceVatNumber" IS 'Refah VAT number for official invoices';


--
-- Name: COLUMN global_settings."invoiceCrNumber"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."invoiceCrNumber" IS 'Refah commercial registration number for official invoices';


--
-- Name: COLUMN global_settings."invoiceAddressAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."invoiceAddressAr" IS 'Refah invoice address in Arabic';


--
-- Name: COLUMN global_settings."invoiceAddressEn"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."invoiceAddressEn" IS 'Refah invoice address in English';


--
-- Name: COLUMN global_settings."updatedBy"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.global_settings."updatedBy" IS 'Super admin who last updated these settings';


--
-- Name: hot_deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_deals (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    service_id uuid NOT NULL,
    title_en character varying(255) NOT NULL,
    title_ar character varying(255) NOT NULL,
    description_en text,
    description_ar text,
    discount_type public.enum_hot_deals_discount_type NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    original_price numeric(10,2) NOT NULL,
    discounted_price numeric(10,2) NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    max_redemptions integer DEFAULT '-1'::integer NOT NULL,
    current_redemptions integer DEFAULT 0 NOT NULL,
    status public.enum_hot_deals_status DEFAULT 'pending'::public.enum_hot_deals_status NOT NULL,
    rejection_reason text,
    approved_by uuid,
    approved_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    image character varying(500)
);


ALTER TABLE public.hot_deals OWNER TO postgres;

--
-- Name: COLUMN hot_deals.discount_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hot_deals.discount_type IS 'percentage = % off, fixed_amount = SAR off';


--
-- Name: COLUMN hot_deals.max_redemptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hot_deals.max_redemptions IS '-1 = unlimited';


--
-- Name: COLUMN hot_deals.image; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hot_deals.image IS 'Uploaded hot deal image path (relative to uploads/)';


--
-- Name: mobile_push_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mobile_push_tokens (
    id uuid NOT NULL,
    token character varying(255) NOT NULL,
    "appType" public."enum_mobile_push_tokens_appType" NOT NULL,
    platform public.enum_mobile_push_tokens_platform DEFAULT 'unknown'::public.enum_mobile_push_tokens_platform NOT NULL,
    "appVersion" character varying(255),
    "deviceName" character varying(255),
    "platformUserId" uuid,
    "staffUserId" uuid,
    "staffId" uuid,
    "tenantId" uuid,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastRegisteredAt" timestamp with time zone NOT NULL,
    "lastSeenAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.mobile_push_tokens OWNER TO postgres;

--
-- Name: notification_delivery_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_delivery_logs (
    id uuid NOT NULL,
    "eventType" character varying(120) NOT NULL,
    "recipientType" public."enum_notification_delivery_logs_recipientType" NOT NULL,
    "recipientId" uuid NOT NULL,
    "tenantId" uuid,
    channel public.enum_notification_delivery_logs_channel NOT NULL,
    status public.enum_notification_delivery_logs_status DEFAULT 'queued'::public.enum_notification_delivery_logs_status NOT NULL,
    reason character varying(255),
    payload jsonb DEFAULT '{}'::jsonb,
    response jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.notification_delivery_logs OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id uuid NOT NULL,
    "orderId" uuid NOT NULL,
    "productId" uuid NOT NULL,
    "productName" character varying(255) NOT NULL,
    "productNameAr" character varying(255),
    "productPrice" numeric(10,2) NOT NULL,
    "productImage" character varying(255),
    "productSku" character varying(255),
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    "totalPrice" numeric(10,2) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: COLUMN order_items."productName"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."productName" IS 'Product name at time of order (snapshot)';


--
-- Name: COLUMN order_items."productNameAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."productNameAr" IS 'Product name in Arabic (snapshot)';


--
-- Name: COLUMN order_items."productPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."productPrice" IS 'Product price at time of order (snapshot)';


--
-- Name: COLUMN order_items."productImage"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."productImage" IS 'Product image at time of order (snapshot)';


--
-- Name: COLUMN order_items."productSku"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."productSku" IS 'Product SKU at time of order (snapshot)';


--
-- Name: COLUMN order_items.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items.quantity IS 'Quantity ordered';


--
-- Name: COLUMN order_items."unitPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."unitPrice" IS 'Price per unit at time of order';


--
-- Name: COLUMN order_items."totalPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.order_items."totalPrice" IS 'Total price for this line item (quantity * unitPrice)';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid NOT NULL,
    "orderNumber" character varying(255) NOT NULL,
    "platformUserId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    status public.enum_orders_status DEFAULT 'pending'::public.enum_orders_status,
    "paymentMethod" public."enum_orders_paymentMethod" NOT NULL,
    "paymentStatus" public."enum_orders_paymentStatus" DEFAULT 'pending'::public."enum_orders_paymentStatus",
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "shippingFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "platformFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "deliveryType" public."enum_orders_deliveryType" DEFAULT 'pickup'::public."enum_orders_deliveryType" NOT NULL,
    "shippingAddress" jsonb,
    "pickupDate" timestamp with time zone,
    "trackingNumber" character varying(255),
    "estimatedDeliveryDate" timestamp with time zone,
    "deliveredAt" timestamp with time zone,
    notes text,
    "tenantNotes" text,
    "cancelledAt" timestamp with time zone,
    "cancellationReason" text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: COLUMN orders."orderNumber"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."orderNumber" IS 'Unique order number (e.g., ORD-2026-001234)';


--
-- Name: COLUMN orders.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.status IS 'Current order status';


--
-- Name: COLUMN orders."paymentMethod"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."paymentMethod" IS 'Payment method selected by customer';


--
-- Name: COLUMN orders."paymentStatus"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."paymentStatus" IS 'Payment status';


--
-- Name: COLUMN orders.subtotal; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.subtotal IS 'Sum of all items before tax';


--
-- Name: COLUMN orders."taxAmount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."taxAmount" IS 'Total tax amount';


--
-- Name: COLUMN orders."shippingFee"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."shippingFee" IS 'Delivery/shipping fee (if applicable)';


--
-- Name: COLUMN orders."platformFee"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."platformFee" IS 'Platform commission';


--
-- Name: COLUMN orders."totalAmount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."totalAmount" IS 'Final total amount (subtotal + tax + shipping - discounts)';


--
-- Name: COLUMN orders."deliveryType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."deliveryType" IS 'Pickup at salon or delivery';


--
-- Name: COLUMN orders."shippingAddress"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."shippingAddress" IS 'Shipping address: {street, city, building, floor, apartment, phone, notes}';


--
-- Name: COLUMN orders."pickupDate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."pickupDate" IS 'When customer will pick up (for pay_on_visit)';


--
-- Name: COLUMN orders."trackingNumber"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."trackingNumber" IS 'Tracking number for shipped orders';


--
-- Name: COLUMN orders."estimatedDeliveryDate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."estimatedDeliveryDate" IS 'Estimated delivery date';


--
-- Name: COLUMN orders."deliveredAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."deliveredAt" IS 'Actual delivery date';


--
-- Name: COLUMN orders.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.notes IS 'Customer notes/instructions';


--
-- Name: COLUMN orders."tenantNotes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."tenantNotes" IS 'Internal notes for tenant';


--
-- Name: COLUMN orders."cancelledAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."cancelledAt" IS 'When order was cancelled';


--
-- Name: COLUMN orders."cancellationReason"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders."cancellationReason" IS 'Reason for cancellation';


--
-- Name: payment_idempotency_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_idempotency_keys (
    id uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    "idempotencyKey" character varying(191) NOT NULL,
    "requestHash" character varying(128) NOT NULL,
    status public.enum_payment_idempotency_keys_status DEFAULT 'processing'::public.enum_payment_idempotency_keys_status NOT NULL,
    "responsePayload" jsonb,
    "errorMessage" character varying(500),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.payment_idempotency_keys OWNER TO postgres;

--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    type public.enum_payment_methods_type NOT NULL,
    "cardLast4" character varying(4),
    "cardBrand" character varying(255),
    "cardExpiry" character varying(7),
    "cardHolderName" character varying(255),
    "stripePaymentMethodId" character varying(255),
    "isDefault" boolean DEFAULT false,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transactions (
    id uuid NOT NULL,
    appointment_id uuid,
    order_id uuid,
    type public.enum_payment_transactions_type NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'SAR'::character varying NOT NULL,
    payment_method public.enum_payment_transactions_payment_method NOT NULL,
    status public.enum_payment_transactions_status DEFAULT 'completed'::public.enum_payment_transactions_status NOT NULL,
    transaction_ref character varying(255),
    gateway_response jsonb DEFAULT '{}'::jsonb,
    processed_by uuid,
    processed_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.payment_transactions OWNER TO postgres;

--
-- Name: COLUMN payment_transactions.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.type IS 'deposit = booking fee online, remainder = at salon, full = paid in full, refund = money back';


--
-- Name: COLUMN payment_transactions.payment_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.payment_method IS 'online = credit card online, cash = at salon, card_pos = POS terminal, wallet = digital wallet, gift_card_code = gift card redemption code';


--
-- Name: COLUMN payment_transactions.transaction_ref; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.transaction_ref IS 'Payment gateway transaction ID';


--
-- Name: COLUMN payment_transactions.gateway_response; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.gateway_response IS 'Full response from payment gateway';


--
-- Name: COLUMN payment_transactions.processed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.processed_by IS 'Staff member who processed (for in-person payments)';


--
-- Name: COLUMN payment_transactions.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.metadata IS 'Additional payment details (notes, receipt URL, etc.)';


--
-- Name: COLUMN payment_transactions.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.notes IS 'Admin/staff notes about this transaction';


--
-- Name: platform_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(255) NOT NULL,
    password character varying(255),
    "firstName" character varying(255) NOT NULL,
    "lastName" character varying(255) NOT NULL,
    "dateOfBirth" date,
    gender public.enum_platform_users_gender,
    "profileImage" character varying(255),
    address_street character varying(255),
    address_city character varying(255),
    address_building character varying(255),
    address_floor character varying(255),
    address_apartment character varying(255),
    address_phone character varying(255),
    address_notes text,
    "preferredLanguage" public."enum_platform_users_preferredLanguage" DEFAULT 'en'::public."enum_platform_users_preferredLanguage",
    "notificationPreferences" jsonb DEFAULT '{"sms": true, "push": true, "email": true, "whatsapp": true}'::jsonb,
    "walletBalance" numeric(10,2) DEFAULT 0,
    "loyaltyPoints" integer DEFAULT 0,
    "totalSpent" numeric(10,2) DEFAULT 0,
    "totalBookings" integer DEFAULT 0,
    "emailVerified" boolean DEFAULT false,
    "phoneVerified" boolean DEFAULT false,
    "emailVerificationToken" character varying(255),
    password_reset_token character varying(255),
    password_reset_token_expires_at timestamp with time zone,
    "phoneVerificationCode" character varying(255),
    "lastLogin" timestamp with time zone,
    "refreshToken" text,
    "isActive" boolean DEFAULT true,
    "isBanned" boolean DEFAULT false,
    "banReason" text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    auth_provider public.enum_platform_users_auth_provider DEFAULT 'local'::public.enum_platform_users_auth_provider NOT NULL,
    google_sub character varying(255),
    google_email character varying(255)
);


ALTER TABLE public.platform_users OWNER TO postgres;

--
-- Name: COLUMN platform_users.address_street; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_street IS 'Street address';


--
-- Name: COLUMN platform_users.address_city; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_city IS 'City';


--
-- Name: COLUMN platform_users.address_building; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_building IS 'Building number/name';


--
-- Name: COLUMN platform_users.address_floor; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_floor IS 'Floor number';


--
-- Name: COLUMN platform_users.address_apartment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_apartment IS 'Apartment number';


--
-- Name: COLUMN platform_users.address_phone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_phone IS 'Phone number for delivery';


--
-- Name: COLUMN platform_users.address_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.platform_users.address_notes IS 'Additional delivery notes';


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name_en character varying(255) NOT NULL,
    name_ar character varying(255) NOT NULL,
    description_en text,
    description_ar text,
    image character varying(255),
    images jsonb DEFAULT '[]'::jsonb,
    "rawPrice" numeric(10,2) NOT NULL,
    "taxRate" numeric(5,2),
    "commissionRate" numeric(5,2),
    price numeric(10,2) NOT NULL,
    category character varying(255) DEFAULT 'general'::character varying NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    sku character varying(255),
    brand character varying(255),
    size character varying(255),
    color character varying(255),
    ingredients text,
    ingredients_en text,
    ingredients_ar text,
    "howToUse_en" text,
    "howToUse_ar" text,
    features_en text,
    features_ar text,
    "isAvailable" boolean DEFAULT true,
    "isFeatured" boolean DEFAULT false,
    "soldCount" integer DEFAULT 0,
    "usedAsGiftCount" integer DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: COLUMN products.name_en; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.name_en IS 'Product name in English';


--
-- Name: COLUMN products.name_ar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.name_ar IS 'Product name in Arabic';


--
-- Name: COLUMN products.description_en; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.description_en IS 'Product description in English';


--
-- Name: COLUMN products.description_ar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.description_ar IS 'Product description in Arabic';


--
-- Name: COLUMN products.image; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.image IS 'Product image path/URL (legacy - use images array instead)';


--
-- Name: COLUMN products.images; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.images IS 'Array of product image paths/URLs (up to 5 images, minimum 1)';


--
-- Name: COLUMN products."rawPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."rawPrice" IS 'Base product price before tax and commission';


--
-- Name: COLUMN products."taxRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."taxRate" IS 'Tax rate applied (read-only, from admin settings)';


--
-- Name: COLUMN products."commissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."commissionRate" IS 'Commission rate applied (read-only, from admin settings)';


--
-- Name: COLUMN products.price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.price IS 'Final product price (rawPrice + tax + commission)';


--
-- Name: COLUMN products.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.category IS 'Product category (e.g., "Hair Care", "Skin Care")';


--
-- Name: COLUMN products.stock; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.stock IS 'Available quantity in inventory';


--
-- Name: COLUMN products.sku; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit (unique identifier)';


--
-- Name: COLUMN products.brand; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.brand IS 'Product brand name';


--
-- Name: COLUMN products.size; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.size IS 'Product size (e.g., "100ml", "Medium")';


--
-- Name: COLUMN products.color; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.color IS 'Product color if applicable';


--
-- Name: COLUMN products.ingredients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.ingredients IS 'Product ingredients or materials (legacy - use ingredients_en/ingredients_ar instead)';


--
-- Name: COLUMN products.ingredients_en; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.ingredients_en IS 'Product ingredients in English';


--
-- Name: COLUMN products.ingredients_ar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.ingredients_ar IS 'Product ingredients in Arabic';


--
-- Name: COLUMN products."howToUse_en"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."howToUse_en" IS 'How to use instructions in English';


--
-- Name: COLUMN products."howToUse_ar"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."howToUse_ar" IS 'How to use instructions in Arabic';


--
-- Name: COLUMN products.features_en; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.features_en IS 'Product features in English (can be JSON array or text)';


--
-- Name: COLUMN products.features_ar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.features_ar IS 'Product features in Arabic (can be JSON array or text)';


--
-- Name: COLUMN products."isAvailable"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."isAvailable" IS 'Whether product is available for sale/gift';


--
-- Name: COLUMN products."isFeatured"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."isFeatured" IS 'Featured products display prominently';


--
-- Name: COLUMN products."soldCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."soldCount" IS 'Total units sold (for analytics)';


--
-- Name: COLUMN products."usedAsGiftCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products."usedAsGiftCount" IS 'Times used as gift in services';


--
-- Name: public_page_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.public_page_data (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "aboutUs_heroImage" character varying(500),
    "aboutUs_storyTitle" character varying(100) DEFAULT 'ourStory'::character varying,
    "aboutUs_storyEn" text,
    "aboutUs_storyAr" text,
    "aboutUs_missions" jsonb DEFAULT '[]'::jsonb,
    "aboutUs_visions" jsonb DEFAULT '[]'::jsonb,
    "aboutUs_values" jsonb DEFAULT '[]'::jsonb,
    "aboutUs_facilitiesDescriptionEn" text,
    "aboutUs_facilitiesDescriptionAr" text,
    "aboutUs_facilitiesImages" jsonb DEFAULT '[]'::jsonb,
    "aboutUs_finalWordTitleEn" character varying(200),
    "aboutUs_finalWordTitleAr" character varying(200),
    "aboutUs_finalWordTextEn" text,
    "aboutUs_finalWordTextAr" text,
    "aboutUs_finalWordType" character varying(20) DEFAULT 'image'::character varying,
    "aboutUs_finalWordImageUrl" character varying(500),
    "aboutUs_finalWordIconName" character varying(100),
    "heroSliders" jsonb DEFAULT '[]'::jsonb,
    "homePage_data" jsonb DEFAULT '{}'::jsonb,
    "contactUs_data" jsonb DEFAULT '{}'::jsonb,
    "pageBanner_services" character varying(500),
    "pageBanner_products" character varying(500),
    "pageBanner_about" character varying(500),
    "pageBanner_contact" character varying(500),
    "generalSettings" jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.public_page_data OWNER TO postgres;

--
-- Name: COLUMN public_page_data."aboutUs_heroImage"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_heroImage" IS 'Hero section banner image (recommended: 1920x600px)';


--
-- Name: COLUMN public_page_data."aboutUs_storyTitle"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_storyTitle" IS 'Title for story section: ourStory, aboutUs, whoWeAre, ourJourney';


--
-- Name: COLUMN public_page_data."aboutUs_storyEn"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_storyEn" IS 'Our story in English';


--
-- Name: COLUMN public_page_data."aboutUs_storyAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_storyAr" IS 'Our story in Arabic';


--
-- Name: COLUMN public_page_data."aboutUs_missions"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_missions" IS 'Array of mission objects with bilingual content, icon/image support';


--
-- Name: COLUMN public_page_data."aboutUs_visions"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_visions" IS 'Array of vision objects with bilingual content, icon/image support';


--
-- Name: COLUMN public_page_data."aboutUs_values"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_values" IS 'Array of value objects with bilingual content, icon/image support';


--
-- Name: COLUMN public_page_data."aboutUs_facilitiesDescriptionEn"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_facilitiesDescriptionEn" IS 'Facilities description in English';


--
-- Name: COLUMN public_page_data."aboutUs_facilitiesDescriptionAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_facilitiesDescriptionAr" IS 'Facilities description in Arabic';


--
-- Name: COLUMN public_page_data."aboutUs_facilitiesImages"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_facilitiesImages" IS 'Array of facility image URLs (up to 10 images, FHD landscape)';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordTitleEn"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordTitleEn" IS 'Final word title in English';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordTitleAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordTitleAr" IS 'Final word title in Arabic';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordTextEn"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordTextEn" IS 'Final word text in English';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordTextAr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordTextAr" IS 'Final word text in Arabic';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordType" IS 'Final word display type: image or icon';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordImageUrl"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordImageUrl" IS 'Final word image URL';


--
-- Name: COLUMN public_page_data."aboutUs_finalWordIconName"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."aboutUs_finalWordIconName" IS 'Final word icon name (Heroicons)';


--
-- Name: COLUMN public_page_data."heroSliders"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."heroSliders" IS 'Array of hero slider objects with background image, text content, CTA buttons, and alignment settings';


--
-- Name: COLUMN public_page_data."homePage_data"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."homePage_data" IS 'Home page data';


--
-- Name: COLUMN public_page_data."contactUs_data"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."contactUs_data" IS 'Contact us page data';


--
-- Name: COLUMN public_page_data."pageBanner_services"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."pageBanner_services" IS 'Banner image for Services page (recommended: 1920x400px)';


--
-- Name: COLUMN public_page_data."pageBanner_products"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."pageBanner_products" IS 'Banner image for Products page (recommended: 1920x400px)';


--
-- Name: COLUMN public_page_data."pageBanner_about"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."pageBanner_about" IS 'Banner image for About Us page (recommended: 1920x400px)';


--
-- Name: COLUMN public_page_data."pageBanner_contact"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."pageBanner_contact" IS 'Banner image for Contact page (recommended: 1920x400px)';


--
-- Name: COLUMN public_page_data."generalSettings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.public_page_data."generalSettings" IS 'General public page settings';


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    staff_id uuid,
    appointment_id uuid,
    platform_user_id uuid,
    customer_name character varying(255),
    rating smallint NOT NULL,
    comment text,
    staff_reply text,
    staff_replied_at timestamp with time zone,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_categories (
    id uuid NOT NULL,
    name_en character varying(255) NOT NULL,
    name_ar character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    icon character varying(255),
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.service_categories OWNER TO postgres;

--
-- Name: service_employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_employees (
    id uuid NOT NULL,
    "serviceId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "commissionRate" numeric(5,2),
    "commissionType" character varying(20),
    "commissionValue" numeric(10,2),
    "isPrimary" boolean DEFAULT false,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.service_employees OWNER TO postgres;

--
-- Name: COLUMN service_employees."commissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.service_employees."commissionRate" IS 'Custom commission rate for this employee on this service (overrides default)';


--
-- Name: COLUMN service_employees."commissionType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.service_employees."commissionType" IS 'Commission type for this service assignment: fixed or percentage';


--
-- Name: COLUMN service_employees."commissionValue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.service_employees."commissionValue" IS 'Commission value for this service assignment';


--
-- Name: COLUMN service_employees."isPrimary"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.service_employees."isPrimary" IS 'Whether this employee is the primary provider for this service';


--
-- Name: COLUMN service_employees.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.service_employees.notes IS 'Additional notes about this employee-service assignment';


--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id uuid NOT NULL,
    "tenantId" uuid,
    name_en character varying(255) NOT NULL,
    name_ar character varying(255) NOT NULL,
    description_en text,
    description_ar text,
    image character varying(255),
    includes json DEFAULT '[]'::json,
    category character varying(255) DEFAULT 'general'::character varying NOT NULL,
    duration integer DEFAULT 30 NOT NULL,
    "rawPrice" numeric(10,2) DEFAULT 0,
    "taxRate" numeric(5,2) DEFAULT 15,
    "commissionRate" numeric(5,2) DEFAULT 10,
    "finalPrice" numeric(10,2) DEFAULT 0,
    "basePrice" numeric(10,2),
    "minPrice" numeric(10,2),
    "maxPrice" numeric(10,2),
    "hasOffer" boolean DEFAULT false,
    "offerDetails" text,
    "hasGift" boolean DEFAULT false,
    "giftType" public."enum_services_giftType",
    "giftDetails" text,
    "isActive" boolean DEFAULT true,
    "availableInCenter" boolean DEFAULT true,
    "availableHomeVisit" boolean DEFAULT false,
    "allowReschedule" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "targetGender" character varying(20) DEFAULT 'all'::character varying NOT NULL,
    "priceType" character varying(20) DEFAULT 'fixed'::character varying NOT NULL,
    variants jsonb DEFAULT '[]'::jsonb,
    "paymentOptions" jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: COLUMN services.image; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services.image IS 'Service thumbnail image path';


--
-- Name: COLUMN services.includes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services.includes IS 'Array of sub-service items (e.g., ["Shampoo", "Blow-dry"])';


--
-- Name: COLUMN services."rawPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."rawPrice" IS 'Base service price before tax and commission';


--
-- Name: COLUMN services."taxRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."taxRate" IS 'Tax rate percentage (default 15% Saudi VAT)';


--
-- Name: COLUMN services."commissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."commissionRate" IS 'System commission rate percentage';


--
-- Name: COLUMN services."finalPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."finalPrice" IS 'Final price = rawPrice + (rawPrice * taxRate/100) + (rawPrice * commissionRate/100)';


--
-- Name: COLUMN services."offerDetails"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."offerDetails" IS 'Offer description (e.g., "20% off this month")';


--
-- Name: COLUMN services."giftType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."giftType" IS 'Gift type: free text description or product selection';


--
-- Name: COLUMN services."giftDetails"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."giftDetails" IS 'Gift description or product ID';


--
-- Name: COLUMN services."availableInCenter"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."availableInCenter" IS 'Service available at the center/salon location';


--
-- Name: COLUMN services."availableHomeVisit"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."availableHomeVisit" IS 'Service available as home visit';


--
-- Name: COLUMN services."allowReschedule"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."allowReschedule" IS 'Allow customer to reschedule appointments for this service';


--
-- Name: COLUMN services."targetGender"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."targetGender" IS 'Who the service is intended for: all, female, or male';


--
-- Name: COLUMN services."paymentOptions"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services."paymentOptions" IS 'Array of allowed booking payment methods for the service';


--
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "position" character varying(80),
    "dashboardPermissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    gender character varying(32),
    "spokenLanguages" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "serviceCommissionEnabled" boolean DEFAULT false NOT NULL,
    "productCommissionEnabled" boolean DEFAULT false NOT NULL,
    email character varying(255),
    "isActive" boolean DEFAULT true NOT NULL,
    bio text,
    commission numeric(5,2) DEFAULT 0 NOT NULL,
    "commissionRate" numeric(5,2) DEFAULT 0 NOT NULL,
    experience character varying(255),
    nationality character varying(255),
    phone character varying(255),
    photo character varying(255),
    rating numeric(3,2) DEFAULT 5 NOT NULL,
    salary numeric(10,2) DEFAULT 0 NOT NULL,
    "scheduleVisibilityWeeks" integer DEFAULT 1 NOT NULL,
    skills jsonb DEFAULT '[]'::jsonb NOT NULL,
    "totalBookings" integer DEFAULT 0 NOT NULL,
    "workingHours" jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- Name: staff_breaks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_breaks (
    id uuid NOT NULL,
    staff_id uuid NOT NULL,
    day_of_week integer,
    specific_date date,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    type public.enum_staff_breaks_type DEFAULT 'lunch'::public.enum_staff_breaks_type,
    label character varying(255),
    is_recurring boolean DEFAULT true,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.staff_breaks OWNER TO postgres;

--
-- Name: COLUMN staff_breaks.day_of_week; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.day_of_week IS 'Day of week for recurring breaks. null = date-specific break';


--
-- Name: COLUMN staff_breaks.specific_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.specific_date IS 'Specific date for one-time breaks. null = recurring';


--
-- Name: COLUMN staff_breaks.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.type IS 'Type of break';


--
-- Name: COLUMN staff_breaks.label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.label IS 'Break label: "Lunch Break", "Prayer Time", "Cleaning Time", etc.';


--
-- Name: COLUMN staff_breaks.is_recurring; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.is_recurring IS 'If true, break repeats weekly. If false, use specificDate';


--
-- Name: COLUMN staff_breaks.start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.start_date IS 'Start date for recurring breaks (null = starts immediately)';


--
-- Name: COLUMN staff_breaks.end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_breaks.end_date IS 'End date for recurring breaks (null = no end date)';


--
-- Name: staff_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_messages (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    sender_type character varying(255) NOT NULL,
    sender_id uuid NOT NULL,
    recipient_type character varying(255),
    recipient_id uuid,
    subject character varying(200),
    body text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    read_by jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.staff_messages OWNER TO postgres;

--
-- Name: staff_payrolls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_payrolls (
    id uuid NOT NULL,
    staff_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    base_salary numeric(10,2) DEFAULT 0 NOT NULL,
    commission numeric(10,2) DEFAULT 0 NOT NULL,
    tips_total numeric(10,2) DEFAULT 0 NOT NULL,
    bonuses numeric(10,2) DEFAULT 0 NOT NULL,
    deductions numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    notes text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.staff_payrolls OWNER TO postgres;

--
-- Name: staff_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_permissions (
    id uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    permissions jsonb DEFAULT '{"view_clients": false, "view_reviews": true, "reply_reviews": false, "view_earnings": false, "can_mark_no_show": true, "can_start_service": true, "view_booking_notes": false}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.staff_permissions OWNER TO postgres;

--
-- Name: staff_schedule_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_schedule_overrides (
    id uuid NOT NULL,
    staff_id uuid NOT NULL,
    date date NOT NULL,
    type public.enum_staff_schedule_overrides_type DEFAULT 'override'::public.enum_staff_schedule_overrides_type,
    start_time time without time zone,
    end_time time without time zone,
    is_available boolean DEFAULT true,
    reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.staff_schedule_overrides OWNER TO postgres;

--
-- Name: COLUMN staff_schedule_overrides.date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_schedule_overrides.date IS 'Specific date for this override';


--
-- Name: COLUMN staff_schedule_overrides.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_schedule_overrides.type IS 'override = replace normal schedule, exception = add special hours';


--
-- Name: COLUMN staff_schedule_overrides.start_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_schedule_overrides.start_time IS 'Override start time. null = day off';


--
-- Name: COLUMN staff_schedule_overrides.end_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_schedule_overrides.end_time IS 'Override end time. null = day off';


--
-- Name: COLUMN staff_schedule_overrides.is_available; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_schedule_overrides.is_available IS 'false = day off, true = available (with override hours if provided)';


--
-- Name: COLUMN staff_schedule_overrides.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_schedule_overrides.reason IS 'Reason for override: "Ramadan hours", "Holiday", "Special event", etc.';


--
-- Name: staff_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_schedules (
    id uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone NOT NULL,
    "isAvailable" boolean DEFAULT true,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.staff_schedules OWNER TO postgres;

--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_shifts (
    id uuid NOT NULL,
    staff_id uuid NOT NULL,
    day_of_week integer,
    specific_date date,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_recurring boolean DEFAULT true,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true,
    label character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.staff_shifts OWNER TO postgres;

--
-- Name: COLUMN staff_shifts.day_of_week; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_shifts.day_of_week IS 'Day of week for recurring shifts (0=Sunday, 6=Saturday). null = date-specific shift';


--
-- Name: COLUMN staff_shifts.specific_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_shifts.specific_date IS 'Specific date for one-time shifts. null = recurring';


--
-- Name: COLUMN staff_shifts.is_recurring; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_shifts.is_recurring IS 'If true, shift repeats weekly. If false, use specificDate';


--
-- Name: COLUMN staff_shifts.start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_shifts.start_date IS 'Start date for recurring shifts (null = starts immediately)';


--
-- Name: COLUMN staff_shifts.end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_shifts.end_date IS 'End date for recurring shifts (null = no end date)';


--
-- Name: COLUMN staff_shifts.label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_shifts.label IS 'Optional label: "Morning Shift", "Evening Shift", etc.';


--
-- Name: staff_time_off; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_time_off (
    id uuid NOT NULL,
    staff_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    type public.enum_staff_time_off_type DEFAULT 'vacation'::public.enum_staff_time_off_type,
    reason text,
    is_approved boolean DEFAULT true,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.staff_time_off OWNER TO postgres;

--
-- Name: COLUMN staff_time_off.start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_time_off.start_date IS 'Start date of time off';


--
-- Name: COLUMN staff_time_off.end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_time_off.end_date IS 'End date of time off (inclusive)';


--
-- Name: COLUMN staff_time_off.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_time_off.type IS 'Type of time off';


--
-- Name: COLUMN staff_time_off.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_time_off.reason IS 'Reason for time off';


--
-- Name: COLUMN staff_time_off.is_approved; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_time_off.is_approved IS 'For future approval workflow';


--
-- Name: COLUMN staff_time_off.approved_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_time_off.approved_by IS 'Tenant user ID who approved (for future)';


--
-- Name: subscription_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_packages (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    name_ar character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    description_ar text,
    "monthlyPrice" numeric(10,2) DEFAULT 0 NOT NULL,
    "sixMonthPrice" numeric(10,2) DEFAULT 0 NOT NULL,
    "annualPrice" numeric(10,2) DEFAULT 0 NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    "platformCommission" numeric(5,2) DEFAULT 5 NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isFeatured" boolean DEFAULT false NOT NULL,
    "isCustom" boolean DEFAULT false NOT NULL,
    "customTenantId" uuid,
    "createdBy" uuid,
    "updatedBy" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.subscription_packages OWNER TO postgres;

--
-- Name: COLUMN subscription_packages.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages.name IS 'Package name in English (Free, Basic, Standard, Premium, Enterprise)';


--
-- Name: COLUMN subscription_packages.name_ar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages.name_ar IS 'Package name in Arabic';


--
-- Name: COLUMN subscription_packages.slug; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages.slug IS 'URL-friendly identifier (free, basic, standard, premium, enterprise)';


--
-- Name: COLUMN subscription_packages.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages.description IS 'Package description in English';


--
-- Name: COLUMN subscription_packages.description_ar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages.description_ar IS 'Package description in Arabic';


--
-- Name: COLUMN subscription_packages."monthlyPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."monthlyPrice" IS 'Price per month for monthly billing';


--
-- Name: COLUMN subscription_packages."sixMonthPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."sixMonthPrice" IS 'Total price for 6 months (with discount)';


--
-- Name: COLUMN subscription_packages."annualPrice"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."annualPrice" IS 'Total price for 12 months (with discount)';


--
-- Name: COLUMN subscription_packages.limits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages.limits IS 'Package limits and features';


--
-- Name: COLUMN subscription_packages."platformCommission"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."platformCommission" IS 'Platform commission percentage for this package';


--
-- Name: COLUMN subscription_packages."displayOrder"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."displayOrder" IS 'Order in which packages are displayed';


--
-- Name: COLUMN subscription_packages."isActive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."isActive" IS 'Whether this package is available for new subscriptions';


--
-- Name: COLUMN subscription_packages."isFeatured"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."isFeatured" IS 'Highlight this package (Most Popular)';


--
-- Name: COLUMN subscription_packages."isCustom"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."isCustom" IS 'Is this a custom package for specific tenant?';


--
-- Name: COLUMN subscription_packages."customTenantId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."customTenantId" IS 'If custom package, which tenant is it for?';


--
-- Name: COLUMN subscription_packages."createdBy"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."createdBy" IS 'Super admin who created this package';


--
-- Name: COLUMN subscription_packages."updatedBy"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscription_packages."updatedBy" IS 'Super admin who last updated this package';


--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.super_admins (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    "firstName" character varying(255) NOT NULL,
    "lastName" character varying(255) NOT NULL,
    role public.enum_super_admins_role DEFAULT 'admin'::public.enum_super_admins_role,
    permissions jsonb DEFAULT '{"users": {"edit": true, "view": true, "create": false, "delete": false}, "tenants": {"edit": true, "view": true, "create": true, "delete": false, "approve": true}, "settings": {"edit": false, "view": true}, "financial": {"view": true, "export": true, "refund": false}}'::jsonb,
    "isActive" boolean DEFAULT true,
    "lastLoginAt" timestamp with time zone,
    "lastLoginIP" character varying(255),
    "profileImage" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.super_admins OWNER TO postgres;

--
-- Name: support_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "superAdminId" uuid,
    "displayName" character varying(255) NOT NULL,
    "displayNameAr" character varying(255),
    title character varying(128),
    "avatarUrl" character varying(1000),
    status public.enum_support_agents_status DEFAULT 'active'::public.enum_support_agents_status NOT NULL,
    "presenceStatus" public."enum_support_agents_presenceStatus" DEFAULT 'offline'::public."enum_support_agents_presenceStatus" NOT NULL,
    "supportedLanguages" jsonb DEFAULT '["ar", "en"]'::jsonb NOT NULL,
    skills jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "lastSeenAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


ALTER TABLE public.support_agents OWNER TO postgres;

--
-- Name: support_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "supportTicketId" uuid NOT NULL,
    "supportMessageId" uuid,
    "uploadedByType" public."enum_support_attachments_uploadedByType" DEFAULT 'customer'::public."enum_support_attachments_uploadedByType" NOT NULL,
    "customerPlatformUserId" uuid,
    "supportAgentId" uuid,
    "fileName" character varying(255) NOT NULL,
    "originalName" character varying(255) NOT NULL,
    "mimeType" character varying(255) NOT NULL,
    "fileCategory" public."enum_support_attachments_fileCategory" NOT NULL,
    "storageProvider" character varying(64) DEFAULT 'local'::character varying NOT NULL,
    "storagePath" character varying(1000) NOT NULL,
    "storageUrl" character varying(1000),
    "fileSize" bigint DEFAULT 0 NOT NULL,
    checksum character varying(128),
    caption text,
    "isInline" boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


ALTER TABLE public.support_attachments OWNER TO postgres;

--
-- Name: support_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid,
    slug character varying(120) NOT NULL,
    scope public.enum_support_categories_scope DEFAULT 'global'::public.enum_support_categories_scope NOT NULL,
    name character varying(255) NOT NULL,
    "nameAr" character varying(255),
    description text,
    "descriptionAr" text,
    icon character varying(120),
    color character varying(32),
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone,
    "parentId" uuid,
    "featureKey" character varying(160),
    "featureRoute" character varying(255)
);


ALTER TABLE public.support_categories OWNER TO postgres;

--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "supportTicketId" uuid NOT NULL,
    "replyToMessageId" uuid,
    "senderType" public."enum_support_messages_senderType" NOT NULL,
    "customerPlatformUserId" uuid,
    "supportAgentId" uuid,
    content text NOT NULL,
    language public.enum_support_messages_language DEFAULT 'ar'::public.enum_support_messages_language NOT NULL,
    "contentFormat" public."enum_support_messages_contentFormat" DEFAULT 'plain'::public."enum_support_messages_contentFormat" NOT NULL,
    visibility public.enum_support_messages_visibility DEFAULT 'public'::public.enum_support_messages_visibility NOT NULL,
    "isEdited" boolean DEFAULT false NOT NULL,
    "editedAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


ALTER TABLE public.support_messages OWNER TO postgres;

--
-- Name: support_ticket_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_ticket_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "supportTicketId" uuid NOT NULL,
    "supportMessageId" uuid,
    "supportAttachmentId" uuid,
    "actorType" public."enum_support_ticket_events_actorType" DEFAULT 'system'::public."enum_support_ticket_events_actorType" NOT NULL,
    "customerPlatformUserId" uuid,
    "supportAgentId" uuid,
    "eventType" public."enum_support_ticket_events_eventType" NOT NULL,
    "fromStatus" public."enum_support_ticket_events_fromStatus",
    "toStatus" public."enum_support_ticket_events_toStatus",
    "fromPriority" public."enum_support_ticket_events_fromPriority",
    "toPriority" public."enum_support_ticket_events_toPriority",
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    "occurredAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.support_ticket_events OWNER TO postgres;

--
-- Name: support_ticket_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_ticket_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "ticketId" uuid NOT NULL,
    "entityType" character varying(120) NOT NULL,
    "entityId" uuid NOT NULL,
    "createdBy" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.support_ticket_links OWNER TO postgres;

--
-- Name: support_ticket_notification_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_ticket_notification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "supportTicketId" uuid NOT NULL,
    "supportMessageId" uuid,
    "eventType" character varying(120) NOT NULL,
    "recipientType" character varying(40) NOT NULL,
    "recipientId" uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    "deliveryState" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "processedAt" timestamp with time zone,
    "failedAt" timestamp with time zone,
    "failureReason" character varying(255),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.support_ticket_notification_events OWNER TO postgres;

--
-- Name: support_ticket_read_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_ticket_read_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "supportTicketId" uuid NOT NULL,
    "participantType" character varying(40) NOT NULL,
    "participantId" uuid,
    "lastReadMessageId" uuid,
    "lastReadAt" timestamp with time zone,
    "unreadCount" integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.support_ticket_read_states OWNER TO postgres;

--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "ticketNumber" character varying(40) NOT NULL,
    "tenantId" uuid NOT NULL,
    "customerPlatformUserId" uuid,
    "supportCategoryId" uuid,
    "assignedSupportAgentId" uuid,
    "sourceChannel" public."enum_support_tickets_sourceChannel" DEFAULT 'customer_app'::public."enum_support_tickets_sourceChannel" NOT NULL,
    status public.enum_support_tickets_status DEFAULT 'draft'::public.enum_support_tickets_status NOT NULL,
    priority public.enum_support_tickets_priority DEFAULT 'medium'::public.enum_support_tickets_priority NOT NULL,
    language public.enum_support_tickets_language DEFAULT 'ar'::public.enum_support_tickets_language NOT NULL,
    subject character varying(255) NOT NULL,
    "subjectAr" character varying(255),
    description text,
    "descriptionAr" text,
    "lastMessageAt" timestamp with time zone,
    "firstResponseAt" timestamp with time zone,
    "resolvedAt" timestamp with time zone,
    "closedAt" timestamp with time zone,
    "reopenedAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone,
    source public.enum_support_tickets_source DEFAULT 'dashboard'::public.enum_support_tickets_source NOT NULL
);


ALTER TABLE public.support_tickets OWNER TO postgres;

--
-- Name: tenant_dashboard_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_dashboard_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    "displayName" character varying(120) NOT NULL,
    "roleKey" character varying(50) DEFAULT 'custom'::character varying NOT NULL,
    permissions jsonb DEFAULT '{"view_dashboard": true}'::jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "passwordResetRequired" boolean DEFAULT false NOT NULL,
    "lastLoginAt" timestamp with time zone,
    "lastLoginIP" character varying(120),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_dashboard_accounts OWNER TO postgres;

--
-- Name: tenant_feature_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_feature_usage (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    feature_key character varying(64) NOT NULL,
    month character varying(7) NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_feature_usage OWNER TO postgres;

--
-- Name: COLUMN tenant_feature_usage.month; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_feature_usage.month IS 'Usage month in YYYY-MM format';


--
-- Name: tenant_gift_card_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_gift_card_packages (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    title_en character varying(255) NOT NULL,
    title_ar character varying(255) NOT NULL,
    description_en text,
    description_ar text,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "priceAmount" numeric(10,2) NOT NULL,
    "walletCreditAmount" numeric(10,2) NOT NULL,
    "bonusAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "imageUrl" character varying(255),
    "thumbnailUrl" character varying(255),
    "startsAt" timestamp with time zone,
    "endsAt" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdByTenantUserId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    title character varying(255),
    description text,
    "discountPreset" character varying(255),
    "discountPercent" numeric(10,2) DEFAULT 0,
    "expirationPreset" character varying(255)
);


ALTER TABLE public.tenant_gift_card_packages OWNER TO postgres;

--
-- Name: tenant_gift_card_settlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_gift_card_settlements (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "transactionId" uuid NOT NULL,
    "packageId" uuid NOT NULL,
    "grossAmount" numeric(10,2) NOT NULL,
    "platformFeeAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "netTenantPayableAmount" numeric(10,2) NOT NULL,
    "settledAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    status public.enum_tenant_gift_card_settlements_status DEFAULT 'pending'::public.enum_tenant_gift_card_settlements_status NOT NULL,
    "settledAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_gift_card_settlements OWNER TO postgres;

--
-- Name: tenant_gift_card_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_gift_card_transactions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "packageId" uuid NOT NULL,
    "senderPlatformUserId" uuid,
    "recipientPlatformUserId" uuid,
    "recipientEmail" character varying(255),
    "recipientPhone" character varying(255),
    "purchaseAmount" numeric(10,2) NOT NULL,
    "creditAmount" numeric(10,2) NOT NULL,
    "bonusAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalCreditAmount" numeric(10,2) NOT NULL,
    status public.enum_tenant_gift_card_transactions_status DEFAULT 'purchased'::public.enum_tenant_gift_card_transactions_status NOT NULL,
    "deliveryChannel" public."enum_tenant_gift_card_transactions_deliveryChannel" DEFAULT 'in_app'::public."enum_tenant_gift_card_transactions_deliveryChannel" NOT NULL,
    "claimToken" character varying(255),
    "claimedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "deliveryMode" public."enum_tenant_gift_card_transactions_deliveryMode",
    "giftCardCodeId" uuid,
    "recipientResolvedPlatformUserId" uuid,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_gift_card_transactions OWNER TO postgres;

--
-- Name: tenant_operational_alert_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_operational_alert_reads (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "readerId" uuid NOT NULL,
    "alertKey" character varying(255) NOT NULL,
    "readAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_operational_alert_reads OWNER TO postgres;

--
-- Name: tenant_push_campaign_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_push_campaign_recipients (
    id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    platform_user_id uuid NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_push_campaign_recipients OWNER TO postgres;

--
-- Name: tenant_push_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_push_campaigns (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    data jsonb,
    audience_type character varying(32) DEFAULT 'selected'::character varying NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_push_campaigns OWNER TO postgres;

--
-- Name: tenant_push_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_push_usage (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    month character varying(7) NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_push_usage OWNER TO postgres;

--
-- Name: tenant_saved_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_saved_reports (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "createdByUserId" uuid,
    "reportType" character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    "selectedMetrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "grouping" character varying(64),
    sorting jsonb DEFAULT '{}'::jsonb NOT NULL,
    "reportConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isFavorite" boolean DEFAULT false NOT NULL,
    "duplicatedFromId" uuid,
    "lastOpenedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb NOT NULL,
    "scheduleConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "lastRunAt" timestamp with time zone,
    "nextRunAt" timestamp with time zone,
    "lastRunResult" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "runHistory" jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.tenant_saved_reports OWNER TO postgres;

--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_settings (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "commissionRate" numeric(5,2),
    "taxRate" numeric(5,2) DEFAULT 15,
    currency character varying(3) DEFAULT 'SAR'::character varying,
    "businessHours" json DEFAULT '{}'::json,
    timezone character varying(255) DEFAULT 'Asia/Riyadh'::character varying,
    "bookingSettings" jsonb DEFAULT '{"noShowPolicy": "warn", "slotInterval": 15, "allowAnyStaff": true, "allowWalkInBooking": true, "cancellationWindow": 24, "defaultBufferAfter": 5, "defaultBufferBefore": 5, "requirePhoneVerification": false, "maxBookingsPerCustomerPerDay": null}'::jsonb,
    "autoApproveBookings" boolean DEFAULT true,
    "bufferTime" integer DEFAULT 15,
    "maxAdvanceBookingDays" integer DEFAULT 30,
    "cancellationPolicy" text,
    "cancellationHours" integer DEFAULT 24,
    "paymentSettings" json DEFAULT '{"acceptCash":true,"acceptCard":true,"acceptWallet":true,"allowServicePayAtCenter":true,"allowServiceFullOnline":true,"allowServiceDeposit":true,"serviceDepositMode":"fixed","serviceDepositFixedAmount":50,"serviceDepositPercentage":50,"allowProductOnline":true,"allowProductPayOnPickup":true,"allowProductCashOnDelivery":true,"defaultDeliveryFee":25}'::json,
    "acceptCash" boolean DEFAULT true,
    "acceptCard" boolean DEFAULT true,
    "acceptWallet" boolean DEFAULT true,
    "payoutBankAccount" json,
    "notificationSettings" json DEFAULT '{}'::json,
    "enableEmailNotifications" boolean DEFAULT true,
    "enableSmsNotifications" boolean DEFAULT false,
    "enableWhatsAppNotifications" boolean DEFAULT false,
    "enableVoiceAlerts" boolean DEFAULT true,
    features json DEFAULT '{}'::json,
    "subscriptionTier" public."enum_tenant_settings_subscriptionTier" DEFAULT 'basic'::public."enum_tenant_settings_subscriptionTier",
    "subscriptionExpiresAt" timestamp with time zone,
    "defaultLanguage" character varying(2) DEFAULT 'ar'::character varying,
    "supportedLanguages" json DEFAULT '["ar","en"]'::json,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "dashboardSettings" jsonb DEFAULT '{"defaultLandingPage": "home"}'::jsonb NOT NULL
);


ALTER TABLE public.tenant_settings OWNER TO postgres;

--
-- Name: COLUMN tenant_settings."commissionRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."commissionRate" IS 'Tenant-specific commission rate (overrides global rate)';


--
-- Name: COLUMN tenant_settings."taxRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."taxRate" IS 'Tax rate (default 15% for Saudi VAT)';


--
-- Name: COLUMN tenant_settings.currency; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings.currency IS 'Currency code (ISO 4217)';


--
-- Name: COLUMN tenant_settings."businessHours"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."businessHours" IS 'Operating hours: { "sunday": { "open": "09:00", "close": "21:00", "isOpen": true }, ... }';


--
-- Name: COLUMN tenant_settings.timezone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings.timezone IS 'Timezone for scheduling';


--
-- Name: COLUMN tenant_settings."bookingSettings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."bookingSettings" IS 'Booking preferences: slot interval, buffers, policies, etc.';


--
-- Name: COLUMN tenant_settings."autoApproveBookings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."autoApproveBookings" IS 'Auto-approve bookings or require manual approval';


--
-- Name: COLUMN tenant_settings."bufferTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."bufferTime" IS 'Buffer time between appointments (minutes)';


--
-- Name: COLUMN tenant_settings."maxAdvanceBookingDays"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."maxAdvanceBookingDays" IS 'Maximum days in advance for bookings';


--
-- Name: COLUMN tenant_settings."cancellationPolicy"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."cancellationPolicy" IS 'Cancellation policy text';


--
-- Name: COLUMN tenant_settings."cancellationHours"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."cancellationHours" IS 'Minimum hours before appointment for cancellation';


--
-- Name: COLUMN tenant_settings."paymentSettings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."paymentSettings" IS 'Payment methods and tenant payment policy for bookings/orders';


--
-- Name: COLUMN tenant_settings."payoutBankAccount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."payoutBankAccount" IS 'Bank account details for payouts';


--
-- Name: COLUMN tenant_settings."notificationSettings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."notificationSettings" IS 'Notification preferences';


--
-- Name: COLUMN tenant_settings."enableVoiceAlerts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."enableVoiceAlerts" IS 'Voice notification for new appointments';


--
-- Name: COLUMN tenant_settings.features; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings.features IS 'Enabled features: { "whatsapp": true, "sms": false, "analytics": true }';


--
-- Name: COLUMN tenant_settings."subscriptionTier"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."subscriptionTier" IS 'Subscription tier';


--
-- Name: COLUMN tenant_settings."subscriptionExpiresAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."subscriptionExpiresAt" IS 'Subscription expiry date';


--
-- Name: COLUMN tenant_settings."defaultLanguage"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."defaultLanguage" IS 'Default language (ar or en)';


--
-- Name: COLUMN tenant_settings."supportedLanguages"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."supportedLanguages" IS 'Supported languages';


--
-- Name: COLUMN tenant_settings."dashboardSettings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_settings."dashboardSettings" IS 'Tenant dashboard preferences such as default landing page';


--
-- Name: tenant_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_subscriptions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "packageId" uuid NOT NULL,
    "billingCycle" public."enum_tenant_subscriptions_billingCycle" DEFAULT 'monthly'::public."enum_tenant_subscriptions_billingCycle" NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'SAR'::character varying NOT NULL,
    status public.enum_tenant_subscriptions_status DEFAULT 'trial'::public.enum_tenant_subscriptions_status NOT NULL,
    "trialEndsAt" timestamp with time zone,
    "currentPeriodStart" timestamp with time zone NOT NULL,
    "currentPeriodEnd" timestamp with time zone NOT NULL,
    "autoRenew" boolean DEFAULT true NOT NULL,
    "nextBillingDate" timestamp with time zone,
    "gracePeriodEnds" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "cancelledBy" uuid,
    "cancellationReason" text,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "stripeSubscriptionId" character varying(255),
    "stripeCustomerId" character varying(255),
    "lastPaymentStatus" public."enum_tenant_subscriptions_lastPaymentStatus",
    "lastPaymentDate" timestamp with time zone,
    "lastPaymentAmount" numeric(10,2),
    metadata jsonb DEFAULT '{}'::jsonb,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_subscriptions OWNER TO postgres;

--
-- Name: COLUMN tenant_subscriptions."billingCycle"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."billingCycle" IS 'How often they are billed';


--
-- Name: COLUMN tenant_subscriptions.amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions.amount IS 'Amount paid for this subscription period';


--
-- Name: COLUMN tenant_subscriptions.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions.status IS 'Current subscription status';


--
-- Name: COLUMN tenant_subscriptions."trialEndsAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."trialEndsAt" IS 'When trial period ends (if applicable)';


--
-- Name: COLUMN tenant_subscriptions."currentPeriodStart"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."currentPeriodStart" IS 'Start of current billing period';


--
-- Name: COLUMN tenant_subscriptions."currentPeriodEnd"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."currentPeriodEnd" IS 'End of current billing period';


--
-- Name: COLUMN tenant_subscriptions."autoRenew"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."autoRenew" IS 'Automatically renew at end of period';


--
-- Name: COLUMN tenant_subscriptions."nextBillingDate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."nextBillingDate" IS 'When next payment will be charged';


--
-- Name: COLUMN tenant_subscriptions."gracePeriodEnds"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."gracePeriodEnds" IS 'Grace period expiry (usually 7 days after currentPeriodEnd)';


--
-- Name: COLUMN tenant_subscriptions."cancelledAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."cancelledAt" IS 'When subscription was cancelled';


--
-- Name: COLUMN tenant_subscriptions."cancelledBy"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."cancelledBy" IS 'Who cancelled (tenant user or admin)';


--
-- Name: COLUMN tenant_subscriptions."cancelAtPeriodEnd"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."cancelAtPeriodEnd" IS 'If true, subscription will not renew at period end';


--
-- Name: COLUMN tenant_subscriptions."stripeSubscriptionId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions."stripeSubscriptionId" IS 'Stripe subscription ID (for future payment integration)';


--
-- Name: COLUMN tenant_subscriptions.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions.metadata IS 'Additional subscription metadata';


--
-- Name: COLUMN tenant_subscriptions.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_subscriptions.notes IS 'Admin notes about this subscription';


--
-- Name: tenant_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_usage (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "currentPeriod" character varying(7) NOT NULL,
    "bookingsThisMonth" integer DEFAULT 0 NOT NULL,
    "bookingsTotal" integer DEFAULT 0 NOT NULL,
    "activeStaff" integer DEFAULT 0 NOT NULL,
    "activeServices" integer DEFAULT 0 NOT NULL,
    "activeProducts" integer DEFAULT 0 NOT NULL,
    "storageUsedMB" numeric(10,2) DEFAULT 0 NOT NULL,
    "emailCampaignsThisMonth" integer DEFAULT 0 NOT NULL,
    "smsCampaignsThisMonth" integer DEFAULT 0 NOT NULL,
    "apiCallsThisMonth" integer DEFAULT 0 NOT NULL,
    "lastResetDate" timestamp with time zone,
    "historicalUsage" jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_usage OWNER TO postgres;

--
-- Name: COLUMN tenant_usage."currentPeriod"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."currentPeriod" IS 'Current tracking period (YYYY-MM)';


--
-- Name: COLUMN tenant_usage."bookingsThisMonth"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."bookingsThisMonth" IS 'Number of bookings created this month';


--
-- Name: COLUMN tenant_usage."bookingsTotal"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."bookingsTotal" IS 'Total bookings all-time';


--
-- Name: COLUMN tenant_usage."activeStaff"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."activeStaff" IS 'Current number of active staff members';


--
-- Name: COLUMN tenant_usage."activeServices"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."activeServices" IS 'Current number of active services';


--
-- Name: COLUMN tenant_usage."activeProducts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."activeProducts" IS 'Current number of active products';


--
-- Name: COLUMN tenant_usage."storageUsedMB"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."storageUsedMB" IS 'Storage used in megabytes';


--
-- Name: COLUMN tenant_usage."lastResetDate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."lastResetDate" IS 'When monthly counters were last reset';


--
-- Name: COLUMN tenant_usage."historicalUsage"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant_usage."historicalUsage" IS 'Historical usage data by month';


--
-- Name: tenant_wallet_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_wallet_balances (
    "platformUserId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    balance numeric(10,2) DEFAULT 0 NOT NULL,
    currency character varying(8) DEFAULT 'SAR'::character varying NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_wallet_balances OWNER TO postgres;

--
-- Name: tenant_wallet_ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_wallet_ledger_entries (
    id uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    type public.enum_tenant_wallet_ledger_entries_type NOT NULL,
    direction public.enum_tenant_wallet_ledger_entries_direction NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(8) DEFAULT 'SAR'::character varying NOT NULL,
    "balanceBefore" numeric(10,2) NOT NULL,
    "balanceAfter" numeric(10,2) NOT NULL,
    "referenceType" character varying(64),
    "referenceId" character varying(128),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.tenant_wallet_ledger_entries OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    "dbSchema" character varying(255) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    status public.enum_tenants_status DEFAULT 'pending_approval'::public.enum_tenants_status,
    city character varying(255),
    plan public.enum_tenants_plan DEFAULT 'free_trial'::public.enum_tenants_plan,
    email character varying(255),
    "paymentDueAt" timestamp with time zone,
    "moreInfoMessage" text,
    password character varying(255),
    "lastLogin" timestamp with time zone,
    address text,
    "buildingNumber" character varying(255),
    "businessType" jsonb DEFAULT '["salon"]'::jsonb NOT NULL,
    "contactPersonEmail" character varying(255),
    coordinates jsonb,
    country character varying(255) DEFAULT 'Saudi Arabia'::character varying NOT NULL,
    "coverImage" character varying(255),
    "crDocument" character varying(255),
    "crNumber" character varying(255),
    description text,
    "descriptionAr" text,
    district character varying(255),
    "facebookUrl" character varying(255),
    "googleMapLink" text,
    "instagramUrl" character varying(255),
    "layoutTemplate" public."enum_tenants_layoutTemplate" DEFAULT 'default'::public."enum_tenants_layoutTemplate" NOT NULL,
    "licenseDocument" character varying(255),
    "licenseNumber" character varying(255),
    "linkedinUrl" character varying(255),
    logo character varying(255),
    mobile character varying(255),
    "nameAr" character varying(255),
    name_ar character varying(255),
    name_en character varying(255),
    phone character varying(255),
    "pinterestUrl" character varying(500),
    "postalCode" character varying(255),
    settings jsonb DEFAULT '{"currency": "SAR", "language": "ar", "timezone": "Asia/Riyadh", "bookingBuffer": 15, "requireDeposit": false, "depositPercentage": 0, "maxAdvanceBooking": 30, "cancellationPolicy": 24, "autoConfirmBookings": false}'::jsonb NOT NULL,
    "snapchatUrl" character varying(500),
    stats jsonb DEFAULT '{"totalRevenue": 0, "totalReviews": 0, "averageRating": 0, "totalBookings": 0, "totalCustomers": 0}'::jsonb NOT NULL,
    street character varying(255),
    "taxDocument" character varying(255),
    "taxNumber" character varying(255),
    "themeColors" jsonb DEFAULT '{"primary": "#7C3AED", "secondary": "#EC4899"}'::jsonb NOT NULL,
    "tiktokUrl" character varying(500),
    "twitterUrl" character varying(500),
    website character varying(255),
    whatsapp character varying(255),
    "workingHours" jsonb DEFAULT '{"friday": {"open": "14:00", "close": "21:00", "isOpen": true}, "monday": {"open": "09:00", "close": "21:00", "isOpen": true}, "sunday": {"open": "09:00", "close": "21:00", "isOpen": true}, "tuesday": {"open": "09:00", "close": "21:00", "isOpen": true}, "saturday": {"open": "09:00", "close": "21:00", "isOpen": true}, "thursday": {"open": "09:00", "close": "21:00", "isOpen": true}, "wednesday": {"open": "09:00", "close": "21:00", "isOpen": true}}'::jsonb NOT NULL,
    "youtubeUrl" character varying(500),
    images jsonb DEFAULT '[]'::jsonb,
    documents jsonb DEFAULT '{"license": null, "ownerIdCard": null, "vatCertificate": null, "commercialRegister": null}'::jsonb,
    "contactPersonNameAr" character varying(255),
    "contactPersonNameEn" character varying(255),
    "contactPersonMobile" character varying(255),
    "contactPersonPosition" character varying(255),
    "providesHomeServices" boolean DEFAULT false,
    "staffCount" integer,
    "mainService" text,
    "sellsProducts" boolean DEFAULT false,
    "hasOwnPaymentGateway" boolean DEFAULT false,
    "serviceRanking" integer,
    "advertiseOnSocialMedia" boolean DEFAULT false,
    "wantsRifahPromotion" boolean DEFAULT false,
    "planStartDate" timestamp with time zone,
    "planEndDate" timestamp with time zone,
    "approvedAt" timestamp with time zone,
    "approvedBy" uuid,
    "rejectionReason" text,
    "suspensionReason" text,
    "ownerName" character varying(255),
    "ownerNameAr" character varying(255),
    "ownerNameEn" character varying(255),
    "ownerPhone" character varying(255),
    "ownerEmail" character varying(255),
    "ownerNationalId" character varying(255)
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    "tenantId" uuid,
    "appointmentId" uuid,
    "bookingSessionId" uuid,
    order_id uuid,
    "paymentMethodId" uuid,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'SAR'::character varying,
    type public.enum_transactions_type NOT NULL,
    status public.enum_transactions_status DEFAULT 'pending'::public.enum_transactions_status,
    "stripePaymentIntentId" character varying(255),
    "stripeChargeId" character varying(255),
    "platformFee" numeric(10,2) DEFAULT 0,
    "tenantRevenue" numeric(10,2) DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    "failureReason" text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: usage_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usage_alerts (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "alertType" public."enum_usage_alerts_alertType" NOT NULL,
    "resourceType" public."enum_usage_alerts_resourceType" NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    title_ar character varying(255),
    message_ar text,
    "currentValue" integer,
    "limitValue" integer,
    percentage numeric(5,2),
    "sentAt" timestamp with time zone NOT NULL,
    "sentVia" jsonb DEFAULT '[]'::jsonb,
    acknowledged boolean DEFAULT false NOT NULL,
    "acknowledgedAt" timestamp with time zone,
    "actionTaken" public."enum_usage_alerts_actionTaken" DEFAULT 'none'::public."enum_usage_alerts_actionTaken" NOT NULL,
    "actionTakenAt" timestamp with time zone,
    priority public.enum_usage_alerts_priority DEFAULT 'medium'::public.enum_usage_alerts_priority NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.usage_alerts OWNER TO postgres;

--
-- Name: COLUMN usage_alerts.title; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts.title IS 'Alert title';


--
-- Name: COLUMN usage_alerts.message; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts.message IS 'Alert message';


--
-- Name: COLUMN usage_alerts."currentValue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts."currentValue" IS 'Current usage value';


--
-- Name: COLUMN usage_alerts."limitValue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts."limitValue" IS 'Limit value';


--
-- Name: COLUMN usage_alerts.percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts.percentage IS 'Usage percentage';


--
-- Name: COLUMN usage_alerts."sentVia"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts."sentVia" IS 'Channels used to send notification: ["email", "sms", "in-app", "whatsapp"]';


--
-- Name: COLUMN usage_alerts.acknowledged; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts.acknowledged IS 'Has tenant acknowledged this alert?';


--
-- Name: COLUMN usage_alerts.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.usage_alerts.metadata IS 'Additional alert metadata';


--
-- Name: wallet_ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_ledger_entries (
    id uuid NOT NULL,
    "platformUserId" uuid NOT NULL,
    type public.enum_wallet_ledger_entries_type NOT NULL,
    direction public.enum_wallet_ledger_entries_direction NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(8) DEFAULT 'SAR'::character varying NOT NULL,
    "balanceBefore" numeric(10,2) NOT NULL,
    "balanceAfter" numeric(10,2) NOT NULL,
    "referenceType" character varying(64),
    "referenceId" character varying(128),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.wallet_ledger_entries OWNER TO postgres;

--
-- Name: FeaturePricings FeaturePricings_featureKey_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeaturePricings"
    ADD CONSTRAINT "FeaturePricings_featureKey_key" UNIQUE ("featureKey");


--
-- Name: FeaturePricings FeaturePricings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeaturePricings"
    ADD CONSTRAINT "FeaturePricings_pkey" PRIMARY KEY (id);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: admin_saved_reports admin_saved_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_saved_reports
    ADD CONSTRAINT admin_saved_reports_pkey PRIMARY KEY (id);


--
-- Name: appointment_events appointment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_events
    ADD CONSTRAINT appointment_events_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_bookingNumber_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_bookingNumber_key" UNIQUE ("bookingNumber");


--
-- Name: appointments appointments_inviteToken_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_inviteToken_key" UNIQUE ("inviteToken");


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: auth_users auth_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_email_key UNIQUE (email);


--
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- Name: bill_payment_attempts bill_payment_attempts_idempotencyKey_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_payment_attempts
    ADD CONSTRAINT "bill_payment_attempts_idempotencyKey_key" UNIQUE ("idempotencyKey");


--
-- Name: bill_payment_attempts bill_payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_payment_attempts
    ADD CONSTRAINT bill_payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: booking_sessions booking_sessions_bookingReference_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT "booking_sessions_bookingReference_key" UNIQUE ("bookingReference");


--
-- Name: booking_sessions booking_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT booking_sessions_pkey PRIMARY KEY (id);


--
-- Name: consultant_conversations consultant_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultant_conversations
    ADD CONSTRAINT consultant_conversations_pkey PRIMARY KEY (id);


--
-- Name: consultant_reports consultant_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultant_reports
    ADD CONSTRAINT consultant_reports_pkey PRIMARY KEY (id);


--
-- Name: consultant_snapshots consultant_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultant_snapshots
    ADD CONSTRAINT consultant_snapshots_pkey PRIMARY KEY (id);


--
-- Name: customer_insights customer_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_insights
    ADD CONSTRAINT customer_insights_pkey PRIMARY KEY (id);


--
-- Name: customer_invoice_events customer_invoice_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invoice_events
    ADD CONSTRAINT customer_invoice_events_pkey PRIMARY KEY (id);


--
-- Name: customer_invoice_items customer_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invoice_items
    ADD CONSTRAINT customer_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: customer_invoices customer_invoices_invoiceNumber_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invoices
    ADD CONSTRAINT "customer_invoices_invoiceNumber_key" UNIQUE ("invoiceNumber");


--
-- Name: customer_invoices customer_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invoices
    ADD CONSTRAINT customer_invoices_pkey PRIMARY KEY (id);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: gift_card_code_redemptions gift_card_code_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_code_redemptions
    ADD CONSTRAINT gift_card_code_redemptions_pkey PRIMARY KEY (id);


--
-- Name: gift_card_codes gift_card_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_codes
    ADD CONSTRAINT gift_card_codes_code_key UNIQUE (code);


--
-- Name: gift_card_codes gift_card_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_codes
    ADD CONSTRAINT gift_card_codes_pkey PRIMARY KEY (id);


--
-- Name: gift_card_packages gift_card_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_packages
    ADD CONSTRAINT gift_card_packages_pkey PRIMARY KEY (id);


--
-- Name: gift_card_transactions gift_card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_transactions
    ADD CONSTRAINT gift_card_transactions_pkey PRIMARY KEY (id);


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (id);


--
-- Name: hot_deals hot_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_deals
    ADD CONSTRAINT hot_deals_pkey PRIMARY KEY (id);


--
-- Name: mobile_push_tokens mobile_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mobile_push_tokens
    ADD CONSTRAINT mobile_push_tokens_pkey PRIMARY KEY (id);


--
-- Name: mobile_push_tokens mobile_push_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mobile_push_tokens
    ADD CONSTRAINT mobile_push_tokens_token_key UNIQUE (token);


--
-- Name: notification_delivery_logs notification_delivery_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_delivery_logs
    ADD CONSTRAINT notification_delivery_logs_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_orderNumber_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_orderNumber_key" UNIQUE ("orderNumber");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_idempotency_keys payment_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_idempotency_keys
    ADD CONSTRAINT payment_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: platform_users platform_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_email_key UNIQUE (email);


--
-- Name: platform_users platform_users_google_sub_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_google_sub_key UNIQUE (google_sub);


--
-- Name: platform_users platform_users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_phone_key UNIQUE (phone);


--
-- Name: platform_users platform_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: public_page_data public_page_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_page_data
    ADD CONSTRAINT public_page_data_pkey PRIMARY KEY (id);


--
-- Name: public_page_data public_page_data_tenantId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_page_data
    ADD CONSTRAINT "public_page_data_tenantId_key" UNIQUE ("tenantId");


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_slug_key UNIQUE (slug);


--
-- Name: service_employees service_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_employees
    ADD CONSTRAINT service_employees_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: staff_breaks staff_breaks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_breaks
    ADD CONSTRAINT staff_breaks_pkey PRIMARY KEY (id);


--
-- Name: staff_messages staff_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_messages
    ADD CONSTRAINT staff_messages_pkey PRIMARY KEY (id);


--
-- Name: staff_payrolls staff_payrolls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_payrolls
    ADD CONSTRAINT staff_payrolls_pkey PRIMARY KEY (id);


--
-- Name: staff_permissions staff_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_pkey PRIMARY KEY (id);


--
-- Name: staff_permissions staff_permissions_staffId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT "staff_permissions_staffId_key" UNIQUE ("staffId");


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_schedule_overrides staff_schedule_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_schedule_overrides
    ADD CONSTRAINT staff_schedule_overrides_pkey PRIMARY KEY (id);


--
-- Name: staff_schedules staff_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_pkey PRIMARY KEY (id);


--
-- Name: staff_shifts staff_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_pkey PRIMARY KEY (id);


--
-- Name: staff_time_off staff_time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_time_off
    ADD CONSTRAINT staff_time_off_pkey PRIMARY KEY (id);


--
-- Name: subscription_packages subscription_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_packages
    ADD CONSTRAINT subscription_packages_pkey PRIMARY KEY (id);


--
-- Name: subscription_packages subscription_packages_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_packages
    ADD CONSTRAINT subscription_packages_slug_key UNIQUE (slug);


--
-- Name: super_admins super_admins_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_email_key UNIQUE (email);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: support_agents support_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_agents
    ADD CONSTRAINT support_agents_pkey PRIMARY KEY (id);


--
-- Name: support_agents support_agents_superAdminId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_agents
    ADD CONSTRAINT "support_agents_superAdminId_key" UNIQUE ("superAdminId");


--
-- Name: support_attachments support_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT support_attachments_pkey PRIMARY KEY (id);


--
-- Name: support_categories support_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_categories
    ADD CONSTRAINT support_categories_pkey PRIMARY KEY (id);


--
-- Name: support_categories support_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_categories
    ADD CONSTRAINT support_categories_slug_key UNIQUE (slug);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_events support_ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_links support_ticket_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_links
    ADD CONSTRAINT support_ticket_links_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_notification_events support_ticket_notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_notification_events
    ADD CONSTRAINT support_ticket_notification_events_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_read_states support_ticket_read_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_read_states
    ADD CONSTRAINT support_ticket_read_states_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_ticketNumber_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT "support_tickets_ticketNumber_key" UNIQUE ("ticketNumber");


--
-- Name: tenant_dashboard_accounts tenant_dashboard_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_dashboard_accounts
    ADD CONSTRAINT tenant_dashboard_accounts_pkey PRIMARY KEY (id);


--
-- Name: tenant_feature_usage tenant_feature_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_feature_usage
    ADD CONSTRAINT tenant_feature_usage_pkey PRIMARY KEY (id);


--
-- Name: tenant_gift_card_packages tenant_gift_card_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_gift_card_packages
    ADD CONSTRAINT tenant_gift_card_packages_pkey PRIMARY KEY (id);


--
-- Name: tenant_gift_card_settlements tenant_gift_card_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_gift_card_settlements
    ADD CONSTRAINT tenant_gift_card_settlements_pkey PRIMARY KEY (id);


--
-- Name: tenant_gift_card_settlements tenant_gift_card_settlements_transactionId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_gift_card_settlements
    ADD CONSTRAINT "tenant_gift_card_settlements_transactionId_key" UNIQUE ("transactionId");


--
-- Name: tenant_gift_card_transactions tenant_gift_card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_gift_card_transactions
    ADD CONSTRAINT tenant_gift_card_transactions_pkey PRIMARY KEY (id);


--
-- Name: tenant_operational_alert_reads tenant_operational_alert_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_operational_alert_reads
    ADD CONSTRAINT tenant_operational_alert_reads_pkey PRIMARY KEY (id);


--
-- Name: tenant_push_campaign_recipients tenant_push_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_push_campaign_recipients
    ADD CONSTRAINT tenant_push_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: tenant_push_campaigns tenant_push_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_push_campaigns
    ADD CONSTRAINT tenant_push_campaigns_pkey PRIMARY KEY (id);


--
-- Name: tenant_push_usage tenant_push_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_push_usage
    ADD CONSTRAINT tenant_push_usage_pkey PRIMARY KEY (id);


--
-- Name: tenant_saved_reports tenant_saved_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_saved_reports
    ADD CONSTRAINT tenant_saved_reports_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_tenantId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT "tenant_settings_tenantId_key" UNIQUE ("tenantId");


--
-- Name: tenant_subscriptions tenant_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tenant_usage tenant_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_usage
    ADD CONSTRAINT tenant_usage_pkey PRIMARY KEY (id);


--
-- Name: tenant_usage tenant_usage_tenantId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_usage
    ADD CONSTRAINT "tenant_usage_tenantId_key" UNIQUE ("tenantId");


--
-- Name: tenant_wallet_balances tenant_wallet_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_wallet_balances
    ADD CONSTRAINT tenant_wallet_balances_pkey PRIMARY KEY ("platformUserId", "tenantId");


--
-- Name: tenant_wallet_ledger_entries tenant_wallet_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_wallet_ledger_entries
    ADD CONSTRAINT tenant_wallet_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: usage_alerts usage_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_alerts
    ADD CONSTRAINT usage_alerts_pkey PRIMARY KEY (id);


--
-- Name: wallet_ledger_entries wallet_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_ledger_entries
    ADD CONSTRAINT wallet_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: appointments_service_variant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX appointments_service_variant_id_idx ON public.appointments USING btree ("serviceVariantId");


--
-- Name: idx_appointments_booking_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_booking_reference ON public.appointments USING btree ("bookingReference");


--
-- Name: idx_appointments_booking_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_booking_session_id ON public.appointments USING btree ("bookingSessionId");


--
-- Name: idx_appointments_invite_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_appointments_invite_token ON public.appointments USING btree ("inviteToken") WHERE ("inviteToken" IS NOT NULL);


--
-- Name: idx_appointments_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_payment_status ON public.appointments USING btree ("paymentStatus", "depositPaid", "remainderPaid");


--
-- Name: idx_bills_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_due_date ON public.bills USING btree ("dueDate");


--
-- Name: idx_bills_invoice_issued_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_invoice_issued_at ON public.bills USING btree ("invoiceIssuedAt");


--
-- Name: idx_bills_paid_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_paid_at ON public.bills USING btree ("paidAt");


--
-- Name: idx_bills_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_status ON public.bills USING btree (status);


--
-- Name: idx_bills_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_tenant_id ON public.bills USING btree ("tenantId");


--
-- Name: idx_bills_tenant_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_tenant_subscription_id ON public.bills USING btree ("tenantSubscriptionId");


--
-- Name: idx_booking_sessions_platform_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_sessions_platform_user ON public.booking_sessions USING btree ("platformUserId");


--
-- Name: idx_booking_sessions_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_booking_sessions_reference ON public.booking_sessions USING btree ("bookingReference");


--
-- Name: idx_booking_sessions_tenant_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_sessions_tenant_created_at ON public.booking_sessions USING btree ("tenantId", "createdAt");


--
-- Name: idx_hot_deals_service_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_deals_service_id ON public.hot_deals USING btree (service_id);


--
-- Name: idx_hot_deals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_deals_status ON public.hot_deals USING btree (status);


--
-- Name: idx_hot_deals_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_deals_tenant_id ON public.hot_deals USING btree (tenant_id);


--
-- Name: idx_hot_deals_valid_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_deals_valid_window ON public.hot_deals USING btree (valid_from, valid_until);


--
-- Name: idx_payment_idempotency_status_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_idempotency_status_updated_at ON public.payment_idempotency_keys USING btree (status, "updatedAt");


--
-- Name: idx_payment_idempotency_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_idempotency_user_id ON public.payment_idempotency_keys USING btree ("platformUserId");


--
-- Name: idx_payment_transactions_appointment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_appointment ON public.payment_transactions USING btree (appointment_id);


--
-- Name: idx_payment_transactions_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_order ON public.payment_transactions USING btree (order_id);


--
-- Name: idx_payment_transactions_processed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_processed_at ON public.payment_transactions USING btree (processed_at);


--
-- Name: idx_payment_transactions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_status ON public.payment_transactions USING btree (status);


--
-- Name: idx_payment_transactions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_type ON public.payment_transactions USING btree (type);


--
-- Name: idx_services_target_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_target_gender ON public.services USING btree ("targetGender");


--
-- Name: idx_staff_breaks_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_breaks_active ON public.staff_breaks USING btree (is_active);


--
-- Name: idx_staff_breaks_staff_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_breaks_staff_date ON public.staff_breaks USING btree (staff_id, specific_date);


--
-- Name: idx_staff_breaks_staff_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_breaks_staff_day ON public.staff_breaks USING btree (staff_id, day_of_week);


--
-- Name: idx_staff_overrides_available; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_overrides_available ON public.staff_schedule_overrides USING btree (is_available);


--
-- Name: idx_staff_overrides_staff_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_overrides_staff_date ON public.staff_schedule_overrides USING btree (staff_id, date);


--
-- Name: idx_staff_shifts_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_shifts_active ON public.staff_shifts USING btree (is_active);


--
-- Name: idx_staff_shifts_staff_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_shifts_staff_date ON public.staff_shifts USING btree (staff_id, specific_date);


--
-- Name: idx_staff_shifts_staff_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_shifts_staff_day ON public.staff_shifts USING btree (staff_id, day_of_week);


--
-- Name: idx_staff_tenant_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_tenant_gender ON public.staff USING btree ("tenantId", gender);


--
-- Name: idx_staff_time_off_approved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_time_off_approved ON public.staff_time_off USING btree (is_approved);


--
-- Name: idx_staff_time_off_staff_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_time_off_staff_dates ON public.staff_time_off USING btree (staff_id, start_date, end_date);


--
-- Name: idx_support_agents_presence_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_agents_presence_status ON public.support_agents USING btree ("presenceStatus");


--
-- Name: idx_support_agents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_agents_status ON public.support_agents USING btree (status);


--
-- Name: idx_support_attachments_file_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_attachments_file_category ON public.support_attachments USING btree ("fileCategory");


--
-- Name: idx_support_attachments_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_attachments_message ON public.support_attachments USING btree ("supportMessageId");


--
-- Name: idx_support_attachments_ticket_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_attachments_ticket_created_at ON public.support_attachments USING btree ("tenantId", "supportTicketId", "createdAt");


--
-- Name: idx_support_categories_feature_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_categories_feature_key ON public.support_categories USING btree ("featureKey");


--
-- Name: idx_support_categories_feature_route; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_categories_feature_route ON public.support_categories USING btree ("featureRoute");


--
-- Name: idx_support_categories_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_categories_is_active ON public.support_categories USING btree ("isActive");


--
-- Name: idx_support_categories_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_categories_parent ON public.support_categories USING btree ("parentId");


--
-- Name: idx_support_categories_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_categories_scope ON public.support_categories USING btree (scope);


--
-- Name: idx_support_categories_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_categories_tenant ON public.support_categories USING btree ("tenantId");


--
-- Name: idx_support_messages_reply_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_reply_to ON public.support_messages USING btree ("replyToMessageId");


--
-- Name: idx_support_messages_sender_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_sender_type ON public.support_messages USING btree ("tenantId", "senderType");


--
-- Name: idx_support_messages_ticket_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_ticket_created_at ON public.support_messages USING btree ("tenantId", "supportTicketId", "createdAt");


--
-- Name: idx_support_ticket_events_actor_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_events_actor_type ON public.support_ticket_events USING btree ("actorType");


--
-- Name: idx_support_ticket_events_tenant_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_events_tenant_time ON public.support_ticket_events USING btree ("tenantId", "occurredAt");


--
-- Name: idx_support_ticket_events_ticket_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_events_ticket_time ON public.support_ticket_events USING btree ("supportTicketId", "occurredAt");


--
-- Name: idx_support_ticket_events_type_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_events_type_time ON public.support_ticket_events USING btree ("eventType", "occurredAt");


--
-- Name: idx_support_ticket_links_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_links_entity_id ON public.support_ticket_links USING btree ("entityId");


--
-- Name: idx_support_ticket_links_entity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_links_entity_type ON public.support_ticket_links USING btree ("entityType");


--
-- Name: idx_support_ticket_links_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_links_ticket ON public.support_ticket_links USING btree ("ticketId");


--
-- Name: idx_support_ticket_notification_events_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_notification_events_message ON public.support_ticket_notification_events USING btree ("supportMessageId");


--
-- Name: idx_support_ticket_notification_events_processed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_notification_events_processed_at ON public.support_ticket_notification_events USING btree ("processedAt");


--
-- Name: idx_support_ticket_notification_events_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_notification_events_recipient ON public.support_ticket_notification_events USING btree ("recipientType", "recipientId");


--
-- Name: idx_support_ticket_notification_events_ticket_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_notification_events_ticket_created_at ON public.support_ticket_notification_events USING btree ("tenantId", "supportTicketId", "createdAt");


--
-- Name: idx_support_ticket_notification_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_notification_events_type ON public.support_ticket_notification_events USING btree ("eventType");


--
-- Name: idx_support_ticket_read_states_last_read_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_read_states_last_read_message ON public.support_ticket_read_states USING btree ("lastReadMessageId");


--
-- Name: idx_support_ticket_read_states_participant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_read_states_participant_id ON public.support_ticket_read_states USING btree ("participantId");


--
-- Name: idx_support_ticket_read_states_participant_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_read_states_participant_type ON public.support_ticket_read_states USING btree ("tenantId", "participantType");


--
-- Name: idx_support_ticket_read_states_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_ticket_read_states_ticket ON public.support_ticket_read_states USING btree ("tenantId", "supportTicketId");


--
-- Name: idx_support_tickets_assigned_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_assigned_agent ON public.support_tickets USING btree ("assignedSupportAgentId");


--
-- Name: idx_support_tickets_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_category ON public.support_tickets USING btree ("supportCategoryId");


--
-- Name: idx_support_tickets_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_customer ON public.support_tickets USING btree ("customerPlatformUserId");


--
-- Name: idx_support_tickets_tenant_last_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_tenant_last_message ON public.support_tickets USING btree ("tenantId", "lastMessageAt");


--
-- Name: idx_support_tickets_tenant_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_tenant_priority ON public.support_tickets USING btree ("tenantId", priority);


--
-- Name: idx_support_tickets_tenant_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_tenant_status ON public.support_tickets USING btree ("tenantId", status);


--
-- Name: idx_tenant_dashboard_accounts_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_dashboard_accounts_role ON public.tenant_dashboard_accounts USING btree ("roleKey");


--
-- Name: idx_tenant_dashboard_accounts_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_dashboard_accounts_tenant ON public.tenant_dashboard_accounts USING btree ("tenantId");


--
-- Name: idx_tenant_saved_reports_tenant_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_saved_reports_tenant_creator ON public.tenant_saved_reports USING btree ("tenantId", "createdByUserId");


--
-- Name: idx_tenant_saved_reports_tenant_favorite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_saved_reports_tenant_favorite ON public.tenant_saved_reports USING btree ("tenantId", "isFavorite");


--
-- Name: idx_tenant_saved_reports_tenant_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_saved_reports_tenant_type ON public.tenant_saved_reports USING btree ("tenantId", "reportType");


--
-- Name: idx_tenant_saved_reports_tenant_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_saved_reports_tenant_updated_at ON public.tenant_saved_reports USING btree ("tenantId", "updatedAt");


--
-- Name: idx_transactions_booking_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_booking_session ON public.transactions USING btree ("bookingSessionId") WHERE ("bookingSessionId" IS NOT NULL);


--
-- Name: uidx_bills_bill_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_bills_bill_number ON public.bills USING btree ("billNumber");


--
-- Name: uidx_bills_payment_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_bills_payment_token ON public.bills USING btree ("paymentToken");


--
-- Name: uidx_payment_idempotency_user_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_payment_idempotency_user_key ON public.payment_idempotency_keys USING btree ("platformUserId", "idempotencyKey");


--
-- Name: uidx_support_agents_super_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_support_agents_super_admin ON public.support_agents USING btree ("superAdminId");


--
-- Name: uidx_support_ticket_links_ticket_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_support_ticket_links_ticket_entity ON public.support_ticket_links USING btree ("ticketId", "entityType", "entityId");


--
-- Name: uidx_support_ticket_read_states_participant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_support_ticket_read_states_participant ON public.support_ticket_read_states USING btree ("tenantId", "supportTicketId", "participantType", "participantId");


--
-- Name: uidx_support_tickets_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uidx_support_tickets_ticket_number ON public.support_tickets USING btree ("ticketNumber");


--
-- Name: unique_staff_date_override; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_staff_date_override ON public.staff_schedule_overrides USING btree (staff_id, date);


--
-- Name: uq_tenant_dashboard_accounts_tenant_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_tenant_dashboard_accounts_tenant_email ON public.tenant_dashboard_accounts USING btree ("tenantId", email);


--
-- Name: appointments appointments_bookingSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "appointments_bookingSessionId_fkey" FOREIGN KEY ("bookingSessionId") REFERENCES public.booking_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: booking_sessions booking_sessions_platformUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT "booking_sessions_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: booking_sessions booking_sessions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT "booking_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bills fk_bills_tenant_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT fk_bills_tenant_id FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bills fk_bills_tenant_subscription_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT fk_bills_tenant_subscription_id FOREIGN KEY ("tenantSubscriptionId") REFERENCES public.tenant_subscriptions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_idempotency_keys payment_idempotency_keys_platformUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_idempotency_keys
    ADD CONSTRAINT "payment_idempotency_keys_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: staff_breaks staff_breaks_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_breaks
    ADD CONSTRAINT staff_breaks_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_schedule_overrides staff_schedule_overrides_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_schedule_overrides
    ADD CONSTRAINT staff_schedule_overrides_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_shifts staff_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff staff_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: staff_time_off staff_time_off_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_time_off
    ADD CONSTRAINT staff_time_off_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: support_agents support_agents_superAdminId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_agents
    ADD CONSTRAINT "support_agents_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES public.super_admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_attachments support_attachments_customerPlatformUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT "support_attachments_customerPlatformUserId_fkey" FOREIGN KEY ("customerPlatformUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_attachments support_attachments_supportAgentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT "support_attachments_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES public.support_agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_attachments support_attachments_supportMessageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT "support_attachments_supportMessageId_fkey" FOREIGN KEY ("supportMessageId") REFERENCES public.support_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_attachments support_attachments_supportTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT "support_attachments_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_attachments support_attachments_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT "support_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_categories support_categories_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_categories
    ADD CONSTRAINT "support_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.support_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_categories support_categories_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_categories
    ADD CONSTRAINT "support_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_messages support_messages_customerPlatformUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT "support_messages_customerPlatformUserId_fkey" FOREIGN KEY ("customerPlatformUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_messages support_messages_replyToMessageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT "support_messages_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES public.support_messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_messages support_messages_supportAgentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT "support_messages_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES public.support_agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_messages support_messages_supportTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT "support_messages_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_messages support_messages_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT "support_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_events support_ticket_events_customerPlatformUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT "support_ticket_events_customerPlatformUserId_fkey" FOREIGN KEY ("customerPlatformUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_supportAgentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT "support_ticket_events_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES public.support_agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_supportAttachmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT "support_ticket_events_supportAttachmentId_fkey" FOREIGN KEY ("supportAttachmentId") REFERENCES public.support_attachments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_supportMessageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT "support_ticket_events_supportMessageId_fkey" FOREIGN KEY ("supportMessageId") REFERENCES public.support_messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_supportTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT "support_ticket_events_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_events support_ticket_events_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT "support_ticket_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_links support_ticket_links_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_links
    ADD CONSTRAINT "support_ticket_links_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_notification_events support_ticket_notification_events_supportMessageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_notification_events
    ADD CONSTRAINT "support_ticket_notification_events_supportMessageId_fkey" FOREIGN KEY ("supportMessageId") REFERENCES public.support_messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_notification_events support_ticket_notification_events_supportTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_notification_events
    ADD CONSTRAINT "support_ticket_notification_events_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_notification_events support_ticket_notification_events_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_notification_events
    ADD CONSTRAINT "support_ticket_notification_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_read_states support_ticket_read_states_lastReadMessageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_read_states
    ADD CONSTRAINT "support_ticket_read_states_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES public.support_messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_read_states support_ticket_read_states_supportTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_read_states
    ADD CONSTRAINT "support_ticket_read_states_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_read_states support_ticket_read_states_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_ticket_read_states
    ADD CONSTRAINT "support_ticket_read_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assignedSupportAgentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT "support_tickets_assignedSupportAgentId_fkey" FOREIGN KEY ("assignedSupportAgentId") REFERENCES public.support_agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_customerPlatformUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT "support_tickets_customerPlatformUserId_fkey" FOREIGN KEY ("customerPlatformUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_supportCategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT "support_tickets_supportCategoryId_fkey" FOREIGN KEY ("supportCategoryId") REFERENCES public.support_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT "support_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_dashboard_accounts tenant_dashboard_accounts_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_dashboard_accounts
    ADD CONSTRAINT "tenant_dashboard_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_saved_reports tenant_saved_reports_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_saved_reports
    ADD CONSTRAINT "tenant_saved_reports_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public.platform_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tenant_saved_reports tenant_saved_reports_duplicatedFromId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_saved_reports
    ADD CONSTRAINT "tenant_saved_reports_duplicatedFromId_fkey" FOREIGN KEY ("duplicatedFromId") REFERENCES public.tenant_saved_reports(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tenant_saved_reports tenant_saved_reports_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_saved_reports
    ADD CONSTRAINT "tenant_saved_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

