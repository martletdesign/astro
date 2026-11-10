import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
// Ordinary independently installed reference apps require no build-only family variable.
export async function checkDashboardFamily(directory,family) {
  assert.ok(['martlet','krigsvold'].includes(family));
  for(const kind of ['administration','operations','analytics']) {
    const html=await readFile(join(directory,`examples/dashboard-${kind}/index.html`),'utf8');
    assert.doesNotMatch(html,/<style\b|\sstyle\s*=|--undefined-|data-family="undefined"/i);
    assert.match(html,/assets\/css\/martlet\.css/);
    if(kind==='analytics') assert.match(html,/role="region" aria-label="Analytics source records table"/);
    assert.match(html,new RegExp(`data-family="${kind==='analytics'?family[0]:family}"`));
  }
}
