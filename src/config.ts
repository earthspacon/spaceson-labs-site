// Replace before deploy. The address is the only contact on the site.
export const CONTACT_EMAIL = 'CONTACT_EMAIL';

export const STUDIO_NAME = 'Spaceson Labs';

export const SITE_DESCRIPTION =
  'Spaceson Labs builds MVPs, Telegram Mini Apps and automations for startups and small businesses. Fixed scope, fixed price, a working demo every week.';

export type Service = {
  name: string;
  price: string;
  priceNote?: string;
  timeline: string;
  includes: string[];
};

export const SERVICES: Service[] = [
  {
    name: 'Bot & Mini App Sprint',
    price: 'from $1,500',
    timeline: '5–10 days',
    includes: [
      'Telegram bot or Mini App',
      'Payments via Telegram Stars or a provider',
      'Admin panel and broadcasts',
      'CRM or Google Sheets sync',
      'Deployed and handed over',
    ],
  },
  {
    name: 'MVP in 3 Weeks',
    price: 'from $6,000',
    timeline: '2–4 weeks',
    includes: [
      'Web app on React / Next.js with a backend',
      'Sign-in, payments, admin',
      'Landing page and analytics',
      'Two rounds of changes included',
      'Fixed price for the agreed scope',
    ],
  },
  {
    name: 'Automation & AI Agent Setup',
    price: 'from $2,000',
    priceNote: 'support from $500/mo',
    timeline: '1–2 weeks',
    includes: [
      'Process audit',
      '2–4 workflows in n8n, Make or code',
      'AI agent for support, leads or documents',
      'Monitoring and alerts',
      'Optional monthly support',
    ],
  },
];

export const STEPS = [
  {
    title: 'Fixed scope, fixed price',
    text: 'Send us the idea. Within 24 hours you get a one-page plan: what we build, what we skip, the timeline and one price.',
  },
  {
    title: 'A demo every week',
    text: 'Every week you get a working build to click through, not a status report. Feedback goes into the next week.',
  },
  {
    title: 'Fast delivery',
    text: 'Senior engineering with AI agents doing research, boilerplate and QA. Bots ship in days, MVPs in weeks.',
  },
];

export type Demo = {
  name: string;
  summary: string;
  points: string[];
  shots: { src: string; alt: string }[];
};

export const DEMOS: Demo[] = [
  {
    name: 'Slotly — Telegram Mini App for bookings',
    summary:
      'Booking and payment for a salon, clinic or tutor, inside Telegram. The customer picks a service and a time, pays and gets a reminder. The owner sees every booking in an admin view.',
    points: [
      'Slots follow working hours and never overlap',
      'Test payments, reminders 2 h before the visit',
      'Admin view with bookings and revenue',
      'Uses Telegram theme colors and user data',
    ],
    shots: [
      {
        src: 'work/slotly-slots.png',
        alt: 'Slotly: picking a day and a time slot',
      },
      {
        src: 'work/slotly-paid.png',
        alt: 'Slotly: booking confirmed and paid',
      },
    ],
  },
];

export const NEXT_DEMO = {
  name: 'SaaS starter',
  text: 'Sign-in, test checkout, dashboard and roles: the base we start an MVP from.',
};

export const PAYMENT_METHODS = [
  {
    name: 'Payoneer',
    text: 'USD or EUR, paid by card or bank from your side.',
  },
  {
    name: 'Bank transfer',
    text: 'SWIFT in USD or EUR against an invoice.',
  },
  {
    name: 'Crypto',
    text: 'USDT or USDC. Network and address come with the invoice.',
  },
];

export const FAQ = [
  {
    question: 'How do you set the price?',
    answer:
      'By scope. You get a one-page plan with features, timeline and one fixed price before you pay anything. The prices above are where each package starts.',
  },
  {
    question: 'How does payment work?',
    answer: '50% upfront, the rest split over milestones. Every payment gets an invoice.',
  },
  {
    question: 'What if the scope changes mid-project?',
    answer:
      'New work goes into a separate milestone with its own fixed price. Nothing is added to the bill without your written yes.',
  },
  {
    question: 'Who owns the code?',
    answer: 'You do. The repository and all rights to the code move to you after the final payment.',
  },
  {
    question: 'Where are you and how do we talk?',
    answer:
      'Tashkent, UTC+5. Day to day we write in Slack, Telegram or email, and meet on a call for each weekly demo.',
  },
];
