// One renderer for the check card: Astro calls it at build time for the sample, the browser calls it for live results.

export type CheckStatus = 'fail' | 'warn' | 'pass';

export type CheckRow = {
  id: string;
  status: CheckStatus;
  title: string;
  where: string | null;
  fix: string | null;
  why: string;
  tag: 'week' | 'full' | null;
};

export type CheckResult = {
  target: string;
  mode: 'repo' | 'live';
  name: string;
  ms: number;
  commit: string | null;
  failed: number;
  total: number;
  labels: string[];
  info: { authors: number; lastCommitDays: number } | null;
  checks: CheckRow[];
};

export type CheckErrorCode = 'bad_target' | 'not_found' | 'private_repo' | 'rate_limited' | 'timeout' | 'upstream';

export type CheckTarget = { mode: 'repo' | 'live'; target: string } | null;

export const CHECK_ERRORS: Record<CheckErrorCode, { title: string; text: string }> = {
  bad_target: {
    title: 'That is not a site or a repo we can read',
    text: 'Paste a web address like your-app.com or a GitHub link like github.com/you/your-app.',
  },
  not_found: {
    title: 'Nothing found at that address',
    text: 'Check the spelling. If it is a site, make sure it is online; if it is a repo, make sure it exists.',
  },
  private_repo: {
    title: 'That repo is private',
    text: 'We only read public code. Check your live site instead, or email us and give us access to look by hand.',
  },
  rate_limited: {
    title: 'Too many checks from your network',
    text: 'Wait an hour and try again, or email us the link and we will run it for you.',
  },
  timeout: {
    title: 'The check took too long, so we stopped it',
    text: 'Very large repos and slow sites do this. Try again, or check the live site instead of the repo.',
  },
  upstream: {
    title: 'GitHub or the site did not answer properly',
    text: 'This is on their side or ours, not yours. Try again in a minute.',
  },
};

export const ICONS = {
  fail: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  pass: '<path d="M20 6 9 17l-5-5"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
} as const;

const STATUS_LABEL: Record<CheckStatus, string> = {
  fail: 'Fails',
  warn: 'Worth fixing',
  pass: 'Passes',
};

const TAG_LABEL = {
  week: 'In the first fix',
  full: 'Part of the full job',
} as const;

const GITHUB_REPO = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i;
const BARE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#].*)?$/i;

export function icon(name: keyof typeof ICONS) {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

export function detectTarget(raw: string): CheckTarget {
  const value = raw.trim();
  const repo = value.match(GITHUB_REPO);
  if (repo) {
    return { mode: 'repo', target: `github.com/${repo[1]}/${repo[2]}` };
  }
  const hasScheme = /^https?:\/\//i.test(value);
  if (!hasScheme && !BARE_HOST.test(value)) {
    return null;
  }
  try {
    const url = new URL(hasScheme ? value : `https://${value}`);
    return { mode: 'live', target: url.origin };
  } catch {
    return null;
  }
}

export function renderCheckCard({ result, limit, isAnimated = false }: { result: CheckResult; limit?: number; isAnimated?: boolean }) {
  const rows = limit ? result.checks.slice(0, limit) : result.checks;
  const hidden = result.checks.length - rows.length;
  const seconds = (result.ms / 1000).toFixed(1).replace(/\.0$/, '');
  const meta = [
    `<span>${result.mode === 'repo' ? 'Code check' : 'Live site check'}</span>`,
    `<span>checked in ${seconds} s</span>`,
    result.commit ? `<span>commit <code>${escapeHtml(result.commit)}</code></span>` : '',
  ].join('');
  const labels = result.labels.map((label) => `<li>${escapeHtml(label)}</li>`).join('');

  return `<article class="cc${isAnimated ? ' cc-animated' : ''}" aria-label="Check result for ${escapeHtml(result.name)}">
  <header class="cc-head">
    <div class="cc-title">
      <p class="cc-name">${escapeHtml(result.name)}</p>
      <p class="cc-meta">${meta}</p>
    </div>
    <p class="cc-score"><strong>${result.failed} of ${result.total}</strong> checks fail</p>
    ${labels ? `<ul class="cc-labels">${labels}</ul>` : ''}
  </header>
  <ol class="cc-rows">${rows.map((row, index) => renderRow({ row, index })).join('')}</ol>
  ${hidden > 0 ? `<p class="cc-more">${hidden} more checks in the full result</p>` : ''}
  ${result.info ? `<p class="cc-info">${renderInfo(result.info)}</p>` : ''}
</article>`;
}

export function renderCheckError({ code }: { code: CheckErrorCode }) {
  const error = CHECK_ERRORS[code] ?? CHECK_ERRORS.upstream;
  return `<div class="cc cc-error" role="alert" data-error="${code}">
  <p class="cc-error-title">${icon('warn')}${error.title}</p>
  <p class="cc-error-text">${error.text}</p>
</div>`;
}

function renderRow({ row, index }: { row: CheckRow; index: number }) {
  const where = row.where ? `<code class="cc-where">${escapeHtml(row.where)}</code>` : '';
  const fix = row.fix ? `<span class="cc-fix">fix: ${escapeHtml(row.fix)}</span>` : '';
  const tag = row.tag ? `<span class="cc-tag">${TAG_LABEL[row.tag]}</span>` : '';

  return `<li class="cc-row is-${row.status}" style="--i:${index}">
  <details>
    <summary>
      <span class="cc-status" title="${STATUS_LABEL[row.status]}">${icon(row.status)}<span class="sr-only">${STATUS_LABEL[row.status]}:</span></span>
      <span class="cc-body">
        <span class="cc-row-title">${escapeHtml(row.title)}</span>
        ${where || fix ? `<span class="cc-row-meta">${where}${fix}</span>` : ''}
      </span>
      <span class="cc-chevron">${icon('chevron')}</span>
    </summary>
    <div class="cc-why"><p>${escapeHtml(row.why)}</p>${tag}</div>
  </details>
</li>`;
}

function renderInfo(info: NonNullable<CheckResult['info']>) {
  const authors = info.authors === 1 ? '1 person commits here' : `${info.authors} people commit here`;
  return `${authors}, last commit ${buildDaysAgo(info.lastCommitDays)}`;
}

function buildDaysAgo(days: number) {
  if (days === 0) {
    return 'today';
  }
  if (days === 1) {
    return 'yesterday';
  }
  return `${days} days ago`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    return `&#${char.charCodeAt(0)};`;
  });
}
