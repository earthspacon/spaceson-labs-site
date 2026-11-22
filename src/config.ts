// The address is the only contact on the site.
export const CONTACT_EMAIL = 'hello@spacesonlabs.com';

export const STUDIO_NAME = 'Spaceson Labs';

export const SITE_TITLE = `${STUDIO_NAME}: any software job, shipped fast and for less`;

export const SITE_DESCRIPTION =
  'We fix half-built apps, build new products, automate work and join your team as engineers. Free app check, prices from $500, agreed in writing before we start.';

export const NAV_LINKS = [
  { href: '#work', label: 'What we do' },
  { href: '#check', label: 'Free check' },
  { href: '#how', label: 'How we work' },
  { href: '#sample', label: 'Sample audit' },
  { href: '#faq', label: 'Questions' },
];

export const HERO = {
  title: 'Any software job, shipped fast and for less.',
  text: 'Fix a half-built app, build a new product, automate the busywork or add an engineer to your team. Any size. Price agreed in writing before we start.',
  offer: 'Start free: see what breaks first in your app.',
  anchor: { text: 'Fixing what it finds starts', price: 'from $500', link: 'What you get' },
  sampleLabel: 'Our sample app · faults planted on purpose',
};

export const CHECK_FIELD = {
  placeholder: 'your-app.com or github.com/you/your-app',
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
    price: 'from $500',
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
    text: 'A senior full-stack engineer in your repo, tracker and standups. Month to month.',
    price: 'from $3,000/mo',
  },
  {
    name: 'Anything else',
    text: 'Telegram bots, internal tools, integrations, migrations, a slow site that needs to be fast. If it is software, ask.',
    price: 'ask us',
  },
];

export const SERVICES_NOTE =
  'These are starting points. Every price is agreed in writing before we start, and it goes lower or higher with the job.';

export const OFFER = {
  title: 'Start with a free check. Then we fix it.',
  check: {
    name: 'The check, free',
    text: 'Paste your site or your GitHub repo. In seconds you see what breaks first once real users arrive, worst first, with the file and line. We never touch your database; we read only what is public.',
  },
  fix: {
    name: 'The fix, from $500',
    items: [
      'A written audit of the whole app, ranked, in plain English, in your repo and as a PDF.',
      'The worst problem fixed, with tests that prove it, as a pull request into your repo.',
      'One price, in writing, for the rest. The audit and the fix are yours whether you go on or not.',
    ],
  },
  cta: 'Start with the fix',
  sampleCaption: 'Live-site check on our sample app',
  repoPrompt: 'Public repo? Check the code too: it shows tests, payments and database rules a site check cannot see.',
};

export const BREAKS = {
  title: 'What breaks once real users arrive',
  quote: '“$18K saved on development. $40K+ needed to fix what $18K bought me.”',
  quoteSource: 'A founder on r/SaaS',
  quoteUrl: 'https://www.reddit.com/r/SaaS/comments/1sd50dh/',
  quoteAfter: 'The free check and the first fix are there so you find out early, while it is still cheap.',
  footnote: 'Each of these is a check in the free tool.',
  items: [
    {
      problem: 'Tables anyone can read',
      text: 'The public key ships to every browser by design. Without row-level security it opens the whole table.',
      fix: 'We add the rules and a test that proves a stranger gets nothing.',
    },
    {
      problem: 'Bugs happen and nobody hears',
      text: 'No error tracking, so you learn about a crash from a refund request.',
      fix: 'Error alerts go to your email.',
    },
    {
      problem: 'The payment code has no tests',
      text: 'Checkout and webhooks change with every prompt and nothing checks them.',
      fix: 'Tests on the payment path.',
    },
    {
      problem: 'Nothing runs before deploy',
      text: 'A broken change goes straight to users.',
      fix: 'Tests run on every push.',
    },
    {
      problem: 'A secret key in the browser',
      text: 'One key that skips every database rule, downloaded by every visitor.',
      fix: 'Moved to a server function, key rotated.',
    },
    {
      problem: 'Files nobody can change safely',
      text: 'One giant page holding half the app, where every edit breaks something.',
      fix: 'Split where the audit says it pays off.',
    },
  ],
};

export const HOW = {
  title: 'How we work',
  intro: 'We work hard, and you can see it: every change lands where you can read it the day we make it.',
  steps: [
    {
      name: 'Scope in writing',
      text: 'What we build, what we leave out and one price, agreed before we start.',
    },
    {
      name: 'Paid by milestone',
      text: 'Each milestone has a fixed amount and ends with working code merged into your repo and a short note on what changed.',
    },
    {
      name: 'Your repo from day one',
      text: 'You invite us and every change is a pull request you can read. There is nothing to hand over at the end.',
    },
    {
      name: 'Stop any time',
      text: 'Stop after any milestone. Finished work is already yours, and any developer can pick it up.',
    },
  ],
  talk: 'Talk any time: email, your team chat or a call when it suits you. We reply fast.',
  payment: 'Pay by Payoneer invoice (card or bank), SWIFT transfer, or USDT/USDC.',
};

export const PROMPTING = {
  title: 'Keep prompting? Yes, until people use it.',
  lead: 'Lovable, Bolt and Cursor are the fastest way to a first version, and we would tell you to keep going until people use it. People who ship with them say the trouble starts later.',
  quotes: [
    {
      text: 'The pain shows up when you add boring stuff: auth/rbac, db schema changes, background jobs, integrations, deploy/rollback.',
      source: 'r/nocode',
      url: 'https://www.reddit.com/r/nocode/comments/1ttnm22/comment/op49uuz/',
    },
    {
      text: 'Shipped two things to production with lovable. One survived, one didnt.',
      source: 'r/nocode',
      url: 'https://www.reddit.com/r/nocode/comments/1ttnm22/comment/op4ov6n/',
    },
    {
      text: 'Great for getting to a working prototype… rough once it is live and has paying users.',
      source: 'r/nocode',
      url: 'https://www.reddit.com/r/nocode/comments/1ttnm22/comment/op5ba2s/',
    },
    {
      text: 'The generation was fast. The cleanup is a nightmare.',
      source: 'r/vibecoding, a founder with users and revenue',
      url: 'https://www.reddit.com/r/vibecoding/comments/1su03dk/',
    },
  ],
  research:
    'A security researcher found weak row-level security in 170 of 1,645 Lovable apps checked; anyone could read or change those databases. It was filed as CVE-2025-48757, which Lovable disputes.',
  researchUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2025-48757',
  close:
    'That is where we come in: we read the code the way the next developer will, fix the worst problem, and add tests so the next prompt does not undo it. You can keep building features in your AI tool after we are done.',
};

export const SAMPLE = {
  title: 'Read a sample audit before you pay for one',
  text: 'We built a small shift-scheduling app for a cleaning company in Lovable, left nine common faults in it on purpose, then audited and fixed it the way we would yours. The report and the pull request below are rendered from that work.',
  run: 'Run the free check on it',
};

export const FAQ = [
  {
    question: 'Prices start at $500. What is the catch?',
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
      'Then we start from the idea. We agree the first version with you in writing, build your core flow first and show it working early. New products start from $2,000.',
  },
  {
    question: 'Do you build AI agents?',
    answer:
      'Yes, one workflow at a time, with a written scope. The agent drafts; anything that sends money or goes to a customer waits for your OK. From $500 per workflow.',
  },
  {
    question: 'Who does the work, and when can we talk?',
    answer:
      'A senior full-stack engineer who uses AI coding tools and reviews every line before it reaches your repo. Talk any time, by email, chat or a call, and we reply fast.',
  },
];

export type Product = {
  name: string;
  job: string;
  url: string;
  host: string;
  shot: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

export const PRODUCTS_SECTION = {
  title: 'Apps we run ourselves',
  intro: 'We build and run our own products on the same rules we use for yours.',
};

export const PRODUCTS: Product[] = [
  {
    name: 'InboxSieve',
    job: 'Sorts contact-form messages: removes spam, scores real client requests and drafts a reply.',
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
    job: "Checks competitors' prices every day and sends a store owner one morning email with every change.",
    url: 'https://pricedawn.spacesonlabs.com/',
    host: 'pricedawn.spacesonlabs.com',
    shot: {
      src: 'work/pricedawn.webp',
      alt: 'PriceDawn morning email: a rival product dropped in price, with the old price, the new one and the link',
      width: 944,
      height: 540,
    },
  },
  {
    name: 'MonthMemo',
    job: "Drafts each agency client's monthly website report from their analytics, sent after the agency approves.",
    url: 'https://monthmemo.spacesonlabs.com/',
    host: 'monthmemo.spacesonlabs.com',
    shot: {
      src: 'work/monthmemo.webp',
      alt: 'MonthMemo report email: sessions, search clicks and key events for the month, with a short written summary',
      width: 968,
      height: 688,
    },
  },
];

export const START = {
  title: 'Tell us what you need built',
  checkLead: 'Have an app already? Check it first.',
  writeLead: 'Or just write to us',
  writeText:
    'Send the link to your app or a few lines about the idea, and what you want done. We reply fast with a plan and a price, or a straight no.',
  talk: 'Talk any time.',
};
