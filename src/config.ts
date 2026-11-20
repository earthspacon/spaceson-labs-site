// Replace before deploy. The address is the only contact on the site.
export const CONTACT_EMAIL = 'CONTACT_EMAIL';

export const STUDIO_NAME = 'Spaceson Labs';

export const SITE_TITLE = `${STUDIO_NAME} — AI agents, automations and MVPs`;

export const SITE_DESCRIPTION =
  'Spaceson Labs is an AI-native product studio: we ship AI agents, automations and MVPs in weeks, not quarters. Fixed scope, fixed price, a working demo every week.';

export type Service = {
  name: string;
  price: string;
  priceNote: string;
  timeline: string;
  summary: string;
  includes: string[];
  covers: string[];
};

export const SERVICES: Service[] = [
  {
    name: 'AI Agent & Automation',
    price: 'from $2,500',
    priceNote: 'setup + from $750/mo retainer',
    timeline: 'Live in 1–2 weeks',
    summary: 'An agent that does real work inside the tools your team already uses.',
    includes: [
      'Lead qualification, support or document agent',
      'Wired into email, your CRM, Slack or HubSpot',
      'Built on n8n or in code, whichever fits',
      'Monitoring and alerts when something breaks',
      'Retainer: tuning, new workflows, fixes',
    ],
    covers: [
      'Discovery: a short audit of the process you want to automate',
      'The build: 2–4 workflows plus the AI agent, wired into your tools',
      'Monitoring and alerts set up',
      '30 days of tuning after go-live',
      'Retainer from $750/mo: monitoring, new workflows, fixes. Model usage billed at cost',
    ],
  },
  {
    name: 'MVP in 3 Weeks',
    price: 'from $6,000',
    priceNote: 'fixed scope, fixed price',
    timeline: '3 weeks',
    summary: 'A product real users can sign up for and pay in, not a clickable mockup.',
    includes: [
      'Next.js / React web app',
      'Sign-in and Stripe billing',
      'Admin panel',
      'Landing page and analytics',
      'A working build to test every week',
    ],
    covers: [
      'A one-page plan with scope, timeline and one price before we start',
      'Sign-in, billing, admin panel, landing page and analytics',
      'A working build every week',
      'Two rounds of changes',
      'Code and IP handed over after final payment',
    ],
  },
  {
    name: 'Product Engineering on Demand',
    price: 'from $5,500/mo',
    priceNote: 'monthly, scale up or down',
    timeline: 'Start within a week',
    summary: 'Senior frontend and full-stack capacity that plugs into your own team.',
    includes: [
      'Senior frontend / full-stack engineering',
      'Works in your repo, tracker and standups',
      'React, Next.js, TypeScript, Node',
      'AI-assisted, so more ships per week',
      'No hiring, no long contract',
    ],
    covers: [
      'A senior engineer\'s time, billed monthly',
      'Planning, standups and code review with your team',
      'Scale up or down month to month',
      'No hiring, no long contract',
    ],
  },
];

export const SERVICES_ALSO = 'Also: Telegram bots & Mini Apps, Web3/TON.';

export const STEPS = [
  {
    title: 'Fixed scope, fixed price',
    text: 'Send us the idea. Within 24 hours you get a one-page plan: what we build, what we skip, the timeline and one price.',
  },
  {
    title: 'A demo every week',
    text: 'Every week you get a working build to click through, not a status report. Your feedback goes into the next week.',
  },
  {
    title: 'Fast delivery',
    text: 'AI agents handle research, boilerplate and tests. A senior engineer designs the system and reviews every line.',
  },
];

export type Shot = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type WorkCard = {
  buildLogId: string;
  name: string;
  label: string;
  summary: string;
  points: string[];
  shots: Shot[];
};

export const WORK: WorkCard[] = [
  {
    buildLogId: 'ai-lead-agent',
    name: 'AI Lead Agent',
    label: 'Own product · demo',
    summary:
      'Reads every inbound email and form, scores the lead against your criteria, drafts a reply and puts the deal into your CRM. You approve, it sends.',
    points: [
      'Inbox and web form in, CRM deal out',
      'Qualification rules you can read and change',
      'Draft replies wait for a human yes',
      'Every decision logged for review',
    ],
    shots: [
      {
        src: 'work/ai-lead-agent.png',
        alt: 'AI Lead Agent: a scored lead with extracted budget and timeline next to an editable draft reply',
        width: 1200,
        height: 750,
      },
    ],
  },
  {
    buildLogId: 'booking-app',
    name: 'Booking + payments app',
    label: 'Own product · demo',
    summary:
      'A mobile web app for a salon, clinic or tutor. The customer picks a service and a time, pays and gets a reminder. The owner sees every booking and the revenue in an admin view. It runs in any mobile browser and can also open inside Telegram.',
    points: [
      'Slots follow working hours and never overlap',
      'Test card payments, reminder 2 h before the visit',
      'Admin view with bookings and revenue',
      'One codebase for the browser and Telegram',
    ],
    shots: [
      {
        src: 'work/slotly-slots.png',
        alt: 'Booking app: picking a day and a time slot',
        width: 390,
        height: 844,
      },
      {
        src: 'work/slotly-paid.png',
        alt: 'Booking app: booking confirmed and paid',
        width: 390,
        height: 844,
      },
    ],
  },
];

export const PAYMENT_METHODS = [
  {
    name: 'Payoneer invoice',
    text: 'Pay by card or bank transfer in USD or EUR.',
  },
  {
    name: 'SWIFT',
    text: 'Direct bank transfer in USD or EUR against an invoice.',
  },
  {
    name: 'Crypto',
    text: 'USDT or USDC. Network and address come with the invoice.',
  },
];

export const HOURS = {
  title: 'Overlap with your working day',
  text: 'We are on UTC+5 and plan our day around yours: EU business hours and the US morning are shared hours for calls and quick answers.',
};

export const FAQ = [
  {
    question: 'How do you set the price?',
    answer:
      'By scope. Before you pay anything you get a one-page plan with features, timeline and one fixed price. The prices above are where each package starts.',
  },
  {
    question: 'How does payment work?',
    answer:
      'Fixed-scope work: 50% upfront, the rest by milestones. Retainers and engineering capacity: monthly in advance. Every payment gets an invoice.',
  },
  {
    question: 'Which AI models do you use, and where does our data go?',
    answer:
      'We pick the model per task (OpenAI, Anthropic or open-source) and run it on your accounts and keys where possible, so your data stays under your contracts.',
  },
  {
    question: 'Who owns the code?',
    answer: 'You do. The repository, workflows and all rights move to you after the final payment.',
  },
  {
    question: 'What time zone are you in, and how do we talk?',
    answer:
      'UTC+5, overlapping EU business hours and the US morning. Day to day we write in Slack or email and meet on a video call for each weekly demo.',
  },
];
