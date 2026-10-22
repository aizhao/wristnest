// Vela 的虚拟列表需要明确的行尺寸；给自动换行预留空间，不截断原文。
const TEXT_WIDTH=360;
const LINE_HEIGHT=30;
function characterWidth(char) {
  if(char==='\t')return 56;
  if(char.codePointAt(0)>0xffff)return 32;
  if(/[A-Zmw@%&]/.test(char))return 24;
  return char.charCodeAt(0)<128?14:24;
}
function contentHeight(content) {
  let lines=1,width=0;
  for(const char of String(content)) {
    if(char==='\n'){lines++;width=0;continue;}
    const size=characterWidth(char);
    if(width+size>TEXT_WIDTH-4){lines++;width=0;}
    width+=size;
  }
  // 多留一行，容纳不同固件字体与词语换行的差异。
  return (lines+1)*LINE_HEIGHT;
}
function messageRows(history) {
  return history.map(item=>{
    const textHeight=contentHeight(item.content);
    return {role:item.role,content:item.content,textHeight,cardHeight:textHeight+48,rowHeight:textHeight+56};
  });
}
module.exports={messageRows};
