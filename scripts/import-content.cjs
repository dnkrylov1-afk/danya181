// Idempotent import of existing content. Does NOT overwrite already edited /pages.
// All source-content files stay outside public/ so unauthorized visitors cannot download them.
"use strict";
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const admin=require('firebase-admin');
const BASE=path.resolve(__dirname,'..');
const URL='https://kvantastika-knowledge-base-default-rtdb.europe-west1.firebasedatabase.app';
admin.initializeApp({credential:admin.credential.applicationDefault(),databaseURL:URL});
const sandbox={window:{}};
vm.createContext(sandbox,{codeGeneration:{strings:false,wasm:false}});
for(const f of ['data-full.js','data-install.js','data-tech.js','data-templates.js']){
  const src=fs.readFileSync(path.join(BASE,'source-content',f),'utf8');
  vm.runInContext(src,sandbox,{filename:f,timeout:10000});
}
(async()=>{
  const pageDefs={...sandbox.window.fullPages,...sandbox.window.installPages,...sandbox.window.techPages};
  const ref=admin.database().ref();
  const [existingPages,existingTitles,existingTemplates]=await Promise.all([
    ref.child('pages').get(),ref.child('pageTitles').get(),ref.child('templates').get()
  ]);
  const savedPages=existingPages.val()||{};
  const savedTitles=existingTitles.val()||{};
  const changes={};let imported=0;
  for(const [id,page] of Object.entries(pageDefs)){
    if(!page||typeof page.html!=='string'||typeof page.title!=='string')continue;
    if(!Object.prototype.hasOwnProperty.call(savedPages,id)){
      changes[`pages/${id}`]=page.html;
      imported++;
    }
    if(!Object.prototype.hasOwnProperty.call(savedTitles,id)) changes[`pageTitles/${id}`]=page.title;
  }
  if(!existingTemplates.exists()) changes.templates=JSON.parse(JSON.stringify(sandbox.window.templateData||{}));
  if(Object.keys(changes).length) await ref.update(changes);
  console.log(`Импортировано ${imported} новых страниц; всего в исходниках ${Object.keys(pageDefs).length}. Уже изменённые страницы сохранены.`);
  console.log('Шаблоны сообщений:',existingTemplates.exists()?'уже были в БД':'импортированы');
})().catch(e=>{console.error(e);process.exitCode=1});
