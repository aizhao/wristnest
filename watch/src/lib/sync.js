const profiles=require('./profile');
function normalizeBase(value) {
  const base=String(value || '').trim().replace(/\/+$/,'');
  const match=base.match(/^(https?):\/\/([a-zA-Z0-9.-]+)(:\d{1,5})?(\/[a-zA-Z0-9/_-]*)?$/);
  if(!match || base.length>180 || base.indexOf('/../')>=0)throw new Error('invalid_address');
  const host=match[2];
  const local=host==='localhost' || host==='127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.local$/.test(host);
  if(match[1]!=='https' && !local)throw new Error('https_required');
  return base;
}
function requestJson(fetchApi,url,token,body) {
  return new Promise((resolve,reject)=>{
    let settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('timeout'))}},20000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value)};
    try{fetchApi.fetch({url,method:body?'POST':'GET',header:{'Content-Type':'application/json',Authorization:token?'Bearer '+token:''},data:body?JSON.stringify(body):'',responseType:'json',success:response=>{
      let data=response.data;try{if(typeof data==='string')data=JSON.parse(data)}catch(e){finish(new Error('invalid_response'));return}
      if(response.code!==200 && response.code!==201){finish(new Error(response.code===401?'unauthorized':response.code===404?'not_published':'request_failed'));return}finish(null,data)
    },fail:()=>finish(new Error('network_failed'))})}catch(e){finish(e)}
  });
}
function downloadFile(requestApi,fileApi,url,token,entry) {
  return new Promise((resolve,reject)=>{
    let finished=false;const timer=setTimeout(()=>finish(new Error('download_timeout')),35000);
    const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve()};
    const target='internal://files/rolepack/'+entry.name;
    requestApi.download({url,header:JSON.stringify({Authorization:'Bearer '+token}),filename:entry.name,success:task=>{
      requestApi.onDownloadComplete({token:task.token,success:download=>{
        if(finished)return;
        fileApi.copy({srcUri:download.uri,dstUri:target,success:()=>{
          fileApi.get({uri:target,success:info=>finish(info.length===entry.bytes?null:new Error('incomplete_file')),fail:()=>finish(new Error('file_check_failed'))});
          fileApi.delete({uri:download.uri,success:()=>{},fail:()=>{}});
        },fail:()=>finish(new Error('file_copy_failed'))});
      },fail:()=>finish(new Error('download_failed'))});
    },fail:()=>finish(new Error('download_failed'))});
  });
}
function cleanup(fileApi,app) {
  const keep={};
  [app.customProfile,app.previousProfile].forEach(profile=>{
    if(!profile)return;
    if(profile.scene)keep[profile.scene]=true;
    if(profile.animations)Object.keys(profile.animations).forEach(key=>profile.animations[key].forEach(uri=>{keep[uri]=true}));
  });
  return new Promise(resolve=>fileApi.list({uri:'internal://files/rolepack/',success:result=>{
    const files=(result.fileList || []).filter(item=>/^internal:\/\/files\/rolepack\/[a-f0-9]{32}\.png$/.test(item.uri) && !keep[item.uri]);
    let pending=files.length;if(!pending){resolve();return}
    files.forEach(item=>fileApi.delete({uri:item.uri,complete:()=>{if(--pending===0)resolve()}}));
  },fail:()=>resolve()}));
}
async function syncProfile(apis,app,progress) {
  const base=normalizeBase(app.sync.baseUrl),id=app.sync.id,token=app.sync.deviceToken;
  if(!/^[a-f0-9]{16}$/.test(id) || !token)throw new Error('pair_first');
  const manifest=profiles.validateRemote(await requestJson(apis.fetch,base+'/api/devices/'+id+'/manifest',token));
  const ack=()=>requestJson(apis.fetch,base+'/api/devices/'+id+'/ack',token,{revision:manifest.revision}).then(()=>true).catch(()=>false);
  if(app.customProfile && app.customProfile.revision===manifest.revision){if(app.sync.lastAck!==manifest.revision && await ack())app.sync.lastAck=manifest.revision;return false;}
  await new Promise(resolve=>apis.file.mkdir({uri:'internal://files/rolepack',recursive:true,success:resolve,fail:resolve}));
  await cleanup(apis.file,app);
  for(let index=0;index<manifest.files.length;index++){
    progress(index+1,manifest.files.length);
    const entry=manifest.files[index];
    await downloadFile(apis.request,apis.file,base+'/api/devices/'+id+'/assets/'+entry.name,token,entry);
  }
  const previous=app.customProfile,older=app.previousProfile;
  app.customProfile=profiles.localize(manifest);app.previousProfile=previous;
  await new Promise((resolve,reject)=>app.save(ok=>{
    if(ok)resolve();else{app.customProfile=previous;app.previousProfile=older;reject(new Error('save_failed'))}
  }));
  if(await ack())app.sync.lastAck=manifest.revision;
  return true;
}
module.exports={normalizeBase,requestJson,syncProfile,cleanup};
