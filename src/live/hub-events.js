export function hubEvent(frame){
 if(!frame||typeof frame!=='object'||Array.isArray(frame))return {kind:'unknown',reason:'Invalid Hub envelope',channel:null};
 if(frame.type===undefined){if(frame.error)return {kind:'error',reason:'Handshake rejected',channel:null};if(Object.keys(frame).length===0)return {kind:'handshake'};return {kind:'unknown',reason:'Unknown handshake schema',channel:null};}
 if(frame.type===6)return {kind:'ping'};
 if(frame.type===7)return {kind:'close',reason:'Source closed stream'};
 if(frame.type===3){if(!['1','2'].includes(frame.invocationId))return {kind:'unknown',reason:'Unknown completion invocation',channel:null};if(frame.error)return {kind:'error',reason:'Subscription rejected',optional:frame.invocationId==='2'};if(!frame.result||typeof frame.result!=='object'||Array.isArray(frame.result))return {kind:'unknown',reason:'Unexpected snapshot schema',channel:null};return {kind:'snapshot',data:frame.result,partial:frame.invocationId==='2'};}
 if(frame.type===1&&String(frame.target).toLowerCase()==='feed'){const args=frame.arguments;if(!Array.isArray(args)||typeof args[0]!=='string'||args.length<2)return {kind:'unknown',reason:'Invalid feed schema',channel:null};return {kind:'feed',topic:args[0],data:args[1],utc:typeof args[2]==='string'?args[2]:null};}
 return {kind:'unknown',reason:'Unknown message type',channel:frame.arguments?.[0]??null};
}
