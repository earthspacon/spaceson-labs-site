// The address is the only contact on the site.
export const CONTACT_EMAIL = 'hello@spacesonlabs.com';

export const STUDIO_NAME = 'Spaceson Labs';

export const SITE_URL = 'https://spacesonlabs.com';

export const SITE_TITLE = `${STUDIO_NAME}: any software job, shipped fast and for less`;

export const SITE_DESCRIPTION =
  'We fix half-built apps, build new products, automate work and join your team as engineers. Free app check, single fixes from $150, agreed in writing before we start.';

export const NAV_LINKS = [
  { href: '#products', label: 'Our products' },
  { href: '#work', label: 'What we take on' },
  { href: '#how', label: 'How we work' },
  { href: '#check', label: 'Free app check' },
  { href: '#faq', label: 'Questions' },
];

export const HERO = {
  title: 'Any software job, shipped fast and for less.',
  text: 'Fix a half-built app, build a new product, automate the busywork or add an engineer to your team. Any size. Price agreed in writing before we start.',
  primary: 'Tell us the job',
  secondary: 'Free app check',
  anchor: { text: 'Jobs start at', price: '$150', team: 'Who we are' },
  workLabel: 'Our products, built and run by us',
};

export const CHECK_FIELD = {
  placeholder: 'your-app.com or GitHub repo',
  button: 'Check it free',
  hint: 'No signup. We only read what is public.',
};

export type Service = {
  name: string;
  text: string;
  price: string;
};

export const SERVICES: Service[] = [
  {
    name: 'Fix or finish an app',
    text: 'A half-built app from Lovable, Bolt, Replit, Cursor or a freelancer who went quiet, made safe for real users.',
    price: 'from $150',
  },
  {
    name: 'A new product from an idea',
    text: 'A first version with sign-in and your core flow, scoped with you before any code is written.',
    price: 'from $2,000',
  },
  {
    name: 'Automations and AI agents',
    text: 'One job inside the tools you already use. Anything that sends money or messages a customer waits for your OK.',
    price: 'from $500',
  },
  {
    name: 'An engineer on your team',
    text: 'A senior full-stack engineer from the studio in your repo, tracker and standups. Month to month.',
    price: 'from $3,000/mo',
  },
  {
    name: 'Anything else',
    text: 'Telegram bots, internal tools, integrations, migrations, a slow site that needs to be fast. If it is software, ask.',
    price: 'ask us',
  },
];

export const SERVICES_NOTE =
  'These are starting points. The real price goes lower or higher with the job, and you see it before we start.';

export const OFFER = {
  title: 'Free app check',
  lead: 'A quick look before we talk.',
  check: {
    name: 'The check, free',
    text: 'Paste your site or GitHub repo and see what breaks first once real users arrive, with the file and line.',
  },
  fix: {
    name: 'The fix, from $150',
    items: [
      'One problem fixed, with tests, as a pull request into your repo. From $150.',
      'A written audit of the whole app, ranked, in plain English, and everything on it fixed. From $500.',
      'One price, agreed before we start. The audit and the fix are yours either way.',
    ],
  },
  cta: 'Start with the fix',
  sampleCaption: 'Sample result',
};

export const HOW = {
  title: 'How we work',
  intro: 'What you get, step by step. Every change lands where you can read it the day we make it.',
  // `term` is the short form the hero lists; `name` is the step heading here.
  steps: [
    {
      term: 'Scope in writing',
      when: 'Before we start',
      name: 'A written scope and one price',
      text: 'What we build, what we leave out and what it costs, agreed before any work.',
    },
    {
      term: 'Paid by milestone',
      when: 'Each milestone',
      name: 'A working build you can try',
      text: 'Each milestone has a fixed amount and ends with working code merged into your repo and a short note on what changed.',
    },
    {
      term: 'Your repo from day one',
      when: 'Every change',
      name: 'Code in your repo',
      text: 'You invite us and every change is a pull request you can read. There is nothing to hand over at the end.',
    },
    {
      term: 'Stop any time',
      when: 'When you choose',
      name: 'Stop and keep everything',
      text: 'Stop after any milestone. Finished work is already yours, and any developer can pick it up.',
    },
  ],
  team: {
    title: 'Who we are',
    text: 'A small senior studio: product, design, engineering and automation under one roof. We work with AI tools where they save time, and a person reviews every line before it reaches your repo.',
    link: 'Meet the founder',
    url: 'https://cv.spacesonlabs.com',
  },
  talk: 'Talk any time: email, your team chat or a call, whichever suits you.',
  payment: 'Pay by Payoneer invoice (card or bank), SWIFT transfer, or USDT/USDC.',
};

export const PROMPTING = {
  title: 'Keep prompting? Yes, until people use it.',
  quotes: [
    {
      text: 'The pain shows up when you add boring stuff: auth/rbac, db schema changes, background jobs, integrations, deploy/rollback.',
      source: 'r/nocode',
      url: 'https://www.reddit.com/r/nocode/comments/1ttnm22/comment/op49uuz/',
    },
    {
      text: 'Great for getting to a working prototype… rough once it is live and has paying users.',
      source: 'r/nocode',
      url: 'https://www.reddit.com/r/nocode/comments/1ttnm22/comment/op5ba2s/',
    },
  ],
  research:
    '170 of 1,645 Lovable apps checked had databases anyone could read or change (CVE-2025-48757, disputed by Lovable).',
  researchUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2025-48757',
  close:
    'That is where we come in: we fix the worst problem and add tests so the next prompt does not undo it. You keep building in your AI tool after we are done.',
};

export const SAMPLE = {
  title: 'Read a sample audit before you pay for one',
  text: 'We built a small shift-scheduling app for a cleaning company, left nine common faults in it on purpose, then audited and fixed it the way we would yours. The report and the pull request below are rendered from that work.',
  run: 'Run the free check on it',
  // Turn on once github.com/spacesonlabs/shiftboard-sample is public.
  isRunnable: false,
  link: 'Read the full sample audit',
};

export const FAQ = [
  {
    question: 'Prices start at $150. What is the catch?',
    answer:
      'A clear scope. Before you pay, we agree in writing what the work covers and what it costs. Small jobs cost less, big ones more, and you see the number first.',
  },
  {
    question: 'What if you take the money and disappear?',
    answer:
      'From the first day the work lands in your repo as pull requests, so you see every change as it happens. You pay by milestone, so you never have much at risk before you see work.',
  },
  {
    question: 'Who owns the code?',
    answer:
      'You, from the first commit. We work in your repo and on your accounts, with common tools any developer can pick up.',
  },
  {
    question: 'I can’t read code. How do I judge the work?',
    answer:
      'Every finding starts with what a user would see, for example “a stranger can read your client list”. The technical name comes second. Every fix ships with tests, and you can re-run the free check and watch the failures go away.',
  },
  {
    question: 'How will I know what’s happening?',
    answer:
      'Every change is a pull request with a short note in plain words. You get written updates as we go, and we can talk whenever you want.',
  },
  {
    question: 'Will you tell me to rewrite everything?',
    answer:
      'Not by default. We keep what works and fix what breaks. If a rewrite is cheaper than fixing, the audit shows both numbers and you choose.',
  },
  {
    question: 'What will the full job cost?',
    answer:
      'Nobody can know before reading the code. After the first fix you get a written scope with one price, split into milestones. You can stop there.',
  },
  {
    question: 'Can’t I fix it with AI myself?',
    answer:
      'Often you can, and the free check shows what to fix. If you are not confident running it in production long term, that is the job we do.',
  },
  {
    question: 'What happens when it breaks after you’re done?',
    answer:
      'Error alerts are on before we leave, so you hear first. After that you can hire us by the job or by the month, and because the code is in your repo you are never stuck with us.',
  },
  {
    question: 'I only have an idea, no app yet.',
    answer:
      'Then we start from the idea. We scope the first version with you, build your core flow first and show it working early. New products start from $2,000.',
  },
  {
    question: 'Do you build AI agents?',
    answer:
      'Yes, one workflow at a time, with a written scope. The agent drafts; anything that sends money or goes to a customer waits for your OK. Each workflow is priced on its own.',
  },
  {
    question: 'Who does the work, and when can we talk?',
    answer:
      'A senior team led by the studio’s founder; more under How we work. Write, message or call whenever suits you.',
  },
];

export type Product = {
  name: string;
  slug: string;
  tagline: string;
  job: string;
  url: string;
  host: string;
  // Describes the hero frame, which shows the product block below the page title.
  alt: string;
};

export const PRODUCTS: Product[] = [
  {
    name: 'InboxSieve',
    slug: 'inboxsieve',
    tagline: 'Sorts contact-form mail and drafts the replies',
    job: 'Sorts contact-form messages: removes spam, scores real client requests and drafts a reply.',
    url: 'https://inboxsieve.com/',
    host: 'inboxsieve.com',
    alt:
      'InboxSieve on its live site: four contact-form messages before, and after it removed the spam, set a sales pitch aside and drafted a reply to the real client',
  },
  {
    name: 'PriceDawn',
    slug: 'pricedawn',
    tagline: "One morning email with rivals' price changes",
    job: "Checks competitors' prices every day and sends a store owner one morning email with every change.",
    url: 'https://pricedawn.spacesonlabs.com/',
    host: 'pricedawn.spacesonlabs.com',
    alt:
      'PriceDawn on its live site: four rival prices checked by hand, next to the one morning email that lists the change and the link',
  },
  {
    name: 'MonthMemo',
    slug: 'monthmemo',
    tagline: "Writes an agency's monthly client reports",
    job: "Drafts each agency client's monthly website report from their analytics, sent after the agency approves.",
    url: 'https://monthmemo.spacesonlabs.com/',
    host: 'monthmemo.spacesonlabs.com',
    alt:
      "MonthMemo on its live site: an agency's analytics spreadsheet next to the monthly report email the client receives",
  },
];

export const START = {
  title: 'Tell us what you need built',
  writeLead: 'Tell us the job',
  checkLead: 'Have an app already? Run the free check',
  writeText:
    'Send the link to your app or a few lines about the idea, and what you want done. We reply fast with a plan and a price, or a straight no.',
  talk: 'Prefer a call? Say so in the email.',
};

// Shared by /for-ai-assistants and /llms.txt so the two never drift.
export const AI_ASSISTANTS = {
  intro: 'If a person asked you for a team to build, fix or finish software, or to automate work, here is what we offer.',
  contact: 'with a few lines about what you want done. We reply fast with a plan and a price agreed in writing before we start.',
};
