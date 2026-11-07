import { createHash, randomBytes } from 'node:crypto';
import { ProviderError } from './provider.js';

const project = process.env.GRIDLINE_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.GRIDLINE_SUPABASE_PUBLISHABLE_KEY;
const origin = process.env.GRIDLINE_ACCOUNT_ORIGIN?.replace(/\/$/, '');
export const accountEnabled = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(project ?? '') &&
 Boolean(key) && /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)$/.test(origin ?? '');
const callback = `${origin}/api/account/callback`;
const secure = origin?.startsWith('https:') ? '; Secure' : '';
const cookie = (name, value, age) =>
 `gridline_${name}=${encodeURIComponent(value)}; Path=/api/account; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`;
function readCookie(req, name) {
 const prefix = `gridline_${name}=`;
 try {
  return decodeURIComponent(req.headers.cookie?.split('; ').find(entry => entry.startsWith(prefix))?.slice(prefix.length) ?? '');
 } catch { return ''; }
}
const fields = ['driver', 'team'];
function preferences(value) {
 return Object.fromEntries(fields.map(field => {
  const id = value?.[field];
  return [field, typeof id === 'string' && /^[a-z0-9_-]{1,64}$/.test(id) ? id : ''];
 }));
}
async function request(path, { method = 'GET', body, token } = {}) {
 const response = await fetch(`${project}/auth/v1/${path}`, {
  method, redirect: 'error', signal: AbortSignal.timeout(7000),
  headers: { apikey: key, ...(body && {'content-type': 'application/json'}), ...(token && {authorization: `Bearer ${token}`}) },
  body: body && JSON.stringify(body),
 });
 if ([400, 401, 403].includes(response.status)) return null;
 if (!response.ok) throw new ProviderError('계정 서비스에 연결하지 못했습니다.', 502);
 return response.status === 204 ? true : response.json();
}
const sessionCookies = session => [
 cookie('access', session.access_token, Math.min(session.expires_in || 3600, 3600)),
 cookie('refresh', session.refresh_token, 30 * 86400),
];
const clearSession = () => [cookie('access', '', 0), cookie('refresh', '', 0)];
function redirect(res, location, cookies = []) {
 res.writeHead(303, { location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'set-cookie': cookies });
 res.end();
}

export async function handleAccount(req, res, url, send, readBody) {
 const action = url.pathname.slice('/api/account/'.length);
 const method = { login: 'GET', callback: 'GET', session: 'GET', favorites: 'POST', logout: 'POST' }[action];
 if (typeof method !== 'string') throw new ProviderError('계정 경로를 찾을 수 없습니다.', 404);
 if (req.method !== method) throw new ProviderError('Method not allowed', 405);
 if (!accountEnabled) {
  if (action === 'session') return send(req, res, 200, { enabled: false, signedIn: false });
  throw new ProviderError('로그인 연결이 준비되지 않았습니다.', 503);
 }
 if (req.headers.host !== new URL(origin).host) throw new ProviderError('계정 연결 주소를 확인하세요.', 403);
 if (method === 'POST' && req.headers.origin !== origin) throw new ProviderError('Origin not allowed', 403);
 if (action === 'login') {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({ provider: 'google', redirect_to: callback, code_challenge: challenge, code_challenge_method: 's256' });
  return redirect(res, `${project}/auth/v1/authorize?${params}`, [cookie('verifier', verifier, 600)]);
 }
 if (action === 'callback') {
  const code = url.searchParams.get('code');
  const verifier = readCookie(req, 'verifier');
  const cookies = [cookie('verifier', '', 0)];
  if (code && verifier) {
   try {
    const session = await request('token?grant_type=pkce', {method: 'POST', body: {auth_code: code, code_verifier: verifier}});
    if (session?.access_token && session.refresh_token) return redirect(res, '/?account=connected', [...cookies, ...sessionCookies(session)]);
   } catch {}
  }
  return redirect(res, '/?account=failed', cookies);
 }

 let token = readCookie(req, 'access');
 let user = token && await request('user', { token });
 let cookies = [];
 const refresh = readCookie(req, 'refresh');
 if (!user && refresh) {
  const session = await request('token?grant_type=refresh_token', {method: 'POST', body: {refresh_token: refresh}});
  if (session?.access_token && session.refresh_token && session.user) {
   token = session.access_token;
   user = session.user;
   cookies = sessionCookies(session);
  } else cookies = clearSession();
 }
 if (action === 'logout') {
  if (user) await request('logout?scope=local', {method: 'POST', token});
  return send(req, res, 200, {signedIn: false}, {'set-cookie': clearSession()});
 }
 if (action === 'favorites') {
  if (!user) return send(req, res, 401, {error: '다시 로그인해 주세요.'}, {'set-cookie': cookies});
  const favorites = preferences(await readBody(req));
  const updated = await request('user', {method: 'PUT', token, body: {data: {gridline_favorites: favorites}}});
  if (!updated) throw new ProviderError('즐겨찾기를 저장하지 못했습니다.', 502);
  return send(req, res, 200, { favorites }, {'set-cookie': cookies});
 }
 return send(req, res, 200, {enabled: true, signedIn: Boolean(user), ...(user && {favorites: preferences(user.user_metadata?.gridline_favorites)})}, {'set-cookie': cookies});
}
