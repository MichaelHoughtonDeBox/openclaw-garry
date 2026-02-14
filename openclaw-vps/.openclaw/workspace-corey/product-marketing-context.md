# Product Marketing Context

*Last updated: 2026-02-09 (v2 — added company vision & investment memo context)*

---

## Company Vision & Strategic Positioning

> **Community Wolf is not building an app. It is building safety data infrastructure.**

### The thesis

Public safety data is globally fragmented and reactive. Siloed signals live in community WhatsApp groups, panic apps, call centres, CCTV systems, guard patrol logs and private security control rooms — none of which talk to one another. Communities, private security firms, insurers and cities all operate on partial, delayed views of risk. True prevention is almost impossible when the underlying dataset is incomplete or non-existent. In emerging markets like South Africa, broken public systems (like 10111) mean millions of incidents go unreported entirely.

Community Wolf exists to solve this by building the foundational data and intelligence layer required to predict, model and understand criminal activity.

### What we are building

At its core, Community Wolf is a **safety data company**. The products (community tools, business tools, Namola) are the means by which we generate, structure and operationalise safety data at scale. They produce millions of geo-tagged safety events across South Africa, the UK and the US. At the centre sits the **Safety Intelligence Layer** — a continuously learning engine that transforms raw signals into standardised risk insights and predictive intelligence, exposed through an API for partners across insurance, mobility, property, security and the public sector.

### Three-layer architecture

1. **Data generation products** — The products that create high-quality, structured safety data at the edge. Community Wolf's WhatsApp-native reporting and business tools (access control, patrol, roster, group agents), plus Namola's verified emergencies, responder logs and outcome data. Together they produce millions of geo-tagged safety signals across multiple countries.

2. **Safety Intelligence Layer** — A continuously learning safety graph that aggregates community incidents, verified emergencies, access logs and patrol data; standardises and verifies signals; identifies hotspots, anomalies and trend shifts; and models crime patterns using local and global datasets. Internal models trained on Chicago, Philadelphia and UK data have already validated early predictive capability.

3. **Safety Intelligence API** — Exposes real-time intelligence to external partners through endpoints (`/risk-score`, `/incidents`, `/heatmap`, `/predict`, live alerts). Allows insurers, mobility platforms, property marketplaces, public-sector entities and private security firms to embed safety intelligence without Community Wolf operating the full stack in every geography.

### The data flywheel

Every product in the ecosystem serves a dual purpose: it either generates revenue, generates data, or both. Business tools are a cash cow *and* a data source. Community tools are primarily a data acquisition channel. Namola is both a cash cow and a data source. All signals feed the Intelligence Layer, which trains models, which improves products, which attracts more users, which generates more data. The API then distributes intelligence outward, creating network effects.

### The market opportunity

Community Wolf sits within the **$250bn+ global private security industry** — one of the largest and least digitised categories worldwide. Beyond private security, real-time location risk underpins several adjacent categories:
- Mapping and routing (e.g., Waze, Google Maps)
- Mobility and ride-hailing
- Last-mile logistics
- Insurance and underwriting
- Property search and valuation
- Public-sector planning

South Africa provides an extreme proving ground: high crime, deep private security penetration and acute need for real-time intelligence. The UK presents opportunity for community-based and API-led deployments. The US provides rich public datasets and a clear customer base across insurers, mobility platforms and city governments. Latin America mirrors South Africa in fragmentation and urban insecurity.

**Geographic expansion roadmap:** South Africa → UK → US → Latin America.

Community Wolf's API-first model allows participation in these categories without requiring an operational presence in each market.

### How to describe Community Wolf (in order of preference)

1. "Community Wolf builds the data and intelligence infrastructure that powers safer cities."
2. "Community Wolf is a safety data platform. We aggregate and structure millions of safety signals into intelligence used by communities, mobility platforms, insurers, security firms and cities."
3. "Community Wolf is the safety data infrastructure that unifies fragmented signals into real-time intelligence."

### Vision statement

> Our vision is to ensure that all of humanity feels safe and protected.

### Mission statement

> Our mission is to build the foundational data and intelligence layer required to predict, model and understand criminal activity.

### Goal

Become the **default safety data layer that others build on** — not just another isolated app.

---

## Product Overview

**One-liner:** Community Wolf is safety data infrastructure — capturing community reports, emergency response, and security operations data into predictive intelligence that teams and platforms build on.

**What it does:** Community Wolf provides a WhatsApp-first platform that lets communities report safety incidents for free in their first language, and gives private security businesses operational tools (access control, patrol management, roster management, group monitoring) that replace expensive hardware with the smartphones already on site. All data feeds into a predictive intelligence layer and API that models crime patterns across cities. At its core, Community Wolf is a data company — the products are the means by which safety data is generated, structured and operationalised at scale.

**Product category:** Safety data infrastructure / community safety platform / security operations SaaS / Access Control as a Service (ACaaS)

**Product type:** Multi-product SaaS platform with three segments:
1. **Community tools** — Free WhatsApp-based reporting and alerts for residents (primarily a data acquisition channel)
2. **Business tools** — Enterprise operational tools for private security businesses, guarding-focused (revenue + data generation)
3. **Safety Intelligence API** — Predictive risk scoring, route analysis, and citywide forecasting (long-term moat + external value)

**Business model:** Multi-sided revenue stack:
- **B2C subscriptions** — Namola premium plans for residents, commuters and tourists
- **B2B SaaS** — Monthly subscription per device/phone number for business tools. No licensing fees, no hidden costs, no-fuss billing. One monthly fee per device for the full service (cloud, updates, support included).
- **Platform/API** — Usage-based and enterprise pricing for the Safety Intelligence API powering risk scores and incident feeds for insurers, mapping and mobility partners, property platforms and cities
- Community tools are free (data acquisition play)

**Pricing benchmarks:**
- Access control software-only: ~R300/month per device
- Access control with hardened device + data bundle: ~R500/month per device (device paid off in ~4 months)
- Competitors charge R800–R1,500/month to rent a dedicated scanner
- Platform fee + modular tool pricing (pick the tools you need)
- Setup/onboarding included in the base fee
- Namola: from R59/month (individual, couple or family plans)

---

## Target Audience

**Target companies:**
- Mid-sized and smaller private security businesses (guarding-focused, not response)
- Security companies managing multiple client sites
- Gated estates and residential complexes (HOAs, body corporates, residents' associations)
- Corporate facilities and logistics centres seeking simplified vehicle access
- Community policing forums (CPFs) and neighbourhood watches
- Municipal safety partnerships

**Market size context:** ~15,000–20,000 registered private security businesses in South Africa, ~3 million deskless guards. Most businesses range from one-man operations to large enterprises like ADT/Fidelity. The vast majority are smaller operators "getting through by the skin of their teeth."

**Decision-makers:**
- Security company owners/directors (primary buyer)
- Operations managers / regional managers
- Estate managers / trustees / HOA committees
- Control room supervisors

**Primary use case:** Replace expensive, breakable, single-purpose hardware devices with WhatsApp-based tools that run on the phones already on every security site — proving to clients that guards are doing what they're supposed to do.

**Jobs to be done:**
- "Help me prove to my clients that my guards are actually doing the work they're paid to do" (accountability & compliance)
- "Help me replace the R1,500/month scanners and patrol devices with something cheaper that guards can't break" (cost reduction & reliability)
- "Help me monitor hundreds of WhatsApp groups without human beings sitting and scrolling all day" (operational efficiency)
- "Help me get structured, exportable reports to my clients every week without manual admin" (reporting & proof of service)

**Use cases:**
- Licence disc scanning at boom gates / estate entrances (basic or comprehensive with driver ID)
- Guard patrol verification via geofenced checkpoints and scheduled routes
- Staff rostering and shift management across multiple sites
- AI-powered WhatsApp group monitoring for control rooms
- Community incident reporting and verified alerts
- Automated weekly/monthly SLA compliance reports to clients
- Real-time flagged vehicle/person alerts across an organisation
- Safety surveys capturing fear-of-crime perception data
- Emergency response dispatch (via Namola integration)

---

## Personas

| Persona | Role | Cares about | Challenge | Value we promise |
|---------|------|-------------|-----------|------------------|
| **Owner / Director** (Decision Maker + Financial Buyer) | Security company owner running 5–50+ sites | Keeping SLAs, retaining clients, reducing device costs, proving value to clients | Paying R1,500/month per scanner across 20 sites, guards breaking hardware, spending hours on admin/reporting | "Cut your device costs in half, deploy in minutes, and get automated proof-of-service reports" |
| **Operations Manager** (Champion) | Day-to-day ops across multiple sites | Guard accountability, real-time visibility, reducing missed patrols | Can't physically be everywhere, relies on trust, paper-based shift records | "See exactly who did what, when, and where — from your phone or dashboard" |
| **Control Room Operator** (User) | Monitors WhatsApp groups and dispatches | Missing critical info in 400+ WhatsApp groups, information overload | Manually scrolling through hundreds of group chats, missing incidents | "Group Agents silently extract the incidents that matter — you only see what's relevant" |
| **Guard / Field Staff** (End User) | Uses the WhatsApp phone on site | Simple instructions, no new apps to learn | Gets given broken devices, complex apps, things that slow them down | "It's just WhatsApp — you already know how to use it" |
| **Estate Manager / HOA Chair** (Client of the security company) | Paying for the security SLA | Proof guards are patrolling, vehicles are being checked, incidents are responded to | Receives patchy manual reports, can't verify if guards are actually working | "Automated, timestamped, GPS-verified proof delivered to your inbox every morning" |

---

## Problems & Pain Points

**Core problem:** Private security businesses are trapped in an expensive, fragile cycle of buying proprietary hardware devices to prove to clients that guards are doing their jobs — while guards actively try to break or avoid using those devices.

**Why alternatives fall short:**
- **Dedicated scanners (At The Gate, SolTerra):** R800–R1,500/month rental per device. Guards put them in socks and bash them against walls. When broken, guards don't have to scan. Expensive to replace. Single-purpose — you need a separate device for patrol, another for scanning.
- **Patrol devices (ActiveTrack, Sefeco):** RFID tap-on-wall systems that are similarly breakable, expensive, and require physical installation at every checkpoint.
- **Manual / clipboard methods:** Zero accountability. "A piece of paper in my post box saying we were here at such and such a time."
- **App-based solutions:** Can't run apps because phones are locked to WhatsApp-only SIM cards. If you unlock the phone for an app, guards will be on TikTok, gambling, or porn instead of watching the site.
- **Human monitoring of WhatsApp groups:** Control rooms have humans scrolling through hundreds of groups. They miss critical information. It's mindless, expensive, and unreliable.

**What it costs them:**
- R1,500/month × 20 sites = R360,000/year just on scanner rentals
- Admin hours compiling manual reports (downloading, formatting, emailing)
- Lost clients when they can't prove SLA compliance
- Guards sleeping on duty with no accountability
- Critical safety information lost in WhatsApp group noise
- Missed incidents that could have been prevented

**Emotional tension:**
- "Everyone's just trying to prove to everybody else that they are doing the thing that they said they were doing" — the entire industry runs on smoke and mirrors
- Constant anxiety about whether guards are actually awake and working
- Fear of losing SLA contracts because you can't prove compliance
- Frustration with the endless cat-and-mouse game of guards breaking devices
- Resignation that "this is just how it is" in the industry

---

## Competitive Landscape

**Direct competitors (same solution, same problem):**
- **At The Gate** — Dedicated licence disc scanners. Falls short because: expensive hardware rental (R800–R1,500/month), guards break the devices, single-purpose (scan only, no patrol), requires physical distribution and setup
- **SolTerra** — Similar hardware-based access control. Falls short because: same hardware dependency, same breakability problem, same cost structure
- **ActiveTrack / Sefeco** — Patrol management devices (RFID wall-taps). Falls short because: requires physical installation of RFID tags at every checkpoint, separate device from the phone, guards break them, no intelligence layer
- **Generic rostering/workforce management SaaS** — Not built for security industry constraints (WhatsApp-locked phones, deskless guards, guard behaviour dynamics)

**Secondary competitors (different solution, same problem):**
- **Manual clipboard/paper logs** — Still used by thousands of smaller companies. Falls short because: zero verification, no real-time alerts, easily fabricated
- **CCTV monitoring** — Proves presence but doesn't capture structured data, expensive infrastructure, doesn't work for mobile patrol
- **Custom-built internal tools** — Some larger companies build their own. Falls short because: expensive to maintain, not scalable, no intelligence layer

**Indirect competitors (conflicting approach):**
- **App-based security platforms** — Require unlocking phones beyond WhatsApp, which breaks the industry's device-control model. Guards will misuse full internet access.
- **Traditional alarm monitoring companies (e.g., Chubb, ADT)** — Focus on response, not guarding operations. Different segment.

---

## Differentiation

**Key differentiators:**
- **Safety data infrastructure, not just another app** — One of the first platforms globally to span community, response and enterprise data in a single, vendor-agnostic middleware layer. Where other products are single-purpose (a panic app, a neighbourhood group, a control-room tool), Wolf functions as the infrastructure layer — providing the data model, the intelligence engine and the distribution channels that others build on.
- **Zero hardware investment** — Uses the WhatsApp phone already on every site. No scanners, no RFID tags, no patrol devices to buy or rent.
- **WhatsApp-native** — Works within the constraints that actually exist (WhatsApp-only SIM cards, guards who break devices, low technical literacy). Not fighting the environment — working within it.
- **Multi-tool consolidation** — Access control + patrol + roster + group monitoring on a single phone. Replaces 3+ separate devices.
- **Instant remote deployment** — Add a phone number, assign skills, operational in minutes. "Took us three and a half minutes to get all 20 sites up and running."
- **AI-powered group monitoring** — No competitor offers automated WhatsApp group intelligence extraction. This is a new category.
- **Unified intelligence layer** — Data from all tools feeds a unified schema and continuously learning safety graph. Not just recording events — modelling patterns, identifying hotspots, predicting risk.
- **Developer-friendly Safety API** — Endpoints like `/risk-score`, `/incidents`, `/heatmap`, `/predict` let external partners embed safety intelligence without building their own data pipeline.
- **Automated proof-of-service** — Export Flows send branded compliance reports automatically. No more Friday afternoon admin.
- **Proven on-the-ground deployments** — Deep emerging-market deployments (Kayamandi township, Alexandra peace project) combined with developed-market datasets (Chicago, Philadelphia, London) give a uniquely broad training ground for predictive intelligence.

**How we do it differently:** Instead of creating yet another device that guards will break, we put operational capabilities onto the one thing they won't break — the WhatsApp phone — because breaking it means they can't check into their shift and don't get paid.

**Why that's better:**
- Half the cost (R300–500 vs R800–1,500)
- Nothing new to distribute, install, or maintain
- Guards already know WhatsApp — minimal training
- Multi-purpose: one phone replaces three devices
- Real-time GPS-verified proof, not trust-based
- Data feeds intelligence models that get smarter over time

**Why customers choose us:**
- "The hardware you need is already on site"
- Dramatically lower cost
- Instant deployment (minutes, not weeks)
- Guards can't game the system (current location verification, not shared/fake locations)
- Automated reporting eliminates admin
- One client scanned 500,000+ licence discs in 6 months across 20 sites

---

## Objections

| Objection | Response |
|-----------|----------|
| "WhatsApp isn't reliable enough for security operations" | We use the Meta WhatsApp Business API — the same infrastructure banks and airlines use. Uptime is excellent for 99% of use cases. For the 1% where zero-miss is critical (e.g., GBV monitoring), we're transparent about platform constraints and work on a case-by-case basis. |
| "Our guards will just fake their location" | WhatsApp distinguishes between current location (where your GPS says you are right now) and shared location (where you drop a pin). Our system only accepts current locations. You physically have to be inside the geofenced radius to check in. |
| "We've always used scanners, why change?" | You're paying R1,500/month per scanner that guards actively try to break. We do the same thing for R300–500/month on a phone they already have. One client replaced scanners across 20 sites in 3.5 minutes. Same national database checks, same alerts, half the cost, zero hardware. |
| "This seems too complicated for my team to set up" | We handle onboarding. But honestly, it's adding phone numbers and ticking boxes. No physical installation, no device shipping, no firmware updates. The industry is used to hand-holding from device companies — we provide the same support, just without the van and the technician. |
| "What about when phones break?" | Phones break too — we know that. But they already have phones and already replace them. The difference is a phone costs R800 to replace. A scanner costs R1,500/month to rent. And they need both right now. With us, they only need one. |

**Anti-persona:**
- Large response-only companies (ADT armed response, not guarding) — our tools are built for guarding operations, not alarm panel monitoring and vehicle dispatch
- Companies with massive IT departments that want to build custom solutions — they'll want more control than a SaaS platform offers
- Single-guard operations with no SLA accountability requirements — they don't have the "prove it" pressure that drives adoption
- Companies that are philosophically opposed to WhatsApp or refuse to use it (rare in SA)

---

## Switching Dynamics

**Push (frustrations driving them away from current solution):**
- Paying R1,500/month per scanner × dozens of sites
- Guards destroying devices deliberately ("boil it in the kettle, put it in a sock and bash it against the wall")
- Friday afternoon admin compiling reports manually to email to clients
- Human control room operators missing critical WhatsApp group messages
- Needing 3 separate devices per site (phone + scanner + patrol device)
- Can't prove compliance to clients beyond "trust me"

**Pull (what attracts them to Community Wolf):**
- Half the cost, instant deployment
- "The hardware you need is already on site" — nothing new to buy
- Automated export flows eliminate Friday admin
- Real-time GPS-verified proof of patrol completion
- AI that monitors WhatsApp groups while humans sleep
- One platform for everything (access + patrol + roster + groups + reporting)
- National database checks with instant flagged vehicle alerts

**Habit (what keeps them stuck with current approach):**
- "This is how the industry has always done it" — 20+ years of device-based workflows
- Existing contracts with scanner rental companies
- Familiarity with ActiveTrack/SolTerra interfaces
- Fear of changing processes across dozens of sites simultaneously
- "If it ain't broke..." (even though it literally is broke — guards break it)

**Anxiety (what worries them about switching):**
- "Will WhatsApp go down during a critical moment?"
- "Can my guards actually use this?" (despite it being simpler than current devices)
- "What if we switch and the data isn't as good?"
- "We've invested in our current hardware stack"
- "What happens if Community Wolf goes under?" (startup risk)
- General industry conservatism and resistance to change

---

## Customer Language

**How they describe the problem:**
- "I'm always trying to prove to the client that we're doing what we said we would"
- "My guards put the scanner in a sock and bashed it against the wall"
- "We have 400 WhatsApp groups and one person trying to read all of them"
- "Every Friday I spend hours pulling reports together to email to the estate"
- "The guy will do anything not to do the thing he's supposed to do"
- "It's smoke and mirrors — we're all just trying to keep up appearances"
- "They boil the stuff in the kettle" (on breaking patrol devices)
- "A piece of paper in my post box saying we were here" (on current patrol proof)

**How they describe us:**
- "The hardware you need is already on site"
- "You can do access control with just WhatsApp"
- "That's insane. The technology around what you've created is insane."
- "It's very basic what I've just seen. If I can understand that, most people can."
- "Once you're using it, you're not gonna leave"
- "It's a no-brainer. When people get it, they will go absolutely."
- "50% faster check-in, 95% fewer errors"
- "It allows people that wouldn't necessarily afford it to actually keep their community safer"

**Words to use:**
- Safety data infrastructure
- Safety Intelligence Layer
- Safety Intelligence API
- Unified safety graph
- Continuously learning
- Geo-tagged safety events
- Predictive intelligence
- WhatsApp-first
- No new hardware
- The hardware you need is already on site
- Deploy in minutes
- Prove compliance / prove it
- Skills (for capabilities assigned to devices)
- Real-time alerts
- GPS-verified
- Automated proof-of-service
- Safety intelligence
- Structured data / structured signals
- Business tools
- Accountability
- Instant deployment
- Half the cost
- The default safety data layer that others build on
- Data generation products (for the product suite)
- Vendor-agnostic middleware layer

**Words to avoid:**
- "Surveillance" (negative connotation)
- "Spying" or "monitoring" when describing group agents to end users
- "Bot" when describing group agents (people don't like bots)
- "Cheap" (use "affordable" or "fraction of the cost")
- "Replace your guards" (we augment, not replace)
- "App" (we're WhatsApp-native, not another app to install)
- "Smart" in isolation (too vague; be specific about what intelligence the system provides)
- "Disruption" externally (internally fine, externally sounds threatening to an industry that's conservative)

**Glossary:**

| Term | Meaning |
|------|---------|
| **Staff** | A WhatsApp phone number/device registered on the platform (will be renamed to "Devices") |
| **Skills** | Capabilities assigned to a staff/device (e.g., access control scanning, patrol check-in) |
| **Sites** | Physical locations where staff operate, used for grouping and filtering |
| **Areas** | Geographic polygons/catchment zones for filtering reports and scoping operations |
| **Alert Flows** | Business automation triggers — when X happens across your organisation, notify Y |
| **Export Flows** | Scheduled automated reports (PDF) sent to email addresses at chosen frequency |
| **Group Agents** | AI agents that sit silently on WhatsApp groups, extracting structured data per assigned skills |
| **Feeds** | Real-time multi-group monitoring view (like a social media dashboard for WhatsApp groups) |
| **Radar** | Keyword, sentiment, and trend tracking across WhatsApp groups |
| **Insights** | Scheduled AI-generated summaries of WhatsApp group activity (daily/weekly) |
| **Intelligence** | The map-based view of community-reported incidents and safety data |
| **Basic scan** | Licence disc only — registration, make, model, expiry, flag status |
| **Comprehensive scan** | Licence disc + driver's licence/ID — full identity capture |
| **Check-in patrol** | Single checkpoint "are you awake?" verification |
| **Route patrol** | Multi-checkpoint walking/driving route with geofenced checkpoints |
| **Fear of crime** | Sentiment-based safety perception data mapped to geographic areas |
| **Namola** | Emergency response app within the Community Wolf ecosystem — panic, family tracking, communities |
| **Safety Intelligence API** | Predictive risk scores and crime forecasting API for third-party platforms. Endpoints: `/risk-score`, `/incidents`, `/heatmap`, `/predict`, live alerts |
| **Safety Intelligence Layer** | The continuously learning engine at the core of Community Wolf that aggregates, standardises and models safety signals into predictive intelligence |
| **Safety graph** | The unified, geo-indexed data store that connects community incidents, verified emergencies, access logs and patrol data into a single schema |
| **Data generation products** | The products that create safety data at the edge — Community Wolf business tools, WhatsApp reporting, and Namola |

---

## Brand Voice

**Tone:** Approachable, clear, and authoritative. Practical, confident, and reassuring. Never condescending. Speaks to the operator who's been in the industry for 20 years — not down to them, but alongside them.

**Style:** Direct and conversational. Technical credibility without jargon. Real-world examples over abstract features. Show, don't tell. Operational language ("deploy in minutes", "proof on your desk by Monday") over marketing fluff.

**Personality:**
- **Practical** — We build things that work in the real world, not in a demo
- **Straight-talking** — We say what we mean. No buzzwords, no enterprise-speak.
- **Empathetic** — We understand the guard-hut-at-2am reality of this industry
- **Ambitious** — We're building Africa's safety data infrastructure, not just another tool
- **Inclusive** — From townships to affluent suburbs, from one-man operations to enterprise

**UK English spelling throughout:** licence (not license), organisation (not organization), neighbourhood (not neighborhood), colour, defence, etc.

---

## Proof Points

**Metrics:**
- 700,000+ Namola downloads, 100k MAU, 20k paying subscribers, ~£300k ARR
- 5,000,000+ structured safety events across the platform
- 200+ communities onboarded
- 170,000+ emergencies handled (via Namola)
- 500,000+ licence discs scanned in 6 months by a single client (Savika, 20 sites)
- 3.5 minutes to deploy access control across 20 sites
- ~50 security companies in pipeline (various stages: POC, started, billing)
- 10 cities across 3 continents for predictive models (Joburg, Cape Town, Durban, London, Chicago, LA, San Francisco, NYC, Boston, Philadelphia)
- Model performance: 71.1% accuracy, 40-week forecast horizon
- Entire platform built by 2-person engineering team (AI-augmented) since January 2025

**Notable customers/logos:**
- Savika (large-scale access control deployment — 500k+ scans)
- Sun Community (estate/residents association)
- Multiple Stellenbosch-area security companies and CPFs
- Kayamandi township deployment (first private response in a township environment)
- Alex Peace Project (Alexandra township)

**Team:**
- **Nicholas Mills** (Co-Founder) — Ex-Versofy founding partner ($10m equity + $100m debt raised); prior quant hedge fund experience in signal processing. Full-time.
- **Michael Houghton** (Co-Founder) — AI engineer and founder of Debox Technologies; delivered AI systems for governments and corporates across Africa and Europe. Full-time.
- **Dr Gretha Groeneveld** — PhD in spatial crime mapping. Deep expertise in Stellenbosch and Western Cape safety landscape.
- Supported by a senior marketer and senior developer.

**Investors:**
- Baobab Network (Africa's leading startup accelerator — first check)
- Vastly Valuable Ventures (Abu Dhabi-based VC — co-invested with Baobab)
- Fuel Ventures (UK VC — led pre-seed round)
- Aura Services — selling Namola into Community Wolf via £1m convertible note + strategic partnership
- Oversubscribed $550k pre-seed round
- In discussions with Southern Passage Capital regarding $5m seed commitment

**Testimonials:**

> "That's insane. The technology around what you've created is insane. You have to share this." — Creative agency partner, after business tools demo

> "It's a no-brainer. When people get it, they will go, absolutely." — Agency partner, after understanding the pricing

> "So they obviously, they obviously don't have to go and do everything. Like it would just be amazing — one step ahead." — Agency partner, on Export Flows

> "Makes complete sense. It's amazing." — Agency partner, on real-time flagged vehicle alerts

> "Namola saved my husband's life on Sunday. The ambulance took maybe 6-8 minutes from the time of my call to them arriving. I am extremely grateful." — Namola user

**Value themes:**

| Theme | Proof |
|-------|-------|
| **Dramatically lower cost** | R300–500/month vs R800–1,500/month for competitors. "Where you're paying R1,800 for a scanner, we're coming in at R500 a month." |
| **Instant deployment** | 3.5 minutes to deploy 20 sites. No hardware shipping, no physical installation. |
| **Guards can't game it** | GPS current-location verification. Shared/fake locations are rejected. "The only way it'll let you check in is if you send a current location inside the perimeter." |
| **Eliminates admin** | Export Flows auto-send PDF reports. Alert Flows auto-notify stakeholders. "Set it up once and it happens automatically." |
| **Proven at scale** | 500,000+ scans processed by one client. 5M+ structured safety events platform-wide. |
| **Zero hardware** | "The hardware you need is already on site." One phone replaces 3 devices. |

---

## Product Ecosystem

### Segment 1: Community Tools (Data acquisition + community value)
- **Community Wolf on WhatsApp** — Free incident reporting in any language. Create alert areas. Receive verified updates. No app download needed.
- **Namola** — Emergency response app with three core features:
  1. **Panic / SOS** — One-tap to reach verified local responders (armed response, medical, public emergency)
  2. **Family tracking** — Find My / Life360-like features with smart location alerts
  3. **Communities** — Join and follow local safety communities (like Nextdoor, but safety-focused)
- **Public safety map** (map.communitywolf) — Real-time map of community-reported incidents (summarised view for public, verbose view for enterprise)

### Segment 2: Business Tools (Revenue generation + data acquisition)
- **Access Control** — Licence disc + driver ID scanning via WhatsApp. National database checks. Instant flagged vehicle alerts. Two modes: basic (disc only) and comprehensive (disc + person).
- **Patrol Management** — Geofenced checkpoint patrols and schedule-driven routes. GPS-verified check-ins via WhatsApp. Prove guards are where they say they are.
- **Roster Management** — Staff scheduling, shift planning, and device-to-person mapping. Shift change requests via WhatsApp. (Payroll integration coming.)
- **Group Agents** — AI agents on WhatsApp groups. Silent listeners that extract structured data per configurable skills. Sub-features: Feeds (live multi-group view), Radar (keyword/sentiment tracking), Insights (scheduled summaries).
- **Safety Survey** — GPS-tagged fear-of-crime surveys for residents and staff. Multi-language. Analytics dashboard with heatmaps.
- **Intelligence** — Dashboard view of community-reported incidents. Daily and weekly briefings. Analytics.

### Segment 3: Safety Intelligence API (Long-term moat + external value)
- Predictive risk scores by location (`/risk-score`)
- Incident feeds and heatmaps (`/incidents`, `/heatmap`)
- Citywide crime forecasting, 40-week horizon (`/predict`)
- Live alerts for real-time event streaming
- Trained on Community Wolf data + public safety datasets
- Live in 10 cities across 3 continents
- Target verticals: insurance/underwriting, mobility/logistics, property/real estate, private security, city/public sector, mapping/navigation

### Cross-cutting platform features:
- **Alert Flows** — Business automation: when X event happens, notify Y people via WhatsApp/email/webhook
- **Export Flows** — Scheduled PDF reports sent to email (daily/weekly/monthly) for SLA compliance
- **Connectors** — Third-party integrations and external system connections
- **Sites** — Group staff/devices by physical location
- **Areas** — Geographic polygons for filtering and scoping
- **Staff/Devices** — Phone number management with skill assignments

### Data flywheel:
Community tools → generate data → feeds business tools → generate more data → feeds Safety Intelligence API → trains predictive models → improves all products → attracts more users → generates more data

---

## Goals

**Primary business goal:** Become the default safety data infrastructure for the world — the foundation on which safer communities, safer mobility, safer insurance and safer cities are built. Prove the model through revenue-generating business tools and Namola subscriptions while accumulating the safety dataset needed to power predictive intelligence at scale.

**Conversion action:** Book a demo / Request a pilot plan. Secondary: "Try on WhatsApp" for community tools. Tertiary: "Request API access" for the intelligence API.

**Current stage:** Raising £5m for 20% of Community Wolf Limited (UK), EIS-approved Seed round.

**Current metrics:**
- Oversubscribed $550k pre-seed (Baobab + Vastly Valuable + Fuel Ventures)
- Namola: ~£300k ARR, 20k paying users, 100k MAU
- ~50 security companies in pipeline
- Revenue generating from business tools
- Sales team recently hired
- 2-person engineering team (AI-augmented) built the entire platform since January 2025

**Near-term priorities (seed capital deployment):**
- Unify datasets from Namola and Community Wolf into a governed, geo-indexed safety graph
- Hire ML and AI talent to deepen the Intelligence Layer
- Ship the Safety Intelligence API to external partners with SLAs and SDKs
- Scale business tools adoption across SA private security market
- Launch consumer and partner offerings in the US, UK and Latin America
- Complete roster management + payroll
- Build out self-service onboarding to reduce hand-holding
- Township alarm system pilot (Kayamandi, via Fiber Time partnership)

**Long-term vision:** "Build an intelligent system that can predict, model, and understand crime and other features... As you drive through the city with Waze, as Waze transfers from one hex to the next hex on a map, it will ping our API and tell you what the risk is." Become the default safety data layer that others build on — not just another isolated app.