"use strict";
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {randomInt} = require("node:crypto");
admin.initializeApp({databaseURL:"https://kvantastika-knowledge-base-default-rtdb.europe-west1.firebasedatabase.app"});
const db = admin.database();
const auth = admin.auth();
const REGION = "europe-west1";
// Internal email is only an Authentication identifier. Actual contact email lives in /users.
// Do not change this suffix after accounts have been created.
const LOGIN_DOMAIN = "kvantastika-knowledge-base.firebaseapp.com";
const ROLES = new Set(["teacher", "senior", "manager", "admin"]);
const GENDERS = new Set(["male", "female", "unspecified"]);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
function password() { let result=""; for(let i=0;i<20;i++) result+=ALPHABET[randomInt(ALPHABET.length)]; return result; }
function asString(v, max=128) { if(typeof v!=="string") throw new HttpsError("invalid-argument", "Некорректные данные формы"); const s=v.trim(); if(!s || s.length>max) throw new HttpsError("invalid-argument", "Некорректная длина поля"); return s; }
function safeLogin(s) { const x=asString(s,32).toLowerCase(); if(!/^[a-z][a-z0-9_-]{2,31}$/.test(x)) throw new HttpsError("invalid-argument", "Логин: 3–32 символа, латинские буквы, цифры, _ или -, начинается с буквы"); return x; }
function safeEmail(s) {const v=asString(s,254).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpsError("invalid-argument", "Укажите корректную почту");return v; }
function safePassword(p) {if (typeof p!=="string" || p.length<12 || p.length>128) throw new HttpsError("invalid-argument", "Пароль должен содержать от 12 до 128 символов"); return p; }
function alias(login) { return `${login}@${LOGIN_DOMAIN}`; }
async function requireAdmin(request) {
  if (!request.auth?.uid || request.auth.token.role!=="admin") throw new HttpsError("permission-denied", "Требуются права администратора");
  const s=await db.ref(`users/${request.auth.uid}`).get();
  if(!s.exists() || s.child("active").val()!==true || s.child("role").val()!=="admin") throw new HttpsError("permission-denied", "Доступ заблокирован");
  return request.auth.uid;
}
async function getEmployee(uid) {
  if(typeof uid!=="string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(uid)) throw new HttpsError("invalid-argument", "Некорректный ID пользователя");
  const snapshot=await db.ref(`users/${uid}`).get();
  if(!snapshot.exists()) throw new HttpsError("not-found", "Сотрудник не найден");
  return snapshot.val();
}

exports.createEmployee=onCall({region:REGION}, async request=>{
  await requireAdmin(request);
  const data=request.data || {};
  const login=safeLogin(data.login);
  const name=asString(data.name,150);
  const email=safeEmail(data.email);
  const gender= data.gender ?? "unspecified";
  const role=data.role;
  if(!GENDERS.has(gender)||!ROLES.has(role)) throw new HttpsError("invalid-argument", "Выберите пол и роль");
  const generated = data.password == null || data.password === "";
  const pass=generated?password():safePassword(data.password);
  let user;
  try {
    user=await auth.createUser({email:alias(login),password:pass,displayName:name,disabled:true});
  } catch(e) {
    if(e.code==="auth/email-already-exists") throw new HttpsError("already-exists", "Этот логин уже занят");
    throw new HttpsError("internal", "Не удалось создать учётную запись");
  }
  try {
    await auth.setCustomUserClaims(user.uid, {role});
    await db.ref(`users/${user.uid}`).set({login,name,email,gender,role,active:true,createdAt:Date.now(),createdBy:request.auth.uid});
    await auth.updateUser(user.uid,{disabled:false});
    return {uid:user.uid,login,password:pass};
  } catch(e) {
    // Fail closed and undo partially created account.
    await db.ref(`users/${user.uid}`).remove().catch(()=>{});
    await auth.deleteUser(user.uid).catch(()=>{});
    throw new HttpsError("internal", "Создание сотрудника не удалось. Попробуйте ещё раз");
  }
});

exports.updateEmployee=onCall({region:REGION}, async request=>{
  const actorUid=await requireAdmin(request);
  const data=request.data||{};
  const uid=asString(data.uid,128);
  const before=await getEmployee(uid);
  const name=asString(data.name,150);
  const email=safeEmail(data.email);
  const gender=data.gender;
  const role=data.role;
  if(!GENDERS.has(gender)||!ROLES.has(role)) throw new HttpsError("invalid-argument","Некорректная роль или пол");
  if(uid===actorUid && role!=="admin") throw new HttpsError("failed-precondition","Нельзя снять роль администратора с себя");
  if(before.role!==role) await auth.setCustomUserClaims(uid,{role});
  await db.ref(`users/${uid}`).update({name,email,gender,role,updatedAt:Date.now()});
  await auth.updateUser(uid,{displayName:name});
  if(before.role!==role) await auth.revokeRefreshTokens(uid);
  return {ok:true};
});

exports.setEmployeeActive=onCall({region:REGION},async request=>{
  const actorUid=await requireAdmin(request);
  const {uid,active}=request.data||{};
  await getEmployee(uid);
  if(typeof active!=="boolean") throw new HttpsError("invalid-argument","Некорректный статус");
  if(uid===actorUid && !active) throw new HttpsError("failed-precondition","Нельзя заблокировать самого себя");
  if(!active){
    // First block database access (immediate), then disable sign-in.
    await db.ref(`users/${uid}/active`).set(false);
    await auth.updateUser(uid,{disabled:true});
    await auth.revokeRefreshTokens(uid);
  } else {
    await auth.updateUser(uid,{disabled:false});
    await db.ref(`users/${uid}/active`).set(true);
  }
  return {ok:true};
});

exports.resetEmployeePassword=onCall({region:REGION},async request=>{
  await requireAdmin(request);
  const {uid}=request.data||{};
  await getEmployee(uid);
  const pass=password();
  await auth.updateUser(uid,{password:pass});
  await auth.revokeRefreshTokens(uid);
  return {password:pass}; // Returned ONCE to authenticated admin; never stored in Realtime Database.
});
