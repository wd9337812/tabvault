import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'node_modules/@tailwindcss/cli/dist/index.mjs'),'-i',path.join(root,'ui/src/style.css'),'-o',path.join(root,'sidepanel.css'),'--minify'],{cwd:root,stdio:'inherit'});
await build({absWorkingDir:root,entryPoints:[path.join(root,'ui/src/main.jsx')],outfile:path.join(root,'sidepanel.js'),bundle:true,minify:true,format:'iife',target:'chrome116',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'inline'});
console.log('Production side panel built with local scripts and styles.');
