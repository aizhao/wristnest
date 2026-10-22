import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createStore,SyncError} from './store.mjs';
import {createHandler,providerConfig,modelConfigured} from '../server/index.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
async function jsonBody(request){
  return new Promise((resolve,reject)=>{
    let size=0,ended=false;const chunks=[];
    request.on('data',chunk=>{if(ended)return;size+=chunk.length;if(size>6000000){ended=true;reject(new SyncError(413,'body_too_large'));return}chunks.push(chunk)});
    request.on('end',()=>{if(ended)return;ended=true;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new SyncError(400,'invalid_json'))}});
    request.on('error',()=>{if(!ended){ended=true;reject(new SyncError(400,'request_aborted'))}});
  });
}
export function createCompanion({directory=path.join(here,'data'),builtinRoot=path.join(here,'../watch/src'),maxPairs=200,chatConfig=providerConfig(),chatFetch=fetch,chatHandler=createHandler(chatConfig,chatFetch)}={}){
  const store=createStore({directory,builtinRoot,maxPairs});const starts=[];
  const chatPath=/^\/api\/devices\/([a-f0-9]{16})\/chat$/;
  const pairedChat=createHandler(chatConfig,chatFetch,{isChatPath:value=>chatPath.test(value),authenticate:async request=>{const match=request.url.match(chatPath);if(!match)return false;await store.verifyDevice(match[1],request.headers.authorization);return true;}});
  const handler=async(request,response)=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
    const send=(status,value,type='application/json; charset=utf-8')=>{response.writeHead(status,{...headers,'Content-Type':type});response.end(type.startsWith('application/json')?JSON.stringify(value):value)};
    const url=new URL(request.url,'http://localhost');const route=url.pathname;const auth=request.headers.authorization;
    try{
      if(request.method==='GET' && route==='/health'){send(200,{ok:true,service:'watch-pet-companion',aiConfigured:modelConfigured(chatConfig)});return;}
      if(route==='/chat'){await chatHandler(request,response);return;}
      if(chatPath.test(route) && !url.search){await pairedChat(request,response);return;}
      const chatStatus=route.match(/^\/api\/devices\/([a-f0-9]{16})\/chat\/status$/);
      if(request.method==='GET' && chatStatus){await store.verifyDevice(chatStatus[1],auth);send(200,{configured:modelConfigured(chatConfig)});return;}
      if(request.method==='POST' && route==='/api/pairs'){
        request.resume();
        const now=Date.now();while(starts.length && now-starts[0]>60000)starts.shift();if(starts.length>=10)throw new SyncError(429,'slow_down');starts.push(now);
        send(201,await store.createPair());return;
      }
      const match=route.match(/^\/api\/(pairs|devices)\/([a-f0-9]{16})\/(manifest|profile|ack|assets\/([a-f0-9]{32}\.png))$/);
      if(match){
        const [,kind,id,action,filename]=match;
        if(request.method==='GET' && action==='manifest'){send(200,kind==='pairs'?await store.view(id,auth):await store.manifest(id,auth));return;}
        if(request.method==='POST' && kind==='pairs' && action==='profile'){await store.verifyEditor(id,auth);send(200,await store.publish(id,auth,await jsonBody(request)));return;}
        if(request.method==='POST' && kind==='devices' && action==='ack'){const data=await jsonBody(request);send(200,await store.ack(id,auth,data.revision));return;}
        if(request.method==='GET' && filename){send(200,await store.asset(id,filename,auth),'image/png');return;}
      }
      if(request.method==='GET' && route==='/builtin/manifest'){send(200,await store.builtinInfo());return;}
      if(request.method==='GET' && route==='/template.png'){send(200,await fs.readFile(path.join(here,'../examples/neutral-atlas.png')),'image/png');return;}
      if(request.method==='GET' && route.startsWith('/builtin/')){send(200,await store.builtinAsset(route.slice(9)),'image/png');return;}
      const pages={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
      if(request.method==='GET' && pages[route]){
        const [file,type]=pages[route];headers['Content-Security-Policy']="default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'";
        send(200,await fs.readFile(path.join(here,'web',file)),type);return;
      }
      if(request.method==='GET' && /^\/icons\/(food|mood|heart|pet|feed|play|chat|settings)\.png$/.test(route)){send(200,await fs.readFile(path.join(builtinRoot,'Common',route.slice(1))),'image/png');return;}
      send(404,{error:'not_found'});
    }catch(error){if(!response.headersSent)send(error instanceof SyncError?error.status:500,{error:error instanceof SyncError?error.message:'internal_error'});else response.end();}
  };
  return {handler,store};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=createCompanion({directory:process.env.SYNC_DATA_DIR || undefined,maxPairs:Number(process.env.MAX_PAIRS)||200});
  const server=http.createServer({requestTimeout:60000,headersTimeout:10000},app.handler);
  const port=Number(process.env.PORT)||8787,host=process.env.HOST || '127.0.0.1';
  server.listen(port,host,()=>console.log(`角色配套服务已启动 http://${host}:${port}，请使用手机可访问的地址；未发布到公网。`));
}
