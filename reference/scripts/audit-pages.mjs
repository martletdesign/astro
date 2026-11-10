import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {checkPages} from './style-audit.mjs';
await checkPages('dist');

// A successful build must include the workspace supplied through the page slot.
const scientific=await readFile('dist/examples/scientific-workspace/index.html','utf8');
for (const marker of ['data-science-form','id="science-initial"','id="science-ambient"','id="science-timeConstant"','id="science-duration"','Run calculation','Download results CSV','<svg','<tbody']) {
  assert.ok(scientific.includes(marker), `Scientific workspace is missing ${marker}`);
}
