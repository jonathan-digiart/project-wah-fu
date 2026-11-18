globalThis.__protectedCombinedEntry=true;
import {runDirectEntry} from './protected-combined-entry-core.mjs';
import {createDirectEntryUI} from './direct-entry-ui.mjs';
const ui=createDirectEntryUI(document);
await runDirectEntry({href:location.href,...ui,importModule:which=>which==='reference'?import('../estate-refined/reference.js'):import('./protected-combined-viewer.js')});
