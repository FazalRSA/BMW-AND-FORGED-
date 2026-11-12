/** Runs the admin capture's Supabase stub on fake routes. node scripts/video/test-supabase-stub.cjs  (exit 0 = all pass) */
const assert = require('node:assert/strict');
const { answerSupabase, CaptureStop, exitCodeFor, makeRouteHandler } = require('./supabase-stub.cjs');
const fs = require('node:fs'); const path = require('node:path');

const session = { access_token: 't', user: { id: 'u', email: 'dealer@example.com' } };
const FX = { cars: [{ id: 'm2_g87', active: true }, { id: 'old', active: false }], wheels: [{ id: 'w1' }], broken: 'not-an-array' };

function fakeRoute(method, url) {
  const out = { fulfilled: null };
  return { out, request: () => ({ method: () => method, url: () => url }), fulfill: async (o) => { out.fulfilled = o; } };
}
const run = (method, url) => { const r = fakeRoute(method, url); return answerSupabase(r, { FX, session, email: 'dealer@example.com' }).then(() => r.out.fulfilled, (e) => { throw e; }); };
const body = (o) => JSON.parse(o.body);

/** Runs the real route handler the capture registers, with a spy for exit, and returns what it reported and exited with. */
async function handle(method, url) {
  const seen = { exit: null, report: null };
  const handler = makeRouteHandler({ FX, session, email: 'dealer@example.com', exit: (c) => { seen.exit = c; }, report: (m) => { seen.report = m; } });
  await handler(fakeRoute(method, url));
  return seen;
}

const tests = {
  'route handler: unexpected write exits 3 with the message': async () => {
    const seen = await handle('POST', 'https://x.supabase.co/rest/v1/leads');
    assert.equal(seen.exit, 3); assert.match(seen.report, /UNEXPECTED WRITE POST leads/);
  },
  'route handler: unknown call exits 3': async () => assert.equal((await handle('GET', 'https://x.supabase.co/graphql/v1')).exit, 3),
  'route handler: stub failure exits 4 and names the URL': async () => {
    const seen = await handle('GET', 'https://x.supabase.co/rest/v1/broken?active=eq.true');
    assert.equal(seen.exit, 4); assert.match(seen.report, /route handler failed for .*broken/);
  },
  'route handler: a normal answer does not exit': async () => assert.equal((await handle('GET', 'https://x.supabase.co/rest/v1/cars')).exit, null),
  'exit code: a CaptureStop keeps its code (3)': async () => assert.equal(exitCodeFor(new CaptureStop(3, 'x')), 3),
  'exit code: any other error is a stub failure (4)': async () => assert.equal(exitCodeFor(new TypeError('x')), 4),
  'no secrets in the capture scripts (keys, tokens, private keys)': async () => {
    const dir = path.join(__dirname); const pat = /sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{30,}|service_role|BEGIN (RSA |)PRIVATE|sb_secret/;
    for (const f of fs.readdirSync(dir).filter((f) => /\.(cjs|ts)$/.test(f) && f !== 'test-supabase-stub.cjs')) assert.equal(pat.test(fs.readFileSync(path.join(dir, f), 'utf8')), false, `secret pattern in ${f}`);
  },
  'GET cars returns every fixture row': async () => assert.equal(body(await run('GET', 'https://x.supabase.co/rest/v1/cars?select=*')).length, 2),
  'GET with active=eq.true hides inactive rows': async () => assert.equal(body(await run('GET', 'https://x.supabase.co/rest/v1/cars?active=eq.true')).length, 1),
  'admin_users answers the demo email': async () => assert.equal(body(await run('GET', 'https://x.supabase.co/rest/v1/admin_users')).email, 'dealer@example.com'),
  'auth token answers the session': async () => assert.equal(body(await run('POST', 'https://x.supabase.co/auth/v1/token')).access_token, 't'),
  'OPTIONS answers 204': async () => assert.equal((await run('OPTIONS', 'https://x.supabase.co/rest/v1/cars')).status, 204),
  'expected write (POST wheels) is held and answered 201': async () => assert.equal((await run('POST', 'https://x.supabase.co/rest/v1/wheels')).status, 201),
  'unexpected write (POST leads) stops with exit 3': async () => {
    await assert.rejects(run('POST', 'https://x.supabase.co/rest/v1/leads'), (e) => e instanceof CaptureStop && e.exitCode === 3 && /UNEXPECTED WRITE POST leads/.test(e.message));
  },
  'unknown call (no table) stops with exit 3': async () => {
    await assert.rejects(run('GET', 'https://x.supabase.co/graphql/v1'), (e) => e instanceof CaptureStop && e.exitCode === 3 && /UNHANDLED/.test(e.message));
  },
  'stub bug (non-array fixture filtered) is NOT a CaptureStop, so the caller exits 4': async () => {
    await assert.rejects(run('GET', 'https://x.supabase.co/rest/v1/broken?active=eq.true'), (e) => !(e instanceof CaptureStop) && e instanceof TypeError);
  },
};

(async () => {
  let failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try { await fn(); console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name, '-', e.message.split('\n')[0]); }
  }
  console.log(failed ? `${failed} failed` : `all ${Object.keys(tests).length} passed`);
  process.exit(failed ? 1 : 0);
})();
