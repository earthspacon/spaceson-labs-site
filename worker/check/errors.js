export const ERROR_STATUS = {
  bad_target: 400,
  not_found: 404,
  private_repo: 403,
  rate_limited: 429,
  timeout: 504,
  upstream: 502,
}

const ERROR_MESSAGES = {
  bad_target: 'Paste a public GitHub repo (github.com/you/your-app) or your app address (https://your-app.com).',
  not_found: 'We could not find that. Check the address and try again.',
  private_repo: 'This repo is private. We only read public code. Paste your app address instead.',
  rate_limited: 'Too many checks right now. Try again in a few minutes.',
  timeout: 'The check took longer than we allow. Try again in a minute.',
  upstream: 'A service we rely on did not answer. Try again in a minute.',
}

export class CheckError extends Error {
  constructor(code, message) {
    super(message ?? ERROR_MESSAGES[code])
    this.code = code
  }
}

export function toErrorResult(error) {
  if (error instanceof CheckError) {
    return {
      error: error.code,
      message: error.message,
    }
  }
  return {
    error: 'upstream',
    message: ERROR_MESSAGES.upstream,
  }
}
