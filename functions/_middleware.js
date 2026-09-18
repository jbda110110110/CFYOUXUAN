const THRESHOLD = 5;
const RECOVERY_MS = 60000;
const TIMEOUT_MS = 3000;

const state = { failures: 0, openedAt: 0 };

function blocked(r) {
  return new Response('Service temporarily unavailable', {
    status: 503,
    headers: { 'Retry-After': String(r) },
  });
}

export async function onRequest(context) {
  const now = Date.now();

  // 熔断中直接返回 503
  if (state.openedAt > 0) {
    const rem = state.openedAt + RECOVERY_MS - now;
    if (rem > 0) return blocked(Math.ceil(rem / 1000));
    state.openedAt = 0;
  }

  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error('cb_timeout')), TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([context.next(), timeout]);
    clearTimeout(timer);
    state.failures = 0;
    return res;
  } catch (e) {
    clearTimeout(timer);
    state.failures += 1;
    if (state.failures >= THRESHOLD) state.openedAt = Date.now();
    return blocked(Math.ceil(RECOVERY_MS / 1000));
  }
}
