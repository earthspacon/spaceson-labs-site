import { describe, expect, it } from 'vitest';

import sampleCheck from '../data/sample-check.json';
import sampleLive from '../data/sample-check-live.json';
import { type CheckResult, FAILED_LABEL, renderCheckCard, renderWhere } from './check-card';

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
