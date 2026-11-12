/** Runs the admin capture's Supabase stub on fake routes. node scripts/video/test-supabase-stub.cjs  (exit 0 = all pass) */
const assert = require('node:assert/strict');
const { answerSupabase, CaptureStop } = require('./supabase-stub.cjs');

const session = { access_token: 't', user: { id: 'u', email: 'dealer@example.com' } };
const FX = { cars: [{ id: 'm2_g87', active: true }, { id: 'old', active: false }], wheels: [{ id: 'w1' }], broken: 'not-an-array' };

function fakeRoute(method, url) {
  const out = { fulfilled: null };
  return { out, request: () => ({ method: () => method, url: () => url }), fulfill: async (o) => { out.fulfilled = o; } };
}
const run = (method, url) => { const r = fakeRoute(method, url); return answerSupabase(r, { FX, session, email: 'dealer@example.com' }).then(() => r.out.fulfilled, (e) => { throw e; }); };
const body = (o) => JSON.parse(o.body);

const tests = {
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
