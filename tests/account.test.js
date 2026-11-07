import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.GRIDLINE_ACCOUNT_ORIGIN = 'https://gridline.example';
process.env.GRIDLINE_SUPABASE_URL = 'https://testproject.supabase.co';
process.env.GRIDLINE_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
const { handleAccount } = await import('../src/account.js');

const origin = process.env.GRIDLINE_ACCOUNT_ORIGIN;
async function call(path, { method = 'GET', headers = {}, body } = {}) {
 const url = new URL(`/api/account/${path}`, origin);
 const request = {method,headers:{host:url.host,...headers}};
 let result;
 const res = {writeHead(status,headers){result = {status,headers};},end(){}};
 await handleAccount(request,res,url,(_req,_res,status,data,headers)=>{result={status,data,headers};},async()=>body);
 return result;
}
const cookiePair = cookie => cookie.split(';')[0];

test('account uses PKCE and writes only protected app session cookies', async t => {
 const start = await call('login');
 const upstream = new URL(start.headers.location);
 const verifier = cookiePair(start.headers['set-cookie'][0]).split('=')[1];
 assert.equal(upstream.origin,'https://testproject.supabase.co');
 assert.equal(upstream.searchParams.get('redirect_to'), origin+'/api/account/callback');
 assert.equal(upstream.searchParams.get('code_challenge'),createHash('sha256').update(verifier).digest('base64url'));
 assert.equal((await call('callback?code=test-code')).headers.location,'/?account=failed');

 t.mock.method(globalThis,'fetch',async (url,options)=>{
  assert.equal(url,'https://testproject.supabase.co/auth/v1/token?grant_type=pkce');
  assert.deepEqual(JSON.parse(options.body),{auth_code:'test-code',code_verifier:verifier});
  return Response.json({access_token:'test-access',refresh_token:'test-refresh',provider_token:'not-for-gridline',expires_in:600});
 });
 const callback = await call('callback?code=test-code',{headers:{cookie:cookiePair(start.headers['set-cookie'][0])}});
 assert.equal(callback.headers.location,'/?account=connected');
 assert.ok(callback.headers['set-cookie'].every(cookie=>cookie.includes('HttpOnly; SameSite=Lax')&&cookie.endsWith('; Secure')));
 assert.doesNotMatch(callback.headers['set-cookie'].join(';'),/not-for-gridline/);
});

test('favorites require a verified session and reject cross-origin writes', async t => {
 const save = {method:'POST',body:{driver:'antonelli',team:'mercedes'}};
 await assert.rejects(call('favorites',save),{status:403});
 assert.equal((await call('favorites',{...save,headers:{origin}})).status,401);

 let calls = 0;
 t.mock.method(globalThis,'fetch',async (url,options)=>{
  assert.equal(url,'https://testproject.supabase.co/auth/v1/user');
  assert.equal(options.headers.authorization,'Bearer test-access');
  if (++calls === 1) return Response.json({id:'account-1'});
  assert.equal(options.method,'PUT');
  assert.deepEqual(JSON.parse(options.body),{data:{gridline_favorites:save.body}});
  return Response.json({id:'account-1',email:'private@example.com'});
 });
 const saved = await call('favorites',{...save,headers:{origin,cookie:'gridline_access=test-access'}});
 assert.deepEqual(saved.data,{favorites:save.body});
});
