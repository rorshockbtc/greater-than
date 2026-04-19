/**
 * Greater — persona / bot data model.
 *
 * Single source of truth that feeds the homepage cards, case-study pages,
 * and demo holding screens. Add new personas here only.
 *
 * `caseStudy` is plain markdown; the case-study page renders it.
 * `heroImage` is the URL relative to the artifact base path.
 * `demoStatus`:
 *   - `live`    → the demo route is fully wired (e.g. blockstream)
 *   - `holding` → the demo route shows a "coming online" holding screen
 */

export type Persona = {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  pain: string;
  heroImage: string;
  caseStudy: string;
  demoStatus: 'live' | 'holding';
  demoLabel: string;
  /**
   * Per-persona scenario + demo-shell config consumed by
   * `PersonaDemoShell` and `ScenarioModal`. Optional only because the
   * FinTech persona has its own bespoke `BlockstreamDemo` page; every
   * other persona must define this.
   */
  scenario?: PersonaScenario;
};

export type PersonaScenario = {
  /** Real, named failure mode the demo dramatizes. */
  failureMode: {
    headline: string;
    body: string;
    /** Real-world example that grounds the scenario (e.g. "CrowdHealth"). */
    namedExample?: string;
  };
  /** What Greater would do differently. */
  pivot: string;
  /**
   * Suggested opening question shown in the modal so visitors don't
   * stare at a blank input. Pre-fills the chat box.
   */
  promptSuggestion: string;
  /** Initial bot greeting once the chat opens. */
  welcome: string;
  /** Input placeholder for this persona's chat. */
  placeholder: string;
  /**
   * Mock site chrome — a believable host page for the chat to live on.
   * Each demo dramatizes the failure mode by surrounding the chat with
   * a page that obviously cannot answer the suggested question on its
   * own.
   */
  shell: PersonaShell;
  /** Public seed bundle slug (file at /seeds/<slug>.json). */
  seedSlug: string;
};

export type PersonaShell = {
  brand: string;
  /** Tailwind class for primary accent (e.g. "bg-indigo-600"). */
  accentBg: string;
  accentText: string;
  navLinks: { label: string; href: string }[];
  breadcrumb: string[];
  /** Short page title visible above the article body. */
  articleTitle: string;
  /** Lead paragraph that introduces the article. */
  articleLede: string;
  /** Bullet sub-sections below the lede; each has a heading + body. */
  articleSections: { heading: string; body: string }[];
  /** Footer line for the mock host. */
  footerNote: string;
};

const PERSONAS: Persona[] = [
  {
    slug: 'startups',
    name: 'Startups',
    shortName: 'Startups',
    tagline: 'Stop bleeding qualified leads to a 2023-grade chatbot.',
    pain: 'Customer acquisition costs are high, attention windows are short, and a generic chatbot can lose a $400-CAC visitor in 8 seconds.',
    heroImage: 'images/personas/startups.png',
    demoStatus: 'live',
    demoLabel: 'Try the live demo — Series A SaaS pricing page',
    scenario: {
      failureMode: {
        headline: 'A $400-CAC visitor opens the chat, gets the cancellation FAQ, and closes the tab.',
        body: 'A founder spends $4 acquiring a click. The visitor lands on pricing, opens the corner chat, asks "can I cancel anytime if my team shrinks?" The off-the-shelf bot pattern-matches "cancel" and pastes a link to the cancellation policy with no acknowledgement of intent. The visitor reads "you may cancel by submitting a request 30 days before renewal" — interprets it as friction — and bounces. The CAC is gone and the founder will never know which conversation lost it.',
        namedExample: 'Vellum (composite of common Series A SaaS chat experiences)',
      },
      pivot: 'Greater answers from the startup\'s actual pricing page, churn policy, and changelog with citations the visitor can click. When the pricing nuance matters ("month-to-month after the first year" vs. "30-day notice"), the bot quotes the source verbatim. When it does not know — say, custom enterprise terms — it says so and offers an escalation the company controls, not a vendor handoff.',
      promptSuggestion: 'Can I cancel anytime if my team shrinks below the Team plan minimum?',
      welcome: "Hi — I'm Vellum's pricing & onboarding bot. Ask me about plans, billing cycles, cancellation, the free trial, or how onboarding works. I quote our docs verbatim and tell you when I don't know.",
      placeholder: 'Ask about pricing, plans, or onboarding…',
      seedSlug: 'startups',
      shell: {
        brand: 'Vellum',
        accentBg: 'bg-indigo-600',
        accentText: 'text-indigo-600',
        navLinks: [
          { label: 'Product', href: '#' },
          { label: 'Pricing', href: '#' },
          { label: 'Customers', href: '#' },
          { label: 'Changelog', href: '#' },
          { label: 'Docs', href: '#' },
        ],
        breadcrumb: ['Vellum', 'Pricing', 'Plans & billing'],
        articleTitle: 'Plans, billing, and what happens if your team changes size',
        articleLede: 'Vellum bills monthly or annually per active seat. Most teams start on Team, upgrade to Business when they need SSO + audit logs, and move to Enterprise when procurement gets involved. This page covers the basics; for anything specific to your contract, ask the assistant in the corner.',
        articleSections: [
          {
            heading: 'Free trial',
            body: 'All plans include a 14-day free trial of the Business tier. No credit card required. At the end of the trial you can downgrade to Team, stay on Business, or cancel — your data is preserved for 90 days regardless.',
          },
          {
            heading: 'Plan tiers at a glance',
            body: 'Starter is for individuals; Team is for 3+ seats with shared workspaces; Business adds SSO, SCIM, audit logs, and priority support; Enterprise is custom pricing with a dedicated CSM, custom DPA, and on-prem deployment options.',
          },
          {
            heading: 'Cancellation and downgrades',
            body: "You can cancel or downgrade at any time. Monthly plans take effect at the end of the current period; annual plans cancel at renewal but you keep access through the paid period. We don't pro-rate refunds for unused months on annual.",
          },
          {
            heading: 'What if my team shrinks?',
            body: "If you're on the Team plan and drop below 3 seats, your account is automatically downgraded to Starter at the next billing cycle. You will not lose access or data; some collaboration features become unavailable. Annual plans hold their seat count until renewal.",
          },
        ],
        footerNote: '© 2026 Vellum, Inc. — fictional company used to demo the Greater chat shell on a typical Series A SaaS pricing page.',
      },
    },
    caseStudy: `## Why startups lose customers in the chat window

Imagine a Series A founder has just spent $4 acquiring a click — maybe much more, depending on the channel. The visitor lands on the pricing page, has a question, and opens the chatbot in the corner. What happens next is, statistically, a coin flip on whether that customer is retained.

Most startups today are running one of three flavors of failure. The first is the off-the-shelf rules-based bot that pattern-matches on keywords and answers with a canned link to a help article — the visitor types "can I cancel anytime" and gets back the FAQ for "cancellation policy" with no acknowledgement of intent. The second is the generic LLM chatbot wired into ChatGPT or Claude with a thin prompt — it answers fluently but invents pricing, hallucinates features, and occasionally tells customers something the company has never said. The third, increasingly common, is the per-seat AI add-on from a vendor like Zendesk or Intercom: a real product, but priced as a tax on every conversation, with the company's own knowledge held captive inside the vendor's infrastructure.

## What Greater does instead

Greater drops a chat surface onto the startup's site that runs entirely in the visitor's browser, with no per-message API cost and no proprietary data leaving the visitor's device. The base bot is fluent and well-mannered out of the box — it knows it's representing a startup, not a generic helpdesk. It's polite about uncertainty and explicit about what it doesn't know.

Where the value actually compounds is in the curated knowledge layer. The startup brings their own docs, marketing site, changelog, and pricing page; Greater indexes them locally with a deterministic scraper (no LLM in the extraction path), and the bot answers from that corpus with citations the visitor can click. Every claim links back to the source paragraph. When the bot doesn't know, it says so and offers an escalation path the company controls — not a vendor-mediated handoff.

## The financial argument

A typical SaaS startup running a per-seat support stack at modest scale pays a five-figure monthly tax for the privilege of a chatbot that frequently makes them look bad. Greater's runtime cost is essentially zero — the model runs in the user's browser. The cost shifts to a one-time setup and a fractional maintenance contract, both of which are vastly smaller than a year of seat fees, and the startup ends up owning their support intelligence instead of renting it.

## The trust argument

For high-growth startups whose customers are increasingly aware of where their data goes, "your message never leaves your browser unless you escalate" is a credible privacy story. The bot can show its work — every retrieved chunk and every citation is visible in the chat — which is the opposite of the black-box experience visitors get from most production AI today.

## Who this is for

Founders who've already realized the chatbot in their corner is costing them deals, who don't want to write a check for another six-figure SaaS line item, and who'd rather hire a fractional architect to set up something they'll own outright. The default Greater shell is free and open-source. The persona-tuned bot — the one that actually closes leads on your specific funnel — is the work clients hire me for.`,
  },
  {
    slug: 'faith',
    name: 'Faith-Based Organizations',
    shortName: 'Faith',
    tagline: 'A bot that actually knows your church, your sermons, your doctrine.',
    pain: 'Years of YouTube and Rumble sermons, distinctive doctrine, and almost no way for a curious visitor to find a five-minute answer.',
    heroImage: 'images/personas/faith.png',
    demoStatus: 'live',
    demoLabel: 'Try the live demo — Reformed Baptist church website',
    scenario: {
      failureMode: {
        headline: 'A grieving visitor lands on a "What We Believe" page and bounces in 90 seconds.',
        body: 'Someone whose mother just died finds a local church through a friend. They want a real, specific answer to "what does this church teach about hope after death?" before deciding whether to visit on Sunday. The site offers a generic five-bullet "What We Believe" page and a YouTube channel with 600 sermons and no transcripts. They watch 90 seconds of one video, give up, and close the tab. The pastor will never know the conversation happened.',
        namedExample: 'Cornerstone Reformed Baptist Church (composite of pastor-led congregations with extensive sermon archives)',
      },
      pivot: 'Greater is grounded in this specific church\'s sermons, position papers, and catechism — every answer cites the sermon, the timestamp, and the verse the pastor was preaching from. When the church\'s teaching differs from the median of the public internet (and it usually does), the bot speaks from the church\'s position, not the average. When asked something the corpus doesn\'t cover, it routes to a real elder, not a vendor handoff.',
      promptSuggestion: 'What does this church teach about hope after a believer dies?',
      welcome: "Peace to you. I'm Cornerstone's website assistant — grounded in our sermons, position papers, and confession. Ask me what we teach, and I'll cite the source. I'm not a pastor; for pastoral care I'll connect you with one of our elders.",
      placeholder: 'Ask what this church teaches about…',
      seedSlug: 'faith',
      shell: {
        brand: 'Cornerstone Church',
        accentBg: 'bg-stone-700',
        accentText: 'text-stone-700',
        navLinks: [
          { label: 'About', href: '#' },
          { label: 'Sermons', href: '#' },
          { label: 'What We Believe', href: '#' },
          { label: 'Visit', href: '#' },
          { label: 'Contact', href: '#' },
        ],
        breadcrumb: ['Cornerstone', 'About', 'What We Believe'],
        articleTitle: 'What We Believe',
        articleLede: 'Cornerstone is a Reformed Baptist congregation. We hold to the 1689 London Baptist Confession of Faith. The page below is intentionally short; for any specific question you have, the assistant in the corner is grounded in our sermons and position papers and will cite chapter and verse.',
        articleSections: [
          {
            heading: 'On Scripture',
            body: 'We confess the 66 books of the Old and New Testaments to be the inspired, inerrant, sufficient, and final authority for faith and practice. We preach expositionally — book by book — because we believe the text shapes the church, not the other way around.',
          },
          {
            heading: 'On the gospel',
            body: 'We confess that salvation is by grace alone, through faith alone, in Christ alone, to the glory of God alone — as recovered in the Reformation and confessed by the 1689. The gospel is not advice; it is the news of what Christ has accomplished for sinners.',
          },
          {
            heading: 'On the church',
            body: 'We are congregationally governed, elder-led, and practice believer\'s baptism by immersion. Membership is meaningful, not nominal; we expect members to know one another and to walk together under the oversight of elders.',
          },
          {
            heading: 'For specific questions',
            body: "Our distinctives — on baptism, the Lord's Day, the Christian life, suffering, hope, ethics — are unpacked across more than 600 sermons and a small library of position papers. The assistant in the corner can find the relevant sermon, quote it, and link to the timestamp.",
          },
        ],
        footerNote: '© 2026 Cornerstone Reformed Baptist Church — fictional congregation used to demo the Greater chat shell with a faith-based corpus.',
      },
    },
    caseStudy: `## The conversion problem most churches do not name

Every faith community has a specific shape — a set of distinctive convictions, a way of reading scripture, a set of practices and counsel that distinguishes it from the church down the street. Most churches communicate that shape through hours of sermons, weekly Bible studies, occasional position papers, and the slow work of personal discipleship. None of that is easily searchable.

A curious visitor — say, someone who lost a parent and found the church through a friend — may have a single five-minute window to figure out what the community actually teaches about a question that matters intensely to them. What they find, almost universally, is a website with a "What We Believe" page that says the same five things every other church's site says, and a YouTube channel with 600 sermons and no transcripts.

## What Greater does for a church

Greater sits on the church's website as a chat surface. Behind it is a knowledge base built from the church's actual primary sources: every YouTube and Rumble sermon transcript, every position paper, every catechism the church publishes. The transcript pipeline is a one-time cost; once indexed, the local browser bot can hold real conversations about the church's distinctive teaching, with citations back to the specific sermon, the timestamp, and the verse the pastor was preaching from.

This is not a substitute for personal discipleship. It is a way for a curious visitor to find an answer to a real question without sitting through twelve hours of video — and, importantly, an answer that is *this church's* answer, not a generic average of every Christian website on the public internet. When the bot doesn't know, it says so and routes the visitor to a real human contact, which the church controls.

## On bias and explicit perspective

Greater takes the position that bias in AI is unavoidable, and that explicit bias is more honest than implied neutrality. A church bot trained on a Reformed Baptist church's sermons will answer like a Reformed Baptist; a bot trained on a Roman Catholic parish's catechism will answer like a Catholic. The bot tells the visitor up front whose perspective it speaks from, which is the opposite of the soft-edged "all paths" hedging most general AI defaults to.

## What this is not

It is not a chaplain. It is not a substitute for a pastor or for a relationship with the local body. It is a tool for the curious visitor — the person who is two clicks away from closing the tab and never coming back. For that visitor, the difference between "I had a question and got a real, sourced answer in two minutes" and "I had a question and watched ninety seconds of a sermon on YouTube before giving up" is large.

## Who this is for

Churches and faith-based organizations whose distinctive teaching is locked inside hours of video and pages of position papers, who want to give curious visitors a real entry point without compromising on what they actually believe. Christ-first by the author's conviction, but the architecture is faith-agnostic — the same pipeline works for any community whose primary sources are in long-form audio and video that nobody is going to watch end-to-end.`,
  },
  {
    slug: 'schools',
    name: 'Private Schools & Families',
    shortName: 'Schools & Families',
    tagline: 'Curated knowledge for institutions and families that care about what their kids learn.',
    pain: 'Private schools want granular control over the curriculum a chatbot speaks from. Families want certainty that the AI in the room will not drift into territory that violates their values.',
    heroImage: 'images/personas/schools.png',
    demoStatus: 'live',
    demoLabel: 'Try the live demo — classical school admissions site',
    scenario: {
      failureMode: {
        headline: 'A prospective family asks "what does this school teach about X" and gets the average of the public internet.',
        body: 'A family touring three classical schools opens the corner chat on each website and asks "how do you teach worldview in upper school?" Two of the three sites run a generic LLM widget that answers fluently from the median of the public internet — Wikipedia, Reddit, the average ed-tech blog. The answers are confident, polished, and indistinguishable from each other. The whole point of choosing a distinctive school is that it is not the average. The family bounces and the admissions director never knows.',
        namedExample: 'Heritage Classical Academy (composite of K–12 classical schools competing on curriculum distinctiveness)',
      },
      pivot: 'Greater speaks only from the school\'s own curriculum scope-and-sequence, faculty handbook, parent handbook, and approved primary sources. When the bot doesn\'t know — say, "what is the lunch menu next Tuesday" — it says so and points to the right office. The corpus is inspectable; the head of school can read every chunk the bot is allowed to speak from.',
      promptSuggestion: 'How does this school teach worldview formation in the upper school?',
      welcome: "Welcome to Heritage Classical. I'm the admissions assistant — grounded in our scope-and-sequence, parent handbook, and faculty position papers. Ask me about our curriculum, philosophy, or admissions process. I won't improvise answers I don't have.",
      placeholder: 'Ask about curriculum, admissions, or philosophy…',
      seedSlug: 'schools',
      shell: {
        brand: 'Heritage Classical Academy',
        accentBg: 'bg-amber-700',
        accentText: 'text-amber-700',
        navLinks: [
          { label: 'About', href: '#' },
          { label: 'Curriculum', href: '#' },
          { label: 'Admissions', href: '#' },
          { label: 'Faculty', href: '#' },
          { label: 'Calendar', href: '#' },
        ],
        breadcrumb: ['Heritage Classical', 'Admissions', 'Why classical'],
        articleTitle: 'Why classical, and how it shows up in our classrooms',
        articleLede: 'Heritage Classical is a K–12 school in the classical Christian tradition, organized around the trivium — grammar, logic, rhetoric — and the great-books canon. The page below is an overview; the assistant in the corner is grounded in our scope-and-sequence and can answer specific questions about how a given subject or grade is taught.',
        articleSections: [
          {
            heading: 'The trivium, briefly',
            body: 'Grammar stage (K–6) emphasizes memorization, recitation, and the building blocks of each discipline. Logic stage (7–9) introduces formal reasoning and the structure of argument. Rhetoric stage (10–12) trains students to write and speak persuasively from a settled body of knowledge.',
          },
          {
            heading: 'Worldview as formation, not indoctrination',
            body: "We teach from a Christian worldview without pretending neutrality is possible. Students read primary sources — including ones we disagree with — and learn to engage them charitably and critically. Our worldview integration document is publicly available; ask the assistant for a summary.",
          },
          {
            heading: 'Admissions and tours',
            body: 'We admit on a rolling basis with priority for sibling and re-enrolling families. Tours are scheduled through the admissions office; financial aid applications open in January for the following academic year. The assistant can pull specific dates and forms; for an application status, contact the admissions director directly.',
          },
          {
            heading: 'What this assistant will not do',
            body: 'The assistant speaks only from materials our head of school has approved. It will not improvise answers about lunch menus, sports schedules, or any operational detail not in the published handbook. For those, it will route you to the right office.',
          },
        ],
        footerNote: '© 2026 Heritage Classical Academy — fictional school used to demo the Greater chat shell with a curriculum-bounded corpus.',
      },
    },
    caseStudy: `## The "what is the AI teaching my child" problem

A private school spends decades building a curriculum that reflects a specific educational philosophy — classical, Charlotte Mason, Montessori, parochial, or some carefully-calibrated blend. Parents pay a meaningful premium to send their children to that school precisely because of that distinctiveness. The moment a generic AI chatbot enters the room — whether on the school's website, the homework help app, or the LMS — that distinctiveness evaporates. The bot answers with the median of its training data, which is the average of the entire public internet, which is the opposite of what the school sells.

The same problem repeats inside individual families. A parent may want their child to be able to ask an AI about the periodic table or the French Revolution. They may not want that same AI improvising answers about identity, ethics, religion, or relationships from a corpus the parent has never seen and cannot inspect.

## What Greater does for schools

A private school deploying Greater can publish a chatbot for prospective families, current families, and students that speaks only from the school's own curriculum, faculty handbook, parent handbook, and approved supplementary reading. The corpus is curated and inspectable. When a visitor asks "what does this school teach about X," the answer comes from the school's own materials, with citations to the specific document and page.

For homework help and study questions, the school can layer on subject-specific corpora it has reviewed and approved — primary source texts, vetted reference material, the school's own teaching materials. Out-of-corpus questions get a clear "I don't have material on that — talk to your teacher or a parent" rather than a confident hallucination.

## What Greater does for families

A family deploying Greater on a home device or browser gets the same architecture at a smaller scale. Parents can curate the corpus the bot answers from — the encyclopedia they trust, the math textbook the child is using, the books the family has chosen — and the bot will not stray outside it. When the bot doesn't know, it says so. The architecture is intentionally narrow; that is the feature, not the bug.

This is the inverse of how most consumer AI works. The big general-purpose assistants are designed to answer everything; their guardrails are bolted on after the fact, and they drift. A corpus-bounded bot is designed to know one thing well and to be honest about everything else.

## On case studies and proof

The roadmap calls for two or three pilot deployments — ideally one classical school, one parochial school, and one Charlotte Mason or Montessori cooperative, in the US Southeast or Midwest where there is real demand for this kind of curation. Visitors to the demo will be able to compare the same question answered by a generic AI and by a corpus-bounded school bot, and see the difference in real time.

## Who this is for

Heads of school, deans of academic affairs, and curriculum directors who are watching the AI debate from the outside and don't see a way to participate without compromising. Also: families who run their household with the same intentionality — who already filter what their children read and watch and want the same control over what the AI in the room speaks from. The default Greater shell is free and open-source; the curated corpora and the integration into your specific school information system are the work that gets hired.`,
  },
  {
    slug: 'small-business',
    name: 'Small Businesses',
    shortName: 'Small Business',
    tagline: 'The chatbot a $50k-revenue local business could never afford until now.',
    pain: 'Generic mass-market chatbots are tuned for nothing; private AI is priced for the Fortune 500. There is no middle.',
    heroImage: 'images/personas/small-business.png',
    demoStatus: 'live',
    demoLabel: 'Try the live demo — local realty office listings page',
    scenario: {
      failureMode: {
        headline: 'A buyer asks "do you have anything under $400k in this school district" and gets a contact form.',
        body: 'A family relocating to a small Southern town opens a local realty office\'s site at 9 PM, opens the corner chat, and asks "do you have anything under $400k with three bedrooms in the Riverside Elementary district?" The free chat widget the agent installed in 2022 returns "thanks for your interest! Please leave your name and email and an agent will get back to you in 1-2 business days." The family is house-hunting tonight; they leave the tab and the listing they would have closed on goes to the agent down the street.',
        namedExample: 'Pinecrest Realty (composite of independent local brokerages with no AI budget)',
      },
      pivot: 'Greater is grounded in the brokerage\'s current MLS feed, school-district overlays, and financing partners. The bot answers the price-range + bedroom + school-district question with actual listings and links, all in the visitor\'s browser, with no per-message API cost. When the bot doesn\'t know — say, off-market pocket listings — it offers to connect the visitor with the agent on call.',
      promptSuggestion: 'Do you have any listings under $400k with three bedrooms in the Riverside Elementary district?',
      welcome: "Welcome to Pinecrest Realty. I'm the listings assistant — grounded in our current MLS feed, school-district overlays, and financing partners. Ask me about a price range, a neighborhood, or a school district. I can pull listings; I can't write an offer.",
      placeholder: 'Ask about listings, neighborhoods, or schools…',
      seedSlug: 'small-business',
      shell: {
        brand: 'Pinecrest Realty',
        accentBg: 'bg-emerald-700',
        accentText: 'text-emerald-700',
        navLinks: [
          { label: 'Buy', href: '#' },
          { label: 'Sell', href: '#' },
          { label: 'Listings', href: '#' },
          { label: 'Agents', href: '#' },
          { label: 'Contact', href: '#' },
        ],
        breadcrumb: ['Pinecrest Realty', 'Buy', 'Search by school district'],
        articleTitle: 'Search current listings by school district',
        articleLede: 'Pinecrest Realty is a small independent brokerage serving the Pinecrest, Riverside, and Oak Hollow areas. Our MLS feed updates every 15 minutes; the assistant in the corner can filter live by price, beds, and school district faster than the search box on this page. For an offer, you\'ll talk to one of our agents.',
        articleSections: [
          {
            heading: 'School-district overlays',
            body: 'We maintain school-district boundary overlays for Riverside Elementary, Pinecrest Middle, and Oak Hollow High. The overlays are updated when the school board redraws them (last redraw: August 2025). The assistant can filter listings by district instantly.',
          },
          {
            heading: 'Pre-approval partners',
            body: 'We work with three local lenders for pre-approval — First Pinecrest Bank, Oak Hollow Credit Union, and Mountain Mortgage. Each has a different rate profile depending on credit score and down payment; the assistant can sketch the differences and connect you for a real conversation.',
          },
          {
            heading: 'Hours and showings',
            body: 'The office is staffed Monday through Saturday, 9 AM to 6 PM. Showings can be requested 24/7 through the assistant or by calling the on-call agent at the number in the footer.',
          },
          {
            heading: 'What the assistant cannot do',
            body: "It cannot write an offer, schedule a closing, or commit our agents to anything. For pocket listings (off-MLS), it will hand you off to the agent who knows the property. For an open-house RSVP, it will route you to the listing agent.",
          },
        ],
        footerNote: '© 2026 Pinecrest Realty — fictional brokerage used to demo the Greater chat shell with a small-business operational corpus.',
      },
    },
    caseStudy: `## The market gap small businesses fall into

A local realty office, a regional law firm, a specialty manufacturer, a dental practice — these businesses each have a small set of distinctive details that matter intensely to the customers who find them. The realty office has a list of current properties and the financing options it works with. The law firm has a specific practice area and a specific client intake process. The manufacturer has a parts catalog and a return policy. The dentist has a schedule, a list of accepted insurances, and a position on whether they take new patients this month.

The off-the-shelf chatbot market does not serve these businesses well. The cheap end of the market gives them a glorified FAQ widget that cannot answer "is this house still available." The expensive end of the market gives them a per-seat platform priced as if they were running a hundred-agent contact center. Most small businesses end up doing nothing — leaving the chat surface empty, or using a free widget that pushes visitors to a contact form they will never staff in real time.

## What Greater does for a small business

Greater drops a working chatbot onto a small business's site at a one-time setup cost, with zero per-message runtime cost — the model runs in the visitor's browser. The base bot is fluent and industry-aware: a realty bot knows what a "buyer's agent" is and roughly how mortgage pre-approval works; a dental bot knows the difference between a cleaning and a deep scaling without being told.

The custom layer — the part that makes it actually useful — is the business's own data, indexed locally. The realty office uploads its current listings; the bot can answer "do you have anything under $400k with three bedrooms in this school district" and link to the matching listings without ever sending the visitor's query to an external API. The dental practice uploads its insurance list and current schedule; the bot can answer "do you take BlueCross PPO" and "do you have any new-patient slots this month" and route to the booking page.

## Why the FOSS shell matters

The base of Greater is open-source. A small business with a developer in the family can fork it, plug in their own corpus, and run it themselves at zero ongoing cost. For everyone else, hiring a fractional architect to do the integration is dramatically cheaper than the per-seat alternative — and they end up owning their corpus, not renting it from a vendor.

## Where this lives

The natural fit is the local business sector that has been most under-served by the AI wave so far: real estate, professional services, healthcare, specialty retail, service trades. The pitch is not "this will replace your front desk." It is "this will answer the question that's stopping a curious visitor from picking up the phone." That question is almost always something the business already knows the answer to and has never managed to put in writing.

## Who this is for

Owner-operators who are competent enough to know their site's chat experience is costing them business, but who don't want to learn to operate Zendesk or pay for a year of seat fees to find out it doesn't fit. The default Greater shell is free and open-source; the custom indexing and the integration into your CRM, listings system, or scheduler is the work that gets hired.`,
  },
  {
    slug: 'healthtech',
    name: 'HealthTech',
    shortName: 'HealthTech',
    tagline: 'A support bot that respects HIPAA, says what it knows, and shuts up about what it does not.',
    pain: 'Generic AI chat in a healthcare context is a compliance liability. Vendor-locked AI chat is a per-seat tax on a margin-thin business.',
    heroImage: 'images/personas/healthtech.png',
    demoStatus: 'live',
    demoLabel: 'Try the live demo — health-share member portal',
    scenario: {
      failureMode: {
        headline: 'A member asks "do you have a knee surgeon in Raleigh in-network" and the bot has no idea what a provider directory is.',
        body: 'A health-share member needs an orthopedic consult. They open the member portal\'s chat and ask "do you have a knee surgeon in the Raleigh, NC area that\'s in-network?" The vendor\'s general-purpose support bot — bolted on with a thin prompt — answers fluently with a list of made-up doctors and fake phone numbers, or worse, sends the query to a third-party LLM with the member\'s session metadata attached. The member calls a fake number, gets nowhere, and the company\'s NPS takes the hit.',
        namedExample: 'CrowdHealth and similar health-share / direct-primary-care platforms with thin AI deployments',
      },
      pivot: 'Greater is grounded in the company\'s actual operational corpus — billing flows, eligibility rules, escalation paths — and refuses to improvise. Asked about a provider directory it does not have, it says so plainly and offers an extension path: "I don\'t have a provider directory today; the company would need to wire one in. Here\'s how that integration looks." Nothing leaves the browser unless the member explicitly escalates.',
      promptSuggestion: 'Do you have a knee surgeon in the Raleigh, NC area that\'s in-network?',
      welcome: "Hi — I'm MutualHealth's member-portal assistant. I'm grounded in our membership rules, billing flows, and escalation paths. I run in your browser; nothing you type is sent anywhere unless you explicitly escalate. I'll tell you when I don't know something rather than guess.",
      placeholder: 'Ask about membership, billing, or how a need is processed…',
      seedSlug: 'healthtech',
      shell: {
        brand: 'MutualHealth',
        accentBg: 'bg-rose-700',
        accentText: 'text-rose-700',
        navLinks: [
          { label: 'How it works', href: '#' },
          { label: 'Membership', href: '#' },
          { label: 'Member portal', href: '#' },
          { label: 'For providers', href: '#' },
          { label: 'Help', href: '#' },
        ],
        breadcrumb: ['MutualHealth', 'Help', 'Member FAQ'],
        articleTitle: 'Member FAQ — what we cover and how needs are processed',
        articleLede: 'MutualHealth is a member-funded health-share community, not insurance. Members pay a monthly share that goes toward other members\' eligible needs. The page below covers the basics; for anything specific to your membership, the assistant in the corner is grounded in our published guidelines and will tell you when it does not have an answer.',
        articleSections: [
          {
            heading: 'How a need is processed',
            body: "Submit eligible needs through the member portal. Needs are reviewed against the published Member Guidelines for eligibility (pre-existing conditions, lifestyle limitations, etc.), assigned a sharing window, and matched to other members\' shares. Most clean submissions are processed within 30 days.",
          },
          {
            heading: 'What we cover and what we don\'t',
            body: 'We cover most acute, unexpected medical needs above the personal responsibility amount. We do not cover routine preventive care, lifestyle-related conditions explicitly listed in the Guidelines, or any need predating membership unless the pre-existing-condition phase-in has been met. Prescriptions and dental are separate add-ons.',
          },
          {
            heading: 'Provider relationships',
            body: 'MutualHealth is not a PPO, HMO, or any kind of network. Members may see any licensed provider. We do not maintain a "preferred provider directory"; the assistant will tell you this plainly if asked.',
          },
          {
            heading: 'Privacy and where your messages go',
            body: 'The assistant runs in your browser. Nothing you type is sent to any third-party LLM provider, MutualHealth server, or analytics tool unless you explicitly tap "escalate to a human." This is the only chat surface in healthtech we are comfortable shipping.',
          },
        ],
        footerNote: '© 2026 MutualHealth — fictional health-share community used to demo the Greater chat shell with a healthtech operational corpus.',
      },
    },
    caseStudy: `## Why healthcare cannot use the chatbot in the corner

The cost of an AI support bot inventing a drug interaction, hallucinating a contraindication, or quietly logging a patient's symptoms to a third-party model provider's training set is — in the healthcare context — not a customer-experience problem. It is a regulatory event, a liability event, and an existential brand event. The default posture of every healthtech company toward generic chatbot vendors should be skepticism, and most are right to feel it.

The other end of the market — vendor-built "HIPAA-compliant" AI chat — solves the compliance problem by charging enough that the company can afford the SOC 2 reports and the data processing agreements. Margins in healthtech are thin. Adding another six-figure SaaS line item to a Series B startup's burn rate, when half the conversations are "where is my invoice" and "do you accept Medicare," is hard to justify.

## What Greater does for healthtech

Greater's architecture is structurally well-suited to the healthcare use case for one specific reason: the model runs in the patient's or user's browser, and the corpus the bot speaks from is shipped as static, inspectable, version-controlled content. Nothing the user types is sent to a third-party LLM provider as a matter of course. There is no per-conversation data egress to manage. The compliance story is "we don't send this anywhere, here is the source code" rather than "we have a 60-page DPA with a vendor."

The free, open-source version of Greater is auditable end to end. A healthtech CISO can read every line of the chat surface and the indexing pipeline, can verify that the corpus the bot speaks from is exactly the corpus the medical and legal teams approved, and can sign off without relying on a vendor's self-attestation. The paid, customized version is the same shell with the company's specific operational corpus indexed in — billing flows, insurance acceptance, scheduling rules, condition-specific patient education — all of it under the company's full control.

## What the bot is allowed to do, and what it is not

A Greater deployment in healthtech is configured to be conservative by default. It answers operational and educational questions from the indexed corpus, with citations. It will not improvise medical advice. When asked something outside its corpus — "what dose of this drug is safe for me" — it returns a clear "I cannot answer that; here is how to reach your provider" rather than guessing. The escalation path is something the company controls, not a vendor handoff.

This conservative posture is not a limitation; it is the product. The value proposition for a healthtech company is precisely that the bot is well-bounded, that its answers are sourced, and that the company can demonstrate to a regulator exactly what the bot will and will not say in any given scenario.

## Who this is for

Healthtech founders and product leads who are watching the AI wave from outside the gate, who know they need an AI support layer to compete on user experience, and who have correctly assessed that the off-the-shelf options are either non-compliant or too expensive. The default Greater shell is free, open-source, and auditable. The integration into your specific operational stack — your billing system, your scheduling system, your insurance verification flow — is the work that gets hired.`,
  },
  {
    slug: 'fintech',
    name: 'FinTech & Bitcoin',
    shortName: 'FinTech',
    tagline: 'Sovereign support for an industry that takes "do not trust, verify" seriously.',
    pain: 'Bitcoin and fintech users are paranoid about where their queries go, for good reason. Most chat AI sends every keystroke to a third party.',
    heroImage: 'images/personas/fintech.png',
    demoStatus: 'live',
    demoLabel: 'Try the live demo — Blockstream support bot',
    scenario: {
      seedSlug: 'bitcoin',
      welcome:
        "Hello! I'm Greater's Blockstream support bot. Ask me about Jade, Green, hardware-wallet recovery, fees, or self-custody.",
      placeholder: 'Ask about your wallet, fees, or recovery…',
      promptSuggestion:
        "I just got an email saying someone logged into my Blockstream Green wallet from a new device. What should I do, in order, right now?",
      failureMode: {
        headline:
          'A panicked user gets a vendor "security alert" email and the bot answers with marketing copy.',
        body:
          "A Blockstream Green user wakes up to an email claiming there was an unauthorized login on their wallet. They open the support chat, terrified, and ask what to do. The off-the-shelf bot — pattern-matching on the word 'login' — replies with a generic five-bullet 'wallet security best practices' page that does not address the specific email, does not tell them whether the email is even legitimate, and silently sends the entire panicked transcript (including any seed words the user pastes by mistake) to a third-party LLM provider with the company's session metadata attached.",
        namedExample:
          'Composite of every fintech support widget that bolts a vendor LLM onto a shared session log.',
      },
      pivot:
        "Greater runs the model in your browser — the panicked transcript never leaves the device unless you explicitly escalate. The bot is grounded in Blockstream's own help articles plus a curated Bitcoin Core / Knots / OpTech corpus, and the answer for this exact scenario is a numbered triage list from the company's documented incident playbook, with the specific URL and signature the legitimate alert email should contain. Disagreements about Bitcoin (Core vs. Knots) are surfaced explicitly via the bias toggle, not papered over.",
      shell: {
        // The Blockstream demo keeps its own bespoke chrome (see
        // BlockstreamDemo.tsx); the shell config below is unused for
        // FinTech but kept structurally so consumers of `Persona`
        // don't need a special case. None of these fields render.
        brand: 'Blockstream',
        accentBg: 'bg-emerald-500',
        accentText: 'text-emerald-400',
        navLinks: [],
        breadcrumb: [],
        articleTitle: '',
        articleLede: '',
        articleSections: [],
        footerNote: '',
      },
    },
    caseStudy: `## The "where does my message go" problem

The Bitcoin community in particular, and the fintech community more broadly, has been burned enough times to be properly suspicious of any chat surface that sends user queries to a third-party LLM provider. A user typing "I think my wallet has been compromised, here is what I see" into a chat widget that posts to OpenAI is a category of risk that the user, the company, and the regulator should all care about, in roughly that order. Most production chat AI is exactly this architecture, with a privacy policy that promises it will be fine.

The other end of the market is the all-cloud "HIPAA-grade" or "SOC 2-grade" vendor that solves the data-egress problem by being expensive. Fintech margins are not what they were. Adding a per-seat per-conversation tax to support — when half the conversations are "where is my statement" and "I forgot my password" — is a hard sell.

## What Greater does for fintech

Greater runs the language model in the user's browser. The user's message never leaves the device unless the user explicitly escalates to a human. The bot's knowledge base is shipped as static, signed content — the company can publish a hash of the corpus, sign it, and let security-minded users verify they are talking to a bot speaking from the corpus the company actually published. This is the "do not trust, verify" ethos applied to support.

For a Bitcoin company specifically — Blockstream is the working example in this demo — the corpus is a curated snapshot of the company's own help articles, the relevant Bitcoin Core and Knots commit history, the Bitcoin OpTech newsletter back catalog, and a curated set of high-signal community threads. The bot answers operational questions about the company's product from the company's own docs, and answers Bitcoin-protocol questions from the curated technical corpus, with explicit citations.

## On explicit bias

The Bitcoin community contains real disagreements that matter — Core versus Knots, custodial versus non-custodial, the various scaling and fee debates. Greater takes the position that pretending to be neutral is a worse failure than being explicit. The Bitcoin demo includes a perspective toggle (Neutral / Core / Knots) so the user can see what the bot says under each lens, and switch between them mid-conversation. The bot is allowed to disagree with itself when the user changes the lens — that is the correct behavior.

This is the product-level expression of a philosophical position: bias in AI is unavoidable, and explicit bias is more honest than implied neutrality. Most Bitcoiners will recognize this as the same argument they have been making about money for years.

## The financial argument

A fintech company running a per-seat AI support stack at a few thousand active users a month is paying a monthly tax that compounds with every new agent and every new conversation. Greater's runtime cost is essentially zero — the model runs in the user's browser. The cost shifts to a one-time setup, a fractional maintenance contract, and a corpus-curation engagement, all of which are dramatically smaller than a year of seat fees.

## Who this is for

Bitcoin companies, Lightning startups, custodial and non-custodial wallet providers, and the broader fintech market that has been correctly skeptical of vendor-mediated AI. The Blockstream demo on this site is the working proof. The integration into your specific support stack — your help center, your escalation path, your specific product's quirks — is the work that gets hired. Forks of the open-source shell are welcome and encouraged; that is how the ecosystem gets sovereign by default.`,
  },
];

export const personas = PERSONAS;

export function getPersona(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug);
}
