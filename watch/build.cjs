// 使用官方构建器 API，避免仅打包时也初始化用户目录中的模拟器。
const Builder=require('aiot-toolkit/lib/builder/VelaUxBuilder').default;
const {CompileMode}=require('@aiot-toolkit/aiotpack');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
async function main() {
  const release=path.join(__dirname,'sign','release'),debug=path.join(__dirname,'sign','debug');
  fs.mkdirSync(release,{recursive:true});fs.mkdirSync(debug,{recursive:true});
  const privateKey=path.join(release,'private.pem'),certificate=path.join(release,'certificate.pem');
  if(!fs.existsSync(privateKey) || !fs.existsSync(certificate)) {
    if(fs.existsSync(privateKey) || fs.existsSync(certificate))throw new Error('Signing files are incomplete; restore the original signing pair before building.');
    execFileSync('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',privateKey,'-x509','-days','3650','-out',certificate,'-subj','/CN=WatchPet Example/O=WatchPet/C=CN'],{stdio:'ignore'});
  }
  fs.chmodSync(privateKey,0o600);
  fs.copyFileSync(privateKey,path.join(debug,'private.pem'));fs.copyFileSync(certificate,path.join(debug,'certificate.pem'));
  fs.chmodSync(path.join(debug,'private.pem'),0o600);
  let success=false;
  const builder=new Builder({
    onBuildSuccess(data) {success=true;console.log('RPK:',data.info && data.info.rpk || 'dist/');},
    onBuildError(error) {console.error(error);process.exitCode=1;}
  });
  await builder.build(__dirname,{mode:process.argv.includes('--release')?CompileMode.PRODUCTION:CompileMode.DEVELOPMENT});
  await builder.dispose();
  if(!success || !fs.existsSync(__dirname+'/dist') || !fs.readdirSync(__dirname+'/dist').some(name=>name.endsWith('.rpk')))throw new Error('RPK build did not complete');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
