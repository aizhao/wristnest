import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {PNG} from 'pngjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const profileTools=require('../watch/src/lib/profile.js');
const hash=value=>createHash('sha256').update(value).digest('hex');
export class SyncError extends Error {constructor(status,code){super(code);this.status=status;}}
const idPattern=/^[a-f0-9]{16}$/;
const filenamePattern=/^[a-f0-9]{32}\.png$/;
function isAuthorized(header,expected){
  const token=typeof header==='string' && header.startsWith('Bearer ')?header.slice(7):'';
  if(!token || token.length>128)return false;
  const actual=Buffer.from(hash(token));const target=Buffer.from(expected);
  return actual.length===target.length && timingSafeEqual(actual,target);
}
function decodeImage(value,kind){
  if(typeof value!=='string' || !value.startsWith('data:image/png;base64,') || value.length>300000)throw new SyncError(400,'invalid_png');
  const base64=value.slice(22);
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new SyncError(400,'invalid_base64');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length<50 || bytes.length>220000 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new SyncError(400,'invalid_png');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<16 || height<16 || width>432 || height>514 || (kind==='avatar' && (width>288 || height>312)))throw new SyncError(400,'invalid_dimensions');
  let image;try{image=PNG.sync.read(bytes,{checkCRC:true});if(image.width!==width || image.height!==height)throw Error();}catch{throw new SyncError(400,'png_decode_failed');}
  return PNG.sync.write(image,{colorType:6,bitDepth:8});
}
export function createStore({directory,builtinRoot,maxPairs=200}){
  const queues=new Map();
  const file=id=>{if(!idPattern.test(id))throw new SyncError(404,'not_found');return path.join(directory,id,'pair.json');};
  const read=async id=>{try{return JSON.parse(await fs.readFile(file(id),'utf8'))}catch(error){if(error instanceof SyncError)throw error;throw new SyncError(404,'not_found')}};
  async function write(id,data){const name=file(id),temp=name+'.tmp-'+randomBytes(4).toString('hex');await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,name);}
  async function authorize(id,header,writeAccess=false){const data=await read(id);if(!isAuthorized(header,data.editorHash) && (writeAccess || !isAuthorized(header,data.deviceHash)))throw new SyncError(401,'unauthorized');return data;}
  async function transaction(id,task){const last=queues.get(id) || Promise.resolve();const job=last.catch(()=>{}).then(task);queues.set(id,job);try{return await job}finally{if(queues.get(id)===job)queues.delete(id);}}
  async function builtin(){
    const profile=JSON.parse(await fs.readFile(path.join(builtinRoot,'profile.json'),'utf8'));
    return {name:profile.name,nickname:profile.nickname,animations:profile.animations,scene:profile.scene};
  }
  async function loadBuiltinAsset(uri){
    if(typeof uri!=='string' || !/^\/Common\/(idle|waving|jumping|waiting|review)\/\d\d\.png$|^\/Common\/scenes\/room\.png$/.test(uri))throw new SyncError(400,'invalid_builtin_asset');
    return fs.readFile(path.join(builtinRoot,uri.slice(1)));
  }
  return {
    async verifyDevice(id,header){const data=await read(id);if(!isAuthorized(header,data.deviceHash))throw new SyncError(401,'unauthorized');},
    async verifyEditor(id,header){await authorize(id,header,true);},
    async createPair(){
      await fs.mkdir(directory,{recursive:true});
      if((await fs.readdir(directory)).filter(name=>idPattern.test(name)).length>=maxPairs)throw new SyncError(429,'pair_capacity_reached');
      const id=randomBytes(8).toString('hex'),deviceToken=randomBytes(24).toString('hex'),editorToken=randomBytes(24).toString('hex');
      await fs.mkdir(path.join(directory,id),{mode:0o700});
      await write(id,{id,deviceHash:hash(deviceToken),editorHash:hash(editorToken),createdAt:Date.now(),manifest:null,lastSynced:''});
      return {id,deviceToken,editorToken};
    },
    async view(id,header){const data=await authorize(id,header);return {manifest:data.manifest,lastSynced:data.lastSynced};},
    async manifest(id,header){const data=await authorize(id,header);if(!data.manifest)throw new SyncError(404,'not_published');return data.manifest;},
    async asset(id,name,header){const data=await authorize(id,header);if(!filenamePattern.test(name) || !data.manifest?.files.some(item=>item.name===name))throw new SyncError(404,'not_found');return fs.readFile(path.join(directory,id,name));},
    async publish(id,header,body){return transaction(id,async()=>{
      const old=await authorize(id,header,true);
      if(!body || typeof body.name!=='string' || typeof body.nickname!=='string')throw new SyncError(400,'invalid_profile');
      if(!body.name.trim() || body.name.trim().length>12 || !body.nickname.trim() || body.nickname.trim().length>12)throw new SyncError(400,'invalid_name');
      const base=await builtin();const images=new Map();const animations={};
      async function add(bytes){if(bytes.length>220000)throw new SyncError(400,'asset_too_large');const name=hash(bytes).slice(0,32)+'.png';images.set(name,bytes);return name;}
      if(body.frames!==null && body.frames!==undefined){
        if(typeof body.frames!=='object' || !Array.isArray(body.frames.idle) || !body.frames.idle.length)throw new SyncError(400,'missing_idle');
        for(const state of profileTools.STATES){const frames=body.frames[state] || body.frames.idle;if(!Array.isArray(frames) || !frames.length || frames.length>8)throw new SyncError(400,'invalid_frame_count');animations[state]=[];for(const value of frames)animations[state].push(await add(decodeImage(value,'avatar')));}
      }else if(old.manifest){
        Object.assign(animations,old.manifest.animations);
        for(const item of old.manifest.files)images.set(item.name,await fs.readFile(path.join(directory,id,item.name)));
      }else{
        for(const state of profileTools.STATES){animations[state]=[];for(const uri of base.animations[state])animations[state].push(await add(await loadBuiltinAsset(uri)));}
      }
      let scene='';
      if(body.scene && body.scene!=='builtin')scene=await add(decodeImage(body.scene,'scene'));
      else if(body.scene===null && old.manifest)scene=old.manifest.scene || '';
      if(scene && !images.has(scene))images.set(scene,await fs.readFile(path.join(directory,id,scene)));
      const referenced=new Set(Object.values(animations).flat());if(scene)referenced.add(scene);
      for(const name of [...images.keys()])if(!referenced.has(name))images.delete(name);
      const manifest={schema:1,revision:randomBytes(8).toString('hex'),name:profileTools.cleanName(body.name,'小伴',12),nickname:profileTools.cleanName(body.nickname,'朋友',12),animations,scene,files:[...images].map(([name,bytes])=>({name,bytes:bytes.length}))};
      try{profileTools.validateRemote(manifest)}catch{throw new SyncError(400,'invalid_pack');}
      for(const [name,bytes]of images)await fs.writeFile(path.join(directory,id,name),bytes,{mode:0o600});
      await write(id,{...old,manifest});
      const keep=new Set([...(old.manifest?.files || []).map(x=>x.name),...manifest.files.map(x=>x.name)]);
      for(const name of await fs.readdir(path.join(directory,id)))if(filenamePattern.test(name) && !keep.has(name))await fs.unlink(path.join(directory,id,name)).catch(()=>{});
      return {revision:manifest.revision,assets:manifest.files.length};
    });},
    async ack(id,header,revision){return transaction(id,async()=>{const data=await read(id);if(!isAuthorized(header,data.deviceHash))throw new SyncError(401,'unauthorized');if(!data.manifest || revision!==data.manifest.revision)throw new SyncError(409,'stale_revision');data.lastSynced=revision;await write(id,data);return {ok:true};});},
    async builtinInfo(){const data=await builtin();return {...data,animations:Object.fromEntries(Object.entries(data.animations).map(([state,frames])=>[state,frames.map(uri=>'/builtin/'+uri.slice(8))])),scene:'/builtin/scenes/room.png'};},
    async builtinAsset(relative){return loadBuiltinAsset('/Common/'+relative);}
  };
}
