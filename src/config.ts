// The address is the only contact on the site.
export const CONTACT_EMAIL = 'hello@spacesonlabs.com';

export const STUDIO_NAME = 'Spaceson Labs';

export const SITE_TITLE = `${STUDIO_NAME} — software products and AI automations at a fixed price`;

export const SITE_DESCRIPTION =
  'Spaceson Labs builds software products and AI automations for businesses at a fixed price, and runs three paid products of its own: InboxSieve, PriceDawn and MonthMemo.';

export const HERO = {
  title: 'We build software products and AI automations, and run three of our own.',
  text: 'One fixed price agreed before work starts. A working build every week. The code is yours at handover.',
  location: 'Remote · UTC+5 · EU and US hours',
};

export type Product = {
  name: string;
  job: string;
  price: string;
  liveSince: string;
  url: string;
  host: string;
  shot: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

// Prices mirror each product's own plan config; dates come from the product repos' git logs.
export const PRODUCTS: Product[] = [
  {
    name: 'InboxSieve',
    job: 'Sorts the messages from a website contact form: removes spam, scores real client requests 0–100 and drafts a reply.',
    price: 'Free plan · paid from $9/mo',
    liveSince: '21 Nov 2026',
    url: 'https://inboxsieve.com/',
    host: 'inboxsieve.com',
    shot: {
      src: 'work/inboxsieve.webp',
      alt: 'InboxSieve: two spam messages removed, a sales pitch set aside, a real client request scored 87 with a drafted reply',
      width: 976,
      height: 768,
    },
  },
  {
    name: 'PriceDawn',
    job: "Checks competitors' prices once a day and sends a store owner one email at 7:00 with every change.",
    price: 'From $19/mo',
    liveSince: '21 Nov 2026',
    url: 'https://pricedawn.spacesonlabs.com/',
    host: 'pricedawn.spacesonlabs.com',
    shot: {
      src: 'work/pricedawn.webp',
      alt: 'PriceDawn morning email: a rival product dropped from 24.99 to 19.99, minus 20%, with the link',
      width: 944,
      height: 540,
    },
  },
  {
    name: 'MonthMemo',
    job: "Writes each marketing agency client's monthly website report from their analytics. The agency approves, the client gets an email.",
    price: 'From $29/mo · first month free',
    liveSince: '21 Nov 2026',
    url: 'https://monthmemo.spacesonlabs.com/',
    host: 'monthmemo.spacesonlabs.com',
    shot: {
      src: 'work/monthmemo.webp',
      alt: 'MonthMemo report email: sessions up 16% to 4,210, search clicks up 17%, key events down 5%, with a short written summary',
      width: 968,
      height: 742,
    },
  },
];

export const LATELY = [
  {
    date: '2026-11-22',
    text: 'Monthly prices live on all three products: InboxSieve from $9, PriceDawn from $19, MonthMemo from $29.',
  },
  {
    date: '2026-11-21',
    text: 'PriceDawn live. Checks up to 1,000 competitor links once a day, sends one email at 7:00 in the store’s time zone, exports price history to CSV. $19 or $49 a month.',
  },
  {
    date: '2026-11-21',
    text: 'MonthMemo live. Connects Google Analytics and Search Console once, drafts every client’s monthly report, waits for the agency’s approval before sending. $29 a month for 5 clients, $59 for 15.',
  },
  {
    date: '2026-11-21',
    text: 'InboxSieve live on inboxsieve.com, one day after its first commit.',
  },
  {
    date: '2026-11-20',
    text: 'InboxSieve: free plan with 50 leads a month, a 14-day trial of the paid plan without a card, prices cut to $9 and $29 a month.',
  },
  {
    date: '2026-11-20',
    text: 'InboxSieve: Google sign-in, team seats, CSV export and an alert for every hot lead.',
  },
];

export type Service = {
  name: string;
  price: string;
  priceNote: string;
  timeline: string;
  summary: string;
  includes: string[];
};

export const SERVICES: Service[] = [
  {
    name: 'AI Agent & Automation',
    price: 'from $2,500',
    priceNote: 'setup + from $750/mo retainer',
    timeline: 'Live in 1–2 weeks',
    summary: 'An agent that does a real job inside the tools your team already uses.',
    includes: [
      'Short audit of the process first',
      '2–4 workflows plus the agent, connected to your email and CRM',
      'Alerts when something breaks',
      '30 days of tuning after go-live',
      'Retainer: new workflows and fixes; usage billed at cost',
    ],
  },
  {
    name: 'MVP in 3 Weeks',
    price: 'from $6,000',
    priceNote: 'fixed scope, fixed price',
    timeline: '3 weeks',
    summary: 'A product people can sign up for and pay in, on phone and desktop.',
    includes: [
      'Sign-in and card payments',
      'Admin panel, landing page, analytics',
      'A working build every week',
      'Two rounds of changes',
      'Code and IP yours after final payment',
    ],
  },
  {
    name: 'Product Engineering on Demand',
    price: 'from $5,500/mo',
    priceNote: 'monthly, scale up or down',
    timeline: 'Start within a week',
    summary: 'A senior frontend and full-stack engineer inside your own team.',
    includes: [
      'Works in your repo, tracker and standups',
      'Planning and code review with your team',
      'Scale up or down month to month',
      'No hiring, no long contract',
    ],
  },
];

export const SERVICES_ALSO = 'Also: Telegram bots & Mini Apps, Web3/TON.';

export const STEPS = [
  {
    title: 'Plan',
    artifact: 'One-page plan with a fixed price, within 24 h',
    text: 'You send a few lines. We reply with what we build, what we skip, the timeline and one price.',
  },
  {
    title: 'Build',
    artifact: 'A link to a working build, every week',
    text: 'You click through the real thing, not a status report. Your notes go into the next week.',
  },
  {
    title: 'Handover',
    artifact: 'Tests and monitoring, set up and running',
    text: 'Tests run on every change. Monitoring alerts us when something breaks after launch.',
  },
  {
    title: 'Transfer',
    artifact: 'The code, accounts and IP, in your name',
    text: 'After the final payment the repository and all rights move to you.',
  },
];

export const PAYMENT_METHODS = [
  {
    name: 'Payoneer invoice',
    text: 'Card or bank transfer in USD or EUR.',
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
  title: 'Working hours',
  text: 'UTC+5. EU business hours and the US morning overlap with ours for calls and quick answers.',
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
    question: 'Where does our data go?',
    answer: 'Where possible the work runs on your own accounts and keys, so your data stays under your contracts.',
  },
  {
    question: 'Who owns the code?',
    answer: 'You do. The repository, workflows and all rights move to you after the final payment.',
  },
  {
    question: 'How do we talk day to day?',
    answer: 'In writing, by email or your team chat, and on a video call for each weekly build.',
  },
];
