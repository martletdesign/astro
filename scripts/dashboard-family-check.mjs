import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
// Ordinary independently installed starters require no build-only family variable.
export async function checkDashboardFamily(directory,family) {
  assert.ok(['martlet','krigsvold'].includes(family));
  for(const kind of ['administration','operations','analytics']) {
    const html=await readFile(join(directory,`examples/dashboard-${kind}/index.html`),'utf8');
    assert.doesNotMatch(html,/--undefined-|data-family="undefined"/);
    assert.match(html,new RegExp(`data-family="${kind==='analytics'?family[0]:family}"`));
    assert.match(html,new RegExp(`--dash-chart-primary:var\\(--${family}-chart-1\\)`));
    assert.match(html,new RegExp(`--${kind==='analytics'?'a':'ex'}-text:var\\(--${family}-text\\)`));
  }
}
