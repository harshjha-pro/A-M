import fs from 'fs';
import path from 'path';
const WEB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../web/node_modules');
const esbuild = await import(WEB + '/esbuild/lib/main.js');
const out = process.argv[2];
const shim = { name: 'globals', setup(b) {
  b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: a.path, namespace: 'g' }));
  b.onLoad({ filter: /.*/, namespace: 'g' }, (a) => ({
    contents: a.path === 'react/jsx-runtime' ? 'const R=window.React;export const Fragment=R.Fragment;export function jsx(t,p,k){const{children,...r}=p||{};return k!==undefined&&(r.key=k),children===undefined?R.createElement(t,r):Array.isArray(children)?R.createElement(t,r,...children):R.createElement(t,r,children)};export const jsxs=jsx;'
      : a.path.startsWith('react-dom') ? 'module.exports=window.ReactDOM' : 'module.exports=window.React', loader: 'js' }));
} };
const r = await esbuild.build({ entryPoints: [new URL('./index.jsx', import.meta.url).pathname], bundle: true, format: 'iife', globalName: '__AM', minify: true, write: false,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [shim], nodePaths: [WEB], legalComments: 'none', metafile: true });
let code = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const names = JSON.parse(fs.readFileSync(new URL('./components.json', import.meta.url))).map((name) => ({ name }));
const header = '/* @ds-bundle: ' + JSON.stringify({ format: 4, namespace: 'AM', components: names }) + ' */\n';
fs.writeFileSync(out, header + code + '\nwindow.AM=__AM;\n');
console.log('bundle', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
