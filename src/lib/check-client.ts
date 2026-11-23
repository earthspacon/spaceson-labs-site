import {
  CHECK_ERRORS,
  type CheckErrorCode,
  FAILED_LABEL,
  type CheckResult,
  detectTarget,
  icon,
  renderCheckCard,
  renderCheckError,
} from './check-card';

const CHECK_API = '/api/check';
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

const MODE_HINT = {
  repo: 'We will read the code in this repo.',
  live: 'We will read what your live site sends to every visitor.',
} as const;

export function setupCheckForms() {
  for (const form of document.querySelectorAll<HTMLFormElement>('form[data-check-form]')) {
    wireForm(form);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-check-sample]')) {
    button.addEventListener('click', () => {
      const form = document.querySelector<HTMLFormElement>('form[data-check-form]');
      const input = form?.querySelector<HTMLInputElement>('input[name="t"]');
      if (!form || !input) {
        return;
      }
      input.value = button.dataset.checkSample ?? '';
      input.focus();
      form.requestSubmit();
    });
  }
}

export function runFromQuery() {
  const target = new URLSearchParams(window.location.search).get('t');
  const form = document.querySelector<HTMLFormElement>('form[data-check-form]');
  const input = form?.querySelector<HTMLInputElement>('input[name="t"]');
  if (!target || !form || !input) {
    return;
  }
  input.value = target;
  form.requestSubmit();
}

function wireForm(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="t"]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const hint = form.querySelector<HTMLElement>('[data-check-hint]');
  const output = document.getElementById(form.dataset.checkForm ?? '');
  if (!input || !button || !output) {
    return;
  }
  const defaultHint = hint?.textContent ?? '';

  input.addEventListener('input', () => {
    const detected = detectTarget(input.value);
    if (hint) {
      hint.textContent = detected ? MODE_HINT[detected.mode] : defaultHint;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const detected = detectTarget(input.value);
    if (!detected) {
      output.innerHTML = renderCheckError({ code: 'bad_target' });
      return;
    }
    button.disabled = true;
    output.setAttribute('aria-busy', 'true');
    output.innerHTML = renderLoading({ target: detected.target });
    output.innerHTML = await fetchResult({ target: detected.target });
    output.removeAttribute('aria-busy');
    button.disabled = false;
  });
}

async function fetchResult({ target }: { target: string }) {
  try {
    const response = await fetch(`${CHECK_API}?target=${encodeURIComponent(target)}`);
    const body = await response.json();
    if (!response.ok || body.error) {
      return renderCheckError({
        code: toErrorCode(body.error),
        message: typeof body.message === 'string' ? body.message : undefined,
      });
    }
    return renderCheckCard({ result: body as CheckResult }) + renderResultFooter({ result: body as CheckResult });
  } catch {
    return renderCheckError({ code: 'upstream' });
  }
}

function toErrorCode(code: unknown): CheckErrorCode {
  if (typeof code === 'string' && code in CHECK_ERRORS) {
    return code as CheckErrorCode;
  }
  return 'upstream';
}

function renderLoading({ target }: { target: string }) {
  return `<div class="cc cc-loading">
  <p class="cc-name">Checking <code>${target.replace(/[<>&"]/g, '')}</code></p>
  <p class="cc-meta">Usually a few seconds. Nothing on your side changes.</p>
  <div class="cc-progress" aria-hidden="true"><span></span></div>
</div>`;
}

function renderResultFooter({ result }: { result: CheckResult }) {
  const shareUrl = new URL(`${BASE}check?t=${encodeURIComponent(result.target)}`, window.location.origin).href;
  const top = result.checks.find((row) => {
    return row.status !== 'pass';
  });
  const subject = `App check: ${result.name}`;
  const body = [
    `${result.failed} of ${result.total} ${FAILED_LABEL}.`,
    top ? `Top problem: ${top.title}${top.where ? ` (${top.where})` : ''}.` : '',
    `Full result: ${shareUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return `<div class="cc-footer">
  <a class="btn btn-primary" href="${BASE}#start">Fix the top one with us ${icon('arrow')}</a>
  <a class="cc-footer-link" href="${mailto}">Email me this report</a>
  <a class="cc-footer-link" href="${shareUrl}">Link to this result</a>
</div>`;
}
