import { describe, expect, it } from 'vitest';

import sampleCheck from '../data/sample-check.json';
import sampleLive from '../data/sample-check-live.json';
import { type CheckResult, CHECK_ERRORS, detectTarget, FAILED_LABEL, renderCheckCard, renderCheckError, renderWhere } from './check-card';

const repo = sampleCheck as CheckResult;
const live = sampleLive as CheckResult;

describe('renderCheckCard', () => {
  it('counts fail and warn rows under one headline word', () => {
    const html = renderCheckCard({ result: live });

    expect(html).toContain(`<strong>4 of 5</strong> ${FAILED_LABEL}`);
  });

  it('keeps the sample card free of anything that ages', () => {
    const html = renderCheckCard({
      result: {
        ...repo,
        info: {
          authors: 1,
          lastCommitDays: 40,
        },
      },
      isSample: true,
    });

    expect(html).toContain('checked in about 3 s');
    expect(html).toContain('1 person commits here');
    expect(html).not.toMatch(/last commit|days ago|today|yesterday/);
  });

  it('shows the exact time and last commit on a real result', () => {
    const html = renderCheckCard({
      result: {
        ...repo,
        ms: 4210,
        info: {
          authors: 2,
          lastCommitDays: 3,
        },
      },
    });

    expect(html).toContain('checked in 4.2 s');
    expect(html).toContain('2 people commit here, last commit 3 days ago');
  });

  it('renders pass rows that have no explanation', () => {
    const html = renderCheckCard({ result: repo });

    expect(html).toContain('No open write rules');
    expect(html).not.toContain('<p>null</p>');
  });

  it('uses the https wording for the live sample', () => {
    const row = live.checks.find((check) => check.id === 'U5');

    expect(row).toMatchObject({
      title: 'Some safety headers missing (low risk)',
      where: 'missing: HSTS, CSP',
    });
  });
});

describe('renderWhere', () => {
  it('keeps the line number glued to its file and breaks only after a slash', () => {
    expect(renderWhere('supabase/migrations/0001_init.sql:14')).toBe(
      '<span class="cc-file">supabase/</span><wbr><span class="cc-file">migrations/</span><wbr><span class="cc-file">0001_init.sql:14</span>',
    );
  });

  it('never splits a folder at its hyphen', () => {
    expect(renderWhere('supabase/functions/stripe-webhook/')).toContain('<span class="cc-file">stripe-webhook/</span>');
  });

  it('keeps a note after the file outside the unbreakable part', () => {
    expect(renderWhere('assets/index-BdKGPZwx.js (service_role)')).toBe(
      '<span class="cc-file">assets/</span><wbr><span class="cc-file">index-BdKGPZwx.js</span> (service_role)',
    );
  });
});

describe('renderCheckError', () => {
  it('shows the server message escaped', () => {
    const html = renderCheckError({ code: 'upstream', message: 'x<y' });

    expect(html).toContain('x&lt;y');
    expect(html).not.toContain('x<y');
  });

  it('falls back to the page copy without a server message', () => {
    expect(renderCheckError({ code: 'rate_limited' })).toContain(CHECK_ERRORS.rate_limited.text);
    expect(CHECK_ERRORS.rate_limited.text).toMatch(/^Wait ten minutes and try again/);
  });
});

describe('renderCheckCard info line', () => {
  it('leaves out the last commit when its date is unknown', () => {
    const html = renderCheckCard({
      result: {
        ...repo,
        info: {
          authors: 2,
          lastCommitDays: null,
        },
      },
    });

    expect(html).toContain('2 people commit here</p>');
    expect(html).not.toMatch(/last commit|null/);
  });
});

describe('detectTarget', () => {
  it('follows the Worker rules', () => {
    expect(detectTarget('github.com/Owner/Repo')).toEqual({ mode: 'repo', target: 'github.com/owner/repo' });
    expect(detectTarget('my-app.lovable.app/x')).toEqual({ mode: 'live', target: 'https://my-app.lovable.app' });
    expect(detectTarget('localhost:3000')).toBeNull();
    expect(detectTarget('a.com:8080')).toBeNull();
  });
});
