export type BuildLog = {
  id: string;
  name: string;
  goal: string;
  steps: string[];
  rules: string[];
  outcome: string[];
};

export const BUILD_LOGS: BuildLog[] = [
  {
    id: 'booking-app',
    name: 'Booking + payments app',
    goal: 'A working, good-looking demo product: a mobile booking web app, which also opens inside Telegram as a Mini App, where a customer of a salon, clinic or tutor picks a service and a slot, "pays" (test mode) and gets a reminder. An admin view lists the bookings. It must run locally with one command and as a static web build, so it works in any phone browser and, with mock launch data, outside Telegram too.',
    steps: [
      'Vite + React + TypeScript + Tailwind and the official Telegram Mini Apps SDK. In-memory / localStorage backend, seeded services and slots, no paid services.',
      'Screens: services → slot picker → confirm + test payment → success; "My bookings"; an /admin bookings table. English copy, mobile-first, Telegram theme variables.',
      'Vitest tests for slot availability and booking logic. The production build must be green.',
      'README with what it is, a "Demo · own product · built in N h" label, run steps and two mobile screenshots (390 px wide).',
    ],
    rules: [
      'Create no external accounts, deploy nothing, spend no money.',
      'Claim no real customers anywhere.',
    ],
    outcome: [
      '11 unit tests: working-hours fit, lead time, overlapping slots (and freed again after a cancel), double booking, a booking too soon, one past closing time, the reminder window, test cards.',
      'A browser run on the production build declined one test card, then approved a second one. Two bookings showed up in "My bookings" and in the admin table, and both survived a reload. 0 console errors.',
      'Built in about an hour of agent time, which is what the README label says. No real bug was recorded in this run.',
      'Not deployed. Payments are test-only; real payments and a server-side check of the Telegram launch data are the next steps.',
    ],
  },
  {
    id: 'ai-lead-agent',
    name: 'AI Lead Agent',
    goal: 'The flagship demo for small and mid-size businesses. A web app where inbound leads (contact-form submissions and emails) arrive. An AI agent qualifies each one (fit score 0–100, budget, timeline and intent extracted, plus the reason), drafts a reply and moves it through a pipeline: New → Qualified → Replied → Won/Lost. A human approves or edits the draft before it is sent. It must look like a real B2B SaaS product: clean, desktop-first, fine on mobile.',
    steps: [
      'Vite + React + TypeScript + Tailwind, a static SPA with no server. The AI layer sits behind one interface, LeadAnalyzer. Demo mode (default): a deterministic rule-based analyzer with a short simulated "thinking" delay, so it works offline with no key. Live mode: calls the Anthropic Messages API from the browser with a key the user pastes in, kept in memory only, with the JSON answer validated by a schema.',
      'About 12 realistic, made-up leads of mixed quality: a hot SaaS founder with budget, a tire-kicker, spam, an agency partner, an enterprise RFP, a wrong fit. Screens: inbox with score badges and filters, lead detail with an editable draft and "Approve & send", a kanban pipeline, a dashboard, and a "Simulate new lead" button. Everything persists to localStorage.',
      'Vitest tests: scoring and extraction on the seed leads (hot beats cold, spam is flagged), pipeline transitions, schema validation of a live-mode answer. Tests and strict type-check green.',
      'A headless browser run on the production build: open the inbox, open a hot lead, approve the draft, move it to Won, simulate a new lead, reload and check the state persists. 0 console errors, no horizontal overflow at 390 px. Screenshots of the four desktop screens and the mobile inbox.',
      'README with what it is, the "Demo · own product · built in N h" label, how live mode works and run steps.',
    ],
    rules: [
      'Companies and people in the seed data are clearly made up, and the README says so.',
      'Never commit or log an API key. No paid API calls while building.',
    ],
    outcome: [
      '22 unit tests in 3 files, all green. The browser run opened a hot lead (score 95), sent the approved reply, moved the deal to Won, analyzed a pasted lead and kept all of it after a reload. 0 console errors, no overflow on any of the five screens at 390 px.',
      'A real bug was caught while writing the tests: for "can we talk this week … by end of Q1" the analyzer picked "this week" as the timeline. The deadline patterns now run first.',
      'About 20 minutes of agent time; the README label rounds that up to one hour.',
      'Live mode was never called against the real API, because the brief forbade paid calls. Expect some prompt tuning on the first real run.',
    ],
  },
];
