"use strict";
// No Firebase Admin SDK here. Every mutation goes to a callable function with server-side authorization.
window.KBAdmin = (() => {
  const ROLE_NAMES={teacher:'Преподаватель',senior:'Старший педагог',manager:'Руководитель',admin:'Администратор'};
  const GENDER_NAMES={unspecified:'Не указан',male:'Мужской',female:'Женский'};
  const roles=Object.entries(ROLE_NAMES), genders=Object.entries(GENDER_NAMES);
  const field=(label,id,type='text',required=true)=>`<label class="field">${label}<input id="${id}" type="${type}" ${required?'required':''} autocomplete="off"></label>`;
  const optionSelect=(entries)=>{const sel=document.createElement('select');for(const [value,label] of entries){const opt=document.createElement('option');opt.value=value;opt.textContent=label;sel.appendChild(opt)}return sel;};
  function createPassword(){
    const abc='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const nums=new Uint32Array(20);crypto.getRandomValues(nums);
    return Array.from(nums,v=>abc[v%abc.length]).join('');
  }
  function errorMessage(e){
    const code=e?.code||'';
    if(code.includes('permission-denied'))return 'Нет прав администратора или доступ был изменён';
    if(code.includes('already-exists'))return 'Этот логин уже занят';
    return e?.message||'Операция не выполнена';
  }
  async function render(root,{db,functions,uid}){
    root.innerHTML=`<div class="content-card"><h3>Управление сотрудниками</h3><p>Создать аккаунт может только администратор. Почта сохраняется для связи и не используется для входа.</p>
      <form id="create-employee" class="employee-form">
        ${field('Логин (латиницей)','e-login')}${field('ФИО','e-name')}${field('Контактная почта','e-email','email')}
        <label class="field">Пол<select id="e-gender"><option value="unspecified">Не указан</option><option value="male">Мужской</option><option value="female">Женский</option></select></label>
        <label class="field">Роль<select id="e-role"><option value="teacher">Преподаватель</option><option value="senior">Старший педагог</option><option value="manager">Руководитель</option><option value="admin">Администратор</option></select></label>
        <label class="field">Пароль (необязательно: система сгенерирует)<input id="e-password" type="password" autocomplete="new-password" minlength="12" placeholder="Не менее 12 символов"></label>
        <div class="employee-actions"><button type="button" class="btn" id="generate-password">Сгенерировать пароль</button><button type="button" class="btn" id="toggle-password">Показать / скрыть</button><button class="btn primary-btn" type="submit" id="create-submit">Создать аккаунт</button></div>
      </form><p class="form-message" id="create-message" role="status"></p><div id="credentials-once" class="credential-panel hidden" role="status"></div>
      </div><div class="content-card"><h3>Сотрудники</h3><p id="users-status" role="status">Загрузка…</p><div class="users-table-wrap"><table class="users-table" id="users-table"><thead><tr><th>Логин</th><th>ФИО</th><th>Почта</th><th>Пол</th><th>Роль</th><th>Доступ</th><th>Действия</th></tr></thead><tbody id="users-body"></tbody></table></div></div>`;
    const $=id=>root.querySelector('#'+id);
    const call=name=>functions.httpsCallable(name);
    const loadingMsg=$('users-status');
    function revealCredentials(login, pass, label){
      const panel=$('credentials-once');panel.replaceChildren();panel.classList.remove('hidden');
      const title=document.createElement('strong');title.textContent=label;
      const note=document.createElement('p');note.textContent='Сохраните данные сейчас. Пароль повторно не показывается и в базе знаний не хранится.';
      const pre=document.createElement('pre');pre.textContent=`Логин: ${login}\nПароль: ${pass}`;
      const copy=document.createElement('button');copy.className='btn';copy.textContent='Скопировать данные';copy.type='button';
      copy.addEventListener('click',()=>navigator.clipboard.writeText(`Логин: ${login}\nПароль: ${pass}`).then(()=>{copy.textContent='Скопировано'}));
      panel.append(title,note,pre,copy);
    }
    $('generate-password').addEventListener('click',()=>{$('e-password').value=createPassword();$('e-password').type='text';});
    $('toggle-password').addEventListener('click',()=>{$('e-password').type=$('e-password').type==='password'?'text':'password'});
    $('create-employee').addEventListener('submit',async e=>{
      e.preventDefault();const msg=$('create-message');msg.textContent='Создание…';$('create-submit').disabled=true;
      $('credentials-once').classList.add('hidden');$('credentials-once').replaceChildren();
      try{
        const payload={login:$('e-login').value,name:$('e-name').value,email:$('e-email').value,gender:$('e-gender').value,role:$('e-role').value,password:$('e-password').value};
        const res=await call('createEmployee')(payload);
        revealCredentials(res.data.login,res.data.password,'Учётная запись создана');
        msg.textContent='Сотрудник добавлен';$('create-employee').reset();
        await loadUsers();
      }catch(err){msg.textContent=errorMessage(err)}finally{$('create-submit').disabled=false;}
    });
    async function loadUsers(){
      try {
        const snap=await db.ref('users').once('value');
        if(!root.contains($('users-body')))return;
        const staff=Object.entries(snap.val()||{}).sort((a,b)=>String(a[1].name||'').localeCompare(String(b[1].name||''),'ru'));
        const tbody=$('users-body');tbody.replaceChildren();
        loadingMsg.textContent=staff.length?`Всего сотрудников: ${staff.length}`:'Пользователи не найдены';
        for(const [id,p] of staff){
          const tr=document.createElement('tr');
          function cell(el){const td=document.createElement('td');td.append(el);tr.append(td);return td;}
          const lg=document.createElement('span');lg.textContent=p.login||'';cell(lg);
          const name=document.createElement('input');name.value=p.name||'';name.setAttribute('aria-label','ФИО');cell(name);
          const email=document.createElement('input');email.value=p.email||'';email.type='email';email.setAttribute('aria-label','Почта');cell(email);
          const gender=optionSelect(genders);gender.value=p.gender||'unspecified';gender.setAttribute('aria-label','Пол');cell(gender);
          const role=optionSelect(roles);role.value=p.role||'teacher';role.disabled=(id===uid);role.setAttribute('aria-label','Роль');cell(role);
          const active=document.createElement('span');active.textContent=p.active?'Активен':'Заблокирован';cell(active);
          const actions=document.createElement('div');actions.className='row-actions';
          const save=document.createElement('button');save.className='btn';save.textContent='Сохранить';
          const toggle=document.createElement('button');toggle.className='btn';toggle.textContent=p.active?'Блокировать':'Разблокировать';toggle.disabled=(id===uid);
          const reset=document.createElement('button');reset.className='btn';reset.textContent='Сбросить пароль';
          const rowStatus=document.createElement('span');rowStatus.className='row-status';rowStatus.setAttribute('role','status');
          const action=async (button,fn)=>{button.disabled=true;rowStatus.textContent='Сохранение…';try{await fn();rowStatus.textContent='Готово';await loadUsers();}catch(err){rowStatus.textContent=errorMessage(err)}finally{button.disabled=false}};
          save.onclick=()=>action(save,async()=>{await call('updateEmployee')({uid:id,name:name.value,email:email.value,gender:gender.value,role:role.value})});
          toggle.onclick=()=>{if(!window.confirm(`${p.active?'Заблокировать':'Разблокировать'} пользователя ${p.login}?`))return;action(toggle,async()=>{await call('setEmployeeActive')({uid:id,active:!p.active})})};
          reset.onclick=()=>{if(!window.confirm(`Сбросить пароль пользователя ${p.login}? Старый пароль перестанет подходить.`))return;action(reset,async()=>{const res=await call('resetEmployeePassword')({uid:id});revealCredentials(p.login,res.data.password,'Новый пароль для сотрудника')})};
          actions.append(save,toggle,reset,rowStatus);cell(actions);tbody.append(tr);
        }
      }catch(e){loadingMsg.textContent='Не удалось загрузить сотрудников: '+errorMessage(e)}
    }
    await loadUsers();
  }
  return {render};
})();
