const sync=require('./sync');
function connection(app,legacy) {
  const pair=app.sync || {};
  if(/^[a-f0-9]{16}$/.test(pair.id) && /^[a-f0-9]{48}$/.test(pair.deviceToken)) {
    try{return {url:sync.normalizeBase(pair.baseUrl)+'/api/devices/'+pair.id+'/chat',token:pair.deviceToken,paired:true}}catch(e){}
  }
  if(legacy && legacy.serviceUrl && legacy.deviceToken)return {url:legacy.serviceUrl,token:legacy.deviceToken,paired:false};
  return null;
}
function errorMessage(code,error) {
  if(code===401)return '配对已失效或令牌不匹配，请到设置重新检查配对。';
  if(code===503)return 'AI 尚未配置，请先在电脑上的 server/.env 填写模型配置并重启服务。';
  if(code===429 || error==='provider_rate_limited')return '请求有点频繁，稍等一会儿再发送。';
  if(error==='provider_auth_failed')return '模型密钥无效或无权限，请检查电脑上的 API 密钥。';
  if(error==='provider_balance_required')return '模型服务余额不足，请检查 API 账户。';
  if(error==='provider_timeout')return '模型回复超时了，请稍后点发送重试。';
  if(error==='provider_unreachable')return '电脑暂时连不上模型服务，请检查电脑网络。';
  if(error==='empty_provider_response' || error==='invalid_provider_response')return '模型没有返回有效文字，请检查模型名和接口设置。';
  if(code===400)return '消息格式有误，请缩短内容后重试。';
  return '暂时连不上聊天服务，请检查手机连接和电脑服务。';
}
module.exports={connection,errorMessage};
