import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createCompanion} from '../companion/server.mjs';
import {providerConfig,validateChat,generateReply} from '../server/index.mjs';
import chat from '../watch/src/lib/chat.js';
import layout from '../watch/src/lib/chat-layout.js';
const builtinRoot=new URL('../watch/src/',import.meta.url).pathname;
async function serve(t,handler){const server=http.createServer(handler);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});t.after(()=>new Promise(resolve=>server.close(resolve)));return 'http://127.0.0.1:'+server.address().port;}
test('实际 HTTP 链路：现有设备配对调用模型，编辑令牌和其他设备不可冒用',async t=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'watch-ai-'));t.after(()=>fsp.rm(directory,{recursive:true,force:true}));
  let captured;
  const provider=await serve(t,async(request,response)=>{const chunks=[];for await(const chunk of request)chunks.push(chunk);captured={url:request.url,headers:request.headers,body:JSON.parse(Buffer.concat(chunks))};response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({choices:[{message:{content:'小赵，我是团团，今天也会陪着你。'}}]}));});
  const config=providerConfig({AI_BASE_URL:provider,AI_API_KEY:'test-model-key',AI_MODEL:'deepseek-flash',AI_THINKING:'disabled'});
  const service=createCompanion({directory,builtinRoot,chatConfig:config});const base=await serve(t,service.handler);
  const pair=await (await fetch(base+'/api/pairs',{method:'POST'})).json();
  const other=await (await fetch(base+'/api/pairs',{method:'POST'})).json();
  const endpoint=base+'/api/devices/'+pair.id+'/chat';
  const send=token=>fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({text:'你好',character:{name:'团团',nickname:'小赵'},history:[{role:'assistant',content:'上次聊过的话'}],pet:{food:65,mood:72,affinity:36}})});
  assert.equal((await send(pair.editorToken)).status,401);assert.equal((await send(other.deviceToken)).status,401);
  const response=await send(pair.deviceToken);assert.equal(response.status,200);assert.equal((await response.json()).text,'小赵，我是团团，今天也会陪着你。');
  assert.equal(captured.url,'/chat/completions');assert.equal(captured.headers.authorization,'Bearer test-model-key');
  assert.deepEqual(captured.body.thinking,{type:'disabled'});assert.equal(captured.body.model,'deepseek-flash');assert.equal(captured.body.stream,false);
  assert.ok(captured.body.messages[0].content.includes('团团'));assert.ok(captured.body.messages[0].content.includes('小赵'));assert.equal(captured.body.messages[1].content,'上次聊过的话');
  assert.equal((await fetch(base+'/api/devices/'+pair.id+'/chat/status')).status,401);
  const status=await (await fetch(base+'/api/devices/'+pair.id+'/chat/status',{headers:{Authorization:'Bearer '+pair.deviceToken}})).json();assert.deepEqual(status,{configured:true});
  const health=await (await fetch(base+'/health')).json();assert.equal(health.aiConfigured,true);assert.ok(!JSON.stringify(health).includes('test-model-key'));
});
test('未配置模型及上游鉴权、余额、限流问题明确报错，不返回伪回复',async()=>{
  const input=validateChat({text:'你好'}),config=providerConfig({AI_BASE_URL:'https://api.deepseek.com',AI_MODEL:'deepseek-flash',AI_API_KEY:'test-key',AI_THINKING:'disabled'});
  await assert.rejects(generateReply(input,providerConfig({})),{code:'model_not_configured'});
  for(const [status,code]of [[401,'provider_auth_failed'],[402,'provider_balance_required'],[429,'provider_rate_limited']])await assert.rejects(generateReply(input,config,async()=>new Response('{}',{status})),{code});
  assert.throws(()=>providerConfig({AI_THINKING:'invalid'}));
  const character=validateChat({text:'你好',character:{name:'<>团团',nickname:'小赵\n'}}).character;assert.deepEqual(character,{name:'团团',nickname:'小赵'});
});
test('聊天自动选择已保存的配对，兼容旧版独立聊天地址，不使用手机编辑令牌',()=>{
  const pair={baseUrl:'http://192.168.1.2:8081',id:'a'.repeat(16),deviceToken:'b'.repeat(48),editorToken:'c'.repeat(48)};
  const connection=chat.connection({sync:pair},{serviceUrl:'https://legacy.example/chat',deviceToken:'legacy'});
  assert.equal(connection.url,pair.baseUrl+'/api/devices/'+pair.id+'/chat');assert.equal(connection.token,pair.deviceToken);
  assert.equal(chat.connection({sync:{}},{serviceUrl:'https://legacy.example/chat',deviceToken:'legacy'}).paired,false);
  assert.equal(chat.connection({sync:{...pair,baseUrl:'http://public.example'}},{}),null);
});
function watch(t,timers={setTimeout,clearTimeout}){
  const file=fs.readFileSync(new URL('../watch/src/Chat/index.ux',import.meta.url),'utf8');
  const code=file.match(/<script>([\s\S]*?)<\/script>/)[1].replace("import router from '@system.router'",'').replace("import fetch from '@system.fetch'",'').replace('export default','module.exports =');
  const calls=[],scrolls=[];let saves=0;
  const app={ready:true,history:[],draft:'原草稿',state:{food:65},sync:{baseUrl:'http://192.168.1.2:8081',id:'a'.repeat(16),deviceToken:'b'.repeat(48)},profile:()=>({name:'团团',nickname:'小赵'}),whenReady:callback=>callback(),save(){saves++}};
  const context={router:{push(){}},fetch:{fetch:options=>calls.push(options)},require:createRequire(new URL('../watch/src/Chat/index.ux',import.meta.url)),module:{exports:{}},setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,JSON};
  vm.runInNewContext(code,context);const page=context.module.exports;Object.assign(page,page.private);page.$app={$def:app};page.$element=()=>({scrollTo:options=>scrolls.push(options)});page.onInit();t.after(()=>page.onDestroy());return {app,page,calls,scrolls,saves:()=>saves};
}
test('手表聊天发送当前角色与对话，成功后保存历史、清空草稿，连续点击不重复请求',t=>{
  const {page,app,calls,saves}=watch(t);page.sendText('你好');page.sendText('重复点击');assert.equal(calls.length,1);assert.equal(page.busy,true);
  const call=calls[0],body=JSON.parse(call.data);assert.deepEqual(body.character,{name:'团团',nickname:'小赵'});assert.equal(call.header.Authorization,'Bearer '+'b'.repeat(48));
  assert.ok(call.url.endsWith('/api/devices/'+'a'.repeat(16)+'/chat'));
  call.success({code:200,data:{text:'小赵你好，我是团团。'}});assert.equal(app.history.length,2);assert.equal(app.history[1].content,'小赵你好，我是团团。');assert.equal(app.draft,'');assert.equal(page.busy,false);assert.equal(saves(),1);
});
test('手表请求失败保留草稿和成功历史，显示可处理原因，离开后迟到回复不写存档',t=>{
  const {page,app,calls,saves}=watch(t);app.history=[{role:'user',content:'原问题'},{role:'assistant',content:'原回复'}];page.sendText('新问题');
  calls[0].success({code:502,data:{error:'provider_auth_failed'}});assert.ok(page.status.includes('密钥'));assert.equal(app.draft,'新问题');assert.equal(app.history.length,2);assert.equal(saves(),0);
  page.sendDraft();page.onHide();calls[1].success({code:200,data:{text:'迟到回复'}});assert.equal(app.history.length,2);assert.equal(app.draft,'新问题');assert.equal(saves(),0);
});
test('没有配对时手表不发起请求，模型未配置时保持输入并给出本地配置提示',t=>{
  const {page,app,calls}=watch(t);app.sync={};page.sendText('你好');assert.equal(calls.length,0);assert.ok(page.status.includes('配对'));
  app.sync={baseUrl:'http://192.168.1.2:8081',id:'a'.repeat(16),deviceToken:'b'.repeat(48)};page.sendText('你好');calls[0].success({code:503,data:{error:'model_not_configured'}});assert.equal(app.draft,'你好');assert.ok(page.status.includes('server/.env'));
});
test('长回复和换行获得足够的独立行空间，显示数据不修改原始聊天历史',()=>{
  const content='这是需要完整阅读的长回复。'.repeat(16)+'\n第二段还有表情🙂和英文 WWW test。';
  const history=[{role:'assistant',content}],before=JSON.stringify(history),long=layout.messageRows(history)[0];
  const short=layout.messageRows([{role:'assistant',content:'你好'}])[0];
  assert.equal(long.content,content);assert.ok(long.textHeight>short.textHeight);assert.ok(long.rowHeight>long.cardHeight && long.cardHeight>long.textHeight);
  assert.ok(layout.messageRows([{role:'assistant',content:'一\n二\n三'}])[0].textHeight>short.textHeight);
  assert.equal(JSON.stringify(history),before);
});
test('最新回复先更新显示行再延迟滚动，返回聊天能显示存档，退出页面取消滚动',t=>{
  let id=0;const jobs=new Map();const timers={setTimeout(callback){const token=++id;jobs.set(token,callback);return token},clearTimeout(token){jobs.delete(token)}};
  const {page,app,calls,scrolls}=watch(t,timers);page.sendText('你好');calls[0].success({code:200,data:{text:'你已经能看见这段完整回复啦。'}});
  assert.equal(page.messages.at(-1).content,'你已经能看见这段完整回复啦。');assert.ok(page.messages.at(-1).rowHeight>0);assert.equal(scrolls.length,0);
  jobs.get(page.scrollTimer)();assert.equal(scrolls.length,1);assert.equal(scrolls[0].index,page.messages.length-1);
  page.onShow();assert.equal(page.messages.at(-1).content,app.history.at(-1).content);
  const pending=page.scrollTimer,late=jobs.get(pending);page.onHide();assert.equal(jobs.has(pending),false);late();assert.equal(scrolls.length,1);
});
