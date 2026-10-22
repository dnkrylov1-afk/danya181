// Run locally ONCE with ADC/service account credentials. Never put service account keys in Hosting.
"use strict";
const admin=require('firebase-admin');
const {randomInt}=require('node:crypto');
const readline=require('node:readline/promises');
const {stdin:input,stdout:output}=require('node:process');
const LOGIN_DOMAIN='kvantastika-knowledge-base.firebaseapp.com';
const URL='https://kvantastika-knowledge-base-default-rtdb.europe-west1.firebasedatabase.app';
admin.initializeApp({credential:admin.credential.applicationDefault(),databaseURL:URL});
const rl=readline.createInterface({input,output});
function makePassword(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';let s='';for(let i=0;i<20;i++)s+=chars[randomInt(chars.length)];return s;}
(async()=>{
  const login=(await rl.question('Логин первого администратора (латиница, 3-32 символа): ')).trim().toLowerCase();
  if(!/^[a-z][a-z0-9_-]{2,31}$/.test(login))throw Error('Некорректный логин');
  const name=(await rl.question('ФИО администратора: ')).trim();
  const email=(await rl.question('Контактная почта: ')).trim().toLowerCase();
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)) throw Error('Проверьте ФИО и почту');
  const password=makePassword();
  const auth=admin.auth();
  // Fail rather than accidentally creating a second initial administrator.
  const current=await admin.database().ref('users').get();
  if(current.exists()) throw Error('В /users уже есть записи. Не используйте bootstrap повторно; добавляйте сотрудников через админку.');
  const record=await auth.createUser({email:`${login}@${LOGIN_DOMAIN}`,password,displayName:name,disabled:true});
  try{
    await auth.setCustomUserClaims(record.uid,{role:'admin'});
    await admin.database().ref(`users/${record.uid}`).set({login,name,email,gender:'unspecified',role:'admin',active:true,createdAt:Date.now(),createdBy:'bootstrap'});
    await auth.updateUser(record.uid,{disabled:false});
  }catch(e){await admin.database().ref(`users/${record.uid}`).remove().catch(()=>{});await auth.deleteUser(record.uid).catch(()=>{});throw e;}
  console.log('\nПервый администратор создан. Сохраните пароль в менеджере паролей.');
  console.log(`Логин: ${login}\nОдноразово показанный пароль: ${password}`);
})().catch(e=>{console.error('Ошибка:',e.message);process.exitCode=1}).finally(()=>rl.close());
