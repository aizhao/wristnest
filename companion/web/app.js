'use strict';
const $=id=>document.getElementById(id);
const state={builtin:null,frames:{},scene:'',pendingFrames:null,pendingScene:null,id:'',key:'',revision:'',busy:false,animation:null,blobs:[]};
const fragment=new URLSearchParams(location.hash.slice(1));
if(/^[a-f0-9]{16}$/.test(fragment.get('id') || '') && /^[a-f0-9]{48}$/.test(fragment.get('key') || '')){state.id=fragment.get('id');state.key=fragment.get('key');}
const errorMessages={unauthorized:'配对信息无效，请重新扫描手表上的二维码。',invalid_name:'名字和称呼请填写 1—12 个字。',invalid_dimensions:'图片尺寸不符合要求，请重新选择。',invalid_png:'图片需要重新处理，请再次选择。',body_too_large:'动作素材太大，请压缩后重试。',pair_capacity_reached:'服务配对数量已满，请联系维护者。'};
function status(text,error=false){$('save-status').textContent=text;$('save-status').classList.toggle('error',error);}
async function api(url,options={}){
  const headers={...(options.headers || {})};if(state.key)headers.Authorization='Bearer '+state.key;
  const response=await fetch(url,{...options,headers,cache:'no-store'});
  if(!response.ok){let data;try{data=await response.json()}catch{}throw new Error(errorMessages[data?.error] || '保存未完成，请检查连接后重试。');}
  return response;
}
function greet(){const name=$('name').value.trim() || '小伴',nickname=$('nickname').value.trim() || '朋友';$('pet-name').textContent=name;$('speech').textContent=nickname+'，你来啦！今天也要陪着我哦。';}
function showFrame(source){if(source)$('pet').src=source;}
function animate(kind){
  clearInterval(state.animation);let index=0;const frames=state.frames[kind] || state.frames.idle || [];showFrame(frames[0]);
  const nickname=$('nickname').value.trim() || '朋友';
  $('speech').textContent={waving:'嘿嘿，好喜欢'+nickname+'摸摸我。',review:'好吃！最喜欢一起吃饭啦。',jumping:'好耶！一起玩最开心！'}[kind] || nickname+'，我在这里。';
  if(frames.length>1 && !matchMedia('(prefers-reduced-motion: reduce)').matches){let ticks=0;state.animation=setInterval(()=>{showFrame(frames[++index%frames.length]);if(++ticks>=12){clearInterval(state.animation);showFrame(state.frames.idle?.[0]);}},200);}
}
function selectScene(source,builtin=false){state.scene=source;$('scene').src=source;$('builtin-scene').classList.toggle('selected',builtin);}
function getImage(file){
  return new Promise((resolve,reject)=>{
    if(!file || file.size>16000000){reject(new Error('请选择 16 MB 以内的图片。'));return;}
    const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);if(image.naturalWidth*image.naturalHeight>18000000)reject(new Error('图片分辨率较大，请先缩小后选择。'));else resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('无法读取这张图片，请尝试 PNG 或 JPG。'));};image.src=url;
  });
}
function encode(image,{sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight,width=288,height=312,cover=false}={}){
  for(let attempt=0;attempt<5;attempt++){
    const canvas=document.createElement('canvas');canvas.width=Math.round(width);canvas.height=Math.round(height);const context=canvas.getContext('2d');
    const scale=cover?Math.max(width/sw,height/sh):Math.min(width/sw,height/sh),dw=sw*scale,dh=sh*scale;
    context.drawImage(image,sx,sy,sw,sh,(width-dw)/2,(height-dh)/2,dw,dh);
    const data=canvas.toDataURL('image/png');if((data.length-22)*.75<=210000)return data;
    width*=.8;height*=.8;
  }
  throw new Error('图片压缩后仍偏大，请尝试更简单的图片。');
}
function setBusy(busy){state.busy=busy;$('save').disabled=busy;$('save').textContent=busy?'正在保存…':'保存，等待手表同步';}
$('name').addEventListener('input',greet);$('nickname').addEventListener('input',greet);
$('pet-stage').addEventListener('click',()=>animate('waving'));
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>animate(button.dataset.action)));
document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{$('speech').textContent=button.dataset.status+'（预览数值）';}));
$('preview-settings').addEventListener('click',()=>{$('editor').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});$('name').focus({preventScroll:true});});
$('preview-chat').addEventListener('click',()=>{$('speech').textContent='聊天入口保留，聊天页面本轮不调整。';});
$('avatar-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{status('正在手机上处理图片…');const image=await getImage(file),frame=encode(image);clearInterval(state.animation);state.pendingFrames={idle:[frame]};state.frames={idle:[frame],waving:[frame],jumping:[frame],waiting:[frame],review:[frame]};showFrame(frame);$('avatar-label').textContent=file.name+' · 静态形象';status('形象已准备好，保存后同步到手表。');}
  catch(error){status(error.message,true);}
});
$('atlas-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    status('正在切分动作图集…');const image=await getImage(file);
    if(image.naturalWidth%8 || image.naturalHeight%11)throw new Error('图集需要是 8 列 × 11 行，宽高分别可被 8 和 11 整除。');
    const sw=image.naturalWidth/8,sh=image.naturalHeight/11;if(sw<64 || sh<64 || Math.abs(sw/sh-192/208)>.12)throw new Error('单格宽高比例应接近 192:208。');
    const layout={idle:[0,6],waving:[3,4],jumping:[4,5],waiting:[6,6],review:[8,6]},frames={};
    for(const [name,[row,count]]of Object.entries(layout)){frames[name]=[];for(let index=0;index<count;index++){frames[name].push(encode(image,{sx:index*sw,sy:row*sh,sw,sh,width:192,height:208}));}await new Promise(resolve=>requestAnimationFrame(resolve));}
    clearInterval(state.animation);state.pendingFrames=frames;state.frames=frames;showFrame(frames.idle[0]);$('avatar-label').textContent=file.name+' · 已准备 27 帧动作';status('动作图集已准备好，保存后同步到手表。');
  }catch(error){status(error.message,true);}
});
$('scene-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{status('正在手机上处理背景…');const image=await getImage(file),scene=encode(image,{width:432,height:514,cover:true});state.pendingScene=scene;selectScene(scene);$('scene-label').textContent=file.name;status('背景已准备好，保存后同步到手表。');}
  catch(error){status(error.message,true);}
});
$('builtin-scene').addEventListener('click',()=>{state.pendingScene='builtin';selectScene(state.builtin.scene,true);$('scene-label').textContent='使用内置场景';});
$('save').addEventListener('click',async()=>{
  if(state.busy)return;if(!state.id){status('请先用手机扫描手表设置页上的配对二维码。',true);return;}
  const name=$('name').value.trim(),nickname=$('nickname').value.trim();if(!name || !nickname){status('请先填写角色名字和对你的称呼。',true);return;}
  setBusy(true);status('正在保存到配套服务…');
  try{
    const response=await api('/api/pairs/'+state.id+'/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,nickname,frames:state.pendingFrames,scene:state.pendingScene})});
    const data=await response.json();state.revision=data.revision;state.pendingFrames=null;state.pendingScene=null;status('已保存。手表保持在自定义页面，正在等待同步确认。');
  }catch(error){status(error.message,true);}finally{setBusy(false);}
});
async function load(){
  try{
    const response=await api('/builtin/manifest');state.builtin=await response.json();state.frames=state.builtin.animations;selectScene(state.builtin.scene,true);$('name').value=state.builtin.name;$('nickname').value=state.builtin.nickname;showFrame(state.frames.idle[0]);greet();
    if(state.id){
      const response=await api('/api/pairs/'+state.id+'/manifest'),data=await response.json();$('connection').textContent='已配对 · '+state.id.slice(-4);$('intro').textContent='修改后保存，手表停留在自定义页即可同步。无需重新安装应用。';status('已连接你的手表配置。修改完成后点保存。');
      if(data.manifest){
        const manifest=data.manifest,frames={};const sources={};
        for(const asset of manifest.files){const response=await api('/api/pairs/'+state.id+'/assets/'+asset.name),url=URL.createObjectURL(await response.blob());state.blobs.push(url);sources[asset.name]=url;}
        for(const [name,items]of Object.entries(manifest.animations))frames[name]=items.map(name=>sources[name]);state.frames=frames;showFrame(frames.idle[0]);
        if(manifest.scene){selectScene(sources[manifest.scene]);$('scene-label').textContent='已保存的自定义背景';}
        $('name').value=manifest.name;$('nickname').value=manifest.nickname;$('avatar-label').textContent='已保存的角色形象';greet();state.revision=manifest.revision;
        if(data.lastSynced===manifest.revision)status('手表已确认当前配置。可以继续修改。');
      }
    }
  }catch(error){status(error.message || '未能读取配置，请刷新重试。',true);}
}
setInterval(async()=>{
  if(!state.id || !state.revision || state.busy || document.hidden)return;
  try{const data=await (await api('/api/pairs/'+state.id+'/manifest')).json();if(data.lastSynced===state.revision)status('手表已确认同步完成，返回小屋看看吧。');}catch{}
},4000);
window.addEventListener('pagehide',()=>{clearInterval(state.animation);state.blobs.forEach(url=>URL.revokeObjectURL(url));});
window.addEventListener('hashchange',()=>location.reload());
load();
