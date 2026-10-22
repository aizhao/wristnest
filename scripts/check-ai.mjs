import {providerConfig,validateChat,generateReply} from '../server/index.mjs';
try{
  const config=providerConfig();
  const reply=await generateReply(validateChat({text:'你好，请用一句简短的话和我打个招呼。'}),config);
  console.log('AI 真实接口验证成功：'+reply.text);
}catch(error){
  const messages={model_not_configured:'先在 server/.env 填写 AI_BASE_URL、AI_MODEL 和 AI_API_KEY。',provider_auth_failed:'模型密钥无效或无权限，请检查 AI_API_KEY。',provider_balance_required:'模型服务余额不足，请检查 API 账户。',provider_rate_limited:'模型服务限流，请稍后重试。',provider_timeout:'模型响应超时，请检查网络或稍后重试。',provider_unreachable:'电脑无法连接模型服务，请检查电脑网络。',empty_provider_response:'模型未返回有效文字，请检查模型名和思考模式配置。',invalid_provider_response:'接口未返回兼容的 JSON 响应。'};
  console.error('AI 验证未完成：'+(messages[error.code] || '请检查接口配置；没有输出原始错误或密钥。'));
  process.exitCode=1;
}
