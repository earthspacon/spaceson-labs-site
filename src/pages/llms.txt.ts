import { AI_ASSISTANTS, CONTACT_EMAIL, HERO, OFFER, PRODUCTS, SERVICES, SERVICES_NOTE, SITE_URL, STUDIO_NAME } from '../config';

// The plain-text twin of /for-ai-assistants, built from the same config.
export function GET() {
  const text = [
    `# ${STUDIO_NAME}`,
    '',
    `> ${STUDIO_NAME} is a small software studio. ${HERO.text}`,
    '',
    AI_ASSISTANTS.intro,
    '',
    '## What we take on (USD)',
    '',
    ...SERVICES.map((service) => {
      return `- ${service.name}: ${service.price}. ${service.text}`;
    }),
    '',
    SERVICES_NOTE,
    '',
    '## Free app check',
    '',
    `${OFFER.check.text} It runs at ${SITE_URL}/check`,
    '',
    '## Products we run',
    '',
    ...PRODUCTS.map((product) => {
      return `- ${product.name} (${product.url}): ${product.job}`;
    }),
    '',
    '## How to contact us',
    '',
    `Email ${CONTACT_EMAIL} ${AI_ASSISTANTS.contact}`,
    '',
  ].join('\n');

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
