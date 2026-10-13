import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render real component markup without a browser. Interaction transitions are
// covered by workspaceMenu tests; this does not claim browser/layout/GPU QA.
const result=await build({stdin:{contents:`export {App} from './src/App.jsx';export {CategoryNavigation} from './src/CategoryNavigation.jsx';export {StageLibrary} from './src/StageLibrary.jsx';export {CategoryPager} from './src/CategoryPager.jsx';`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',write:false,logLevel:'silent'});
const mod={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {App,CategoryNavigation,StageLibrary,CategoryPager}=mod.exports;

test('real workspace markup places labeled technical disclosures above the five creative controls',()=>{
  const html=renderToStaticMarkup(createElement(App));
  const project=html.indexOf('id="menu-trigger-project"'),inspect=html.indexOf('id="menu-trigger-inspect"'),render=html.indexOf('id="menu-trigger-render"');
  assert.ok(project>0&&project<inspect&&inspect<render&&render<html.indexOf('id="category-tab-product"'));
  assert.ok(html.includes('<span>Progetto</span>'));assert.ok(html.includes('<span>Ispeziona</span>'));assert.ok(html.includes('<span>Render</span>'));
  assert.equal((html.match(/class="technical-rail"/g)||[]).length,1);
  assert.equal((html.match(/<button[^>]*id="(?:menu-trigger|category-tab)-[^"]+"[^>]*aria-expanded="true"/g)||[]).length,1);
  assert.ok(html.includes('id="controls-product"'));assert.ok(!html.includes('id="controls-scene"'));
});

test('creative indicators are neutral while their menu is closed and only the selected region is mounted',()=>{
  const html=renderToStaticMarkup(createElement(CategoryNavigation,{active:'scene',opened:false,onChange(){},onToggle(){}}));
  assert.equal((html.match(/aria-expanded="false"/g)||[]).length,5);assert.ok(!html.includes('class="active"'));
  const children=['MAT','ENV','LIGHT','CAM','FX'].map(text=>createElement('p',{key:text},text));
  const panel=renderToStaticMarkup(createElement(CategoryPager,{active:'camera'},children));
  assert.ok(panel.includes('id="controls-camera"'));assert.ok(panel.includes('<p>CAM</p>'));assert.ok(!panel.includes('<p>ENV</p>'));
});

test('scene selector renders ten readable entries per concept collection without raster previews',()=>{
  for(const selected of ['black-softbox','neon-rain-cathedral']){
    const html=renderToStaticMarkup(createElement(StageLibrary,{selected,onChoose(){},disabled:false}));
    assert.equal((html.match(/class="stage-number"/g)||[]).length,10);
    assert.equal((html.match(/aria-pressed="true"/g)||[]).length,2);
    assert.ok(!html.includes('<canvas'));assert.ok(!html.includes('<img'));
  }
});
