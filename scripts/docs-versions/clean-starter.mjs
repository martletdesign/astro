import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
// npm's package allowlist can include nested generated trees; reject them before packing.
export async function assertCleanStarter(root) {
  for (const entry of await readdir(root, {withFileTypes:true})) {
    if (entry.isSymbolicLink() || ['node_modules','dist','.astro'].includes(entry.name) || entry.name.endsWith('.tgz')) throw Error(`Generated or linked starter input is not allowed: ${join(root,entry.name)}`);
    if (entry.isDirectory()) await assertCleanStarter(join(root,entry.name));
    else if (!entry.isFile()) throw Error(`Unsupported starter input: ${join(root,entry.name)}`);
  }
}
