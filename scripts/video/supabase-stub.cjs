/**
 * Answers the admin page's Supabase calls during the admin capture (scripts/video/capture-admin.cjs).
 *
 * answerSupabase(route, ctx) answers one request from the fixtures; it never reaches the network.
 * It throws a CaptureStop (with exitCode) when the capture must stop:
 *   3  an unknown Supabase call, or a write other than the expected ones (wheel price save, profile upsert)
 *   4  any other failure while answering (a bug in this stub); the caller reports it and exits
 * The caller turns a CaptureStop into its message and exit code, so nothing here calls process.exit.
 */
class CaptureStop extends Error {
  constructor(exitCode, message) { super(message); this.name = 'CaptureStop'; this.exitCode = exitCode; }
}

const EXPECTED_WRITES = { wheels: ['POST', 'PATCH', 'PUT'], profiles: ['POST', 'PATCH', 'PUT'] };

async function answerSupabase(route, { FX, session, email, log = () => {} }) {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

  if (method === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  }
  const table = (url.pathname.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
  if (url.pathname.includes('/auth/v1/token')) return json(session);
  if (url.pathname.includes('/auth/v1/user')) return json(session.user);
  if (url.pathname.includes('/auth/v1/')) return json({});
  if (url.pathname.includes('/storage/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"demo"}' });
  if (!table) throw new CaptureStop(3, `UNHANDLED Supabase call ${method} ${url.pathname}: stopping the capture`);

  if (method !== 'GET' && method !== 'HEAD') {
    if (!(EXPECTED_WRITES[table] || []).includes(method)) {
      throw new CaptureStop(3, `UNEXPECTED WRITE ${method} ${table}: stopping the capture`);
    }
    log(`expected write held locally: ${method} ${table}`);
    return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '[]' });
  }
  if (table === 'admin_users') return json({ email });
  let rows = FX[table];
  if (!rows) return json([]);
  if (url.searchParams.get('active') === 'eq.true') rows = rows.filter((r) => r.active !== false);
  return json(rows);
}

module.exports = { answerSupabase, CaptureStop };
