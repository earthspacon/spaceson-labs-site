import { CheckError, toErrorResult } from './errors.js'
import { createGuardedFetch } from './guarded-fetch.js'
import { runLiveChecks } from './live-checks.js'
import { runRepoChecks } from './repo-checks.js'
import { openGithubRepo } from './sources/github.js'
import { parseTarget } from './target.js'

export { ERROR_STATUS } from './errors.js'
export { FORBIDDEN_PATHS, ForbiddenRequestError, createGuardedFetch } from './guarded-fetch.js'
export { parseTarget } from './target.js'

const STATUS_ORDER = {
  fail: 0,
  warn: 1,
  pass: 2,
}

// `tree` swaps GitHub for another source (a directory on disk) with the same shape.
export async function runCheck(target, { fetch, githubToken, now = Date.now, timeoutMs = 25000, tree }) {
  const parsed = parseTarget(target)
  if (!parsed) {
    return toErrorResult(new CheckError('bad_target'))
  }
  const controller = new AbortController()
  const guardedFetch = createGuardedFetch({
    fetch,
    signal: controller.signal,
  })
  const startedAt = now()
  let timer
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve(toErrorResult(new CheckError('timeout')))
    }, timeoutMs)
  })
  const work = runMode({
    parsed,
    fetch: guardedFetch,
    githubToken,
    now,
    tree,
  })
    .then((body) => {
      return buildResult({
        parsed,
        body,
        ms: Math.round(now() - startedAt),
      })
    })
    .catch(toErrorResult)
  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

async function runMode({ parsed, fetch, githubToken, now, tree }) {
  if (parsed.mode === 'live') {
    const live = await runLiveChecks({
      target: parsed,
      fetch,
    })
    return {
      ...live,
      commit: null,
      info: null,
    }
  }
  const source = tree
    ? await tree.open({ now })
    : await openGithubRepo({
        owner: parsed.owner,
        repo: parsed.repo,
        fetch,
        token: githubToken,
        now,
      })
  return {
    name: source.name,
    commit: source.commit,
    info: source.info,
    labels: [],
    checks: await runRepoChecks({
      source,
      fetch,
    }),
  }
}

function buildResult({ parsed, body, ms }) {
  const checks = body.checks
    .map((check, index) => {
      return {
        check,
        index,
      }
    })
    .sort((a, b) => STATUS_ORDER[a.check.status] - STATUS_ORDER[b.check.status] || a.index - b.index)
    .map((item) => item.check)
  return {
    target: parsed.target,
    mode: parsed.mode,
    name: body.name,
    ms,
    commit: body.commit,
    failed: checks.filter((check) => check.status !== 'pass').length,
    total: checks.length,
    labels: body.labels,
    info: body.info,
    checks,
  }
}
