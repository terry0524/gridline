// Hosting configuration; local development stays loopback-only by default.
export function deploymentSettings(env=process.env,port=3000){
 const bindHost=env.HOST||'127.0.0.1';
 if(!['127.0.0.1','0.0.0.0','::1'].includes(bindHost))throw Error('Invalid HOST');
 const allowedHosts=new Set([`localhost:${port}`,`127.0.0.1:${port}`]);
 const allowedOrigins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`]);
 const urls=[env.GRIDLINE_PUBLIC_URL,env.RENDER_EXTERNAL_URL].filter(Boolean);
 if(env.RENDER_EXTERNAL_HOSTNAME&&!env.RENDER_EXTERNAL_URL)urls.push('https://'+env.RENDER_EXTERNAL_HOSTNAME);
 for(const value of urls){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Public URL must be a plain HTTPS origin');
  allowedHosts.add(url.host);allowedOrigins.add(url.origin);
 }
 return{bindHost,allowedHosts,allowedOrigins,liveEnabled:env.GRIDLINE_LIVE_ENABLED!=='0'};
}
