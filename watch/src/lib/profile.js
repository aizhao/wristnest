const STATES=['idle','waving','jumping','waiting','review'];
function cleanName(value,fallback,max) { const text=typeof value==='string'?value.trim().replace(/[\x00-\x1f\x7f<>\u202a-\u202e\u2066-\u2069]/g,'').slice(0,max):'';return text || fallback; }
function personalize(line,profile) { return String(line).split('朋友').join(profile.nickname || '朋友').split('{nickname}').join(profile.nickname || '朋友').split('{name}').join(profile.name || '小伴'); }
function activeProfile(builtin,custom) {
  if(!custom || custom.schema!==1 || !custom.animations || !Array.isArray(custom.animations.idle) || !custom.animations.idle.length)return builtin;
  const allowed=uri=>typeof uri==='string' && /^internal:\/\/files\/rolepack\/[a-zA-Z0-9_-]+\.png$/.test(uri);
  if(!STATES.every(state=>Array.isArray(custom.animations[state]) && custom.animations[state].length>=1 && custom.animations[state].length<=8 && custom.animations[state].every(allowed)))return builtin;
  if(custom.scene && !allowed(custom.scene))return builtin;
  return {schema:1,name:cleanName(custom.name,'小伴',12),nickname:cleanName(custom.nickname,'朋友',12),scene:custom.scene || builtin.scene,animations:custom.animations};
}
function validateRemote(data) {
  if(!data || data.schema!==1 || !/^[a-f0-9]{16}$/.test(data.revision) || !Array.isArray(data.files) || data.files.length<1 || data.files.length>41)throw new Error('invalid_manifest');
  const names={};let total=0;
  data.files.forEach(file=>{
    if(!file || !/^[a-f0-9]{32}\.png$/.test(file.name) || names[file.name] || !Number.isInteger(file.bytes) || file.bytes<50 || file.bytes>220000)throw new Error('invalid_asset');
    names[file.name]=true;total+=file.bytes;
  });
  if(total>3600000)throw new Error('pack_too_large');
  if(!data.animations || !Array.isArray(data.animations.idle) || !data.animations.idle.length)throw new Error('missing_idle');
  STATES.forEach(state=>{
    const frames=data.animations[state] || data.animations.idle;
    if(!Array.isArray(frames) || !frames.length || frames.length>8 || frames.some(name=>!names[name]))throw new Error('invalid_frames');
  });
  if(data.scene && !names[data.scene])throw new Error('invalid_scene');
  return data;
}
function localize(data) {
  validateRemote(data);
  const result={schema:1,revision:data.revision,name:cleanName(data.name,'小伴',12),nickname:cleanName(data.nickname,'朋友',12),scene:data.scene?'internal://files/rolepack/'+data.scene:'',animations:{}};
  STATES.forEach(state=>{result.animations[state]=(data.animations[state] || data.animations.idle).map(name=>'internal://files/rolepack/'+name);});
  return result;
}
module.exports={STATES,cleanName,personalize,activeProfile,validateRemote,localize};
