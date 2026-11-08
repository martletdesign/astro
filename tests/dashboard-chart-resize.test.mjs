import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chart} from '../reference/page-archetypes/jekyll/assets/js/dashboard-ui.mjs';

class Node {
 constructor(){this.children=[];this.attributes={};this.textContent='';}
 append(node){this.children.push(node);}
 replaceChildren(){this.children=[];}
 setAttribute(name,value){this.attributes[name]=String(value);}
 insertRow(){const row=new Node();this.append(row);return row;}
}

test('chart resize uses consistent width, defers/coalesces DOM writes and renders latest data',()=>{
 const prior={document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame};
 const mount=new Node();Object.assign(mount,{clientWidth:320,isConnected:true});
 const table={tHead:null,tBodies:[],createTHead(){return this.tHead=new Node()},createTBody(){const body=new Node();this.tBodies.push(body);return body}};
 const summary=new Node();const root={querySelector(selector){return selector.startsWith('[data-chart=')?mount:selector.startsWith('[data-chart-table=')?table:summary}};
 let observed,observer;const frames=[];
 try{
  globalThis.document={createElement:()=>new Node(),createElementNS:()=>new Node()};
  globalThis.ResizeObserver=class{constructor(callback){observer=callback}observe(node){observed=node}};
  globalThis.requestAnimationFrame=callback=>{frames.push(callback);return frames.length};
  chart(root,'sessions',[{label:'Old',value:1}],{label:'Initial sessions'});
  assert.equal(observed,mount);const initial=mount.children[0];
  // Content-box measurement can differ from clientWidth due to mount padding.
  // Height-only notifications must not perpetually redraw the observed mount.
  observer([{contentRect:{width:280}}]);assert.equal(frames.length,0);assert.equal(mount.children[0],initial);
  mount.clientWidth=400;observer([{contentRect:{width:360}}]);
  mount.clientWidth=440;observer([{contentRect:{width:400}}]);
  assert.equal(frames.length,1);assert.equal(mount.children[0],initial,'observer delivery must not mutate observed SVG');
  chart(root,'sessions',[{label:'Newest',value:2},{label:'Current',value:3}],{label:'Latest sessions'});
  frames[0]();assert.equal(mount.children[0].attributes['aria-label'],'Latest sessions. 2 data points. Exact values are in the following data table.');
  assert.match(mount.children[0].attributes.viewBox,/^0 0 440 /);
  const rendered=mount.children[0];observer([{contentRect:{width:400}}]);assert.equal(frames.length,1);assert.equal(mount.children[0],rendered);
  mount.clientWidth=500;observer([{contentRect:{width:460}}]);assert.equal(frames.length,2);
  mount.isConnected=false;frames[1]();assert.equal(mount.children[0],rendered,'late observer work must not draw into detached route');
 }finally{Object.assign(globalThis,prior)}
});
