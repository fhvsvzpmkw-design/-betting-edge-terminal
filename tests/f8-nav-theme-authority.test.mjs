import assert from 'node:assert/strict';
import fs from 'node:fs';

const primaryNav=fs.readFileSync(new URL('../assets/primary-nav-shell.js',import.meta.url),'utf8');
const resultsDesk=fs.readFileSync(new URL('../assets/results-desk-ui.js',import.meta.url),'utf8');

assert.match(primaryNav,/data-view=\\?"engine\\?"[^\n]*border-color:#6f8faa!important/,'F8 menu tile must keep the canonical steel border');
assert.match(primaryNav,/data-primary-view=\\?"engine\\?"[^\n]*border-color:#6f8faa!important/,'F8 active header must keep the canonical steel border');
assert.match(primaryNav,/color:#c7d2dc!important/,'F8 canonical steel text color is missing');
assert.match(primaryNav,/background:#09131d!important/,'F8 canonical steel background is missing');

assert.doesNotMatch(resultsDesk,/runnerNavPad/,'Results Desk must not style or mutate the primary navigation shell');
assert.doesNotMatch(resultsDesk,/primaryShellActive|primaryMenuMessage|primaryShellMessage/,'Results Desk must not own F8 navigation presentation');

console.log('F8 navigation theme authority regression checks passed');
