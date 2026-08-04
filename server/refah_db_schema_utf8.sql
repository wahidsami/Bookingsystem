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
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid NOT NULL,
    "bookingNumber" text,
    "tenantId" uuid,
    "startTime" timestamp without time zone,
    "paymentStatus" text,
    status text,
    price numeric(10,2),
    "serviceId" uuid,
    "platformUserId" uuid
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid,
    "actorId" text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    before jsonb,
    after jsonb,
    "requestId" text
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "customerId" uuid NOT NULL,
    "serviceId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "startAt" timestamp without time zone,
    "endAt" timestamp without time zone,
    status text DEFAULT 'pending'::text,
    "paymentStatus" text DEFAULT 'pending'::text,
    "expiresAt" timestamp with time zone
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "nameEn" text,
    "nameAr" text,
    description text,
    "isActive" boolean DEFAULT true,
    "parentId" uuid,
    type character varying DEFAULT 'service'::character varying NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_closure; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories_closure (
    id_ancestor uuid NOT NULL,
    id_descendant uuid NOT NULL
);


ALTER TABLE public.categories_closure OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "tenantId" uuid NOT NULL,
    "appUserId" uuid,
    phone text NOT NULL,
    "fullName" text,
    email text,
    gender text,
    "dateOfBirth" date,
    "avatarUrl" text,
    address jsonb,
    interests text[],
    hobbies text[],
    notes text,
    tags text[],
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "loyaltyTier" text DEFAULT 'bronze'::text NOT NULL,
    "noShowCount" integer DEFAULT 0 NOT NULL,
    "preferredLang" text DEFAULT 'ar'::text NOT NULL,
    "bannedAt" timestamp without time zone,
    "deletedAt" timestamp without time zone
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: job_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    last_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    process_after timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.job_queue OWNER TO postgres;

--
-- Name: migration_quarantine; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migration_quarantine (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    entity character varying NOT NULL,
    "legacyId" character varying NOT NULL,
    "tenantId" uuid,
    reason text NOT NULL,
    payload jsonb
);


ALTER TABLE public.migration_quarantine OWNER TO postgres;

--
-- Name: migration_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migration_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" uuid,
    "legacyId" integer NOT NULL,
    status character varying NOT NULL,
    "startedAt" timestamp with time zone DEFAULT now(),
    "finishedAt" timestamp with time zone,
    "reportPath" text,
    stats jsonb
);


ALTER TABLE public.migration_runs OWNER TO postgres;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "tenantId" uuid NOT NULL,
    "orderId" uuid NOT NULL,
    "productId" uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    "totalPrice" numeric(10,2) NOT NULL,
    "productName" text,
    "productNameAr" text,
    "productPrice" numeric(10,2),
    "productImage" text,
    "productSku" text
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "tenantId" uuid NOT NULL,
    "customerId" uuid NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "totalAmount" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "paymentMethod" text,
    notes text,
    "appUserId" uuid,
    "platformUserId" uuid,
    "orderNumber" text,
    "paymentStatus" text,
    subtotal numeric(10,2),
    "taxAmount" numeric(10,2),
    "shippingFee" numeric(10,2)
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_verifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.otp_verifications OWNER TO postgres;

--
-- Name: packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    "nameAr" text,
    price numeric(10,2) DEFAULT 0,
    "commissionRate" numeric(5,2) DEFAULT 5,
    "commissionBase" text DEFAULT 'total'::text,
    "maxStaff" integer DEFAULT 3,
    "maxServices" integer DEFAULT 10,
    "maxBookingsPerMonth" integer DEFAULT 500,
    "isActive" boolean DEFAULT true,
    "aiContentAssistant" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.packages OWNER TO postgres;

--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transactions (
    id uuid NOT NULL,
    appointment_id uuid,
    order_id uuid,
    type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'SAR'::character varying NOT NULL,
    payment_method text NOT NULL,
    status text NOT NULL,
    transaction_ref text,
    gateway_response jsonb DEFAULT '{}'::jsonb,
    processed_by uuid,
    processed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_transactions OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'SAR'::bpchar NOT NULL,
    "providerRef" character varying,
    method character varying,
    fees jsonb
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: platform_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_users (
    id uuid NOT NULL,
    "firstName" text,
    "lastName" text,
    email text,
    phone text
);


ALTER TABLE public.platform_users OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "tenantId" uuid NOT NULL,
    "nameEn" character varying NOT NULL,
    "nameAr" character varying NOT NULL,
    "descriptionEn" text,
    "descriptionAr" text,
    "categoryId" uuid,
    brand character varying,
    size character varying,
    color character varying,
    sku character varying,
    "ingredientsEn" text,
    "ingredientsAr" text,
    "howToUseEn" text,
    "howToUseAr" text,
    "featuresEn" text,
    "featuresAr" text,
    "imageUrls" jsonb,
    price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "stockQuantity" integer DEFAULT 0 NOT NULL,
    "isAvailable" boolean DEFAULT true NOT NULL,
    "isFeatured" boolean DEFAULT false NOT NULL,
    "totalSold" integer DEFAULT 0 NOT NULL,
    "usedAsGiftCount" integer DEFAULT 0 NOT NULL,
    name_en text,
    name_ar text
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: refresh_token_families; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_token_families (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    family_id uuid NOT NULL,
    token_hash text NOT NULL,
    consumed boolean DEFAULT false NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL
);


ALTER TABLE public.refresh_token_families OWNER TO postgres;

--
-- Name: schedule_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_overrides (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    date date NOT NULL,
    "isAvailable" boolean DEFAULT true,
    "overrideStart" time without time zone,
    "overrideEnd" time without time zone,
    reason text
);


ALTER TABLE public.schedule_overrides OWNER TO postgres;

--
-- Name: schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone NOT NULL,
    "isDayOff" boolean DEFAULT false,
    label text,
    "startDate" date,
    "endDate" date,
    "isRecurring" boolean DEFAULT true
);


ALTER TABLE public.schedules OWNER TO postgres;

--
-- Name: service_staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_staff (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "serviceId" uuid NOT NULL,
    "staffId" uuid NOT NULL
);


ALTER TABLE public.service_staff OWNER TO postgres;

--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "nameEn" text,
    "nameAr" text,
    description text,
    "durationMins" integer,
    price numeric(10,2),
    "isActive" boolean DEFAULT true,
    "bufferBeforeMins" integer DEFAULT 0,
    "bufferAfterMins" integer DEFAULT 0,
    "categoryId" uuid,
    "descriptionEn" text,
    "descriptionAr" text,
    "imageUrl" text,
    "availableInCenter" boolean DEFAULT true,
    "availableHomeVisit" boolean DEFAULT false,
    includes jsonb,
    benefits jsonb,
    "whatToExpect" jsonb,
    "hasOffer" boolean DEFAULT false,
    "offerDetails" text,
    "hasGift" boolean DEFAULT false,
    "giftType" text,
    "giftDetails" text,
    "includesAr" jsonb,
    "benefitsAr" jsonb,
    "whatToExpectAr" jsonb,
    name_en text,
    name_ar text
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "userId" uuid,
    "nameEn" text,
    "nameAr" text,
    email text,
    phone text,
    "isActive" boolean DEFAULT true,
    bio text,
    "avatarUrl" text,
    nationality text,
    experience text,
    "baseSalary" numeric(12,2),
    "commissionRate" numeric(5,2),
    skills jsonb,
    rating numeric(3,2),
    "totalBookings" integer DEFAULT 0,
    role text DEFAULT 'employee'::text,
    name text
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- Name: staff_breaks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_breaks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "dayOfWeek" integer NOT NULL,
    type text,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone NOT NULL
);


ALTER TABLE public.staff_breaks OWNER TO postgres;

--
-- Name: tenant_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    type text NOT NULL,
    "documentNumber" text,
    "fileUrl" text,
    "uploadedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tenant_documents OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "nameEn" text,
    "nameAr" text,
    slug text,
    status text DEFAULT 'pending_review'::text,
    settings jsonb,
    "requestedPackageId" uuid,
    "assignedPackageId" uuid,
    "rejectedAt" timestamp with time zone,
    "rejectionReason" text,
    "logoUrl" text,
    "coverUrl" text,
    "contactPhone" text,
    "contactMobile" text,
    website text,
    address text,
    locale character varying(10),
    timezone character varying(50),
    currency character varying(3),
    "socialLinks" jsonb,
    "workingHours" jsonb,
    "bookingSettings" jsonb,
    "paymentSettings" jsonb,
    "notificationSettings" jsonb
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: time_off; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_off (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "tenantId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "startAt" timestamp with time zone NOT NULL,
    "endAt" timestamp with time zone NOT NULL,
    reason text,
    type text,
    "approvalStatus" text DEFAULT 'pending'::text
);


ALTER TABLE public.time_off OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    email text,
    phone text,
    name text,
    role text DEFAULT 'customer'::text,
    "passwordHash" text,
    "tenantId" uuid,
    gender text,
    "dateOfBirth" date,
    address jsonb,
    profile jsonb,
    "bannedAt" timestamp without time zone,
    "avatarUrl" text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "eventId" character varying NOT NULL,
    provider character varying DEFAULT 'stripe'::character varying NOT NULL,
    "eventType" character varying NOT NULL,
    "rawBody" text NOT NULL,
    signature character varying,
    status character varying DEFAULT 'received'::character varying NOT NULL,
    "processedAt" timestamp with time zone,
    "errorMsg" text
);


ALTER TABLE public.webhook_events OWNER TO postgres;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: order_items PK_005269d8574e6fac0493715c308; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY (id);


--
-- Name: products PK_0806c755e0aca124e67c0cf6d7d; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY (id);


--
-- Name: customers PK_133ec679a801fab5e070f73d3ea; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY (id);


--
-- Name: orders PK_710e2d4957aa5878dfe94e4ac2f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: categories_closure PK_dc67f6a82852c15ec6e4243398d; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories_closure
    ADD CONSTRAINT "PK_dc67f6a82852c15ec6e4243398d" PRIMARY KEY (id_ancestor, id_descendant);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: job_queue job_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_pkey PRIMARY KEY (id);


--
-- Name: migration_quarantine migration_quarantine_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migration_quarantine
    ADD CONSTRAINT migration_quarantine_pkey PRIMARY KEY (id);


--
-- Name: migration_runs migration_runs_legacy_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migration_runs
    ADD CONSTRAINT migration_runs_legacy_id_unique UNIQUE ("legacyId");


--
-- Name: migration_runs migration_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migration_runs
    ADD CONSTRAINT migration_runs_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: platform_users platform_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_pkey PRIMARY KEY (id);


--
-- Name: refresh_token_families refresh_token_families_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_token_families
    ADD CONSTRAINT refresh_token_families_pkey PRIMARY KEY (id);


--
-- Name: schedule_overrides schedule_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: service_staff service_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_pkey PRIMARY KEY (id);


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
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: tenant_documents tenant_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_documents
    ADD CONSTRAINT tenant_documents_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: time_off time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_off
    ADD CONSTRAINT time_off_pkey PRIMARY KEY (id);


--
-- Name: webhook_events uq_webhook_event_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT uq_webhook_event_id UNIQUE ("eventId");


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: IDX_208a358e9fe8abe6e1d8245980; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_208a358e9fe8abe6e1d8245980" ON public.orders USING btree ("tenantId");


--
-- Name: IDX_37c1a605468d156e6a8f78f1dc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_37c1a605468d156e6a8f78f1dc" ON public.customers USING btree ("tenantId");


--
-- Name: IDX_51fff5114cc41723e8ca36cf22; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_51fff5114cc41723e8ca36cf22" ON public.categories_closure USING btree (id_descendant);


--
-- Name: IDX_5ada63158a19f87d472a346c5f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_5ada63158a19f87d472a346c5f" ON public.order_items USING btree ("tenantId");


--
-- Name: IDX_6804855ba1a19523ea57e0769b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_6804855ba1a19523ea57e0769b" ON public.products USING btree ("tenantId");


--
-- Name: IDX_bookings_status_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_bookings_status_expires" ON public.bookings USING btree (status, "expiresAt") WHERE (status = 'hold'::text);


--
-- Name: IDX_bookings_tenant_staff_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_bookings_tenant_staff_start" ON public.bookings USING btree ("tenantId", "staffId", "startAt");


--
-- Name: IDX_bookings_tenant_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_bookings_tenant_start" ON public.bookings USING btree ("tenantId", "startAt");


--
-- Name: IDX_ea1e9c4eea91160dfdb4318778; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_ea1e9c4eea91160dfdb4318778" ON public.categories_closure USING btree (id_ancestor);


--
-- Name: IDX_schedules_tenant_staff_dow; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_schedules_tenant_staff_dow" ON public.schedules USING btree ("tenantId", "staffId", "dayOfWeek");


--
-- Name: IDX_services_tenant_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_services_tenant_active" ON public.services USING btree ("tenantId", "isActive");


--
-- Name: IDX_services_tenant_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_services_tenant_category" ON public.services USING btree ("tenantId", "categoryId");


--
-- Name: IDX_time_off_tenant_staff_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_time_off_tenant_staff_range" ON public.time_off USING btree ("tenantId", "staffId", "startAt", "endAt");


--
-- Name: IDX_webhook_events_eventId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_webhook_events_eventId" ON public.webhook_events USING btree ("eventId");


--
-- Name: IDX_webhook_events_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_webhook_events_status_created" ON public.webhook_events USING btree (status, "createdAt");


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity, "entityId");


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree ("tenantId");


--
-- Name: idx_bookings_expires_hold; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_expires_hold ON public.bookings USING btree ("expiresAt") WHERE (status = 'hold'::text);


--
-- Name: idx_bookings_overlap_check; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_overlap_check ON public.bookings USING btree ("tenantId", "staffId", "startAt", "endAt") WHERE (status = ANY (ARRAY['hold'::text, 'pending'::text, 'confirmed'::text]));


--
-- Name: idx_migration_quarantine_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_migration_quarantine_entity ON public.migration_quarantine USING btree (entity, "legacyId");


--
-- Name: idx_migration_quarantine_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_migration_quarantine_tenant ON public.migration_quarantine USING btree ("tenantId");


--
-- Name: idx_migration_runs_legacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_migration_runs_legacy ON public.migration_runs USING btree ("legacyId");


--
-- Name: idx_migration_runs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_migration_runs_status ON public.migration_runs USING btree (status);


--
-- Name: idx_migration_runs_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_migration_runs_tenant ON public.migration_runs USING btree ("tenantId");


--
-- Name: idx_otp_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_expires ON public.otp_verifications USING btree (expires_at);


--
-- Name: idx_otp_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_phone ON public.otp_verifications USING btree (phone);


--
-- Name: idx_rtf_family; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rtf_family ON public.refresh_token_families USING btree (family_id, token_hash) WHERE ((consumed = false) AND (revoked = false));


--
-- Name: idx_rtf_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rtf_user ON public.refresh_token_families USING btree (user_id) WHERE (revoked = false);


--
-- Name: idx_schedule_overrides_staff_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedule_overrides_staff_date ON public.schedule_overrides USING btree ("staffId", date);


--
-- Name: idx_staff_breaks_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_breaks_staff ON public.staff_breaks USING btree ("staffId");


--
-- Name: idx_tenant_documents_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_documents_tenant_id ON public.tenant_documents USING btree ("tenantId");


--
-- Name: idx_users_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tenant_id ON public.users USING btree ("tenantId");


--
-- Name: idx_webhook_events_unprocessed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_events_unprocessed ON public.webhook_events USING btree (status, "createdAt") WHERE ((status)::text = ANY ((ARRAY['received'::character varying, 'failed'::character varying])::text[]));


--
-- Name: categories_closure FK_51fff5114cc41723e8ca36cf227; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories_closure
    ADD CONSTRAINT "FK_51fff5114cc41723e8ca36cf227" FOREIGN KEY (id_descendant) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: order_items FK_cdb99c05982d5191ac8465ac010; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: orders FK_e5de51ca888d8b1f5ac25799dd1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_e5de51ca888d8b1f5ac25799dd1" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: categories_closure FK_ea1e9c4eea91160dfdb4318778d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories_closure
    ADD CONSTRAINT "FK_ea1e9c4eea91160dfdb4318778d" FOREIGN KEY (id_ancestor) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: order_items FK_f1d359a55923bb45b057fbdab0d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: products FK_ff56834e735fa78a15d0cf21926; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES public.categories(id);


--
-- Name: payments payments_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public.bookings(id);


--
-- Name: staff staff_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: tenant_documents tenant_documents_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_documents
    ADD CONSTRAINT "tenant_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_assignedPackageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "tenants_assignedPackageId_fkey" FOREIGN KEY ("assignedPackageId") REFERENCES public.packages(id);


--
-- Name: tenants tenants_requestedPackageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "tenants_requestedPackageId_fkey" FOREIGN KEY ("requestedPackageId") REFERENCES public.packages(id);


--
-- Name: users users_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_overrides; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: service_staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_breaks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff_breaks ENABLE ROW LEVEL SECURITY;

--
-- Name: categories tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.categories USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: payments tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.payments USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: schedule_overrides tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.schedule_overrides USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: schedules tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.schedules USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: service_staff tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.service_staff USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: staff_breaks tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.staff_breaks USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: time_off tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation ON public.time_off USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: bookings tenant_isolation_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation_policy ON public.bookings USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: categories tenant_isolation_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation_policy ON public.categories USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: service_staff tenant_isolation_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation_policy ON public.service_staff USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: services tenant_isolation_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation_policy ON public.services USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: staff tenant_isolation_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tenant_isolation_policy ON public.staff USING (("tenantId" = (current_setting('app.current_tenant'::text))::uuid));


--
-- Name: time_off; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

