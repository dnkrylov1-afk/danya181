from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public/index.html'
s=p.read_text(encoding='utf-8')
def replace(old,new):
 global s
 if old not in s: raise Exception('Cannot find '+old[:100])
 s=s.replace(old,new,1)
replace('  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>', '  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>\n  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>\n  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js"></script>')
replace('''      <p>Введите код доступа</p>
      <input type="password" id="login-input" class="login-input" placeholder="Код доступа" autocomplete="off">
      <button id="login-btn" class="login-btn">Войти</button>
      <p id="login-error" class="login-error">Неверный код доступа</p>''','''      <p>Вход для сотрудников школы</p>
      <form id="login-form">
        <input type="text" id="login-input" class="login-input" placeholder="Логин" autocomplete="username" required>
        <input type="password" id="login-password" class="login-input" placeholder="Пароль" autocomplete="current-password" required>
        <button id="login-btn" class="login-btn" type="submit">Войти</button>
      </form>
      <p id="login-error" class="login-error" role="alert">Ошибка входа</p>''')
replace('''  <aside class="sidebar" id="sidebar">''','''  <button id="mobile-menu-btn" type="button" aria-label="Открыть меню">☰ Меню</button>
  <aside class="sidebar" id="sidebar">''')
replace('''      <div class="menu-section-header">Дообучение <span class="arrow">›</span></div>
      <div class="menu-section-content">
        <button class="menu-item sub" data-page="training">В разработке</button>
      </div>
    </div>
  </aside>''','''      <div class="menu-section-header">Дообучение <span class="arrow">›</span></div>
      <div class="menu-section-content">
        <button class="menu-item sub" data-page="training">В разработке</button>
      </div>
    </div>
    <div class="menu-section open" id="admin-menu" hidden>
      <div class="menu-section-header">Администрирование <span class="arrow">›</span></div>
      <div class="menu-section-content"><button class="menu-item" data-page="admin-users">Сотрудники</button></div>
    </div>
  </aside>''')
replace('''  <script src="data-templates.js"></script>
  <script src="data-install.js"></script>
  <script src="data-tech.js"></script>
  <script src="data-full.js"></script>''','''  <!-- Content lives in authenticated database. Never publish source-content/* -->
  <script src="admin-users.js"></script>''')
old='''      const ACCESS_CODES = {
        'qWanTas2742!': 'teacher',
        'qWanTas274209!': 'admin'
      };

      let currentRole = localStorage.getItem('userRole') || null;
      let isEditMode = false;
      let currentPageId = 'home';

      function updateToolbar() {
        if (currentRole === 'admin') {
          EDIT_TOOLBAR.classList.add('visible');
        } else {
          EDIT_TOOLBAR.classList.remove('visible');
        }
      }

      function updateRoleBadge() {
        if (currentRole) {
          ROLE_BADGE.textContent = currentRole === 'admin' ? 'Руководитель' : 'Преподаватель';
          ROLE_BADGE.className = 'role-badge' + (currentRole === 'admin' ? ' admin' : '');
        }
      }

      if (currentRole) {
        LOGIN_OVERLAY.classList.add('hidden');
        updateRoleBadge();
        updateToolbar();
      } else {
        LOGIN_OVERLAY.classList.remove('hidden');
      }
'''
new='''      // Internal Firebase Auth email aliases let teachers log in with a username.
      // Contact email is stored separately in protected /users/$uid.
      const AUTH = firebase.auth();
      const FUNCTIONS = firebase.app().functions('europe-west1');
      const LOGIN_DOMAIN = 'kvantastika-knowledge-base.firebaseapp.com';
      const LOGIN_FORM = document.getElementById('login-form');
      const LOGIN_PASSWORD = document.getElementById('login-password');
      const ADMIN_MENU = document.getElementById('admin-menu');
      const ROLES = {admin:'Администратор',manager:'Руководитель',senior:'Старший преподаватель',teacher:'Преподаватель'};
      let currentRole = null;
      let currentUser = null;
      let isEditMode = false;
      let currentPageId = 'home';
      let sessionVersion = 0;

      function updateToolbar() {
        EDIT_TOOLBAR.classList.toggle('visible', currentRole==='admin' && currentPageId!=='admin-users');
      }
      function updateRoleBadge() {
        ROLE_BADGE.textContent = ROLES[currentRole] || 'Сотрудник';
        ROLE_BADGE.className = 'role-badge' + (currentRole==='admin'?' admin':'');
        ADMIN_MENU.hidden = currentRole !== 'admin';
      }
      function showLogin(message='') {
        currentRole=null;currentUser=null;isEditMode=false;currentPageId='home';
        disableEditMode();ROOT.replaceChildren();
        ADMIN_MENU.hidden=true;EDIT_TOOLBAR.classList.remove('visible');
        document.body.classList.remove('menu-open');
        LOGIN_OVERLAY.classList.remove('hidden');
        LOGIN_ERROR.textContent=message;
        LOGIN_ERROR.style.display=message?'block':'none';
      }
'''
replace(old,new)
old='''      const pages = {
        ...generalPages,
        ...window.fullPages || {},
        ...window.installPages || {},
        ...window.techPages || {},
      };

      async function loadFromFirebase() {
  try {
    const snapshot = await db.ref('pages').once('value');
    const data = snapshot.val();
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (pages[key] && value) {
          // Проверяем, есть ли класс content-card
          if (value.includes('class="content-card"')) {
            pages[key].html = value;
          } else {
            // Если нет — оборачиваем
            pages[key].html = `<div class="content-card" data-editable="true">${value}</div>`;
          }
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error.message);
  }
}
'''
new='''      const pages = {...generalPages};
      async function loadFromFirebase() {
        // No requests for content are made before a verified, active user signs in.
        const [snapshot,titlesSnapshot,templatesSnapshot] = await Promise.all([
          db.ref('pages').once('value'),db.ref('pageTitles').once('value'),db.ref('templates').once('value')
        ]);
        const data=snapshot.val()||{};
        const titles=titlesSnapshot.val()||{};
        window.templateData=templatesSnapshot.val()||{};
        for (const [key,value] of Object.entries(data)) {
          const html=typeof value==='string'?value:value?.html;
          if(typeof html!=='string') continue;
          pages[key]={title:titles[key]||value?.title||key,html};
        }
      }
'''
replace(old,new)
replace('''async function saveToFirebase() {
  try {''','''async function saveToFirebase() {
  try {
    if(currentRole!=='admin' || !currentUser) throw Error('Нет прав на изменение страницы');''')
replace('''      function showPage(pageId) {
        currentPageId = pageId;
        const page = pages[pageId];
        if (!page) return;
        ROOT.innerHTML = page.html;''','''      function showPage(pageId) {
        if(!currentUser) return;
        if(pageId==='admin-users' && currentRole!=='admin') return;
        currentPageId = pageId;
        if(pageId==='admin-users') {
          isEditMode=false;disableEditMode();TOGGLE_EDIT.textContent='Редактировать';
          updateToolbar();
          document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
          document.querySelector('[data-page="admin-users"]').classList.add('active');
          window.KBAdmin.render(ROOT,{db,functions:FUNCTIONS,uid:currentUser.uid});
          return;
        }
        const page = pages[pageId];
        if (!page) return;
        ROOT.innerHTML = page.html;
        updateToolbar();''')
old='''      function login(code) {
        const role = ACCESS_CODES[code];
        if (!role) { LOGIN_ERROR.style.display = 'block'; return false; }
        currentRole = role;
        localStorage.setItem('userRole', role);
        LOGIN_OVERLAY.classList.add('hidden');
        updateRoleBadge();
        updateToolbar();
        LOGIN_ERROR.style.display = 'none';
        showPage('home');
        return true;
      }

      LOGIN_BTN.addEventListener('click', () => login(LOGIN_INPUT.value));
      LOGIN_INPUT.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(LOGIN_INPUT.value); });

      LOGOUT_BTN.addEventListener('click', () => {
        currentRole = null;
        isEditMode = false;
        disableEditMode();
        localStorage.removeItem('userRole');
        LOGIN_OVERLAY.classList.remove('hidden');
        LOGIN_INPUT.value = '';
        TOGGLE_EDIT.textContent = 'Редактировать';
        updateToolbar();
      });

      SIDEBAR.addEventListener('click', (e) => {
        const btn = e.target.closest('.menu-item');
        if (btn) showPage(btn.dataset.page);
      });

      (async function init() {
        await loadFromFirebase();
        if (currentRole) {
          showPage('home');
        } else {
          LOGIN_OVERLAY.classList.remove('hidden');
        }
      })();'''
new='''      LOGIN_FORM.addEventListener('submit',async (event)=>{
        event.preventDefault();
        const login=LOGIN_INPUT.value.trim().toLowerCase();
        if(!/^[a-z][a-z0-9_-]{2,31}$/.test(login)){
          LOGIN_ERROR.textContent='Введите корректный логин';LOGIN_ERROR.style.display='block';return;
        }
        LOGIN_BTN.disabled=true;LOGIN_BTN.textContent='Вход…';
        LOGIN_ERROR.style.display='none';
        try {await AUTH.signInWithEmailAndPassword(`${login}@${LOGIN_DOMAIN}`,LOGIN_PASSWORD.value);LOGIN_PASSWORD.value='';}
        catch(e){LOGIN_ERROR.textContent='Не удалось войти. Проверьте логин и пароль или обратитесь к администратору.';LOGIN_ERROR.style.display='block';}
        finally {LOGIN_BTN.disabled=false;LOGIN_BTN.textContent='Войти';}
      });
      LOGOUT_BTN.addEventListener('click',async ()=>{await AUTH.signOut();LOGIN_INPUT.value='';LOGIN_PASSWORD.value='';});
      SIDEBAR.addEventListener('click',(e)=>{
        const btn=e.target.closest('.menu-item');
        if(btn) {showPage(btn.dataset.page);document.body.classList.remove('menu-open')}
      });
      document.getElementById('mobile-menu-btn').addEventListener('click',()=>document.body.classList.toggle('menu-open'));
      AUTH.onAuthStateChanged(async user=>{
        const version=++sessionVersion;
        if(!user){showLogin();return;}
        try{
          // Force refresh so freshly assigned roles are visible after login.
          const token=await user.getIdTokenResult(true);
          const snap=await db.ref(`users/${user.uid}`).once('value');
          const profile=snap.val();
          if(!profile?.active || profile.role!==token.claims.role || !ROLES[profile.role]){
            throw Error('Пользователь не активирован администратором');
          }
          if(version!==sessionVersion) return;
          currentRole=profile.role;currentUser=user;
          await loadFromFirebase();
          if(version!==sessionVersion)return;
          LOGIN_OVERLAY.classList.add('hidden');LOGIN_ERROR.style.display='none';
          updateRoleBadge();showPage('home');
        }catch(e){
          console.warn('Авторизация не завершена:',e.code||e.message);
          if(version===sessionVersion){showLogin('Нет доступа к базе знаний. Обратитесь к администратору.');await AUTH.signOut();}
        }
      });
      // Detect revoked profile rights (including deactivation) without relying only on cached role.
      db.ref('users').child('__no_client_writes__'); // Placeholder: no client writes to profile paths.
'''
replace(old,new)
# Remove misleading placeholder.
s=s.replace("      // Detect revoked profile rights (including deactivation) without relying only on cached role.\n      db.ref('users').child('__no_client_writes__'); // Placeholder: no client writes to profile paths.\n",'')
replace('''    @media (max-width: 900px) {
      .sidebar { display: none; }
      .main { margin-left: 0; padding: 24px 20px 60px; }
      .home-hero h1 { font-size: 26px; }
    }''','''    .menu-section[hidden], .hidden { display: none !important; }
    .login-input { letter-spacing: normal; }
    #mobile-menu-btn { display: none; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; }
    .field input, .field select, .users-table input, .users-table select {
      padding: 9px 10px; border: 1px solid #D5CCF0; border-radius: 9px; min-width: 0; width: 100%;
      font: inherit; background: white;
    }
    .employee-form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; margin-top: 14px; }
    .employee-actions { grid-column: 1/-1; display:flex; gap:8px; flex-wrap:wrap; }
    .primary-btn { background: var(--primary); color:white; }
    .form-message,.row-status { font-size:13px; color:var(--primary-dark); }
    .credential-panel { padding:16px; border-radius:12px; background:#F0EAFD; margin-top:12px; }
    .credential-panel pre { padding:10px 0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .users-table-wrap { overflow-x:auto; max-width:100%; }
    .users-table { border-collapse:collapse; width:100%; min-width:760px; font-size:12px; }
    .users-table th,.users-table td { border-bottom:1px solid #EDE8F8; text-align:left; padding:9px 5px; }
    .users-table th { color:var(--primary-dark); }
    .row-actions { display:flex; flex-wrap:wrap; align-items:center; gap:5px; min-width:130px; }
    .row-actions .btn { padding:5px 8px; font-size:11px; }
    .row-status { flex-basis:100%; }
    @media (max-width: 900px) {
      .sidebar { display: none; width:min(85vw,320px); }
      body.menu-open .sidebar { display:block; z-index:900; box-shadow:5px 0 30px rgba(0,0,0,.2); }
      #mobile-menu-btn { display:block; position:fixed; top:7px; right:8px; z-index:901; border:1px solid #D5CCF0; border-radius:8px; padding:7px 10px; background:white; color:var(--primary-dark); }
      .main { margin-left: 0; padding: 55px 20px 60px; }
      .home-hero h1 { font-size: 26px; }
      .login-box { width:min(400px,92vw);padding:24px; }
      .employee-form { grid-template-columns:1fr; }
    }''')
p.write_text(s,encoding='utf-8')
print('patched html bytes',p.stat().st_size)
