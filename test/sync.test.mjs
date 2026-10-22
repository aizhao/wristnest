import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {PNG} from 'pngjs';
import {createStore} from '../companion/store.mjs';
import {createCompanion} from '../companion/server.mjs';
import profiles from '../watch/src/lib/profile.js';
import sync from '../watch/src/lib/sync.js';
const builtinRoot=new URL('../watch/src/',import.meta.url).pathname;
function png(color=90,width=32,height=40){const image=new PNG({width,height});for(let i=0;i<image.data.length;i+=4){image.data[i]=color;image.data[i+1]=150;image.data[i+2]=110;image.data[i+3]=255;}return 'data:image/png;base64,'+PNG.sync.write(image).toString('base64');}
const body=(extra={})=>({name:'团团',nickname:'小赵',frames:{idle:[png()]},scene:'builtin',...extra});
async function setup(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'watch-pet-test-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return createStore({directory,builtinRoot});}
test('角色包鉴权隔离：设备令牌可下载，不能修改；不同配对不能读取',async t=>{
  const store=await setup(t),pair=await store.createPair(),other=await store.createPair();
  await assert.rejects(store.publish(pair.id,'Bearer '+pair.deviceToken,body()),{status:401});
  await store.publish(pair.id,'Bearer '+pair.editorToken,body());
  const manifest=await store.manifest(pair.id,'Bearer '+pair.deviceToken);assert.equal(manifest.name,'团团');
  await assert.rejects(store.manifest(pair.id,'Bearer '+other.editorToken),{status:401});
  assert.ok((await store.asset(pair.id,manifest.files[0].name,'Bearer '+pair.deviceToken)).length>50);
  await assert.rejects(store.asset(pair.id,'../../secret','Bearer '+pair.deviceToken),{status:404});
});
test('换形象保留背景、改名保留图片，并发写入不会产生半份配置',async t=>{
  const store=await setup(t),pair=await store.createPair(),auth='Bearer '+pair.editorToken;
  await store.publish(pair.id,auth,body({scene:png(180,64,76)}));
  const before=await store.manifest(pair.id,auth);
  await store.publish(pair.id,auth,body({frames:{idle:[png(120)]},scene:null}));
  const after=await store.manifest(pair.id,auth);assert.equal(after.scene,before.scene);assert.notEqual(after.animations.idle[0],before.animations.idle[0]);
  await Promise.all([store.publish(pair.id,auth,body({name:'名字甲',frames:null,scene:null})),store.publish(pair.id,auth,body({name:'名字乙',frames:null,scene:null}))]);
  const final=await store.manifest(pair.id,auth);assert.equal(final.name,'名字乙');assert.deepEqual(final.animations,after.animations);
});
test('损坏图片、过大尺寸及无效动作不替换原来的角色包',async t=>{
  const store=await setup(t),pair=await store.createPair(),auth='Bearer '+pair.editorToken;
  await store.publish(pair.id,auth,body());const before=await store.manifest(pair.id,auth);
  await assert.rejects(store.publish(pair.id,auth,body({frames:{idle:['data:image/png;base64,aGVsbG8=']}})),{status:400});
  await assert.rejects(store.publish(pair.id,auth,body({frames:{idle:[png(90,300,400)]}})),{status:400});
  await assert.rejects(store.publish(pair.id,auth,body({frames:{idle:Array(9).fill(png())}})),{status:400});
  assert.equal((await store.manifest(pair.id,auth)).revision,before.revision);
});
test('角色包清单拒绝越界路径、任意远程 URL 和不完整帧；支持静态图片回退',()=>{
  const name='a'.repeat(32)+'.png';const manifest={schema:1,revision:'1'.repeat(16),name:'团团',nickname:'朋友',scene:'',files:[{name,bytes:100}],animations:{idle:[name]}};
  const local=profiles.localize(manifest);assert.equal(local.animations.waving[0],'internal://files/rolepack/'+name);
  assert.throws(()=>profiles.validateRemote({...manifest,files:[{name:'../bad.png',bytes:100}]}));
  assert.throws(()=>profiles.validateRemote({...manifest,scene:'https://other.test/image.png'}));
  assert.throws(()=>profiles.validateRemote({...manifest,animations:{idle:['b'.repeat(32)+'.png']}}));
  assert.equal(profiles.personalize('{nickname}，喜欢你。',{nickname:'小赵'}),'小赵，喜欢你。');
  assert.equal(profiles.cleanName('<>','小伴',12),'小伴');
});
test('HTTP 配对→发布→手表下载→存档提交→回执；下载失败保留原配置',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'watch-pet-http-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const appServer=createCompanion({directory,builtinRoot});const server=http.createServer(appServer.handler);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const pair=await (await fetch(base+'/api/pairs',{method:'POST',body:'{}'})).json();
  const auth={Authorization:'Bearer '+pair.editorToken,'Content-Type':'application/json'};
  const published=await (await fetch(base+'/api/pairs/'+pair.id+'/profile',{method:'POST',headers:auth,body:JSON.stringify(body())})).json();assert.ok(published.revision);
  const disk=new Map(),tasks=new Map();let failCopy=false;
  const api={
    fetch:{fetch(options){fetch(options.url,{method:options.method,headers:options.header,body:options.method==='POST'?options.data:undefined}).then(async response=>options.success({code:response.status,data:await response.json()})).catch(options.fail)}},
    request:{download(options){const token=String(tasks.size+1);tasks.set(token,options);options.success({token})},onDownloadComplete(options){const job=tasks.get(options.token);fetch(job.url,{headers:JSON.parse(job.header)}).then(async response=>{if(!response.ok)throw Error();const uri='internal://cache/'+options.token;disk.set(uri,Buffer.from(await response.arrayBuffer()));options.success({uri})}).catch(options.fail)}},
    file:{mkdir(options){options.success()},list(options){options.success({fileList:[...disk].filter(([uri])=>uri.startsWith('internal://files/rolepack/')).map(([uri])=>({uri}))})},copy(options){if(failCopy)options.fail();else{disk.set(options.dstUri,disk.get(options.srcUri));options.success()}},get(options){const data=disk.get(options.uri);data?options.success({length:data.length}):options.fail()},delete(options){disk.delete(options.uri);options.success?.();options.complete?.();}}
  };
  const app={state:{affinity:36},history:[{role:'user',content:'原记录'}],customProfile:null,previousProfile:null,sync:{baseUrl:base,...pair},save(callback){callback(true)}};
  await sync.syncProfile(api,app,()=>{});assert.equal(app.customProfile.name,'团团');assert.equal(app.state.affinity,36);assert.equal(app.history.length,1);
  const view=await (await fetch(base+'/api/pairs/'+pair.id+'/manifest',{headers:auth})).json();assert.equal(view.lastSynced,published.revision);
  const before=app.customProfile;
  await fetch(base+'/api/pairs/'+pair.id+'/profile',{method:'POST',headers:auth,body:JSON.stringify(body({frames:{idle:[png(130)]},name:'新形象'}))});
  failCopy=true;await assert.rejects(sync.syncProfile(api,app,()=>{}));assert.equal(app.customProfile,before);assert.equal(app.state.affinity,36);
  failCopy=false;app.save=callback=>callback(false);await assert.rejects(sync.syncProfile(api,app,()=>{}),{message:'save_failed'});assert.equal(app.customProfile,before);
  for(const secretPath of ['/server/.env','/watch/sign/release/private.pem','/companion/data'])assert.equal((await fetch(base+secretPath)).status,404);
});
test('配套服务地址拒绝凭据、查询串和不加密公网地址，允许 HTTPS 和局域网测试',()=>{
  assert.equal(sync.normalizeBase('https://pet.example/'),'https://pet.example');assert.equal(sync.normalizeBase('http://192.168.1.2:8787'),'http://192.168.1.2:8787');
  for(const url of ['https://name:password@pet.example','https://pet.example/?token=1','http://public.example','file:///private'])assert.throws(()=>sync.normalizeBase(url));
});
