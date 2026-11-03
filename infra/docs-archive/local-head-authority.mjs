// Nonproduction Git-backed authority rehearsal. No remote transport or live
// protection is implemented. Keep the independently pinned anchor off storage.
import {execFileSync} from 'node:child_process';
import {isAbsolute} from 'node:path';
const ref='refs/heads/checkpoint-authority',file='checkpoint-head.json';
const digest=/^[a-f0-9]{64}$/,object=/^[a-f0-9]{40}$/;
function need(ok,message){if(!ok)throw Error(message);}
function git(path,args,input){
 try{return execFileSync('git',['--git-dir',path,...args],{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:15000,maxBuffer:2*1024*1024,env:{...process.env,GIT_AUTHOR_NAME:'Nonproduction checkpoint rehearsal',GIT_AUTHOR_EMAIL:'rehearsal@example.invalid',GIT_COMMITTER_NAME:'Nonproduction checkpoint rehearsal',GIT_COMMITTER_EMAIL:'rehearsal@example.invalid'}}).trim();}
 catch{throw Error(`Local authority git ${args[0]} failed`);}
}
function config({mode,authorityPath,family,framework}){
 need(mode==='nonproduction','Production head authority is not configured');
 need(isAbsolute(authorityPath||'')&&['martlet','krigsvold'].includes(family)&&['astro','react','jekyll'].includes(framework),'Invalid authority identity');
 need(git(authorityPath,['rev-parse','--is-bare-repository'])==='true','Authority requires a separate bare repository');
 need(git(authorityPath,['remote'])==='','Nonproduction authority must have no remote');
 return {authorityPath,family,framework};
}
function record(c,sequence,checkpointSha256,previousCommit){return {schemaVersion:1,family:c.family,framework:c.framework,sequence,checkpointSha256,previousCommit};}
function commitRecord(c,value,parent){
 const blob=git(c.authorityPath,['hash-object','-w','--stdin'],JSON.stringify(value)+'\n');
 const tree=git(c.authorityPath,['mktree'],`100644 blob ${blob}\t${file}\n`);
 return git(c.authorityPath,['commit-tree',tree,...(parent?['-p',parent]:[]),'-m',`Nonproduction checkpoint authority ${value.sequence}`]);
}
export function initializeLocalHeadAuthority(options){
 const c=config(options);let existing='';
 try{existing=git(c.authorityPath,['show-ref','--verify','--hash',ref]);}catch{}
 need(!existing,'Authority is already initialized');
 const anchorCommit=commitRecord(c,record(c,0,null,null),null);
 // All-zero expected old value gives create-only initialization.
 git(c.authorityPath,['update-ref',ref,anchorCommit,'0'.repeat(40)]);
 return {anchorCommit,ref};
}
export function localHeadAuthority(options){
 const c=config(options),anchor=options.anchorCommit;
 need(object.test(anchor||''),'Independently pinned bootstrap commit required');
 function readState(){
  const tip=git(c.authorityPath,['show-ref','--verify','--hash',ref]);
  need(object.test(tip),'Missing authority tip');
  const entries=[];let at=tip;
  for(let count=0;count<=1000;count++){
   const tree=git(c.authorityPath,['ls-tree',at]);
   need(/^100644 blob [a-f0-9]{40}\tcheckpoint-head\.json$/.test(tree),'Unexpected authority tree');
   let value;try{value=JSON.parse(git(c.authorityPath,['show',`${at}:${file}`]));}catch{throw Error('Invalid authority record');}
   need(value.schemaVersion===1&&value.family===c.family&&value.framework===c.framework&&Number.isSafeInteger(value.sequence)&&value.sequence>=0,'Authority identity mismatch');
   const parents=git(c.authorityPath,['rev-list','--parents','-n','1',at]).split(' ').slice(1);
   if(at===anchor){
    need(parents.length===0&&value.sequence===0&&value.checkpointSha256===null&&value.previousCommit===null,'Invalid authority bootstrap');
    for(let i=0;i<entries.length;i++)need(entries[i].value.sequence===entries.length-i,'Authority sequence discontinuity');
    return {tip,value:entries[0]?.value??value};
   }
   need(parents.length===1&&value.previousCommit===parents[0]&&digest.test(value.checkpointSha256||''),'Authority parent or checkpoint mismatch');
   entries.push({commit:at,value});at=parents[0];
  }
  throw Error('Authority history exceeds rehearsal bound or lacks pinned bootstrap');
 }
 return {
  readHead:async()=>readState().value.checkpointSha256,
  compareAndSwapHead:async(previous,next)=>{
   need(previous===null||digest.test(previous||''),'Invalid expected head');
   need(digest.test(next||'')&&next!==previous,'Invalid next head');
   const current=readState();if(current.value.checkpointSha256!==previous)return false;
   const nextCommit=commitRecord(c,record(c,current.value.sequence+1,next,current.tip),current.tip);
   try{git(c.authorityPath,['update-ref',ref,nextCommit,current.tip]);}catch{return false;}
   return true;
  }
 };
}
