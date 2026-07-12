--
-- PostgreSQL database dump
--

\restrict TdrDg7LxSNFQxO8iNEhvyKZ5AuPMDpcHKcnhIAMsdKVd8llfQt0U4ObE4hp5m1T

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

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
-- Name: CommunityType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."CommunityType" AS ENUM (
    'CHANNEL',
    'DIRECT'
);


ALTER TYPE public."CommunityType" OWNER TO postgres;

--
-- Name: MemberRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MemberRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER'
);


ALTER TYPE public."MemberRole" OWNER TO postgres;

--
-- Name: OfficeCategory; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OfficeCategory" AS ENUM (
    'REGULAR',
    'RECORDS'
);


ALTER TYPE public."OfficeCategory" OWNER TO postgres;

--
-- Name: OrganizationType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrganizationType" AS ENUM (
    'REGIONAL',
    'PENRO',
    'CENRO'
);


ALTER TYPE public."OrganizationType" OWNER TO postgres;

--
-- Name: RouteStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RouteStatus" AS ENUM (
    'PENDING',
    'RECEIVED',
    'COMPLETED',
    'RETURNED'
);


ALTER TYPE public."RouteStatus" OWNER TO postgres;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."UserStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Community; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Community" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isGeneral" boolean DEFAULT false NOT NULL,
    "isPrivate" boolean DEFAULT false NOT NULL,
    "ownerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type public."CommunityType" DEFAULT 'CHANNEL'::public."CommunityType" NOT NULL
);


ALTER TABLE public."Community" OWNER TO postgres;

--
-- Name: CommunityAttachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CommunityAttachment" (
    id text NOT NULL,
    "messageId" text NOT NULL,
    "fileName" text NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text NOT NULL,
    "fileSize" integer NOT NULL,
    path text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CommunityAttachment" OWNER TO postgres;

--
-- Name: CommunityMember; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CommunityMember" (
    id text NOT NULL,
    "communityId" text NOT NULL,
    "userId" text NOT NULL,
    role public."MemberRole" DEFAULT 'MEMBER'::public."MemberRole" NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CommunityMember" OWNER TO postgres;

--
-- Name: CommunityMessage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CommunityMessage" (
    id text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text NOT NULL,
    "communityId" text NOT NULL,
    "editedAt" timestamp(3) without time zone,
    "isDeleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."CommunityMessage" OWNER TO postgres;

--
-- Name: CommunityRead; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CommunityRead" (
    id text NOT NULL,
    "communityId" text NOT NULL,
    "userId" text NOT NULL,
    "lastReadAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CommunityRead" OWNER TO postgres;

--
-- Name: Document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "trackingNumber" text NOT NULL,
    "documentTypeId" text NOT NULL,
    "currentStatusId" text NOT NULL,
    "currentOfficeId" text NOT NULL,
    title text NOT NULL,
    description text,
    "referenceNumber" text,
    "createdById" text NOT NULL,
    priority text,
    "confidentialityLevel" text,
    deadline timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "senderContact" text,
    "senderName" text,
    "senderOfficeId" text,
    "senderOrganization" text,
    "senderType" text,
    classification text,
    addressee text,
    "deadlineReminderSent" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Document" OWNER TO postgres;

--
-- Name: DocumentAttachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DocumentAttachment" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "fileName" text NOT NULL,
    "filePath" text NOT NULL,
    "mimeType" text,
    "fileSize" integer,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publicId" text NOT NULL
);


ALTER TABLE public."DocumentAttachment" OWNER TO postgres;

--
-- Name: DocumentLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DocumentLog" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    description text,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DocumentLog" OWNER TO postgres;

--
-- Name: DocumentRoute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DocumentRoute" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "fromOfficeId" text NOT NULL,
    "toOfficeId" text NOT NULL,
    "sentByUserId" text NOT NULL,
    "receivedByUserId" text,
    status public."RouteStatus" DEFAULT 'PENDING'::public."RouteStatus" NOT NULL,
    remarks text,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public."DocumentRoute" OWNER TO postgres;

--
-- Name: DocumentStatus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DocumentStatus" (
    id text NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public."DocumentStatus" OWNER TO postgres;

--
-- Name: DocumentType; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DocumentType" (
    id text NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public."DocumentType" OWNER TO postgres;

--
-- Name: MessageReaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessageReaction" (
    id text NOT NULL,
    "messageId" text NOT NULL,
    "userId" text NOT NULL,
    emoji text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MessageReaction" OWNER TO postgres;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "documentId" text
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: Office; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Office" (
    id text NOT NULL,
    "officeCode" text NOT NULL,
    "officeName" text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "organizationUnitId" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    category public."OfficeCategory" DEFAULT 'REGULAR'::public."OfficeCategory" NOT NULL
);


ALTER TABLE public."Office" OWNER TO postgres;

--
-- Name: OfficeUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OfficeUser" (
    id text NOT NULL,
    "officeId" text NOT NULL,
    "userId" text NOT NULL,
    designation text,
    "isOfficeAdmin" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."OfficeUser" OWNER TO postgres;

--
-- Name: OrganizationUnit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OrganizationUnit" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type public."OrganizationType" NOT NULL,
    description text,
    "parentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."OrganizationUnit" OWNER TO postgres;

--
-- Name: Role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public."Role" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "employeeId" text,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "mobileNumber" text,
    "profileImageId" text,
    "profileImageUrl" text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: UserRole; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserRole" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "roleId" text NOT NULL
);


ALTER TABLE public."UserRole" OWNER TO postgres;

--
-- Name: UserSettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserSettings" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "emailNotifications" boolean DEFAULT true NOT NULL,
    "smsNotifications" boolean DEFAULT false NOT NULL,
    "darkMode" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "notificationSounds" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."UserSettings" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: Community; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Community" (id, name, description, "isGeneral", "isPrivate", "ownerId", "createdAt", type) FROM stdin;
cmr3hvqhm0000vwh8fhxyopda	General	Regionwide discussion for all DENR Caraga personnel.	t	f	\N	2026-07-02 12:42:45.85	CHANNEL
cmr4uie0j000cvwlco0ekztoc		\N	f	t	\N	2026-07-03 11:24:04.339	DIRECT
cmr5mdp2s001cvwh4phvs4lpg		\N	f	t	\N	2026-07-04 00:24:14.644	DIRECT
cmr5wv8j8000kvwmsxp90eo7k		\N	f	t	\N	2026-07-04 05:17:49.173	DIRECT
cmr5x4v4a000ovwmst9asupus		\N	f	t	\N	2026-07-04 05:25:18.346	DIRECT
cmr5y7g3c001avwmseyi4mk4j		\N	f	t	\N	2026-07-04 05:55:18.457	DIRECT
cmr5yclts001evwmsbqr609ml		\N	f	t	\N	2026-07-04 05:59:19.169	DIRECT
cmr63ps470009vwzgmgbqz4x0	ICT Team	This is a test Channel	f	f	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-04 08:29:31.927	CHANNEL
\.


--
-- Data for Name: CommunityAttachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CommunityAttachment" (id, "messageId", "fileName", "originalName", "mimeType", "fileSize", path, "createdAt") FROM stdin;
cmr8hkvgh002jvwho0k8kxhpm	cmr8hkvg1002hvwhoaolabx12	1783297989926.pdf	DOC-2026-000014-routing-slip.pdf	application/pdf	88881	/uploads/community/1783297989926.pdf	2026-07-06 00:33:09.954
cmr8i3lj7001jvwm0cop6zkj2	cmr8i3lj6001hvwm0505q3mu2	1783298863545.png	ChatGPT Image Jul 5, 2026, 04_37_18 PM.png	image/png	1093497	/uploads/community/1783298863545.png	2026-07-06 00:47:43.556
cmr8j7t6a002fvwm0s5awljk0	cmr8j7t5w002dvwm0ny20cs2z	1783300739679.jfif	4294ebfb-b6ec-454f-a526-80c2c0aafe02 (1).jfif	image/jpeg	332355	/uploads/community/1783300739679.jfif	2026-07-06 01:18:59.699
cmr8jlea4001hvwco2dt1qixa	cmr8jlea2001fvwco16ucasne	1783301373572.png	image.png	image/png	80416	/uploads/community/1783301373572.png	2026-07-06 01:29:33.581
cmr8mqn86007nvw8g32314qgb	cmr8mqn83007lvw8g3896t2rc	1783306657268.png	edats caraga.png	image/png	25249	/uploads/community/1783306657268.png	2026-07-06 02:57:37.302
\.


--
-- Data for Name: CommunityMember; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CommunityMember" (id, "communityId", "userId", role, "joinedAt") FROM stdin;
cmr3hvqhq0002vwh88tbd3cir	cmr3hvqhm0000vwh8fhxyopda	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-02 12:42:45.854
cmr43vrej0009vwyk8e7j9gew	cmr3hvqhm0000vwh8fhxyopda	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEMBER	2026-07-02 22:58:38.587
cmr4uie0j000evwlcm03yweb6	cmr4uie0j000cvwlco0ekztoc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-03 11:24:04.339
cmr4uie0j000fvwlcdery39dn	cmr4uie0j000cvwlco0ekztoc	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEMBER	2026-07-03 11:24:04.339
cmr5mdp2s001evwh4e6acon5r	cmr5mdp2s001cvwh4phvs4lpg	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-04 00:24:14.644
cmr5mdp2s001fvwh42nzp8oym	cmr5mdp2s001cvwh4phvs4lpg	c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	MEMBER	2026-07-04 00:24:14.644
cmr5wv8j9000mvwms5tyk9lng	cmr5wv8j8000kvwmsxp90eo7k	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-04 05:17:49.173
cmr5wv8j9000nvwms65s4ect2	cmr5wv8j8000kvwmsxp90eo7k	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	MEMBER	2026-07-04 05:17:49.173
cmr5x4v4a000qvwmsumro3sv1	cmr5x4v4a000ovwmst9asupus	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-04 05:25:18.346
cmr5x4v4a000rvwmsfrj0oh3i	cmr5x4v4a000ovwmst9asupus	42932359-6f58-4095-8654-88c4bd10bc45	MEMBER	2026-07-04 05:25:18.346
cmr5y7g3c001cvwms8z7muixz	cmr5y7g3c001avwmseyi4mk4j	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-04 05:55:18.457
cmr5y7g3c001dvwmse4knphdl	cmr5y7g3c001avwmseyi4mk4j	fb0c300b-2665-4fd1-a8a8-38980e919616	MEMBER	2026-07-04 05:55:18.457
cmr5yclts001gvwmsr62uk9dk	cmr5yclts001evwmsbqr609ml	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEMBER	2026-07-04 05:59:19.169
cmr5yclts001hvwmsvtd5ysgt	cmr5yclts001evwmsbqr609ml	23a4f2bc-6716-49b3-962a-ad3ca9b0503f	MEMBER	2026-07-04 05:59:19.169
cmr60rj42000fvw5wjrj1x8w0	cmr3hvqhm0000vwh8fhxyopda	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	MEMBER	2026-07-04 07:06:54.722
cmr63ps47000bvwzgvk6k8tok	cmr63ps470009vwzgmgbqz4x0	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	OWNER	2026-07-04 08:29:31.927
cmr63ps47000cvwzg2ikj2okb	cmr63ps470009vwzgmgbqz4x0	c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	MEMBER	2026-07-04 08:29:31.927
cmr63ps47000dvwzgz6cmi86k	cmr63ps470009vwzgmgbqz4x0	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEMBER	2026-07-04 08:29:31.927
cmr63ps47000evwzgss5ct1k3	cmr63ps470009vwzgmgbqz4x0	e84a98d7-bd0d-42fb-b887-7d568ce950c1	MEMBER	2026-07-04 08:29:31.927
cmr6bju99000ivwvkyeortedn	cmr63ps470009vwzgmgbqz4x0	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	MEMBER	2026-07-04 12:08:51.693
\.


--
-- Data for Name: CommunityMessage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CommunityMessage" (id, message, "createdAt", "updatedAt", "userId", "communityId", "editedAt", "isDeleted") FROM stdin;
cmr4hq3eu0011vwycret06rx4	try this message	2026-07-03 05:26:08.838	2026-07-03 05:26:08.838	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4hr3ud0017vwycomkdfdrv	very good lagi ni?	2026-07-03 05:26:56.054	2026-07-03 05:26:56.054	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4hwcmu001dvwyci73q9edg	test again for this chat	2026-07-03 05:31:00.726	2026-07-03 05:31:00.726	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ifdel001nvwycu3jkf0pk	test test	2026-07-03 05:45:48.189	2026-07-03 05:45:48.189	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ix6z9000hvw7sd5lzjx0z	asa ni tama	2026-07-03 05:59:39.669	2026-07-03 05:59:39.669	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ix7t0000jvw7sgkz14ocx	d	2026-07-03 05:59:40.74	2026-07-03 05:59:40.74	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ix8m4000lvw7s8996e3hl	d	2026-07-03 05:59:41.788	2026-07-03 05:59:41.788	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ix92j000nvw7sg3c11s7c	d	2026-07-03 05:59:42.38	2026-07-03 05:59:42.38	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ix9gz000pvw7scsmlyb59	d	2026-07-03 05:59:42.9	2026-07-03 05:59:42.9	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ix9tv000rvw7sjy1syyda	d	2026-07-03 05:59:43.364	2026-07-03 05:59:43.364	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ixa5w000tvw7spxt2bgp5	d	2026-07-03 05:59:43.796	2026-07-03 05:59:43.796	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ixagj000vvw7szni8hcip	d	2026-07-03 05:59:44.18	2026-07-03 05:59:44.18	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ixapg000xvw7shi6o8ls9	d	2026-07-03 05:59:44.5	2026-07-03 05:59:44.5	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ixawb000zvw7siamymljt	d	2026-07-03 05:59:44.748	2026-07-03 05:59:44.748	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ixb3n0011vw7sfkstbhnh	d	2026-07-03 05:59:45.012	2026-07-03 05:59:45.012	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4ixbas0013vw7s3v5dsnbl	d	2026-07-03 05:59:45.268	2026-07-03 05:59:45.268	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4j5sp0001dvw7s1wc27i2k	test again this	2026-07-03 06:06:21.06	2026-07-03 06:06:21.06	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4j88ln001nvw7s2yqlz7rs	test 222	2026-07-03 06:08:14.987	2026-07-03 06:08:14.987	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4jeg8j001xvw7s8gzubtus	tesst aggaiinn ahahah	2026-07-03 06:13:04.819	2026-07-03 06:13:04.819	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4jeo9n001zvw7s79rkl3fz	yes it is	2026-07-03 06:13:15.227	2026-07-03 06:13:15.227	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4mo8l1002pvwyoi1hz1hh4	try again this	2026-07-03 07:44:40.309	2026-07-03 07:44:40.309	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4moerg002rvwyon4hxkt0y	ok man lagi	2026-07-03 07:44:48.317	2026-07-03 07:44:48.317	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4mok98002tvwyo6lztwbg5	mao gani	2026-07-03 07:44:55.437	2026-07-03 07:44:55.437	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4mozl9002vvwyok1vb9jm6	kinsa nag ingon nga sili	2026-07-03 07:45:15.309	2026-07-03 07:45:15.309	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4mpy6l0035vwyo6c1eeqrz	nagno man jud	2026-07-03 07:46:00.142	2026-07-03 07:46:00.142	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4mtjap003rvwyo22d3nofh	try this	2026-07-03 07:48:47.474	2026-07-03 07:48:47.474	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4muiy9003xvwyo9pq4fjld	this is it?	2026-07-03 07:49:33.682	2026-07-03 07:49:33.682	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4mumzl003zvwyo5tkg0qys	okay	2026-07-03 07:49:38.913	2026-07-03 07:49:38.913	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4n6uru004hvwyo4c5gmqzb	beh buti nga	2026-07-03 07:59:08.874	2026-07-03 07:59:08.874	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4n711e004jvwyotugsvk0n	bebebe boti nga	2026-07-03 07:59:16.994	2026-07-03 07:59:16.994	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4n7z3f004lvwyoee5b0ryp	awesome?	2026-07-03 08:00:01.131	2026-07-03 08:00:01.131	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4n83w2004nvwyodt02dmlv	yes	2026-07-03 08:00:07.347	2026-07-03 08:00:07.347	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr4uvwfx0009vwfw1xfa1g3h	test message	2026-07-03 11:34:34.75	2026-07-03 11:34:34.75	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr4uwg1p000bvwfwh9cq8pwa	uy hehe	2026-07-03 11:35:00.157	2026-07-03 11:35:00.157	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr4uwn1p000dvwfwexwd9t8y	mao ra man diay ni hehe	2026-07-03 11:35:09.229	2026-07-03 11:35:09.229	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr4uwszx000fvwfw8bi5t70o	gani ahahah	2026-07-03 11:35:16.941	2026-07-03 11:35:16.941	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr5kzeyp000dvwag4lx2z8oh	hakhak	2026-07-03 23:45:08.738	2026-07-03 23:45:08.738	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr5kzkep000fvwag1ahchqoo	mao ra diay ni	2026-07-03 23:45:15.794	2026-07-03 23:45:15.794	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr5kzw6x000hvwaga09bzrwu	oo ahaha	2026-07-03 23:45:31.065	2026-07-03 23:45:31.065	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr5mgok8001lvwh4dd63zuv7	try ahaha	2026-07-04 00:26:33.945	2026-07-04 00:26:33.945	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5mdp2s001cvwh4phvs4lpg	\N	f
cmr5xc4us000xvwmsqkppg3yi	hello	2026-07-04 05:30:57.557	2026-07-04 05:30:57.557	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr5xcdnf000zvwmsuah4i23l	hala	2026-07-04 05:31:08.956	2026-07-04 05:31:08.956	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr5xckyz0011vwms6pbps5ut	y	2026-07-04 05:31:18.444	2026-07-04 05:31:18.444	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr4uie0j000cvwlco0ekztoc	\N	f
cmr60rpy6000jvw5w5hwzd53f	hello	2026-07-04 07:07:03.582	2026-07-04 07:07:03.582	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr63qybl000lvwzgh8iaexpi	hello	2026-07-04 08:30:26.626	2026-07-04 08:30:26.626	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr63r4u2000nvwzgqj04rwsh	yup	2026-07-04 08:30:35.066	2026-07-04 08:30:35.066	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6bk8tl000uvwvkpa05c9zl	yes	2026-07-04 12:09:10.569	2026-07-04 12:09:10.569	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6bkjv6000wvwvkpyzsulql	ahahah	2026-07-04 12:09:24.882	2026-07-04 12:09:24.882	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6bws00002gvwvkg6b50ean	test this	2026-07-04 12:18:55.297	2026-07-04 12:18:55.297	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dkt0d001tvw7khbv1eqag	try this oned	2026-07-04 13:05:35.966	2026-07-04 13:05:35.966	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dldae0023vw7ksq5sz7dt	awesome!!	2026-07-04 13:06:02.246	2026-07-04 13:06:02.246	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dlrkt0029vw7ks6jwk9yk	yes this is it??	2026-07-04 13:06:20.766	2026-07-04 13:06:20.766	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dth2d003jvw7ktr2phd4u	try this at home	2026-07-04 13:12:20.39	2026-07-04 13:12:20.39	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dtq38003nvw7kjchwidxh	why is this	2026-07-04 13:12:32.085	2026-07-04 13:12:32.085	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dtxod003vvw7ki14qidc3	ahahah	2026-07-04 13:12:41.918	2026-07-04 13:12:41.918	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dugl9004dvw7kidzhbt81	test again	2026-07-04 13:13:06.429	2026-07-04 13:13:06.429	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6duje5004jvw7k4vfq9pc7	ahaha	2026-07-04 13:13:10.061	2026-07-04 13:13:10.061	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6dv4id0055vw7k1x0c2u9x	hi	2026-07-04 13:13:37.429	2026-07-04 13:13:37.429	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr6dv71g0059vw7k4tdih11a	hello	2026-07-04 13:13:40.709	2026-07-04 13:13:40.709	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr6dve39005hvw7kv46lzazc	uy	2026-07-04 13:13:49.846	2026-07-04 13:13:49.846	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr6yl6pp000xvwmchtmxfxdk	test	2026-07-04 22:53:45.662	2026-07-04 22:53:45.662	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr6ylicl0015vwmcov033fhz	mike	2026-07-04 22:54:00.741	2026-07-04 22:54:00.741	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr706ukb0019vw0sus5gdien	hello	2026-07-04 23:38:35.964	2026-07-04 23:38:35.964	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr70ardn001nvw0sbnf9o4mu	yes	2026-07-04 23:41:38.46	2026-07-04 23:41:38.46	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr70bn7t0029vw0szo5t1t44	hello	2026-07-04 23:42:19.721	2026-07-04 23:42:19.721	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr70byih002hvw0sksgx9m65	yes hello	2026-07-04 23:42:34.362	2026-07-04 23:42:34.362	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr70jeoi0031vw0s5lbdgyrt	hello telepon	2026-07-04 23:48:21.906	2026-07-04 23:48:21.906	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr70jvyj003dvw0s7x96vnw3	ahahah	2026-07-04 23:48:44.3	2026-07-04 23:48:44.3	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr70xr6l004tvw0si7l68qky	beh ato daw itry?	2026-07-04 23:59:31.294	2026-07-04 23:59:31.294	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr70y5wf0055vw0s7ellpl3m	aw okay man diay	2026-07-04 23:59:50.368	2026-07-04 23:59:50.368	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr70yek1005dvw0s051551f8	okay bitaw ahaha	2026-07-05 00:00:01.585	2026-07-05 00:00:01.585	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr70z5ul005tvw0sm2fge71k	itry daw nato diri?	2026-07-05 00:00:36.957	2026-07-05 00:00:36.957	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr70zhfr005zvw0svocsq718	ahahah sakto na	2026-07-05 00:00:51.975	2026-07-05 00:00:51.975	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr70zzla006dvw0sfzrvxqrh	ahaha sakto na jud	2026-07-05 00:01:15.502	2026-07-05 00:01:15.502	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr7106g2006hvw0sezp3ial5	pgka dabong	2026-07-05 00:01:24.387	2026-07-05 00:01:24.387	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr710c17006nvw0sovgbg94m	ahahah	2026-07-05 00:01:31.628	2026-07-05 00:01:31.628	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr73csln007rvw0spfdfa2d1	test daw	2026-07-05 01:07:12.204	2026-07-05 01:07:12.204	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr73duuc0081vw0sbwkuauqf	ahahaha this is it	2026-07-05 01:08:01.765	2026-07-05 01:08:01.765	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr73frot008rvw0sygknd4mh	awesome!!	2026-07-05 01:09:30.99	2026-07-05 01:09:30.99	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr73nsn10099vw0sgfaxkh0f	test testttt	2026-07-05 01:15:45.469	2026-07-05 01:15:45.469	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr73oi5a009jvw0sinzbaha6	test test	2026-07-05 01:16:18.526	2026-07-05 01:16:18.526	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr73p572009tvw0s1dw579to	direct test	2026-07-05 01:16:48.399	2026-07-05 01:16:48.399	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr73qbyo00abvw0sj7qrxpqc	try agaiin	2026-07-05 01:17:43.824	2026-07-05 01:17:43.824	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr73qmvj00ajvw0sehx9mltj	this is it	2026-07-05 01:17:57.968	2026-07-05 01:17:57.968	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr748qiy00dbvw0sisn4nm9d	test ahaha	2026-07-05 01:32:02.506	2026-07-05 01:32:02.506	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr74b6hn00dzvw0sbvo56ar5	wala lagi ni?	2026-07-05 01:33:56.507	2026-07-05 01:33:56.507	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr74n0h400f3vw0s9pkabyut	okay na ba kaha ni?	2026-07-05 01:43:08.584	2026-07-05 01:43:08.584	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr74nhcg00fdvw0siirxct00	wala lagi gihapon?	2026-07-05 01:43:30.448	2026-07-05 01:43:30.448	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr74nweg00fjvw0sbwfb0g10	peke man ni oi	2026-07-05 01:43:49.96	2026-07-05 01:43:49.96	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr74vxe300gdvw0swpilqwze	test daw beh	2026-07-05 01:50:04.492	2026-07-05 01:50:04.492	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr74wpqb00h3vw0s8x6w29xq	test daw utro nako	2026-07-05 01:50:41.219	2026-07-05 01:50:41.219	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr74x54r00h7vw0scr1xqg8e	hala nigana lagi ni?	2026-07-05 01:51:01.18	2026-07-05 01:51:01.18	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr74xmp800hdvw0ssr8qd41e	dri daw ta sa direct	2026-07-05 01:51:23.948	2026-07-05 01:51:23.948	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr74y6cc00hvvw0smw9q71v6	nigana siya?	2026-07-05 01:51:49.405	2026-07-05 01:51:49.405	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr74z6as00itvw0s510hq07u	wow ha?	2026-07-05 01:52:36.004	2026-07-05 01:52:36.004	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr74ze6c00ixvw0sde5909z7	unya ngano man ni?	2026-07-05 01:52:46.212	2026-07-05 01:52:46.212	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr752m2000jrvw0sj35c27ej	dsadsad	2026-07-05 01:55:16.392	2026-07-05 01:55:16.392	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr7532hu00jvvw0sq6k380d4	test	2026-07-05 01:55:37.698	2026-07-05 01:55:37.698	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr753iru00jzvw0sg4rui4k1	fdfdfdf	2026-07-05 01:55:58.795	2026-07-05 01:55:58.795	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr75di4o00kfvw0sbiji4cwt	test again	2026-07-05 02:03:44.52	2026-07-05 02:03:44.52	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr75oqbt00lrvw0s763nk0fb	beh daw beh	2026-07-05 02:12:28.361	2026-07-05 02:12:28.361	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr75p3u900m1vw0s0i5hniks	kini daw	2026-07-05 02:12:45.873	2026-07-05 02:12:45.873	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr75q2tt00n9vw0s9dxavr8r	try daw nako utro	2026-07-05 02:13:31.218	2026-07-05 02:13:31.218	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr75qsyx00o1vw0symxwyf8g	last again	2026-07-05 02:14:05.097	2026-07-05 02:14:05.097	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr75snh500pfvw0s4csw0119	kini daw	2026-07-05 02:15:31.29	2026-07-05 02:15:31.29	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr75swhl00pjvw0stgjz2oke	try uro	2026-07-05 02:15:42.97	2026-07-05 02:15:42.97	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr75rp6900onvw0sr8yteejw	beh daw beh kung maedit bah	2026-07-05 02:14:46.833	2026-07-05 06:56:42.87	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	2026-07-05 06:56:42.869	f
cmr75r7op00obvw0scgbu1olq	This message was deleted.	2026-07-05 02:14:24.169	2026-07-05 06:57:41.802	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	t
cmr75ua5u00qbvw0shjs9bl8k	this is a try	2026-07-05 02:16:47.347	2026-07-05 02:16:47.347	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr769hyc002hvwvganw7rt7r	unsa man	2026-07-05 02:28:37.285	2026-07-05 02:28:37.285	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr76a5l8002nvwvgtiek6683	mao ra man to	2026-07-05 02:29:07.917	2026-07-05 02:29:07.917	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8mny6p006tvw8gjzmca6ee	oka na ba ni?	2026-07-06 02:55:31.538	2026-07-06 02:55:31.538	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8mo6za0071vw8gsu45wd1j	yes okay na	2026-07-06 02:55:42.934	2026-07-06 02:55:42.934	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr75dzzs00l5vw0sv76j911b	This message was deleted.	2026-07-05 02:04:07.672	2026-07-05 06:59:08.732	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	2026-07-05 06:58:50.003	t
cmr75t7fd00prvw0szjx4t67i	try again 2	2026-07-05 02:15:57.146	2026-07-05 07:00:05.7	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	2026-07-05 07:00:05.699	f
cmr76ad4s002tvwvgbakb77b3	ngano man diay kuno?	2026-07-05 02:29:17.693	2026-07-05 07:00:51.28	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	2026-07-05 07:00:51.279	f
cmr7g0yoc002dvwdkiy2qt5gr	ahahah	2026-07-05 07:01:55.212	2026-07-05 07:01:55.212	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr7g196b002jvwdka7mpdb0x	katawa man ka	2026-07-05 07:02:08.819	2026-07-05 07:02:08.819	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr766dst001tvwvgi6ctogps	try this again	2026-07-05 02:26:11.933	2026-07-05 10:39:39.392	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	2026-07-05 10:39:39.39	f
cmr8e2vqy000hvw7guk8lkjf4	hello	2026-07-05 22:55:11.674	2026-07-05 22:55:11.674	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8e3s9r0013vw7g12qvhzmz	yes	2026-07-05 22:55:53.823	2026-07-05 22:55:53.823	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8edrhq001jvw7gydj44uni	❤️ ahahah	2026-07-05 23:03:39.374	2026-07-05 23:03:39.374	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8ee7uo001pvw7gm9hhj09u	👍	2026-07-05 23:04:00.577	2026-07-05 23:04:00.577	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8eetgb001vvw7gw8mcua3f	😆 mo try daw kog taas kaayo nga message ug ok ba tan-awon	2026-07-05 23:04:28.571	2026-07-05 23:04:28.571	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8hkvg1002hvwhoaolabx12	this is a test messages	2026-07-06 00:33:09.937	2026-07-06 00:33:09.937	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8hnld10031vwhoskgj4uu0	wala lagi	2026-07-06 00:35:16.837	2026-07-06 00:35:16.837	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8i30o60015vwm0uawvzy5f	try kuno beh	2026-07-06 00:47:16.518	2026-07-06 00:47:16.518	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8i39fz001bvwm0gmeso8p3	naa na jud	2026-07-06 00:47:27.887	2026-07-06 00:47:27.887	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8i3lj6001hvwm0505q3mu2	test 2	2026-07-06 00:47:43.554	2026-07-06 00:47:43.554	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8j7t5w002dvwm0ny20cs2z	❤️ try daw kuno beh	2026-07-06 01:18:59.685	2026-07-06 01:18:59.685	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8jlea2001fvwco16ucasne		2026-07-06 01:29:33.578	2026-07-06 01:29:33.578	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8ligo60029vw441f3ultwr	try daw nako ni beh	2026-07-06 02:23:15.942	2026-07-06 02:23:15.942	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8livdf002hvw449e8845go	ngano wala man ni abot	2026-07-06 02:23:34.995	2026-07-06 02:23:34.995	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8ljci8002rvw44dti67hnw	wala ni abot ang notify	2026-07-06 02:23:57.201	2026-07-06 02:23:57.201	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8ljoib002zvw4472sglmm0	ngano kaha	2026-07-06 02:24:12.756	2026-07-06 02:24:12.756	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8ll85l0039vw44d1boi0te	wala niabot ang unread	2026-07-06 02:25:24.873	2026-07-06 02:25:24.873	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8lmlyt0045vw44066y8g3w	mao siguro ni dahilan?	2026-07-06 02:26:29.429	2026-07-06 02:26:29.429	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8lmsds0049vw44q1p3lotv	uy wala lagi gihapon	2026-07-06 02:26:37.744	2026-07-06 02:26:37.744	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8ln7p8004tvw4404x89jm8	ngano wla man gihapon	2026-07-06 02:26:57.596	2026-07-06 02:26:57.596	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8lnmen0053vw44zzj7vvwx	ngano wala man gihapon	2026-07-06 02:27:16.655	2026-07-06 02:27:16.655	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8m3ct4000tvw8ggmojo8fq	bitaw no ngano wala?	2026-07-06 02:39:30.712	2026-07-06 02:39:30.712	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8m3v29000zvw8g9359mt0r	ahhy naa na diay	2026-07-06 02:39:54.369	2026-07-06 02:39:54.369	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8m4f0k0019vw8gwop6uqem	ahhaha naa na diay	2026-07-06 02:40:20.228	2026-07-06 02:40:20.228	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8m4uxv001jvw8gbkxtqkla	naa na oi ahahah	2026-07-06 02:40:40.868	2026-07-06 02:40:40.868	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8m53cn001rvw8gkkqs51sx	ahahah	2026-07-06 02:40:51.768	2026-07-06 02:40:51.768	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8m6pmv002hvw8g39bpevtd	Ict asa na	2026-07-06 02:42:07.303	2026-07-06 02:42:07.303	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8m6xyj002pvw8gjzjzo03l	naa ra man ko	2026-07-06 02:42:18.091	2026-07-06 02:42:18.091	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8m77ic002zvw8ges7dofr1	ahahah naa na	2026-07-06 02:42:30.469	2026-07-06 02:42:30.469	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr8m7j810039vw8gstfqy2lm	correct?	2026-07-06 02:42:45.65	2026-07-06 02:42:45.65	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8mmzbh005xvw8g7br9vvyk	okay na man siguro ni	2026-07-06 02:54:46.349	2026-07-06 02:54:46.349	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8mnijr006dvw8gedcicr2w	okay na ba ni?	2026-07-06 02:55:11.271	2026-07-06 02:55:11.271	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr8moh270079vw8gdeqsba0w	kini daw?	2026-07-06 02:55:55.999	2026-07-06 02:55:55.999	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8montm007fvw8gqgiwj03z	ahh okay napud	2026-07-06 02:56:04.762	2026-07-06 02:56:04.762	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8mqn83007lvw8g3896t2rc	try daw nako ni	2026-07-06 02:57:37.299	2026-07-06 02:57:37.299	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr8mnp8j006jvw8gizpyht31	test test	2026-07-06 02:55:19.94	2026-07-06 11:10:06.006	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	2026-07-06 11:10:06.004	f
cmr9ty15s000lvwf46oabphl9	hello	2026-07-06 23:07:05.441	2026-07-06 23:07:05.441	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9tyjno000xvwf4eion6f8n	uy	2026-07-06 23:07:29.412	2026-07-06 23:07:29.412	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9u02nr0017vwf4vi7uwsxb	nice 👍	2026-07-06 23:08:40.695	2026-07-06 23:08:40.695	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9u0pzi001dvwf4o3z6jkka	awesome! 😍	2026-07-06 23:09:10.926	2026-07-06 23:09:10.926	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9ueuwg0023vwf4p8jm4zjk	sound test	2026-07-06 23:20:10.481	2026-07-06 23:20:10.481	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9uf5vo002bvwf44taevpfu	ahahah	2026-07-06 23:20:24.709	2026-07-06 23:20:24.709	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9ufsmw002hvwf42dgq3ksm	mike check	2026-07-06 23:20:54.201	2026-07-06 23:20:54.201	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vntk9003jvwf4i4wll7kb	eno two	2026-07-06 23:55:08.266	2026-07-06 23:55:08.266	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vo72v003xvwf4za9vxgqm	tree four	2026-07-06 23:55:25.784	2026-07-06 23:55:25.784	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vp1hj004bvwf4csmfx0xq	y man mo sounds pa ni	2026-07-06 23:56:05.191	2026-07-06 23:56:05.191	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vpevj004hvwf4vbkevkqr	y man?	2026-07-06 23:56:22.544	2026-07-06 23:56:22.544	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vushz0053vwf4s9672uw4	test	2026-07-07 00:00:33.479	2026-07-07 00:00:33.479	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vv1pj0059vwf4ivto1uwg	oh common	2026-07-07 00:00:45.415	2026-07-07 00:00:45.415	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9vzzpx005nvwf47s7jvg00	test	2026-07-07 00:04:36.118	2026-07-07 00:04:36.118	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9w0sye005zvwf4m2w6dhbh	test	2026-07-07 00:05:14.007	2026-07-07 00:05:14.007	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9w1t8p006bvwf4u1ux8bvq	test 2	2026-07-07 00:06:01.034	2026-07-07 00:06:01.034	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9w4cci006nvwf4z9kwmsb0	testtt	2026-07-07 00:07:59.106	2026-07-07 00:07:59.106	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9w5an4006zvwf4f40ku11v	test 333	2026-07-07 00:08:43.552	2026-07-07 00:08:43.552	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9w60fj007lvwf48aflau3a	ngano man ni	2026-07-07 00:09:16.976	2026-07-07 00:09:16.976	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wcuv4008nvwf4qe2bwjui	try daw beh	2026-07-07 00:14:36.352	2026-07-07 00:14:36.352	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wk3qv009pvwf4bnfolfyb	try daw be	2026-07-07 00:20:14.455	2026-07-07 00:20:14.455	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wkbo7009vvwf43rrhpkyw	hala okay na?	2026-07-07 00:20:24.727	2026-07-07 00:20:24.727	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wkuec00a9vwf4zeyp1xw8	okay na ni?	2026-07-07 00:20:48.996	2026-07-07 00:20:48.996	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wla3200anvwf4uxdfpqzq	okay na diay? ahaha	2026-07-07 00:21:09.326	2026-07-07 00:21:09.326	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wmq0000b1vwf41zqenlf6	dapat dili ni mo sound	2026-07-07 00:22:16.609	2026-07-07 00:22:16.609	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wnbsu00bfvwf43fq9etys	ngano mo sound man gihapon?	2026-07-07 00:22:44.863	2026-07-07 00:22:44.863	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wocgr00btvwf4mamrzyhi	try daw	2026-07-07 00:23:32.38	2026-07-07 00:23:32.38	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wol6u00bzvwf4ol0w6r7c	try this	2026-07-07 00:23:43.686	2026-07-07 00:23:43.686	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wq45p00cdvwf4aujrqvvv	test	2026-07-07 00:24:54.926	2026-07-07 00:24:54.926	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9wqkku00cpvwf4an1aoeih	test 2	2026-07-07 00:25:16.206	2026-07-07 00:25:16.206	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x2kyp00dhvwf4hskki660	test	2026-07-07 00:34:36.577	2026-07-07 00:34:36.577	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x2yb900dtvwf4u18yzkvs	test 3434	2026-07-07 00:34:53.877	2026-07-07 00:34:53.877	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x3i6i00edvwf4auvpaxz6	test 3434345666	2026-07-07 00:35:19.626	2026-07-07 00:35:19.626	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x3sr800ervwf4nlfwkqpb	pagka dabong	2026-07-07 00:35:33.333	2026-07-07 00:35:33.333	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x4ckc00f5vwf4fger6v68	bitaw	2026-07-07 00:35:59.005	2026-07-07 00:35:59.005	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x4hbc00fbvwf414yg9l6h	pero kini	2026-07-07 00:36:05.161	2026-07-07 00:36:05.161	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x5ry100fxvwf4z1lueh55	test	2026-07-07 00:37:05.593	2026-07-07 00:37:05.593	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x65eq00gbvwf4l20khami	ngano ma ni	2026-07-07 00:37:23.043	2026-07-07 00:37:23.043	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x6aas00ghvwf491dgfbax	aw	2026-07-07 00:37:29.38	2026-07-07 00:37:29.38	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x6nzg00gvvwf4st4l0tbr	hala	2026-07-07 00:37:47.116	2026-07-07 00:37:47.116	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x6z6p00h1vwf4uhvog9w7	diba dili dapat mosound?	2026-07-07 00:38:01.634	2026-07-07 00:38:01.634	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x77mo00h7vwf4i7fm4zet	kini ang dapat mo sound	2026-07-07 00:38:12.577	2026-07-07 00:38:12.577	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x7a0v00hdvwf4nc9hbfkq	tama	2026-07-07 00:38:15.68	2026-07-07 00:38:15.68	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x7dro00hjvwf4rm6tfmy9	kini dili	2026-07-07 00:38:20.532	2026-07-07 00:38:20.532	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x91z000hxvwf4o8vme67g	test	2026-07-07 00:39:38.556	2026-07-07 00:39:38.556	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x9hkw00ibvwf41ltgqgeo	kini dili	2026-07-07 00:39:58.784	2026-07-07 00:39:58.784	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9x9o8k00ihvwf4wxt7rm3j	kini mo sound	2026-07-07 00:40:07.412	2026-07-07 00:40:07.412	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xa1ru00irvwf4w9wm0r8n	try daw	2026-07-07 00:40:24.955	2026-07-07 00:40:24.955	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xbgz100jjvwf41ic2matl	test	2026-07-07 00:41:31.309	2026-07-07 00:41:31.309	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9xr1fn00kvvwf4hiavr0o9	try daw beh	2026-07-07 00:53:37.667	2026-07-07 00:53:37.667	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9xre2300l3vwf4i53tciqs	ngano man dili mo daound	2026-07-07 00:53:54.027	2026-07-07 00:53:54.027	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9xrwui00lhvwf4o3ron0k2	wala lagi ni sound?	2026-07-07 00:54:18.378	2026-07-07 00:54:18.378	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9xs2ni00llvwf4ma1gjdas	kung kini daw	2026-07-07 00:54:25.903	2026-07-07 00:54:25.903	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xslgg00m5vwf4tdqeapdz	dapat mo saound ni	2026-07-07 00:54:50.273	2026-07-07 00:54:50.273	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9xssae00mdvwf402v643d8	wala napud ni sound	2026-07-07 00:54:59.127	2026-07-07 00:54:59.127	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9xu3am00mzvwf4007dcxlu	whay man	2026-07-07 00:56:00.047	2026-07-07 00:56:00.047	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xxz9300ntvwf48t3ribrh	test test	2026-07-07 00:59:01.431	2026-07-07 00:59:01.431	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xyba600o7vwf4bakrfr1x	test test test	2026-07-07 00:59:17.022	2026-07-07 00:59:17.022	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xyq9k00olvwf4qiozkt84	test 333	2026-07-07 00:59:36.441	2026-07-07 00:59:36.441	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xyu6p00orvwf4yg5z9yuv	again	2026-07-07 00:59:41.521	2026-07-07 00:59:41.521	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xzbff00p5vwf4qh9hfn1e	dapat sili ni mo sound	2026-07-07 01:00:03.868	2026-07-07 01:00:03.868	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xzfem00pbvwf4kxtd1wfb	tama	2026-07-07 01:00:09.022	2026-07-07 01:00:09.022	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9xzr5h00ppvwf4xmfuq8x7	kini mo sound na ni	2026-07-07 01:00:24.246	2026-07-07 01:00:24.246	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9y03et00pzvwf4txh3hvmq	kini pud dapat mo sound na	2026-07-07 01:00:40.133	2026-07-07 01:00:40.133	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9ycl7g00r3vwf4dmdhvz5q	test	2026-07-07 01:10:23.069	2026-07-07 01:10:23.069	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9ycrh500r9vwf4ood6nmmw	okay test	2026-07-07 01:10:31.193	2026-07-07 01:10:31.193	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9yd3yu00rjvwf41uh3m87g	kini daw test	2026-07-07 01:10:47.382	2026-07-07 01:10:47.382	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9ydgeb00rrvwf4yuf7zn4x	ahahah sak to	2026-07-07 01:11:03.492	2026-07-07 01:11:03.492	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9ydrck00s1vwf4loutycfg	kini daw napud	2026-07-07 01:11:17.684	2026-07-07 01:11:17.684	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9ye2sv00s9vwf4rh4our4c	ahaha tamam	2026-07-07 01:11:32.527	2026-07-07 01:11:32.527	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9yetbo00srvwf4v0xiko8o	test napu daw	2026-07-07 01:12:06.901	2026-07-07 01:12:06.901	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9yfzws00tlvwf4fo5w1qah	try daw ni besh	2026-07-07 01:13:02.092	2026-07-07 01:13:02.092	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr9ygbsv00tzvwf4cdmd6csg	uy maay	2026-07-07 01:13:17.504	2026-07-07 01:13:17.504	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr5wv8j8000kvwmsxp90eo7k	\N	f
cmr9yhodw00udvwf4cnhbg6za	test	2026-07-07 01:14:20.468	2026-07-07 01:14:20.468	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr63ps470009vwzgmgbqz4x0	\N	f
cmr9yi3rn00uzvwf4md9fa1sv	test	2026-07-07 01:14:40.403	2026-07-07 01:14:40.403	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmr9yfhlz00t7vwf4x1ob5g9y	test again?	2026-07-07 01:12:38.375	2026-07-07 01:16:26.069	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	2026-07-07 01:16:26.068	f
cmrakpj7z000pvw8kbtfuecvf	this is a test	2026-07-07 11:36:18.576	2026-07-07 11:36:18.576	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrakpwdm0013vw8krzppi2x1	ahahah	2026-07-07 11:36:35.627	2026-07-07 11:36:35.627	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrakpyv50019vw8krfhri2b0	dsdds	2026-07-07 11:36:38.849	2026-07-07 11:36:38.849	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrakqdoa001fvw8kblxxb3zv	this is greate ahahah	2026-07-07 11:36:58.043	2026-07-07 11:36:58.043	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrcobukm000pvwb443gxzeox	test	2026-07-08 22:53:10.918	2026-07-08 22:53:10.918	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrcobz68000vvwb4hz6tsfyr	tryfdf	2026-07-08 22:53:16.88	2026-07-08 22:53:16.88	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrg2d12s001dvw2okjkiqxhx	hey	2026-07-11 07:49:19.156	2026-07-11 07:49:19.156	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
cmrg2e0ff001nvw2o0axhdvs1	hello	2026-07-11 07:50:04.972	2026-07-11 07:50:04.972	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmrg3ubgx0043vw2oleq6i40j	genetasd	2026-07-11 08:30:45.394	2026-07-11 08:30:45.394	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrg42pcs0059vw2o5lowpq0i	test again	2026-07-11 08:37:16.636	2026-07-11 08:37:16.636	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr63ps470009vwzgmgbqz4x0	\N	f
cmrg42ul0005hvw2ofl5zuyqu	oi	2026-07-11 08:37:23.412	2026-07-11 08:37:23.412	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr63ps470009vwzgmgbqz4x0	\N	f
cmrh6ksy6000hvw4wtpbxesgt	trdtdtdt	2026-07-12 02:35:06.51	2026-07-12 02:35:06.51	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrh6l07a000vvw4w55ceoo5r	][[][]	2026-07-12 02:35:15.911	2026-07-12 02:35:15.911	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrhlkoy4000rvwtcv03c7o0t	try daw	2026-07-12 09:34:55.564	2026-07-12 09:34:55.564	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrhln9bw0015vwtcjhgb8he7	hey	2026-07-12 09:36:55.292	2026-07-12 09:36:55.292	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrhlnqlv001nvwtczu4y7y0v	ahoyyy	2026-07-12 09:37:17.683	2026-07-12 09:37:17.683	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr63ps470009vwzgmgbqz4x0	\N	f
cmrhlogoe002bvwtcn4keeabn	pero kung	2026-07-12 09:37:51.47	2026-07-12 09:37:51.47	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr3hvqhm0000vwh8fhxyopda	\N	f
cmrhloy2g002rvwtcrpa942dn	try daw nako ni	2026-07-12 09:38:14.008	2026-07-12 09:38:14.008	7c63e49d-3561-40ad-b46c-62701b85d4dc	cmr4uie0j000cvwlco0ekztoc	\N	f
\.


--
-- Data for Name: CommunityRead; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CommunityRead" (id, "communityId", "userId", "lastReadAt") FROM stdin;
cmr6bhfse000pvwvwboj42ip2	cmr63ps470009vwzgmgbqz4x0	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-12 09:42:44.092
cmr6b5klc0003vwzk0ldl2zju	cmr3hvqhm0000vwh8fhxyopda	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-12 09:42:45.218
cmr7062rx000pvw0sm0agcrd4	cmr4uie0j000cvwlco0ekztoc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-12 09:49:13.136
cmr70akyl001lvw0s56n84t09	cmr5wv8j8000kvwmsxp90eo7k	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-11 08:46:03.863
cmr7bz886006pvwvgmjzog6x3	cmr5mdp2s001cvwh4phvs4lpg	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-07 06:55:43.532
cmrg2c8bm0015vw2owx0h9qhp	cmr63ps470009vwzgmgbqz4x0	7c63e49d-3561-40ad-b46c-62701b85d4dc	2026-07-12 09:37:17.812
cmrg2bgn5000jvw2oedsiysz5	cmr3hvqhm0000vwh8fhxyopda	7c63e49d-3561-40ad-b46c-62701b85d4dc	2026-07-12 09:37:51.541
cmr706qk50017vw0sturl723k	cmr5wv8j8000kvwmsxp90eo7k	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	2026-07-07 12:04:08.663
cmrg2cczs0019vw2oi23ak0fu	cmr4uie0j000cvwlco0ekztoc	7c63e49d-3561-40ad-b46c-62701b85d4dc	2026-07-12 09:38:14.065
cmr6bh3c0000jvwvwvwc24g1w	cmr3hvqhm0000vwh8fhxyopda	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	2026-07-08 22:53:17.01
cmr7317p80071vw0sufqbodhg	cmr5x4v4a000ovwmst9asupus	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	2026-07-05 01:27:37.161
cmr6bi501000zvwvwi1wiovj1	cmr63ps470009vwzgmgbqz4x0	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	2026-07-07 01:14:20.544
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Document" (id, "trackingNumber", "documentTypeId", "currentStatusId", "currentOfficeId", title, description, "referenceNumber", "createdById", priority, "confidentialityLevel", deadline, "createdAt", "updatedAt", "senderContact", "senderName", "senderOfficeId", "senderOrganization", "senderType", classification, addressee, "deadlineReminderSent") FROM stdin;
325953b4-c75b-469a-aa36-5dc630f06511	DOC-2026-000004	9a92633c-51d2-49a0-941c-648bdb88de6f	9220bd8a-36bb-404c-a821-0fe69455deaf	74d7167a-4df2-4798-a890-84850b0254a9	Test Route	this is a test for routing slip	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	2026-06-17 22:47:00	2026-06-14 22:47:25.757	2026-06-24 23:54:38.807	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	SIMPLE	\N	t
9823f90c-b3e4-4549-b76b-80002ffc2faf	DOC-2026-000006	7c708646-3213-4a73-8601-68adfae0cea4	acb8612e-586c-42ab-8799-cf14c427e561	6a6a02f5-41e3-4904-b321-a27c52c53771	Test for addresssee	test addreseer	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	2026-06-16 06:21:00	2026-06-15 00:22:03.917	2026-06-16 01:45:00.806	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	SIMPLE	Mayor Lagnada	t
edc38cc9-9e86-4783-a18b-a08d1df8d36f	DOC-2026-000011	7c708646-3213-4a73-8601-68adfae0cea4	9220bd8a-36bb-404c-a821-0fe69455deaf	87496e1c-e3b2-4fe0-8885-7fb45449e4fc	Letter to PENRO edited2	test edit2	\N	42932359-6f58-4095-8654-88c4bd10bc45	MEDIUM	CONFIDENTIAL	2026-06-30 00:03:00	2026-06-24 00:03:50.964	2026-06-29 07:00:01.194	09332626565	Marimar	74d7167a-4df2-4798-a890-84850b0254a9		CLIENT	TECHNICAL	PENRO ADN	t
2cc828a2-7974-4e07-8b86-783e992e2b96	DOC-2026-000013	5561630d-d97c-4913-8468-c8d821ba8040	3e1ea1f1-146d-4683-9bd3-3f6d8572fbb0	02ea09f3-8c74-408a-ab41-df13fe79177f	Test for route Live		\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	\N	2026-06-30 23:09:47.517	2026-07-05 05:27:37.982	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	TECHNICAL		f
728aa53d-0b1a-4afc-8319-11408d5df3fd	DOC-2026-000009	0d68d4df-6b74-4b0e-b469-6053d930a862	9220bd8a-36bb-404c-a821-0fe69455deaf	6a6a02f5-41e3-4904-b321-a27c52c53771	this is a test for live updating		\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	HIGH	PUBLIC	2026-06-22 02:04:00	2026-06-17 02:04:51.313	2026-07-05 02:45:39.644	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	SIMPLE	Test	t
c6ea87fb-05fa-446e-9b3c-f5733a27b592	DOC-2026-000003	5561630d-d97c-4913-8468-c8d821ba8040	5b699c27-b94d-466c-91c0-c0499497944f	02ea09f3-8c74-408a-ab41-df13fe79177f	Memo Random	test document	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	2026-06-15 07:57:00	2026-06-14 07:57:30.481	2026-06-17 02:10:21.783	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	SIMPLE	\N	t
1d54d3d3-cc9b-40f7-8565-34513e151094	DOC-2026-000014	9a92633c-51d2-49a0-941c-648bdb88de6f	acb8612e-586c-42ab-8799-cf14c427e561	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	Document for Settings Email notif sample	test for email settings notif	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	2026-07-02 05:20:00	2026-07-02 00:21:27.124	2026-07-09 00:32:26.968	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE	Mr. Sinister	t
15552fe5-bb26-4097-b29a-f07c0bca2e1d	DOC-2026-000016	5561630d-d97c-4913-8468-c8d821ba8040	acb8612e-586c-42ab-8799-cf14c427e561	02ea09f3-8c74-408a-ab41-df13fe79177f	Direct Test Route Two	sample 2	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	2026-07-10 23:23:00	2026-07-08 23:23:32.723	2026-07-09 00:31:36.598	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE		f
f527d185-031a-4005-bacc-d32ba4efe7c8	DOC-2026-000001	7c708646-3213-4a73-8601-68adfae0cea4	5b699c27-b94d-466c-91c0-c0499497944f	02ea09f3-8c74-408a-ab41-df13fe79177f	Test Document	dsadsad	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	INTERNAL	2026-06-15 08:43:00	2026-06-13 08:43:54.078	2026-06-16 12:25:22.768	Marimar	Marimar	\N	\N	CLIENT	\N	\N	t
5fe08d3f-e0b1-4547-8dab-c117d077c021	DOC-2026-000012	5561630d-d97c-4913-8468-c8d821ba8040	d8309c16-f54e-4108-905f-c9bc5abe84e3	74d7167a-4df2-4798-a890-84850b0254a9	Memorandum Agreement 3	test 2	\N	42932359-6f58-4095-8654-88c4bd10bc45	MEDIUM	PUBLIC	2026-06-28 02:04:00	2026-06-24 02:04:31.946	2026-06-24 02:05:00.242			74d7167a-4df2-4798-a890-84850b0254a9		OFFICE	COMPLEX	Mr. Sinister	f
624f9763-995a-4781-b62d-e681f060b0c7	DOC-2026-000007	57152932-d800-4b02-af4a-60fb494c556d	acb8612e-586c-42ab-8799-cf14c427e561	6a6a02f5-41e3-4904-b321-a27c52c53771	Test Attachments	this is for test attachments	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	2026-06-19 02:47:00	2026-06-16 02:48:28.906	2026-07-05 03:58:45.239	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	COMPLEX	Mr. Clean	t
f6ff8b13-4ffb-4b29-a3b0-c53da3cc6c07	DOC-2026-000002	5561630d-d97c-4913-8468-c8d821ba8040	acb8612e-586c-42ab-8799-cf14c427e561	3d520d2d-6a8e-46c1-ace9-0833a5b1923a	Test PENRO Document	fdsf	\N	e84a98d7-bd0d-42fb-b887-7d568ce950c1	HIGH	INTERNAL	2026-06-19 08:50:00	2026-06-13 08:50:35.455	2026-06-18 09:00:01.2	\N	\N	87ee5450-4aa9-4ed5-b501-7b2a74ce253f	\N	OFFICE	\N	\N	t
40966284-145f-4616-bbea-2d8ae1aad541	DOC-2026-000019	5561630d-d97c-4913-8468-c8d821ba8040	4a6f3b27-e100-4541-9783-d92bd8785b5f	02ea09f3-8c74-408a-ab41-df13fe79177f	Test for live Routing Direct XXXX	dsaddad	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	2026-07-11 00:03:00	2026-07-09 00:03:57.487	2026-07-09 00:34:00.473	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE		f
0080cc8b-4da8-4bad-b6ea-92d35a80f808	DOC-2026-000008	5561630d-d97c-4913-8468-c8d821ba8040	4d23d8b8-5acd-473f-a2ca-7704c1d35cec	02ea09f3-8c74-408a-ab41-df13fe79177f	This is another document for testing	test	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	2026-06-19 01:38:00	2026-06-17 01:39:03.37	2026-07-05 05:27:45.598	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE	Mayor Lagnada	t
1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	DOC-2026-000005	5561630d-d97c-4913-8468-c8d821ba8040	4d23d8b8-5acd-473f-a2ca-7704c1d35cec	02ea09f3-8c74-408a-ab41-df13fe79177f	Test Routing Slip II	test roouting 2	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	2026-06-24 23:00:00	2026-06-14 23:01:11.988	2026-07-06 02:20:01.484	Norman	Norman	\N	\N	CLIENT	SIMPLE	\N	f
aa83520b-52ef-47ba-b287-1355c16ba72d	DOC-2026-000010	5561630d-d97c-4913-8468-c8d821ba8040	acb8612e-586c-42ab-8799-cf14c427e561	02ea09f3-8c74-408a-ab41-df13fe79177f	Test for notfications	this is a test for notifications	\N	7c63e49d-3561-40ad-b46c-62701b85d4dc	MEDIUM	PUBLIC	2026-07-01 09:14:00	2026-06-22 09:14:49.658	2026-07-09 00:00:57.602	\N	\N	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	\N	OFFICE	SIMPLE	Mr. Notif	t
5cec3c84-7b20-461d-8480-654fe1945b1e	DOC-2026-000018	5561630d-d97c-4913-8468-c8d821ba8040	acb8612e-586c-42ab-8799-cf14c427e561	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	TEst 4	fdsfdsf	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	\N	2026-07-08 23:43:28.545	2026-07-09 00:32:30.151	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE		f
06105c55-bb39-4e0b-84c3-fcdd022a83c4	DOC-2026-000015	5561630d-d97c-4913-8468-c8d821ba8040	acb8612e-586c-42ab-8799-cf14c427e561	02ea09f3-8c74-408a-ab41-df13fe79177f	Test Route Document	this is a test route	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	2026-07-16 23:18:00	2026-07-08 23:19:14.349	2026-07-09 00:03:02.032	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE	TEst	f
76259ed4-7ab4-499e-bb2c-080d2743ff39	DOC-2026-000017	5561630d-d97c-4913-8468-c8d821ba8040	acb8612e-586c-42ab-8799-cf14c427e561	02ea09f3-8c74-408a-ab41-df13fe79177f	Test Route Treee	dfsfsdf	\N	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	MEDIUM	PUBLIC	\N	2026-07-08 23:42:19.228	2026-07-09 00:31:16.661	\N	\N	02ea09f3-8c74-408a-ab41-df13fe79177f	\N	OFFICE	SIMPLE		f
\.


--
-- Data for Name: DocumentAttachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DocumentAttachment" (id, "documentId", "fileName", "filePath", "mimeType", "fileSize", "uploadedAt", "publicId") FROM stdin;
fcb80ef7-da1c-41de-8d38-558e3c9a49f5	624f9763-995a-4781-b62d-e681f060b0c7	DOC-2026-000005-routing-slip.pdf	https://res.cloudinary.com/dj7rmhxix/image/upload/v1781578104/documents/ujq1pdrfypoqlqevf9pu.pdf	application/pdf	88387	2026-06-16 02:48:28.906	documents/ujq1pdrfypoqlqevf9pu
c79c586f-3075-4473-bc9b-5209f85955d2	0080cc8b-4da8-4bad-b6ea-92d35a80f808	Routing_slip_2026-6416951-LB.pdf	https://res.cloudinary.com/dj7rmhxix/image/upload/v1781660340/documents/ahbasainu71pynzx0mnj.pdf	application/pdf	379417	2026-06-17 01:39:03.37	documents/ahbasainu71pynzx0mnj
2077b072-5c82-4844-be24-637dede184bf	edc38cc9-9e86-4783-a18b-a08d1df8d36f	DOC-2026-000011-routing-slip (2).pdf	https://res.cloudinary.com/dj7rmhxix/image/upload/v1782265268/documents/wj0h1wz4xlmdgatetajp.pdf	application/pdf	88871	2026-06-24 01:41:25.578	documents/wj0h1wz4xlmdgatetajp
\.


--
-- Data for Name: DocumentLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DocumentLog" (id, "documentId", "userId", action, description, "ipAddress", "createdAt") FROM stdin;
3ae9e9f8-59b0-4320-b57b-6433a3a82dbd	f527d185-031a-4005-bacc-d32ba4efe7c8	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-13 08:43:54.083
47fab233-8ac1-4645-b71a-94e3ab2d7958	f6ff8b13-4ffb-4b29-a3b0-c53da3cc6c07	e84a98d7-bd0d-42fb-b887-7d568ce950c1	DOCUMENT_CREATED	Document created	\N	2026-06-13 08:50:35.46
96b8a5c8-460c-4af2-9aa2-73d1ce7e3621	f6ff8b13-4ffb-4b29-a3b0-c53da3cc6c07	e84a98d7-bd0d-42fb-b887-7d568ce950c1	DOCUMENT_ROUTED	Document routed	\N	2026-06-13 08:55:16.737
7af3ba87-1789-4dd7-b38a-4e6641bde7d6	f6ff8b13-4ffb-4b29-a3b0-c53da3cc6c07	23a4f2bc-6716-49b3-962a-ad3ca9b0503f	DOCUMENT_RECEIVED	Document received	\N	2026-06-13 08:55:55.401
3d375344-613c-486e-b741-19761a067124	c6ea87fb-05fa-446e-9b3c-f5733a27b592	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-14 07:57:30.492
24206d69-e2a1-40d1-b96d-33a6b78b4298	325953b4-c75b-469a-aa36-5dc630f06511	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-14 22:47:25.773
c0943f85-045e-4c92-aa2a-7b6ca129ab53	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-14 23:01:11.995
d1bfb524-72db-479a-a05c-540c40da2e65	9823f90c-b3e4-4549-b76b-80002ffc2faf	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-15 00:22:03.925
77184f1e-c8e3-4aaa-adc3-096ae3b2ecf0	f527d185-031a-4005-bacc-d32ba4efe7c8	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-15 04:34:39.798
49f8b16f-e862-42cb-b402-d58d69a6e06d	c6ea87fb-05fa-446e-9b3c-f5733a27b592	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-15 04:34:52.533
108f71f5-52f5-4877-9213-b1d9939fe60a	c6ea87fb-05fa-446e-9b3c-f5733a27b592	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-15 04:37:51.774
407cf0d5-a2fa-464a-b608-3116c6022956	f527d185-031a-4005-bacc-d32ba4efe7c8	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-15 04:37:54.837
1fe29f9f-6b9e-4ad2-9f4b-1eb554c096db	9823f90c-b3e4-4549-b76b-80002ffc2faf	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 00:08:17.494
1e4d9a3d-60ad-4841-b030-d3714955607b	9823f90c-b3e4-4549-b76b-80002ffc2faf	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 00:42:02.475
eed9cf29-f464-4d15-a265-626566ffcdcd	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-16 02:48:28.914
b708ba33-355c-4574-975e-473bdbfae71c	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 03:41:48.754
85eff68c-d6ee-4441-a99f-86f79c8c97d0	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 03:53:41.944
b9d1b9c7-f5c1-404c-b7d7-3cff8d67cfe5	325953b4-c75b-469a-aa36-5dc630f06511	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 04:05:55.177
f096996a-b8b4-4e81-aabb-863df5bd1475	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 04:07:01.705
3bdb21b4-504f-444e-ab37-de7177862d80	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 04:07:03.996
1a141d47-3f85-4801-857a-9031636ab301	f527d185-031a-4005-bacc-d32ba4efe7c8	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 04:07:26.995
dba922b6-a472-4ac9-b4fd-b449976231bc	f527d185-031a-4005-bacc-d32ba4efe7c8	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 04:08:51.391
aecd0787-4c8a-47b9-b4a9-7dd6d4f6c2fa	f527d185-031a-4005-bacc-d32ba4efe7c8	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 04:09:19.889
338509a6-d069-43d6-ac82-f2a8795620f1	f527d185-031a-4005-bacc-d32ba4efe7c8	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 04:09:43.991
fcda1be1-1913-48b8-8227-ffa51eb91dd3	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-16 04:10:12.86
6c1bdf39-16cb-4e2e-8a03-bb22436e48dd	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 10:00:49.7
59c930e7-13ea-4f0c-88f7-253ca3ed1ac0	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-06-16 12:06:45.633
247f00c0-4aa7-4179-aced-97a717ae694b	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as FOR_APPROVAL	\N	2026-06-16 12:10:17.195
fc94a0d1-4492-4a04-8ddf-d5cb4f1bbdb9	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-06-16 12:12:35.836
0b10f557-e6b4-4b18-9a3f-c952133b142e	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-16 12:13:26.24
7187cc78-06a5-4a09-aea4-78cf73729f3b	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-06-16 12:17:29.225
9aaa380c-1d9c-4c2b-9b37-af2810165813	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-06-16 12:20:14.636
82778ea0-6837-4e87-a9a6-21a206c0d336	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as PENDING	\N	2026-06-16 12:20:20.59
2e7846f3-8e60-4b71-9b48-86c7cf70a426	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-16 12:20:25.824
ae0f4636-6205-41f9-9896-273d881c8d40	f527d185-031a-4005-bacc-d32ba4efe7c8	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as COMPLETED	\N	2026-06-16 12:25:22.773
c908d781-3a88-4f83-b69f-607410636d9c	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-06-16 12:28:45.315
177fb73c-bdc9-4438-bed4-3c7cbd79442d	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_APPROVAL	\N	2026-06-16 12:28:58.412
7250dfae-70cb-4e54-9801-34e01164125a	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-16 12:29:02.368
c7f762ce-87d4-41a0-91b3-e6b5c0a7de74	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-06-16 12:29:06.458
563187f3-52ca-4b34-be63-8303563db423	c6ea87fb-05fa-446e-9b3c-f5733a27b592	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-16 22:47:40.68
418e40ea-4ad4-459c-bd71-2f4f9d4fa65c	325953b4-c75b-469a-aa36-5dc630f06511	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-16 23:18:29.658
7e4c49e6-6ccd-404f-a00e-d20c6e039573	325953b4-c75b-469a-aa36-5dc630f06511	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_APPROVAL	\N	2026-06-17 01:04:50.968
4d16b872-a991-438f-b428-9ab6c07eb31b	0080cc8b-4da8-4bad-b6ea-92d35a80f808	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-06-17 01:39:03.377
7a2aca3b-d858-44a3-b25f-ad79d1e348da	0080cc8b-4da8-4bad-b6ea-92d35a80f808	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-17 01:41:02.353
7c4dc07b-23bf-47c9-9966-f86e03ef0fe0	c6ea87fb-05fa-446e-9b3c-f5733a27b592	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-17 01:41:56.358
2b53650a-1c21-4f96-aa9c-1e344d2a0f28	0080cc8b-4da8-4bad-b6ea-92d35a80f808	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-06-17 01:42:31.177
bf4ad0bb-01c2-453b-9660-a9f844db0a71	c6ea87fb-05fa-446e-9b3c-f5733a27b592	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-06-17 01:58:31.84
9c79b5b9-5df5-4072-a913-f7aa8af047f9	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-17 01:59:17.161
ee4e70b0-6288-40c2-9208-6cd05228e353	c6ea87fb-05fa-446e-9b3c-f5733a27b592	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-17 01:59:55.471
aefb5fea-84b3-497f-9a26-55906d1210ad	0080cc8b-4da8-4bad-b6ea-92d35a80f808	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-17 02:01:03.33
eaf259ec-1542-4426-99ec-e67c343b9382	0080cc8b-4da8-4bad-b6ea-92d35a80f808	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-17 02:01:46.557
40a75e09-6d8d-4e83-9a4b-7cd2c2e5cb14	c6ea87fb-05fa-446e-9b3c-f5733a27b592	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-17 02:01:48.206
d9893b3f-e6ea-411b-a5c1-e4e0f552d2cf	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-17 02:01:49.027
b88ec10d-dd96-493d-be38-392a6a22b9be	728aa53d-0b1a-4afc-8319-11408d5df3fd	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-17 02:04:51.318
cf3fb52b-1277-4bca-9246-bb464506db60	728aa53d-0b1a-4afc-8319-11408d5df3fd	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-17 02:05:13.963
68c9ae0c-78e9-46e9-86ef-f28569a9230d	728aa53d-0b1a-4afc-8319-11408d5df3fd	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-17 02:06:01.207
7f4eb602-2435-48c1-8697-eebe8017e1fb	c6ea87fb-05fa-446e-9b3c-f5733a27b592	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as COMPLETED	\N	2026-06-17 02:10:21.787
b3ced929-b3ab-4760-a6b5-7614bbf6488b	325953b4-c75b-469a-aa36-5dc630f06511	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as APPROVED	\N	2026-06-17 02:10:57.555
c3a24dbb-1c32-4527-bb45-d31dab7fc6c7	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as COMPLETED	\N	2026-06-17 02:20:34.315
ee8bd4f7-bc02-4b41-a400-85440b6baeef	aa83520b-52ef-47ba-b287-1355c16ba72d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-22 09:14:49.668
57b680f5-a519-4aa2-9e61-3db09d56ae3f	aa83520b-52ef-47ba-b287-1355c16ba72d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-22 09:16:08.117
1bd0e014-5451-4ffd-bbce-dc6c56611346	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-22 11:11:14.936
5f35718f-e5f3-4121-8efa-3c50104e22bd	325953b4-c75b-469a-aa36-5dc630f06511	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-22 11:50:04.314
faf36c86-f37d-41f3-9578-e1acbab313fc	325953b4-c75b-469a-aa36-5dc630f06511	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-06-22 11:56:23.981
1aa0901a-93f6-4908-aae2-1c0b14198ded	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-06-22 11:57:47.606
a556ae08-42b3-4364-a130-669caadf3bb5	aa83520b-52ef-47ba-b287-1355c16ba72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-22 12:14:10.418
ea577c7e-c7a8-4add-96df-5945fa512b38	aa83520b-52ef-47ba-b287-1355c16ba72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-22 12:15:30.68
ee4327f8-0d1f-4c77-a640-2e9709a431d0	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-22 12:20:24.49
5b170c11-1c2d-4574-833b-7eefd15eec35	325953b4-c75b-469a-aa36-5dc630f06511	7c63e49d-3561-40ad-b46c-62701b85d4dc	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-06-22 12:20:29.495
6dc889fe-f084-48f0-97ab-dbc03bafde97	edc38cc9-9e86-4783-a18b-a08d1df8d36f	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_CREATED	Document created	\N	2026-06-24 00:03:50.977
cd32d6b0-a609-4add-b370-76bedcd79dbf	edc38cc9-9e86-4783-a18b-a08d1df8d36f	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_UPDATED	Document updated	\N	2026-06-24 01:27:41.899
a7e73524-d81f-4ffa-8b6a-ecc93330229d	edc38cc9-9e86-4783-a18b-a08d1df8d36f	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_UPDATED	Document updated	\N	2026-06-24 01:28:35.484
9ef54cc9-9775-45bd-aba4-f26f44502018	edc38cc9-9e86-4783-a18b-a08d1df8d36f	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_UPDATED	Document updated	\N	2026-06-24 01:41:25.582
6be0439d-9773-4f10-9537-19e67e5e7644	edc38cc9-9e86-4783-a18b-a08d1df8d36f	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_ROUTED	Document routed	\N	2026-06-24 02:03:14.953
567f4885-41f9-417d-984c-f2e757c68d6a	5fe08d3f-e0b1-4547-8dab-c117d077c021	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_CREATED	Document created	\N	2026-06-24 02:04:31.952
231f67b7-0c7a-480b-b6f3-56de25f686de	5fe08d3f-e0b1-4547-8dab-c117d077c021	42932359-6f58-4095-8654-88c4bd10bc45	DOCUMENT_UPDATED	Document updated	\N	2026-06-24 02:05:00.244
5d542693-2d88-42c4-a28c-b0ed0555e149	325953b4-c75b-469a-aa36-5dc630f06511	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-24 23:52:58.519
eab1c808-8ed0-48e2-89bf-1bf1632d04f1	325953b4-c75b-469a-aa36-5dc630f06511	e84a98d7-bd0d-42fb-b887-7d568ce950c1	DOCUMENT_RECEIVED	Document received	\N	2026-06-24 23:54:06.491
e90a7dee-9ad3-423a-b221-914bc34e3539	325953b4-c75b-469a-aa36-5dc630f06511	e84a98d7-bd0d-42fb-b887-7d568ce950c1	DOCUMENT_ROUTED	Document routed	\N	2026-06-24 23:54:38.81
fbffd2af-8468-4ba7-8d34-c73b35a79e3b	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-30 23:08:11.698
6953674b-085c-41a5-8f57-6edcef6d2ddf	2cc828a2-7974-4e07-8b86-783e992e2b96	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_CREATED	Document created	\N	2026-06-30 23:09:47.523
4496d1a3-75d4-4804-ae0a-c2a297ca7712	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-06-30 23:10:02.68
cf88bff0-e4c8-497c-b7fb-7e4abe9e92c5	2cc828a2-7974-4e07-8b86-783e992e2b96	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-06-30 23:43:31.261
465a8b94-bd23-40fd-aaa9-8a9af5b72818	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-06-30 23:45:02.492
705663d8-992f-4859-9e66-8e1689edea69	2cc828a2-7974-4e07-8b86-783e992e2b96	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-01 07:57:40.086
29dbfb57-3bca-4783-be80-c353e90126f1	1d54d3d3-cc9b-40f7-8565-34513e151094	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-07-02 00:21:27.131
8ae7718f-bac0-40d5-affe-d51a70c090e9	1d54d3d3-cc9b-40f7-8565-34513e151094	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:38:59.417
1a14a0d6-c0f3-442c-b29c-b0baad9bc283	1d54d3d3-cc9b-40f7-8565-34513e151094	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:40:01.31
5a590c11-3cbf-43be-8cbc-7f2ea59992ad	1d54d3d3-cc9b-40f7-8565-34513e151094	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:40:46.249
221addb3-b4ef-47c0-9371-0fb5c2725bd7	728aa53d-0b1a-4afc-8319-11408d5df3fd	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:44:02.398
06a44dbe-dfd2-4011-bec1-71011fdfa829	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:45:09.767
f432699f-eafa-403f-a9ce-26be844c2af0	624f9763-995a-4781-b62d-e681f060b0c7	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:46:09.846
64b4b405-3c6f-43ff-92e5-921330cd3971	1d54d3d3-cc9b-40f7-8565-34513e151094	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:47:11.347
055695e6-e6bd-4868-99ed-3177504bed82	728aa53d-0b1a-4afc-8319-11408d5df3fd	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:47:51.958
d56ba52a-7c4b-4998-81c2-6dc4542daf26	728aa53d-0b1a-4afc-8319-11408d5df3fd	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:48:15.6
7a950202-b64d-4626-bd90-daf8066800f0	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:54:49.332
10d6e6aa-7529-4fb4-9a67-9549e57881e1	2cc828a2-7974-4e07-8b86-783e992e2b96	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:55:47.736
a3a3a179-7de9-4e7b-8d42-a607e091af97	2cc828a2-7974-4e07-8b86-783e992e2b96	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:56:18.085
5bdcab08-e09a-4610-8e2b-a132c0e8eda4	2cc828a2-7974-4e07-8b86-783e992e2b96	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:57:14.319
78ff6f77-9111-49e0-b830-320753f00f59	2cc828a2-7974-4e07-8b86-783e992e2b96	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:57:59.266
30f170bf-d664-4bd6-b170-4a0737d1c6af	728aa53d-0b1a-4afc-8319-11408d5df3fd	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:58:00.421
0c8efdab-1daa-4368-8220-d2a3288abe11	aa83520b-52ef-47ba-b287-1355c16ba72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:58:28.939
43703fde-ac33-4c32-b7a6-36b2592a25b9	aa83520b-52ef-47ba-b287-1355c16ba72d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 05:58:45.178
2669bcb0-3272-4085-a70e-aff55d4919a3	aa83520b-52ef-47ba-b287-1355c16ba72d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 05:59:24.696
dbe6d2d8-5b28-4be0-b82a-4ca338ae72f0	1d54d3d3-cc9b-40f7-8565-34513e151094	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-02 06:00:38.678
bed1164b-6be6-4ec9-9350-10bc2a442e94	aa83520b-52ef-47ba-b287-1355c16ba72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-02 06:00:54.507
d6180d60-49c2-43a8-b263-085128b7a7f5	aa83520b-52ef-47ba-b287-1355c16ba72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-04 09:22:41.313
71aa857d-6457-4790-a108-bd37e3d80884	624f9763-995a-4781-b62d-e681f060b0c7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-04 09:23:22.154
87789f9f-ae87-4165-a602-79cfb7328e1f	728aa53d-0b1a-4afc-8319-11408d5df3fd	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-05 02:45:39.648
b3cbb579-21d8-4e2f-a717-8e5f9ffb1ed7	624f9763-995a-4781-b62d-e681f060b0c7	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	DOCUMENT_RECEIVED	Document received	\N	2026-07-05 03:58:45.241
b6be508f-fe5f-485d-b66d-bf81bfefe0c2	2cc828a2-7974-4e07-8b86-783e992e2b96	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-07-05 05:27:23.052
c02b59ab-2214-4e05-bb4b-5e0e37765314	0080cc8b-4da8-4bad-b6ea-92d35a80f808	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-07-05 05:27:32.337
c434ff55-e479-46eb-b1ce-c79525fcbc47	2cc828a2-7974-4e07-8b86-783e992e2b96	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_REVIEW	\N	2026-07-05 05:27:37.987
6a4c9b5a-2801-4bc3-94ca-942a28c156c7	0080cc8b-4da8-4bad-b6ea-92d35a80f808	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-07-05 05:27:45.601
ba01beae-8017-4f52-8136-afa949418e81	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as ON_PROCESS	\N	2026-07-06 02:20:01.492
e6842fc5-4ebf-4767-9bdb-98a692cb1313	06105c55-bb39-4e0b-84c3-fcdd022a83c4	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-07-08 23:19:14.36
6cd640e4-0a2d-4f34-a5e3-74457d83dd53	06105c55-bb39-4e0b-84c3-fcdd022a83c4	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:19:14.398
b53fe8a5-c3a5-4732-b1f5-a484b12c060d	aa83520b-52ef-47ba-b287-1355c16ba72d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-08 23:21:51.207
c77b97a4-3675-4d16-8efe-849455ce500e	1d54d3d3-cc9b-40f7-8565-34513e151094	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-08 23:21:54.383
9c7a814c-b34c-43a1-8900-c9e8f37d8167	15552fe5-bb26-4097-b29a-f07c0bca2e1d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-07-08 23:23:32.73
62bf2ac7-55eb-4714-8156-79785cdee9c1	15552fe5-bb26-4097-b29a-f07c0bca2e1d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:23:32.745
01d9f165-d918-4df6-a73f-d0043184f33f	76259ed4-7ab4-499e-bb2c-080d2743ff39	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-07-08 23:42:19.233
aca2e663-65e9-489f-9378-f034d6e3601f	76259ed4-7ab4-499e-bb2c-080d2743ff39	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:42:19.246
454b6444-db7b-4a54-9bca-0e9c5ba5e977	5cec3c84-7b20-461d-8480-654fe1945b1e	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-07-08 23:43:28.549
ed302a18-40e0-4c7d-9f75-8b8247f5a676	5cec3c84-7b20-461d-8480-654fe1945b1e	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:44:17.302
11939f02-b194-4aab-9893-01491ee3ed5f	06105c55-bb39-4e0b-84c3-fcdd022a83c4	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-08 23:45:07.947
112180fc-6524-46c4-924e-2b66a4e7739d	15552fe5-bb26-4097-b29a-f07c0bca2e1d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-08 23:45:09.841
657691e1-7832-40b0-bb86-302178ea66c8	76259ed4-7ab4-499e-bb2c-080d2743ff39	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-08 23:45:11.238
090f8e92-211e-4a09-88e7-657407967ebe	1d54d3d3-cc9b-40f7-8565-34513e151094	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:45:27.29
d2156d42-0aad-40a8-a806-e31d051c6fbe	15552fe5-bb26-4097-b29a-f07c0bca2e1d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:45:52.61
1196a3b5-4176-4227-be13-656558c83f06	aa83520b-52ef-47ba-b287-1355c16ba72d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-08 23:47:35.913
ee92b3de-6ada-4414-89f0-1f1d63cbc8f5	aa83520b-52ef-47ba-b287-1355c16ba72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:00:57.603
f5315034-e90c-4461-b241-0a16062713b0	1d54d3d3-cc9b-40f7-8565-34513e151094	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:00:59.028
5a85cb59-4619-433f-8133-9a6241b94871	15552fe5-bb26-4097-b29a-f07c0bca2e1d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:01:00.728
f38ade28-f319-40b0-acb7-af4b28328f89	15552fe5-bb26-4097-b29a-f07c0bca2e1d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:01:26.791
bd8a9c9b-9755-481c-93a4-e5b1fb4697a5	5cec3c84-7b20-461d-8480-654fe1945b1e	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:01:52.24
322125e0-5abe-4f59-8a29-5aca9a724dc2	15552fe5-bb26-4097-b29a-f07c0bca2e1d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:01:53.836
1b399842-da0c-4f84-ab0f-0e28e25d9e75	06105c55-bb39-4e0b-84c3-fcdd022a83c4	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:02:21.543
edd95f24-392f-4368-9394-0c0e18741917	5cec3c84-7b20-461d-8480-654fe1945b1e	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:02:45.71
6eb72292-dd0f-4312-a43f-6daf00e165b6	06105c55-bb39-4e0b-84c3-fcdd022a83c4	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:03:02.033
7838d7a3-fe71-47f1-923c-b0ff41cb4a1a	5cec3c84-7b20-461d-8480-654fe1945b1e	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:03:02.955
3d97835a-24e8-42e0-a8df-27a45f4c7c17	40966284-145f-4616-bbea-2d8ae1aad541	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_CREATED	Document created	\N	2026-07-09 00:03:57.49
c7e1c1e1-78a4-4c74-bdd4-509570ecdeef	40966284-145f-4616-bbea-2d8ae1aad541	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:03:57.505
e28aed82-428e-4453-a594-9ff614cc9851	40966284-145f-4616-bbea-2d8ae1aad541	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:21:50.986
a4a83fd3-0f77-4962-8e7d-b9b7bcd9e411	76259ed4-7ab4-499e-bb2c-080d2743ff39	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:22:06.404
2c617481-e276-4d1c-8959-8e1b582c05ee	40966284-145f-4616-bbea-2d8ae1aad541	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:30:53.602
e2f728d6-4e71-47b7-b970-0e3dedf90629	40966284-145f-4616-bbea-2d8ae1aad541	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:31:08.947
6d82be7c-3f40-4306-aca5-e924165da9a1	76259ed4-7ab4-499e-bb2c-080d2743ff39	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:31:16.663
d2793c1e-3d5e-4319-ac58-2d63b62756e1	15552fe5-bb26-4097-b29a-f07c0bca2e1d	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:31:32.918
6212af94-465f-4efc-b76c-4965f5eaf78f	15552fe5-bb26-4097-b29a-f07c0bca2e1d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:31:36.599
f1ff8789-dfc3-41e6-a8b0-e364ae266998	5cec3c84-7b20-461d-8480-654fe1945b1e	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:32:05.922
9d96a1b4-449d-44ca-962e-dfde580886f8	1d54d3d3-cc9b-40f7-8565-34513e151094	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	DOCUMENT_ROUTED	Document routed	\N	2026-07-09 00:32:20.758
1ac4e4ad-62a0-4350-883f-dbb8d8c1545b	1d54d3d3-cc9b-40f7-8565-34513e151094	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:32:26.969
7d7957ec-acc9-4129-bd2a-f910def0c578	5cec3c84-7b20-461d-8480-654fe1945b1e	7c63e49d-3561-40ad-b46c-62701b85d4dc	DOCUMENT_RECEIVED	Document received	\N	2026-07-09 00:32:30.152
4200b9de-d487-46f0-becc-fb60ea39d023	40966284-145f-4616-bbea-2d8ae1aad541	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	STATUS_UPDATED	Document marked as FOR_APPROVAL	\N	2026-07-09 00:34:00.475
\.


--
-- Data for Name: DocumentRoute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DocumentRoute" (id, "documentId", "fromOfficeId", "toOfficeId", "sentByUserId", "receivedByUserId", status, remarks, "sentAt", "receivedAt", "completedAt") FROM stdin;
e961d1bc-7f11-475d-901c-f7dbdd586003	f527d185-031a-4005-bacc-d32ba4efe7c8	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	please verify	2026-06-16 04:07:26.989	2026-06-16 04:08:51.387	\N
61b675c7-121d-456b-be62-d0693406ced7	f527d185-031a-4005-bacc-d32ba4efe7c8	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	dffdsfsdf	2026-06-16 04:09:19.884	2026-06-16 04:09:43.985	\N
e43c3b7a-1944-4296-af65-3c273dac24a8	f6ff8b13-4ffb-4b29-a3b0-c53da3cc6c07	87ee5450-4aa9-4ed5-b501-7b2a74ce253f	3d520d2d-6a8e-46c1-ace9-0833a5b1923a	e84a98d7-bd0d-42fb-b887-7d568ce950c1	23a4f2bc-6716-49b3-962a-ad3ca9b0503f	RECEIVED	please	2026-06-13 08:55:16.731	2026-06-13 08:55:55.395	\N
66a1b1b6-656e-4723-a00a-60121d08c504	c6ea87fb-05fa-446e-9b3c-f5733a27b592	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	for AA	2026-06-15 04:34:52.529	2026-06-15 04:37:51.77	\N
bd893bcc-61d5-4905-9b62-ce49d76ffb51	f527d185-031a-4005-bacc-d32ba4efe7c8	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	for AA	2026-06-15 04:34:39.79	2026-06-15 04:37:54.833	\N
02ad6df8-4345-4047-ac20-326d88994aa3	9823f90c-b3e4-4549-b76b-80002ffc2faf	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	6a6a02f5-41e3-4904-b321-a27c52c53771	7c63e49d-3561-40ad-b46c-62701b85d4dc	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	RECEIVED	please for AA	2026-06-16 00:08:17.485	2026-06-16 00:42:02.468	\N
e821b00b-88f7-4c57-8eb0-5b4700444f56	624f9763-995a-4781-b62d-e681f060b0c7	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	Please route this	2026-06-16 03:41:48.742	2026-06-16 04:07:01.699	\N
11fced23-48c5-47d3-944a-91de6fd6c8d0	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	this is a test 2	2026-06-16 03:53:41.937	2026-06-16 04:07:03.991	\N
7fab0fc2-19c6-4ab2-b489-d07fa38b4ca8	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	Test	2026-06-16 04:10:12.853	2026-06-16 10:00:49.683	\N
8b24ba11-2193-40d9-80a2-22dc902cf609	325953b4-c75b-469a-aa36-5dc630f06511	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	this is it	2026-06-16 04:05:55.169	2026-06-16 23:18:29.651	\N
dd8b1ecb-413e-4971-994d-42899185e6c7	0080cc8b-4da8-4bad-b6ea-92d35a80f808	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	forward this to PENRO	2026-06-17 01:41:02.343	2026-06-17 01:42:31.171	\N
3f16ab90-8da0-4a85-9fa5-9fde2a7b4e41	c6ea87fb-05fa-446e-9b3c-f5733a27b592	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	also this one	2026-06-17 01:41:56.352	2026-06-17 01:58:31.833	\N
95c1ff92-cd7a-4894-a047-b9f183583d9b	0080cc8b-4da8-4bad-b6ea-92d35a80f808	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	pleasee again and again	2026-06-17 02:01:03.323	2026-06-17 02:01:46.547	\N
d085599c-f26d-4a1d-a6e2-2e19e4b15ac5	c6ea87fb-05fa-446e-9b3c-f5733a27b592	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	please again	2026-06-17 01:59:55.466	2026-06-17 02:01:48.201	\N
aa55e62e-e3fd-4b70-ac34-15ff0719a2b7	1484bef9-5f16-4876-b1a6-a6dbf1e7e18a	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	pleaseee!!	2026-06-17 01:59:17.155	2026-06-17 02:01:49.023	\N
b192b8ae-54bc-4db5-aeef-61002fea657d	728aa53d-0b1a-4afc-8319-11408d5df3fd	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	Test	2026-06-17 02:05:13.956	2026-06-17 02:06:01.2	\N
2db735fc-b0dd-4345-bec9-430b1a46fb69	325953b4-c75b-469a-aa36-5dc630f06511	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	opproved!	2026-06-22 11:50:04.307	2026-06-22 11:56:23.976	\N
8adeca6c-6827-4c4d-9d84-8805a65cf42f	624f9763-995a-4781-b62d-e681f060b0c7	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	please	2026-06-22 11:11:14.928	2026-06-22 11:57:47.6	\N
1fbf9912-caf4-4f97-bc3f-8d70519e85eb	aa83520b-52ef-47ba-b287-1355c16ba72d	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	Please AA	2026-06-22 09:16:08.11	2026-06-22 12:14:10.412	\N
67efb1a2-68b8-4989-856d-1a06d985e076	edc38cc9-9e86-4783-a18b-a08d1df8d36f	74d7167a-4df2-4798-a890-84850b0254a9	87496e1c-e3b2-4fe0-8885-7fb45449e4fc	42932359-6f58-4095-8654-88c4bd10bc45	\N	PENDING	for cenro	2026-06-24 02:03:14.944	\N	\N
6d7a53c5-28ba-4a9e-8f1a-0704ca7793d3	325953b4-c75b-469a-aa36-5dc630f06511	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	87ee5450-4aa9-4ed5-b501-7b2a74ce253f	7c63e49d-3561-40ad-b46c-62701b85d4dc	e84a98d7-bd0d-42fb-b887-7d568ce950c1	RECEIVED	test 	2026-06-24 23:52:58.502	2026-06-24 23:54:06.48	\N
ff8c6ede-daa2-4c6e-878b-af1d85361254	325953b4-c75b-469a-aa36-5dc630f06511	87ee5450-4aa9-4ed5-b501-7b2a74ce253f	74d7167a-4df2-4798-a890-84850b0254a9	e84a98d7-bd0d-42fb-b887-7d568ce950c1	\N	PENDING	pleaseeee	2026-06-24 23:54:38.802	\N	\N
ac8af834-2856-4f12-91c9-10e1750474b2	624f9763-995a-4781-b62d-e681f060b0c7	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	test route if live	2026-06-30 23:08:11.682	2026-06-30 23:10:02.675	\N
f501fd68-1af7-4904-982a-2c46d4910439	2cc828a2-7974-4e07-8b86-783e992e2b96	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	try again test live	2026-06-30 23:43:31.254	2026-07-01 07:57:40.073	\N
63e1e520-7ebe-42a9-a7b6-6b88f97f4d52	1d54d3d3-cc9b-40f7-8565-34513e151094	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	Test sounds	2026-07-02 05:38:59.409	2026-07-02 05:40:01.306	\N
8ace029f-eb22-4086-b112-34409d3451ca	1d54d3d3-cc9b-40f7-8565-34513e151094	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	test sound 2	2026-07-02 05:40:46.243	2026-07-02 05:47:11.343	\N
069aad1b-00c0-42d9-8ac3-7805144f8bd1	624f9763-995a-4781-b62d-e681f060b0c7	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	back to you..	2026-06-30 23:45:02.485	2026-07-02 05:45:09.757	\N
61dcf709-01bf-4386-9491-8605c194714e	728aa53d-0b1a-4afc-8319-11408d5df3fd	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	sample sounds test 2	2026-07-02 05:44:02.391	2026-07-02 05:47:51.949	\N
3c191db5-66f4-4876-99e8-fa72ff886087	624f9763-995a-4781-b62d-e681f060b0c7	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	no sound test	2026-07-02 05:46:09.84	2026-07-02 05:54:49.327	\N
9a8b384e-92bf-48f3-915e-ad68805bf9b6	2cc828a2-7974-4e07-8b86-783e992e2b96	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	Test sound 2	2026-07-02 05:55:47.728	2026-07-02 05:56:18.08	\N
6319041c-6d2f-4314-812b-eb9b7b3332c8	2cc828a2-7974-4e07-8b86-783e992e2b96	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	try again this is for 5	2026-07-02 05:57:14.314	2026-07-02 05:57:59.261	\N
58fa4ed7-9fdb-4e5f-8936-0d77a3dc91e0	728aa53d-0b1a-4afc-8319-11408d5df3fd	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	test again for sound 3	2026-07-02 05:48:15.595	2026-07-02 05:58:00.417	\N
956f3ef1-2a18-4f4e-b1a2-6490f6fa2fc0	aa83520b-52ef-47ba-b287-1355c16ba72d	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	Test again	2026-07-02 05:58:28.934	2026-07-02 05:58:45.172	\N
d08ab009-4ae8-486c-b979-2bf5e9612620	aa83520b-52ef-47ba-b287-1355c16ba72d	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	test 3	2026-07-02 05:59:24.691	2026-07-02 06:00:54.503	\N
2ae1a454-f48e-444b-9de3-b0e6f0ca1511	728aa53d-0b1a-4afc-8319-11408d5df3fd	02ea09f3-8c74-408a-ab41-df13fe79177f	6a6a02f5-41e3-4904-b321-a27c52c53771	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	\N	PENDING	didto ni	2026-07-05 02:45:39.633	\N	\N
103a0793-e8de-48f7-a54a-3deb46f2e514	624f9763-995a-4781-b62d-e681f060b0c7	02ea09f3-8c74-408a-ab41-df13fe79177f	6a6a02f5-41e3-4904-b321-a27c52c53771	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	RECEIVED	mike	2026-07-04 09:23:22.147	2026-07-05 03:58:45.236	\N
d1775f9b-4cab-4e89-819f-eb796cab9b7f	aa83520b-52ef-47ba-b287-1355c16ba72d	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED		2026-07-04 09:22:41.299	2026-07-08 23:21:51.199	\N
50a791ee-aa2e-423c-9fd4-c8bf450e0f01	1d54d3d3-cc9b-40f7-8565-34513e151094	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	test 5555	2026-07-02 06:00:38.672	2026-07-08 23:21:54.378	\N
388d2eb8-485b-41c9-ab4a-81acf8a9550a	06105c55-bb39-4e0b-84c3-fcdd022a83c4	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	tehis is a test route	2026-07-08 23:19:14.381	2026-07-08 23:45:07.943	\N
bd1a65c3-c1d6-40b2-9a3e-2a4dbdb3ebb3	15552fe5-bb26-4097-b29a-f07c0bca2e1d	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	this is test route 2	2026-07-08 23:23:32.739	2026-07-08 23:45:09.837	\N
1caa6c2d-d3d6-4c42-bb8f-7a6cc26b143c	76259ed4-7ab4-499e-bb2c-080d2743ff39	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	tesr	2026-07-08 23:42:19.241	2026-07-08 23:45:11.235	\N
179ddc0f-803b-4d72-9060-cf81ec3a6c41	aa83520b-52ef-47ba-b287-1355c16ba72d	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED		2026-07-08 23:47:35.907	2026-07-09 00:00:57.597	\N
39108b6a-f67f-4f00-b92f-00112c7f643b	1d54d3d3-cc9b-40f7-8565-34513e151094	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	test	2026-07-08 23:45:27.28	2026-07-09 00:00:59.023	\N
9ef8462c-d15b-4925-a70b-4c3a38d94728	15552fe5-bb26-4097-b29a-f07c0bca2e1d	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED		2026-07-08 23:45:52.604	2026-07-09 00:01:00.724	\N
6ad009e4-0640-4ddd-b57c-7acf7c7a4512	5cec3c84-7b20-461d-8480-654fe1945b1e	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	this is a test	2026-07-08 23:44:17.296	2026-07-09 00:01:52.235	\N
a36581f0-41bf-4eb2-8fd1-bc715adcbfbc	15552fe5-bb26-4097-b29a-f07c0bca2e1d	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	test daw beh mao na ba ni?	2026-07-09 00:01:26.778	2026-07-09 00:01:53.832	\N
504b61c8-e939-4512-aabe-f84610ef33dd	06105c55-bb39-4e0b-84c3-fcdd022a83c4	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	Kini daw beh	2026-07-09 00:02:21.537	2026-07-09 00:03:02.03	\N
586c94bc-f7a2-4055-a619-a3e36bb2be16	5cec3c84-7b20-461d-8480-654fe1945b1e	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED	kini pud	2026-07-09 00:02:45.704	2026-07-09 00:03:02.951	\N
357928b4-4f27-4c6b-ba93-51ac4a7ffc45	40966284-145f-4616-bbea-2d8ae1aad541	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	kini daw beh ug oka na kaha ni	2026-07-09 00:03:57.5	2026-07-09 00:21:50.981	\N
232369f5-e645-4364-bc7a-0a26fabcff03	40966284-145f-4616-bbea-2d8ae1aad541	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED		2026-07-09 00:30:53.594	2026-07-09 00:31:08.941	\N
f3eb63c1-ea2d-4cf6-89bd-0f89979b91ae	76259ed4-7ab4-499e-bb2c-080d2743ff39	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED		2026-07-09 00:22:06.397	2026-07-09 00:31:16.659	\N
a232787e-c0da-4242-be17-66e53075a3ce	15552fe5-bb26-4097-b29a-f07c0bca2e1d	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	02ea09f3-8c74-408a-ab41-df13fe79177f	7c63e49d-3561-40ad-b46c-62701b85d4dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	RECEIVED		2026-07-09 00:31:32.913	2026-07-09 00:31:36.595	\N
0dc285e8-5537-48e4-90b0-9ccaa1f28060	1d54d3d3-cc9b-40f7-8565-34513e151094	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	testest	2026-07-09 00:32:20.751	2026-07-09 00:32:26.964	\N
efbc43dd-bb1b-48a1-a426-08afd1242c83	5cec3c84-7b20-461d-8480-654fe1945b1e	02ea09f3-8c74-408a-ab41-df13fe79177f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	7c63e49d-3561-40ad-b46c-62701b85d4dc	RECEIVED	resresr	2026-07-09 00:32:05.916	2026-07-09 00:32:30.148	\N
\.


--
-- Data for Name: DocumentStatus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DocumentStatus" (id, name, description) FROM stdin;
d8309c16-f54e-4108-905f-c9bc5abe84e3	DRAFT	\N
acb8612e-586c-42ab-8799-cf14c427e561	PENDING	\N
d6232a6c-bf8a-4519-a9f6-799f0074f3b0	APPROVED	\N
b4ec6b27-818f-4077-9e2c-c6d7955541ca	REJECTED	\N
5b699c27-b94d-466c-91c0-c0499497944f	COMPLETED	\N
9220bd8a-36bb-404c-a821-0fe69455deaf	IN_TRANSIT	\N
e0775c67-67c7-4c31-bb3b-f63b3b661428	RECEIVED	\N
3e1ea1f1-146d-4683-9bd3-3f6d8572fbb0	FOR_REVIEW	\N
4d23d8b8-5acd-473f-a2ca-7704c1d35cec	ON_PROCESS	\N
4a6f3b27-e100-4541-9783-d92bd8785b5f	FOR_APPROVAL	\N
9e21a71d-925e-41c5-9cc8-eac229e1075a	FOR_RELEASE	\N
\.


--
-- Data for Name: DocumentType; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DocumentType" (id, name, description) FROM stdin;
5561630d-d97c-4913-8468-c8d821ba8040	Memorandum	\N
57152932-d800-4b02-af4a-60fb494c556d	Purchase Request	\N
3a4cf3f7-3fcb-413c-9e46-6fcea74b0a7a	Contract	\N
0d68d4df-6b74-4b0e-b469-6053d930a862	Payroll	\N
7c708646-3213-4a73-8601-68adfae0cea4	Letter	\N
9a92633c-51d2-49a0-941c-648bdb88de6f	Others	\N
\.


--
-- Data for Name: MessageReaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MessageReaction" (id, "messageId", "userId", emoji, "createdAt") FROM stdin;
cmr7ixn45001hvwj8m3n70dbq	cmr75t7fd00prvw0szjx4t67i	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	😊	2026-07-05 08:23:19.109
cmr7j94wd001zvwj82eh0famy	cmr75t7fd00prvw0szjx4t67i	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	😍	2026-07-05 08:32:15.374
cmr7jf7eu0023vwj8umqn67ud	cmr766dst001tvwvgi6ctogps	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	👍	2026-07-05 08:36:58.566
cmr7jkqic0025vwj8stb4m2cs	cmr74nweg00fjvw0sbwfb0g10	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	😘	2026-07-05 08:41:16.597
cmr7jrvoz002fvwj8eoux0wr2	cmr75t7fd00prvw0szjx4t67i	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	👍	2026-07-05 08:46:49.907
cmr7jvadf002jvwj8z2x0wl2w	cmr7g196b002jvwdka7mpdb0x	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	👍	2026-07-05 08:49:28.9
cmr7k7uv5002tvwj8oovws7ub	cmr7g196b002jvwdka7mpdb0x	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	😆	2026-07-05 08:59:15.329
cmr7kjyml0049vwj890zz8mg2	cmr706ukb0019vw0sus5gdien	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	❤️	2026-07-05 09:08:40.077
cmr8e3wpx0019vw7gpg78d6xi	cmr8e2vqy000hvw7guk8lkjf4	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	👍	2026-07-05 22:55:59.589
cmr8effiz0021vw7gvazc5fcr	cmr8eetgb001vvw7gw8mcua3f	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	😘	2026-07-05 23:04:57.179
cmr8mi48z004rvw8grngahm3u	cmr8m53cn001rvw8gkkqs51sx	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	😊	2026-07-06 02:50:59.459
cmr8mjiba0051vw8g4vrje88x	cmr8jlea2001fvwco16ucasne	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	❤️	2026-07-06 02:52:04.342
cmr8mjvse0053vw8g38tc3mvs	cmr8m53cn001rvw8gkkqs51sx	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	👍	2026-07-06 02:52:21.806
cmr8mr0dt007tvw8gmmuqfx52	cmr8mqn83007lvw8g3896t2rc	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	👍	2026-07-06 02:57:54.353
cmr94f30w0019vwp4chnrua91	cmr8mnijr006dvw8gedcicr2w	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	👍	2026-07-06 11:12:30.992
cmr9tyt2n0015vwf4lz84dhbb	cmr9tyjno000xvwf4eion6f8n	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	❤️	2026-07-06 23:07:41.616
cmr9ykgov00vbvwf4x6o90554	cmr9yhodw00udvwf4cnhbg6za	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	👍	2026-07-07 01:16:30.463
cmra8hwhu00vzvwf4jpcgjgxi	cmr9yi3rn00uzvwf4md9fa1sv	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	😍	2026-07-07 05:54:27.139
cmraam38q00wjvwf4p7ddvp7j	cmr9yfzws00tlvwf4fo5w1qah	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	❤️	2026-07-07 06:53:41.738
cmrhljd5o0009vwtcy1lz6tlr	cmrg3ubgx0043vw2oleq6i40j	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	❤️	2026-07-12 09:33:53.628
cmrhljsty000jvwtc6hj8ve38	cmrh6ksy6000hvw4wtpbxesgt	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	😗	2026-07-12 09:34:13.943
cmrhlk9ks000pvwtc2rzlvqux	cmrh6l07a000vvw4w55ceoo5r	7c63e49d-3561-40ad-b46c-62701b85d4dc	😍	2026-07-12 09:34:35.644
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, "userId", title, message, type, "isRead", "createdAt", "documentId") FROM stdin;
f0489e04-9ecb-4b82-9dfd-7be96803672c	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Route has been routed to your office.	ROUTED	t	2026-06-22 11:50:04.316	325953b4-c75b-469a-aa36-5dc630f06511
19b31b8a-c45b-44d9-8516-1e466c42e37f	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Document has been routed to your office.	ROUTED	t	2026-06-16 04:09:19.891	\N
4d7f4e03-257d-4921-9ba0-662ad523a6af	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Route has been routed to your office.	ROUTED	t	2026-06-16 04:05:55.18	\N
35dbddc1-f98d-4b21-932b-9b870b1f0fcf	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Routing Slip II has been routed to your office.	ROUTED	t	2026-06-16 03:53:41.946	\N
02446fb2-a235-47a9-84d5-3aa481de5d73	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "Test Route" is nearing its deadline.	DEADLINE	t	2026-06-16 23:00:00.158	\N
b39938f4-0047-4ee8-b6a1-5ca54ee37df1	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	Document Deadline Reminder	Document "Test for addresssee" is nearing its deadline.	DEADLINE	t	2026-06-16 01:45:00.021	\N
429b4d7d-06f9-46a1-9289-212371054efc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "this is a test for live updating" is nearing its deadline.	DEADLINE	t	2026-06-21 22:00:00.044	728aa53d-0b1a-4afc-8319-11408d5df3fd
368ba894-ea7f-46e7-a203-b95430338fdd	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Document has been routed to your office.	ROUTED	t	2026-06-16 04:07:26.996	\N
c6019425-fad5-44eb-be92-cf87e7d330fb	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Routing Slip II has been routed to your office.	ROUTED	t	2026-06-16 04:10:12.862	\N
616c2f58-849b-46ae-8acc-da5f5937aebe	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Routing Slip II has been routed to your office.	ROUTED	t	2026-06-17 01:59:17.164	\N
02c32195-7bf9-4493-b04f-1566ac1eb8ed	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Memo Random has been routed to your office.	ROUTED	t	2026-06-17 01:59:55.473	\N
bc387470-0037-4681-9cd3-2376290233dc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	This is another document for testing has been routed to your office.	ROUTED	t	2026-06-17 02:01:03.332	\N
e505c7bd-b753-499b-bd31-c2bc8889a5a4	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	this is a test for live updating has been routed to your office.	ROUTED	t	2026-06-17 02:05:13.965	\N
9b5cee68-922c-4cbb-86f1-00d927b8166e	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "This is another document for testing" is nearing its deadline.	DEADLINE	t	2026-06-18 01:49:00.038	\N
9c079fc7-f553-42ab-a3ad-a76c1f8e92e6	23a4f2bc-6716-49b3-962a-ad3ca9b0503f	Document Deadline Reminder	Document "Test PENRO Document" is nearing its deadline.	DEADLINE	f	2026-06-18 09:00:00.241	\N
5feabb07-4b2e-4dcd-a665-3d0da28c0e16	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	This is another document for testing has been routed to your office.	ROUTED	t	2026-06-17 01:41:02.369	\N
e387ca59-8ca8-4bcd-8492-cad284b095c8	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Memo Random has been routed to your office.	ROUTED	t	2026-06-17 01:41:56.36	\N
9bf93e46-c77e-42a0-995a-fa53b8a94cb7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "Test Attachments" is nearing its deadline.	DEADLINE	t	2026-06-18 03:00:00.046	\N
9d5d29c6-d075-4cb5-b5f0-5eb75e32b4f5	c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	New Incoming Document	Letter to PENRO edited2 has been routed to your office.	ROUTED	f	2026-06-24 02:03:14.958	edc38cc9-9e86-4783-a18b-a08d1df8d36f
25561703-b082-4a21-9969-8a783a094ea9	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test for notfications has been routed to your office.	ROUTED	t	2026-06-22 09:16:08.119	\N
106d201d-07b5-42a8-a300-06059786685a	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Attachments has been routed to your office.	ROUTED	t	2026-06-22 11:11:14.939	\N
b858f765-5098-452e-9dc8-a30f69648cc6	e84a98d7-bd0d-42fb-b887-7d568ce950c1	New Incoming Document	Test Route has been routed to your office.	ROUTED	t	2026-06-24 23:52:58.53	325953b4-c75b-469a-aa36-5dc630f06511
25284854-4dcd-4de1-8e58-6f867c642518	42932359-6f58-4095-8654-88c4bd10bc45	New Incoming Document	Test Route has been routed to your office.	ROUTED	f	2026-06-24 23:54:38.813	325953b4-c75b-469a-aa36-5dc630f06511
4bdfbd81-498f-4918-8a9d-b72363010e57	fb0c300b-2665-4fd1-a8a8-38980e919616	New Incoming Document	Test Route has been routed to your office.	ROUTED	f	2026-06-24 23:54:38.814	325953b4-c75b-469a-aa36-5dc630f06511
6df7d5a3-4c1c-4e22-9d05-40c8aa4ea99c	c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	Document Deadline Reminder	Document "Letter to PENRO edited2" is nearing its deadline.	DEADLINE	f	2026-06-29 07:00:00.192	edc38cc9-9e86-4783-a18b-a08d1df8d36f
40c0ebae-67de-4bfd-ba84-3015dad78f72	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "Test for notfications" is nearing its deadline.	DEADLINE	t	2026-06-30 10:00:00.176	aa83520b-52ef-47ba-b287-1355c16ba72d
78f7bb73-d1f8-4891-a037-1e67725b6aad	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Attachments has been routed to your office.	ROUTED	t	2026-06-30 23:08:11.708	624f9763-995a-4781-b62d-e681f060b0c7
dae74ba8-7fc6-4f71-9e99-f672e58b9933	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "Document for Settings Email notif sample" is nearing its deadline.	DEADLINE	t	2026-07-02 00:23:00.026	1d54d3d3-cc9b-40f7-8565-34513e151094
bd22cd62-93eb-4c13-9fff-02068b00759a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	Document Deadline Reminder	Document "Document for Settings Email notif sample" is nearing its deadline.	DEADLINE	t	2026-07-02 00:27:00.015	1d54d3d3-cc9b-40f7-8565-34513e151094
4794d6a0-1977-4f69-ac9a-8e95808e8471	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test for route Live has been routed to your office.	ROUTED	t	2026-06-30 23:43:31.263	2cc828a2-7974-4e07-8b86-783e992e2b96
ec3d56b9-f77c-44eb-9cfb-65a9bd8881b2	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Document for Settings Email notif sample has been routed to your office.	ROUTED	t	2026-07-02 05:38:59.427	1d54d3d3-cc9b-40f7-8565-34513e151094
c6fec584-f4ba-4ade-80eb-3cd0fba21f55	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Attachments has been routed to your office.	ROUTED	t	2026-06-30 23:45:02.494	624f9763-995a-4781-b62d-e681f060b0c7
15958544-3bad-4f65-bfe8-25625bdd4e9c	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Attachments has been routed to your office.	ROUTED	t	2026-07-02 05:46:09.848	624f9763-995a-4781-b62d-e681f060b0c7
ed193b8a-3afb-411a-9bad-b3677ffb7c05	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	this is a test for live updating has been routed to your office.	ROUTED	t	2026-07-02 05:44:02.4	728aa53d-0b1a-4afc-8319-11408d5df3fd
c9685bdf-05d7-4f24-b70e-f8722fe5d72d	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Document for Settings Email notif sample has been routed to your office.	ROUTED	t	2026-07-02 05:40:46.25	1d54d3d3-cc9b-40f7-8565-34513e151094
f60e216f-f059-4dbd-ab56-189f34df851a	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	this is a test for live updating has been routed to your office.	ROUTED	t	2026-07-02 05:48:15.601	728aa53d-0b1a-4afc-8319-11408d5df3fd
f6d437ae-83d9-4be4-b81e-2e749af1508d	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test for route Live has been routed to your office.	ROUTED	t	2026-07-02 05:55:47.738	2cc828a2-7974-4e07-8b86-783e992e2b96
b3222869-e8de-41c4-9fc7-18d5a74c0880	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test for route Live has been routed to your office.	ROUTED	t	2026-07-02 05:57:14.321	2cc828a2-7974-4e07-8b86-783e992e2b96
0a172d17-54a8-4e25-b7a1-2c4f1d2e4f53	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test for notfications has been routed to your office.	ROUTED	t	2026-07-02 05:58:28.94	aa83520b-52ef-47ba-b287-1355c16ba72d
c3ab3cfb-0f58-4785-a50e-4f084cdf66f7	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test for notfications has been routed to your office.	ROUTED	t	2026-07-02 05:59:24.697	aa83520b-52ef-47ba-b287-1355c16ba72d
e48b808a-26a5-45c0-856d-834a902df9a7	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Document for Settings Email notif sample has been routed to your office.	ROUTED	t	2026-07-02 06:00:38.681	1d54d3d3-cc9b-40f7-8565-34513e151094
0175deed-ce72-47b5-870f-9465b2841129	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	New Incoming Document	Test Attachments has been routed to your office.	ROUTED	t	2026-07-04 09:23:22.157	624f9763-995a-4781-b62d-e681f060b0c7
bbdcda96-5f1a-4155-a369-749bd49f6209	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	New Incoming Document	this is a test for live updating has been routed to your office.	ROUTED	f	2026-07-05 02:45:39.659	728aa53d-0b1a-4afc-8319-11408d5df3fd
c2234d70-abc8-4999-9586-9cf30066151c	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test for notfications has been routed to your office.	ROUTED	t	2026-07-04 09:22:41.324	aa83520b-52ef-47ba-b287-1355c16ba72d
5a7992c2-53ab-4566-9c4c-e08c108673d6	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Route Document has been routed to your office.	ROUTED	t	2026-07-08 23:19:14.399	06105c55-bb39-4e0b-84c3-fcdd022a83c4
2d9370d3-74f5-4311-b1bd-f19757cb3040	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Direct Test Route Two has been routed to your office.	ROUTED	t	2026-07-08 23:23:32.747	15552fe5-bb26-4097-b29a-f07c0bca2e1d
67d5d133-7f03-4f54-a443-173f2db8f43b	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test Route Treee has been routed to your office.	ROUTED	t	2026-07-08 23:42:19.247	76259ed4-7ab4-499e-bb2c-080d2743ff39
69e57f4f-f652-4a6c-a98e-ed2b28e35c51	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Direct Test Route Two has been routed to your office.	ROUTED	t	2026-07-09 00:01:26.795	15552fe5-bb26-4097-b29a-f07c0bca2e1d
954f73ef-a5c0-4270-8b67-ea6d5567e413	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Route Document has been routed to your office.	ROUTED	t	2026-07-09 00:02:21.546	06105c55-bb39-4e0b-84c3-fcdd022a83c4
1f4a6f8f-0c0d-4935-ba1e-d4fce82ba8be	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	TEst 4 has been routed to your office.	ROUTED	t	2026-07-09 00:02:45.713	5cec3c84-7b20-461d-8480-654fe1945b1e
00970d62-b4e1-433e-9da4-543ee54376ff	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test for notfications has been routed to your office.	ROUTED	t	2026-07-08 23:47:35.915	aa83520b-52ef-47ba-b287-1355c16ba72d
5a632776-048d-453b-9175-39b8c8ed3266	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Direct Test Route Two has been routed to your office.	ROUTED	t	2026-07-08 23:45:52.615	15552fe5-bb26-4097-b29a-f07c0bca2e1d
a9dc3ae7-7dcb-4889-8bc0-9a3ed40d4c91	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Document for Settings Email notif sample has been routed to your office.	ROUTED	t	2026-07-08 23:45:27.293	1d54d3d3-cc9b-40f7-8565-34513e151094
cbc76960-0e5a-444d-afa6-789d32c3bc32	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test for live Routing Direct XXXX has been routed to your office.	ROUTED	t	2026-07-09 00:30:53.604	40966284-145f-4616-bbea-2d8ae1aad541
d1dab282-abbd-401b-bed2-cf32818a83fc	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Test Route Treee has been routed to your office.	ROUTED	t	2026-07-09 00:22:06.407	76259ed4-7ab4-499e-bb2c-080d2743ff39
81c2f835-349e-46e5-a8ef-638a82d741ca	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	New Incoming Document	Direct Test Route Two has been routed to your office.	ROUTED	t	2026-07-09 00:31:32.921	15552fe5-bb26-4097-b29a-f07c0bca2e1d
80ff1181-64f1-46ca-b978-4b6eb99d5e4d	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Document for Settings Email notif sample has been routed to your office.	ROUTED	t	2026-07-09 00:32:20.76	1d54d3d3-cc9b-40f7-8565-34513e151094
739df911-c10a-419e-9858-ced8b724ae8c	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	TEst 4 has been routed to your office.	ROUTED	t	2026-07-09 00:32:05.925	5cec3c84-7b20-461d-8480-654fe1945b1e
86f872cb-ba84-462d-a004-4a8f2879a9d5	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	Test for live Routing Direct XXXX has been routed to your office.	ROUTED	t	2026-07-09 00:03:57.507	40966284-145f-4616-bbea-2d8ae1aad541
c1556cf6-3423-4c9e-bd0b-38f782a75ed5	7c63e49d-3561-40ad-b46c-62701b85d4dc	New Incoming Document	TEst 4 has been routed to your office.	ROUTED	t	2026-07-08 23:44:17.305	5cec3c84-7b20-461d-8480-654fe1945b1e
\.


--
-- Data for Name: Office; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Office" (id, "officeCode", "officeName", description, "createdAt", "organizationUnitId", "updatedAt", category) FROM stdin;
02ea09f3-8c74-408a-ab41-df13fe79177f	ORD	Office of the Regional Director		2026-06-13 08:16:30.955	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-13 08:16:30.955	REGULAR
16e99c9c-d37a-462c-85d6-f0afe3ab7931	PMD	Planning & Management Division		2026-06-13 08:17:47.732	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-13 08:17:47.732	REGULAR
ce7ea05f-ae5e-493a-b9c7-ab7567de135e	HRD	Human Resource Division		2026-06-13 08:18:32.744	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-13 08:18:32.744	REGULAR
b2468e64-7e0e-43ea-bc30-9d444a8f43ce	FINANCE	Finance Division		2026-06-13 08:18:54.711	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-13 08:18:54.711	REGULAR
6a6a02f5-41e3-4904-b321-a27c52c53771	ICT	ICT Unit		2026-06-13 08:42:18.851	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-13 08:42:18.851	REGULAR
56f45e25-167f-4f9b-8a90-ce9bd5c94b30	PENRO-ADN	PENRO Agusan del Norte		2026-06-13 08:45:04.716	bf02cea6-19d9-4426-91a4-17800a218e6a	2026-06-13 08:45:04.716	REGULAR
87ee5450-4aa9-4ed5-b501-7b2a74ce253f	PENRO-ADN-Records	PENRO ADN Records		2026-06-13 08:46:04.052	bf02cea6-19d9-4426-91a4-17800a218e6a	2026-06-13 08:46:04.052	RECORDS
87496e1c-e3b2-4fe0-8885-7fb45449e4fc	CENRO-NASIPIT	Office of the CENRO Nasipit		2026-06-13 08:46:40.606	98789459-eeb2-4581-90c4-5e1e45921e7b	2026-06-13 08:46:40.606	REGULAR
3d520d2d-6a8e-46c1-ace9-0833a5b1923a	PENRO-ADMIN	PENRO Admin		2026-06-13 08:52:09.057	bf02cea6-19d9-4426-91a4-17800a218e6a	2026-06-13 08:52:09.057	REGULAR
74d7167a-4df2-4798-a890-84850b0254a9	CENRO-NASIPIT-REC	CENRO Nasipit Records	test update	2026-06-13 08:47:10.583	98789459-eeb2-4581-90c4-5e1e45921e7b	2026-06-14 00:51:09.544	RECORDS
e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	RO-RECORDS	Records Office		2026-06-13 08:41:35.347	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-14 00:51:40.584	RECORDS
\.


--
-- Data for Name: OfficeUser; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OfficeUser" (id, "officeId", "userId", designation, "isOfficeAdmin") FROM stdin;
7502dab1-2257-433e-a93c-586f5e646f8f	e48c8cf7-2cb7-4163-8ae7-932192d0a1e6	7c63e49d-3561-40ad-b46c-62701b85d4dc	\N	f
36275ae2-99a2-406d-aab3-ac822e664900	87ee5450-4aa9-4ed5-b501-7b2a74ce253f	e84a98d7-bd0d-42fb-b887-7d568ce950c1	\N	f
fab13f0a-1571-40ed-aa67-a4cfc365b452	3d520d2d-6a8e-46c1-ace9-0833a5b1923a	23a4f2bc-6716-49b3-962a-ad3ca9b0503f	\N	f
23d0a483-65b1-4cc0-be5a-266beb9916b9	02ea09f3-8c74-408a-ab41-df13fe79177f	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	\N	f
a19b7618-de4e-497d-920f-dc9644c60493	6a6a02f5-41e3-4904-b321-a27c52c53771	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	\N	f
ebf81070-0750-422f-9bd4-2917d7b557a9	74d7167a-4df2-4798-a890-84850b0254a9	42932359-6f58-4095-8654-88c4bd10bc45	\N	f
9e0d37b4-f94a-4dbc-b8e2-613cb394ae93	87496e1c-e3b2-4fe0-8885-7fb45449e4fc	c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	\N	f
bfd1b777-39e0-41ae-a67c-c951fb95ad34	74d7167a-4df2-4798-a890-84850b0254a9	fb0c300b-2665-4fd1-a8a8-38980e919616	\N	f
\.


--
-- Data for Name: OrganizationUnit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OrganizationUnit" (id, code, name, type, description, "parentId", "createdAt", "updatedAt") FROM stdin;
93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	RO	Regional Office	REGIONAL	\N	\N	2026-06-13 08:12:40.82	2026-06-13 08:12:40.82
bf02cea6-19d9-4426-91a4-17800a218e6a	PENRO	PENRO Agusan del Norte	PENRO	\N	93b8e47c-d8f1-46e4-b60a-6a66f5b8ea04	2026-06-13 08:14:58.783	2026-06-13 08:14:58.783
98789459-eeb2-4581-90c4-5e1e45921e7b	CENRO	CENRO Nasipit	CENRO	\N	bf02cea6-19d9-4426-91a4-17800a218e6a	2026-06-13 08:15:22.616	2026-06-13 08:15:22.616
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Role" (id, name, description) FROM stdin;
faeaa07f-3bdd-42c7-b666-fdac8032c905	SUPER_ADMIN	\N
a4f88ca0-0c65-487d-bf7f-094a0e7cdcb8	OFFICE_ADMIN	\N
eaee6fda-e45b-42d3-8199-eb0cc7d9b73e	SUPERVISOR	\N
fff66699-4f3c-49ca-8c45-5671411ac47e	ENCODER	\N
1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0	SECRETARY	\N
c7342c1a-b2b8-41cc-8713-ce8029ac2867	VIEWER	\N
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, "employeeId", "firstName", "lastName", email, username, "passwordHash", status, "createdAt", "updatedAt", "mobileNumber", "profileImageId", "profileImageUrl") FROM stdin;
d06911df-2ff2-4351-b279-94d6364c67cf	EMP-0001	System	Administrator	admin@mail.com	admin	$2b$10$IeKUhDE3ylqGYfwuYXgIjOo063CRaX5gWeFuVscZt6G6Cuub.YncW	ACTIVE	2026-06-13 08:03:12.777	2026-06-13 08:03:12.777	\N	\N	\N
e84a98d7-bd0d-42fb-b887-7d568ce950c1	EMP-0006	Tom	Beringer	tom@gmail.com	penroadn	$2b$10$AhZicwX9ztjC4XX4d5J66OsYwj301qnOTGbXSS2cjKZhFLlnA9HKG	ACTIVE	2026-06-13 08:49:41.254	2026-06-13 08:49:41.254	\N	\N	\N
23a4f2bc-6716-49b3-962a-ad3ca9b0503f	EMP-0021	Dave	Mon	dave@gmail.com	penroadnadmin	$2b$10$n3hwNYDq01dmYtEuez0ire0nh1dFEb.qb0mihVFgTy7/uSQkodjRW	ACTIVE	2026-06-13 08:53:54.263	2026-06-13 08:53:54.263	\N	\N	\N
7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	0012203	Mike	Tiu	mike@gmail.com	mike	$2b$10$oLfAxYGZsWWLMfexMODPS.tv/ar39pFi6KJc8N89kPbpbiI7X/IOy	ACTIVE	2026-06-16 00:11:17.405	2026-06-16 00:11:17.405	\N	\N	\N
fb0c300b-2665-4fd1-a8a8-38980e919616	EMP-0024	Test	One	test@email.com	testone	$2b$10$qo3KheUaHW7PhMgJlnIWDO/nNdMXTv.8G5a3rKe4FQbagmVtZKTGi	ACTIVE	2026-06-23 12:35:59.574	2026-06-23 12:35:59.574	\N	\N	\N
42932359-6f58-4095-8654-88c4bd10bc45	EMP-0022	nasipit	records	cenronasipitedats@gmail.com	nasipitrecords	$2b$10$QgtcBvzQVhECNir7E0cqj.AMynWRRqxr7KFCG5GTMV7aZp.EjmHl.	ACTIVE	2026-06-23 12:26:39.527	2026-06-24 00:02:14.832	\N	\N	\N
c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	EMP-0023	cenro	nasipit	cenronasipitedats2@gmail.com	cenronasipit	$2b$10$2MDmAndRHfPSAZl9/TmR7upWL/x7hMnfhLftDJtSKAwtOi4M.VdJ.	ACTIVE	2026-06-23 12:29:08.171	2026-06-24 00:02:28.754	\N	\N	\N
7c63e49d-3561-40ad-b46c-62701b85d4dc	EMP-001	Jhon 	Doe	jhondoe@email.com	records	$2b$10$ukB8elKlMZGnKB7yQzZmgOaSFPF7EYZxJDpafiwnMQbjbSqSZ0v8e	ACTIVE	2026-06-13 08:43:02.85	2026-06-30 02:02:14.784	\N	users/profile-pictures/th76slshdu1dxdaqclv7	https://res.cloudinary.com/dj7rmhxix/image/upload/v1782784934/users/profile-pictures/th76slshdu1dxdaqclv7.png
1e2f2fcd-fcad-4053-b48b-c5380ba50cda	EMP-00012	Ored	Yee	gonzrock12@gmail.com	ored	$2b$10$OkCkfGcvT1Hm7byemQhXOuz0uIQPRjuhoxPAX7ZPJA1NtyhhA7uYm	ACTIVE	2026-06-15 04:36:38.259	2026-07-02 00:21:51.26	09322929564	users/profile-pictures/zcfnall95pyh4ttldvzt	https://res.cloudinary.com/dj7rmhxix/image/upload/v1781744303/users/profile-pictures/zcfnall95pyh4ttldvzt.png
\.


--
-- Data for Name: UserRole; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserRole" (id, "userId", "roleId") FROM stdin;
cca0ea77-5e36-40cb-bb95-63b518bab2e8	d06911df-2ff2-4351-b279-94d6364c67cf	faeaa07f-3bdd-42c7-b666-fdac8032c905
3dd4f62f-f878-4bd2-8e59-10807dfd6aec	7c63e49d-3561-40ad-b46c-62701b85d4dc	1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0
5fb3a182-ec38-48ca-ae6c-c3ab74902df3	e84a98d7-bd0d-42fb-b887-7d568ce950c1	1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0
0b1bfaba-d403-4c5b-9cb4-65d38f7485f1	23a4f2bc-6716-49b3-962a-ad3ca9b0503f	1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0
07935bc9-35b2-4bc2-b78a-536792cff1ee	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0
00d2566e-98b5-4442-a08e-bb117342f291	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	fff66699-4f3c-49ca-8c45-5671411ac47e
bd22a4ea-19f6-4a31-98a8-f5a2f63e1cce	42932359-6f58-4095-8654-88c4bd10bc45	1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0
976f0686-d553-4eca-a497-c3d1d0df709f	c2a19ace-9ffe-4bc9-b251-cd3ac568b41c	1d4e58dc-2ebc-4448-b70b-3cda2e98c0b0
3f595b74-0fe4-4565-8fc4-a92c2ed5990f	fb0c300b-2665-4fd1-a8a8-38980e919616	fff66699-4f3c-49ca-8c45-5671411ac47e
\.


--
-- Data for Name: UserSettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserSettings" (id, "userId", "emailNotifications", "smsNotifications", "darkMode", "createdAt", "updatedAt", "notificationSounds") FROM stdin;
8c5eadd1-c76e-428d-87a7-15a8e525cd86	7b0c57f8-11e5-4459-b05b-4dd0ecb63d5a	t	f	f	2026-07-05 01:43:43.563	2026-07-07 01:12:18.369	f
fb98736a-92aa-483f-ba0d-07dec7f43ff3	1e2f2fcd-fcad-4053-b48b-c5380ba50cda	t	f	f	2026-07-01 23:40:06.893	2026-07-12 09:40:32.047	t
90e959d2-d990-4825-a9c8-e109460f405a	7c63e49d-3561-40ad-b46c-62701b85d4dc	t	f	f	2026-07-02 05:38:00.08	2026-07-02 05:59:39.201	f
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5b701d40-3bb0-4d5d-949e-268d488bf308	36b002698649239b30cdbd34ba1feece0da035bfa1f09f522e62c7f23604bb1c	2026-05-26 13:12:09.946413+08	20260526051209_init	\N	\N	2026-05-26 13:12:09.839112+08	1
35f2320f-e6d4-4c4b-8e77-4e5f25593a81	140f18bd46824aca70297a5051c0ec77696bfeeb3a70ae522c39531a628a4f35	2026-05-26 20:14:05.523518+08	20260526121405_update_route_status	\N	\N	2026-05-26 20:14:05.52124+08	1
44775c3c-283a-46ef-9180-8390ae1c7405	538d78818ea6320bb5175e444820f64da15c803aca2b20f97aa9c3565befb475	2026-07-02 07:00:25.559786+08	20260701230025_add_user_settings	\N	\N	2026-07-02 07:00:25.498688+08	1
68a94a21-278d-4c48-9e75-d234f070f4af	66d0c18c863e5b37392e01d92e7d3ffeaa554e151231864a3ba9197078895199	2026-05-27 12:14:51.842975+08	20260527041451_organization_hierarchy	\N	\N	2026-05-27 12:14:51.777879+08	1
212803b5-2ca3-4fbc-9e2a-f8b1d3bf8ecb	46cb3187a21852dc11f90a844630b59962f4f34699cb671e12b8bd70c67190bf	2026-06-10 05:30:02.22822+08	20260609213002_add_public_id_for_cloudinary	\N	\N	2026-06-10 05:30:02.215517+08	1
5616b144-5712-4a7c-af5c-adb6b922f5ae	51f98091a2eabfbbdddc6ffa022b5ee3fb08af448ecaa0d20f5eefb7455d2e48	2026-07-06 07:15:45.691945+08	20260705231545_add_community_attachments	\N	\N	2026-07-06 07:15:45.584311+08	1
7171ff86-7374-4e13-814e-36f0d762d01c	f1967b481b154d5d90112af9cbc29d34c2d1b7a298279404d06091d0af76b6e0	2026-06-11 14:20:32.332033+08	20260611062032_add_document_sender_fields	\N	\N	2026-06-11 14:20:32.285531+08	1
ceec7076-d8cc-4c72-bada-5739b2745ea8	8ee4e73f1a01e35635b2e259935b0751b18f1b37d3361b8e7c47666ac6ee2895	2026-07-02 13:09:59.953426+08	20260702050959_add_notification_sounds	\N	\N	2026-07-02 13:09:59.933541+08	1
a068a167-ca97-4e54-9f3f-cc29f0324f02	ff823a57f8076ee65a33922659c37e6d92409bee912ffa66d744e699c0d67d16	2026-06-13 15:39:15.258059+08	20260613073915_add_office_category	\N	\N	2026-06-13 15:39:15.230361+08	1
38f1d3ee-55cb-40a0-a24d-673d37c66150	c26f457a5e8ec1ad762baecacfa98a2d181bff9acf0a93489b9f9a586ed31811	2026-06-14 15:53:37.479846+08	20260614075337_add_document_classification	\N	\N	2026-06-14 15:53:37.46914+08	1
5ea4c7df-da63-4d0a-9b69-b62a5e67ee6b	b6840ff3e77e1902016f3a08aff28c0169b6ad3cf6c0961955788fc14c74c010	2026-06-15 08:14:21.220974+08	20260615001421_add_document_addressee	\N	\N	2026-06-15 08:14:21.210918+08	1
e8993704-09d4-4a33-9598-30c8b9c78b4a	9a482f1b71f770876177eec8e97e265bb6831a98392ac33f0013e92c652aae43	2026-07-02 17:38:46.750312+08	20260702093846_add_user_community	\N	\N	2026-07-02 17:38:46.684795+08	1
de22956f-1d72-44f2-afd1-f901120ef5ba	903b6787cefdf13d700dd37ab6f5bbb2a9a8e6a7bb090c8075f05af6214b9a80	2026-06-15 09:30:57.019312+08	20260615013056_add_notifications	\N	\N	2026-06-15 09:30:56.966539+08	1
ed3ccfb1-93ef-4c4f-9450-7bd738f05370	b794f3dc9484f501baca617683ab4602cd8fc8739eac123b8dc4122a2a4349f7	2026-06-15 10:43:39.75251+08	20260615024339_add_reminder_sent_deadline	\N	\N	2026-06-15 10:43:39.74981+08	1
cea1db83-623f-4efd-a1b2-b76ef9c513ca	3aa3aef0971286369926073a306d49c59aa4bc2d83e51208ca531721cbe4a959	2026-06-15 11:49:58.011375+08	20260615034958_add_mobile_number	\N	\N	2026-06-15 11:49:58.009423+08	1
c1625d4d-9adc-4678-9ea7-bf6da73c0d9e	380eed87acb1e25d2157db8aac9fb9fefc799f93425adf2119eaf539226fe6e6	2026-07-03 18:38:43.196+08	20260703103843_add_community_type	\N	\N	2026-07-03 18:38:43.165271+08	1
ae9c3cce-ec30-4da0-8184-b16618ac3193	563ea7df18c997e91d24814b278f3b542e545b49baa8fc41ef19d64505409f58	2026-06-18 07:26:50.963518+08	20260617232650_add_user_profile_picture	\N	\N	2026-06-18 07:26:50.950273+08	1
8277dcbe-534d-487b-b5ec-21891bca6848	7b9f6c9b2542c6af072acbda4c2a08515592738326e9ef0d113ce4af40fea532	2026-06-22 19:37:17.984888+08	20260622113717_add_document_id_for_notifications	\N	\N	2026-06-22 19:37:17.97354+08	1
37d36237-f28c-49b2-b6c2-bdfcde0fb7d4	0db366ab18b5be903430be4e0a5cc3416fd65e324df6aa79a1a1f4bd62ae89ed	2026-07-04 16:27:46.804536+08	20260704082746_add_community_cascade_delete	\N	\N	2026-07-04 16:27:46.776223+08	1
93f7cdf6-c358-43f7-959e-be87a0116ad4	797a1d303749d0c383e8df3cf2594521314f27712b2a1c96474eb777f2e2b955	2026-07-04 19:43:49.70163+08	20260704114349_add_community_read	\N	\N	2026-07-04 19:43:49.635214+08	1
8db7bf48-8684-4be1-a95b-abc9d22307a7	8a23cec14b9c46362ed448787d852ee321f21a9fadac93dba6892617379e4837	2026-07-05 13:54:44.147352+08	20260705055444_add_message_edit_delete	\N	\N	2026-07-05 13:54:44.123422+08	1
0e8ef254-48f5-4d85-83ad-09f37c2f54a9	4ea8f4649f13a421a77fa49640b3fff43bf52aa26541c89ba6bc94e22ff64d27	2026-07-05 15:20:03.77615+08	20260705072003_add_message_reactions	\N	\N	2026-07-05 15:20:03.728083+08	1
\.


--
-- Name: CommunityAttachment CommunityAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityAttachment"
    ADD CONSTRAINT "CommunityAttachment_pkey" PRIMARY KEY (id);


--
-- Name: CommunityMember CommunityMember_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMember"
    ADD CONSTRAINT "CommunityMember_pkey" PRIMARY KEY (id);


--
-- Name: CommunityMessage CommunityMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMessage"
    ADD CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY (id);


--
-- Name: CommunityRead CommunityRead_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityRead"
    ADD CONSTRAINT "CommunityRead_pkey" PRIMARY KEY (id);


--
-- Name: Community Community_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Community"
    ADD CONSTRAINT "Community_pkey" PRIMARY KEY (id);


--
-- Name: DocumentAttachment DocumentAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentAttachment"
    ADD CONSTRAINT "DocumentAttachment_pkey" PRIMARY KEY (id);


--
-- Name: DocumentLog DocumentLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentLog"
    ADD CONSTRAINT "DocumentLog_pkey" PRIMARY KEY (id);


--
-- Name: DocumentRoute DocumentRoute_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentRoute"
    ADD CONSTRAINT "DocumentRoute_pkey" PRIMARY KEY (id);


--
-- Name: DocumentStatus DocumentStatus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentStatus"
    ADD CONSTRAINT "DocumentStatus_pkey" PRIMARY KEY (id);


--
-- Name: DocumentType DocumentType_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentType"
    ADD CONSTRAINT "DocumentType_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: MessageReaction MessageReaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessageReaction"
    ADD CONSTRAINT "MessageReaction_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OfficeUser OfficeUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OfficeUser"
    ADD CONSTRAINT "OfficeUser_pkey" PRIMARY KEY (id);


--
-- Name: Office Office_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Office"
    ADD CONSTRAINT "Office_pkey" PRIMARY KEY (id);


--
-- Name: OrganizationUnit OrganizationUnit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrganizationUnit"
    ADD CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: UserRole UserRole_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserRole"
    ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY (id);


--
-- Name: UserSettings UserSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSettings"
    ADD CONSTRAINT "UserSettings_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: CommunityMember_communityId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON public."CommunityMember" USING btree ("communityId", "userId");


--
-- Name: CommunityRead_communityId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "CommunityRead_communityId_userId_key" ON public."CommunityRead" USING btree ("communityId", "userId");


--
-- Name: DocumentStatus_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DocumentStatus_name_key" ON public."DocumentStatus" USING btree (name);


--
-- Name: DocumentType_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DocumentType_name_key" ON public."DocumentType" USING btree (name);


--
-- Name: Document_trackingNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Document_trackingNumber_key" ON public."Document" USING btree ("trackingNumber");


--
-- Name: MessageReaction_messageId_userId_emoji_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON public."MessageReaction" USING btree ("messageId", "userId", emoji);


--
-- Name: OfficeUser_officeId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "OfficeUser_officeId_userId_key" ON public."OfficeUser" USING btree ("officeId", "userId");


--
-- Name: Office_officeCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Office_officeCode_key" ON public."Office" USING btree ("officeCode");


--
-- Name: OrganizationUnit_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON public."OrganizationUnit" USING btree (code);


--
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- Name: UserRole_userId_roleId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON public."UserRole" USING btree ("userId", "roleId");


--
-- Name: UserSettings_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UserSettings_userId_key" ON public."UserSettings" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_employeeId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_employeeId_key" ON public."User" USING btree ("employeeId");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: CommunityAttachment CommunityAttachment_messageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityAttachment"
    ADD CONSTRAINT "CommunityAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES public."CommunityMessage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommunityMember CommunityMember_communityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMember"
    ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES public."Community"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommunityMember CommunityMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMember"
    ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CommunityMessage CommunityMessage_communityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMessage"
    ADD CONSTRAINT "CommunityMessage_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES public."Community"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommunityMessage CommunityMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMessage"
    ADD CONSTRAINT "CommunityMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CommunityRead CommunityRead_communityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityRead"
    ADD CONSTRAINT "CommunityRead_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES public."Community"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommunityRead CommunityRead_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityRead"
    ADD CONSTRAINT "CommunityRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Community Community_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Community"
    ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DocumentAttachment DocumentAttachment_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentAttachment"
    ADD CONSTRAINT "DocumentAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentLog DocumentLog_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentLog"
    ADD CONSTRAINT "DocumentLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentLog DocumentLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentLog"
    ADD CONSTRAINT "DocumentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DocumentRoute DocumentRoute_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentRoute"
    ADD CONSTRAINT "DocumentRoute_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentRoute DocumentRoute_fromOfficeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentRoute"
    ADD CONSTRAINT "DocumentRoute_fromOfficeId_fkey" FOREIGN KEY ("fromOfficeId") REFERENCES public."Office"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DocumentRoute DocumentRoute_receivedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentRoute"
    ADD CONSTRAINT "DocumentRoute_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DocumentRoute DocumentRoute_sentByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentRoute"
    ADD CONSTRAINT "DocumentRoute_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DocumentRoute DocumentRoute_toOfficeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DocumentRoute"
    ADD CONSTRAINT "DocumentRoute_toOfficeId_fkey" FOREIGN KEY ("toOfficeId") REFERENCES public."Office"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_currentOfficeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_currentOfficeId_fkey" FOREIGN KEY ("currentOfficeId") REFERENCES public."Office"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_currentStatusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_currentStatusId_fkey" FOREIGN KEY ("currentStatusId") REFERENCES public."DocumentStatus"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_documentTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES public."DocumentType"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_senderOfficeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_senderOfficeId_fkey" FOREIGN KEY ("senderOfficeId") REFERENCES public."Office"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessageReaction MessageReaction_messageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessageReaction"
    ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES public."CommunityMessage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessageReaction MessageReaction_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessageReaction"
    ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OfficeUser OfficeUser_officeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OfficeUser"
    ADD CONSTRAINT "OfficeUser_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES public."Office"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OfficeUser OfficeUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OfficeUser"
    ADD CONSTRAINT "OfficeUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Office Office_organizationUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Office"
    ADD CONSTRAINT "Office_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES public."OrganizationUnit"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrganizationUnit OrganizationUnit_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrganizationUnit"
    ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."OrganizationUnit"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserRole UserRole_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserRole"
    ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserRole UserRole_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserRole"
    ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserSettings UserSettings_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSettings"
    ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict TdrDg7LxSNFQxO8iNEhvyKZ5AuPMDpcHKcnhIAMsdKVd8llfQt0U4ObE4hp5m1T

