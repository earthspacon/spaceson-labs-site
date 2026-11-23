import { describe, expect, it } from 'vitest';

import sampleCheck from '../data/sample-check.json';
import { type CheckResult, CRITICAL_CHECK_IDS, renderCheckCard, toneOf } from './check-card';

const result = sampleCheck as CheckResult;

describe('toneOf', () => {
  it('marks only failed critical checks red', () => {
    expect(toneOf({ id: 'G6', status: 'fail' })).toBe('critical');
    expect(toneOf({ id: 'U1', status: 'fail' })).toBe('critical');
  });

  it('keeps every other finding amber', () => {
    expect(toneOf({ id: 'G1', status: 'fail' })).toBe('warn');
    expect(toneOf({ id: 'U2', status: 'warn' })).toBe('warn');
    expect(toneOf({ id: 'G4', status: 'warn' })).toBe('warn');
  });

  it('keeps passes green, critical or not', () => {
    expect(toneOf({ id: 'G7', status: 'pass' })).toBe('pass');
    expect(toneOf({ id: 'G1', status: 'pass' })).toBe('pass');
  });
});

describe('renderCheckCard tone classes', () => {
  it('puts one tone class on every row', () => {
    const html = renderCheckCard({ result, isSample: true });
    const tones = [...html.matchAll(/class="cc-row is-\w+ tone-(\w+)"/g)].map((match) => match[1]);

    expect(tones).toHaveLength(result.checks.length);
    expect(tones.filter((tone) => tone === 'critical')).toHaveLength(
      result.checks.filter((check) => check.status === 'fail' && CRITICAL_CHECK_IDS.has(check.id)).length,
    );
  });

  it('leaves the sample with fewer red rows than amber ones', () => {
    const tones = result.checks.map(toneOf);

    expect(tones.filter((tone) => tone === 'critical').length).toBeLessThan(tones.filter((tone) => tone === 'warn').length);
  });
});
