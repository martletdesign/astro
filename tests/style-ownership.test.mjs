import test from 'node:test';
import {checkSources} from '../reference/scripts/style-audit.mjs';
test('reference markup has no inline or component-local CSS',async()=>{await checkSources(['src','reference/src','reference/page-archetypes']);});
