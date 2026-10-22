// 本地单字拼音输入。词频和多音词预测不依赖联网服务。
function candidates(dictionary, composition, offset) {
  if (!composition) return {items:[], total:0};
  const syllables=Object.keys(dictionary).filter(key => composition.indexOf(key)===0).sort((a,b)=>b.length-a.length);
  const syllable=syllables[0];
  if (!syllable) return {items:[],total:0};
  const chars=dictionary[syllable].split('');
  return {items:chars.slice(offset,offset+5).map(char=>({char,syllable})), total:chars.length};
}
module.exports={candidates};
