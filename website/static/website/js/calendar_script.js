// =============================
    // 設定
    // =============================
    const API_BASE = '/website/api';
    const ROLE_ORDER = ['MC','解説者1','解説者2','ゲスト']; // 相対で '/api/events' を利用。失敗時は自動フォールバック（localStorage）

    // =============================
    // ユーティリティ
    // =============================
    const pad = (n) => String(n).padStart(2, '0');
    const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const parseDateStr = (str) => {
      const [y,m,dd] = str.split('-').map(Number);
      return new Date(y, m-1, dd);
    };

    function getCSRFToken(){
      // Django想定：cookie "csrftoken" を返す
      const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }

    // localStorage キー
    const LS_KEY = 'calendarEvents_v1';
    const LS_RACE_KEY = 'calendarRace_v1';

    function readLocalRace(){ try{ return JSON.parse(localStorage.getItem(LS_RACE_KEY) || '[]'); }catch{ return []; } }
    function writeLocalRace(list){ localStorage.setItem(LS_RACE_KEY, JSON.stringify(list)); }

    function readLocalEvents(){
      try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }catch{ return []; }
    }
    function writeLocalEvents(list){
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    }

    // ID発行（ローカル用）
    function uid(){ return 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

    // =============================
    // API クライアント（失敗時フォールバック）
    // =============================
    let serverAvailable = false; // 起動時に判定

    async function tryServer(){
      // 適当な月で軽く GET を試みて疎通確認
      try{
        const now = new Date();
        const ym = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
        const res = await fetch(`${API_BASE}/events?month=${ym}`, 
        { method:'GET' });
        serverAvailable = res.ok; // 200系なら利用
      }catch{
        serverAvailable = false;
      }
      updateModeBadge();
    }

    function updateModeBadge(){
      const badge = document.getElementById('modeBadge');
      if(serverAvailable){
        badge.textContent = '';
        badge.style.color = '#a7f3d0';
        badge.style.borderColor = '#134e5a';
      }else{
        badge.textContent = 'スマホの方は画面を横にしてご覧ください。';
        badge.style.color = '#fde68a';
        badge.style.borderColor = '#4b5563';
      }
    }

    async function fetchEventsByMonth(year, month){
      const ym = `${year}-${pad(month)}`;
      if(serverAvailable){
        try{
          const res = await fetch(`${API_BASE}/events?month=${ym}`, 
          { method:'GET' });
          if(res.ok) return await res.json();
        }catch{ /* フォールバック */ }
      }
      // フォールバック：ローカルから月抽出
      const all = readLocalEvents();
      return all.filter(ev => (ev.date || '').startsWith(ym));
    }

    async function createEvent(payload){
      // payload: {date, title, time?, description?}
      if(serverAvailable){
        try{
          const res = await fetch(`${API_BASE}/events/`, {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify(payload)
          });
          if(res.ok){ return await res.json(); } // {id, ...}
        }catch{ /* フォールバック */ }
      }
      // ローカル保存
      const list = readLocalEvents();
      const ev = { id: uid(), ...payload };
      list.push(ev); writeLocalEvents(list);
      return ev;
    }

    async function deleteEvent(id){
      if(serverAvailable){
        try{
          const res = await fetch(`${API_BASE}/events/${encodeURIComponent(id)}/`, {
            method:'DELETE', headers:{ 'X-CSRFToken': getCSRFToken() }
          });
          if(res.ok) return true;
        }catch{ /* フォールバック */ }
      }
      // ローカル削除
      const list = readLocalEvents();
      const idx = list.findIndex(e => e.id === id);
      if(idx !== -1){ list.splice(idx,1); writeLocalEvents(list); return true; }
      return false;
    }

    async function deleteAllOn(dateStr){
      if(serverAvailable){
        // サーバー側に一括削除APIが無い場合は個別に取得->削除を実装してください
        const d = await fetchEventsByMonth(...ymOf(dateStr));
        const targets = d.filter(e => e.date === dateStr);
        for(const t of targets){ await deleteEvent(t.id); }
        return true;
      }else{
        const list = readLocalEvents().filter(e => e.date !== dateStr);
        writeLocalEvents(list); return true;
      }
    }

    function ymOf(dateStr){
      const d = parseDateStr(dateStr);
      return [d.getFullYear(), d.getMonth()+1];
    }

    // ===== 開催日API/ローカル =====
    async function fetchRaceByMonth(year, month){
      const ym = `${year}-${pad(month)}`;
      if(serverAvailable){
        try{
          const res = await fetch(`${API_BASE}/racedays/?month=${ym}`,
                      { method:'GET' });
          if(res.ok) return await res.json();
        }catch{ /* fallback */ }
      }
      const all = readLocalRace();
      return all.filter(r => (r.date||'').startsWith(ym));
    }

    async function upsertRace(payload){ // {date, title, type}
  if(serverAvailable){
    try{
      const res = await fetch(`${API_BASE}/racedays/`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify(payload)
      });
      if(res.ok) return await res.json();
    }catch{ /* fallback */ }
  }
  const list = readLocalRace();
  const idx = list.findIndex(r => r.date === payload.date);
  if(idx !== -1) list[idx] = { ...list[idx], ...payload };
  else list.push({ id: uid(), ...payload });
  writeLocalRace(list);
  return payload;
}

    async function clearRace(dateStr){
      if(serverAvailable){
        try{
          const res = await fetch(`${API_BASE}/racedays/${encodeURIComponent(dateStr)}`,
          { method:'DELETE', headers:{ 'X-CSRFToken': getCSRFToken() } });
          if(res.ok) return true;
        }catch{ /* fallback */ }
      }
      const list = readLocalRace().filter(r => r.date !== dateStr);
      writeLocalRace(list);
      return true;
    }

    // =============================
    // カレンダー描画
    // =============================
    const gridEl = document.getElementById('grid');
    const monthLabel = document.getElementById('monthLabel');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const todayBtn = document.getElementById('todayBtn');

    let current = new Date(); // 現在表示している月

    function firstDayOfMonth(y, m){ return new Date(y, m-1, 1); }
    function lastDayOfMonth(y, m){ return new Date(y, m, 0); }

    function buildMonthMatrix(y, m){
      const first = firstDayOfMonth(y,m);
      const last = lastDayOfMonth(y,m);
      const startIndex = (first.getDay() + 6) % 7; // 0=月
      const daysInMonth = last.getDate();

      const cells = [];
      // 前月分
      const prevLast = lastDayOfMonth(y, m-1);
      for(let i=0;i<startIndex;i++){
        const day = prevLast.getDate() - (startIndex - 1 - i);
        const d = new Date(y, m-2, day);
        cells.push({ date:d, inMonth:false });
      }
      // 今月分
      for(let d=1; d<=daysInMonth; d++){
        cells.push({ date:new Date(y, m-1, d), inMonth:true });
      }
      // 次月分で 6行×7列=42セルに埋める
      while(cells.length < 42){
        const lastCell = cells[cells.length-1].date;
        const d = new Date(lastCell.getFullYear(), lastCell.getMonth(), lastCell.getDate()+1);
        cells.push({ date:d, inMonth: d.getMonth() === (m-1) });
      }
      return cells;
    }

    async function render(){
      const y = current.getFullYear();
      const m = current.getMonth()+1;
      monthLabel.textContent = `${y}年${m}月`;
      gridEl.innerHTML = '';

      const cells = buildMonthMatrix(y,m);
      const monthly = await fetchEventsByMonth(y,m);
      const raceMonthly = await fetchRaceByMonth(y,m);
      const raceMap = new Map();
        for(const r of raceMonthly){
          if(!raceMap.has(r.date)) raceMap.set(r.date, []);
        raceMap.get(r.date).push(r);
      }
      const byDate = new Map();
      for(const e of monthly){
        if(!byDate.has(e.date)) byDate.set(e.date, []);
        byDate.get(e.date).push(e);
        
      }
      // Sort events by time then title
      for(const list of byDate.values()){
        list.sort((a,b)=> (ROLE_ORDER.indexOf((a.role||'MC')) - ROLE_ORDER.indexOf((b.role||'MC'))) || a.title.localeCompare(b.title));
      }

      const todayStr = fmtDate(new Date());

      for(const c of cells){
        const d = c.date;
        const cell = document.createElement('div');
        cell.className = 'day' + (c.inMonth?'':' other');
        const dateStr = fmtDate(d);
        if(dateStr === todayStr) cell.classList.add('today');

        const num = document.createElement('div');
        num.className='num';
        num.textContent = d.getDate();
        cell.appendChild(num);
        cell.classList.remove("none", "toshi", "minou");
        // 開催日カラー & タグ
        const rinfos = raceMap.get(dateStr) || [];

        if (rinfos.length > 0) {
  cell.classList.remove("none", "toshi", "minou");

  // 最新1件を採用
  const rinfo = rinfos[rinfos.length - 1];  

  const type = rinfo.type;
  const label = TYPE_LABELS[type] || type;

  const tag = document.createElement('div');
  tag.className = 'raceTag';
  tag.textContent = rinfo.title ? `${label}: ${rinfo.title}` : label;
  cell.appendChild(tag);

  cell.classList.add(type);
}

        const roles = ['MC','解説者1','解説者2','ゲスト'];
        const allEvents = (byDate.get(dateStr) || []).map(e => ({...e, role: e.role || 'MC'}));

        const lanes = document.createElement('div');
        lanes.className = 'lanes';
        for(const role of roles){
          const lane = document.createElement('div');
          lane.className = 'lane';

          const laneTitle = document.createElement('div');
          laneTitle.className = 'laneTitle';
          laneTitle.textContent = role;
          lane.appendChild(laneTitle);

          const laneBody = document.createElement('div');
          laneBody.className = 'laneBody';

          const items = allEvents.filter(e => e.role === role);
          if(items.length === 0){
            const empty = document.createElement('div');
            empty.className = 'listEmpty';
            empty.textContent = '—';
            laneBody.appendChild(empty);
          }else{
            for(const ev of items){
              const pill = document.createElement('div');
              pill.className='pill';
              pill.title = ev.description || ''; const title = document.createElement('span'); title.textContent = ev.title; pill.appendChild(title);
              if (ev.description) {
                const note = document.createElement('span');
                note.className = 'noteIcon';
                note.textContent = '📝';
                pill.appendChild(note);
                pill.title = ev.description;
              }
              laneBody.appendChild(pill);
            }
          }
          lane.appendChild(laneBody);
          lanes.appendChild(lane);
        }
        cell.appendChild(lanes);

        // クリックで追加モーダル
        cell.addEventListener('click', () => openDialogFor(dateStr));
        gridEl.appendChild(cell);
      }
    }

    prevBtn.addEventListener('click', ()=>{ current = new Date(current.getFullYear(), current.getMonth()-1, 1); render(); });
    nextBtn.addEventListener('click', ()=>{ current = new Date(current.getFullYear(), current.getMonth()+1, 1); render(); });
    todayBtn.addEventListener('click', ()=>{ const now = new Date(); current = new Date(now.getFullYear(), now.getMonth(), 1); render(); });

    // =============================
    // モーダル & フォーム
    // =============================
    const dialog = document.getElementById('eventDialog');
    const dateInput = document.getElementById('dateInput');
    const roleSelect = document.getElementById('roleSelect');
    const raceTitleInput = document.getElementById('raceTitleInput');
    const titleInput = document.getElementById('titleInput');
    const descInput = document.getElementById('descInput');
    const eventList = document.getElementById('eventList');
    const TYPE_LABELS = {
  none: "非開催",
  toshi: "都市開催",
  minou: "箕面開催"
};
    
    const form = document.getElementById('eventForm');

    function clearForm(){
      titleInput.value = '';
      descInput.value = '';
      if(roleSelect) roleSelect.value = 'MC';
    }

    async function refreshEventList(dateStr){
      eventList.innerHTML = '';
      const [y,m] = ymOf(dateStr);
      const list = (await fetchEventsByMonth(y,m)).filter(e => e.date === dateStr);
      if(list.length === 0){
        const p = document.createElement('div'); p.className='listEmpty'; p.textContent = 'この日の予定はまだありません';
        eventList.appendChild(p);
        return;
      }
      for(const ev of list){
        const row = document.createElement('div'); row.className='eventItem';
        const left = document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column';
        const title = document.createElement('div'); title.textContent = `[${ev.role || 'MC'}] ${ev.title}`;
        const meta = document.createElement('div');
        meta.className='meta';
        meta.innerHTML = `${ev.description ? '<span>📝メモあり</span>' : ''}`;
        left.appendChild(title); left.appendChild(meta);
        if (ev.description){
          const memo = document.createElement('div');
          memo.className = 'memo';
          memo.textContent = ev.description;
          left.appendChild(memo);
        }

        const del = document.createElement('button'); del.className='danger'; del.textContent='削除';
        del.addEventListener('click', async (e)=>{
          e.preventDefault();
          await deleteEvent(ev.id);
          await refreshEventList(dateStr);
      setRaceFields(dateStr);
          await render();
        });
        row.appendChild(left); row.appendChild(del);
        eventList.appendChild(row);
      }
    }

    async function readRaceForDate(dateStr){
      const [y,m] = ymOf(dateStr);
      const list = await fetchRaceByMonth(y,m);
      return list.find(r => r.date === dateStr) || null;
    }
    async function setRaceFields(dateStr){
  if(!raceTitleInput) return;
  const r = await readRaceForDate(dateStr);
  raceTitleInput.value = r && r.title ? r.title : '';
}


    function openDialogFor(dateStr){
      dateInput.value = dateStr;
      clearForm();
      dialog.showModal();
      refreshEventList(dateStr);
    }

    // 背景クリックで閉じる
    dialog.addEventListener('click', (e)=>{
      const rect = dialog.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if(!inside) dialog.close();
    });
    

    // この日の予定を全削除
    

    // 追加
// ★ form.submit から出演者処理を削除する
form.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const raceType = document.getElementById('raceTypeSelect').value;
  const racePayload = {
    date: dateInput.value,
    title: raceTitleInput.value.trim() || "",
    type: raceType
  };
  console.log("送信データ:", payload);  // ← ここで確認！
  if(raceType === "none" || raceType === "toshi" || raceType === "minou"){
    await upsertRace(racePayload);
  } else {
    await clearRace(racePayload.date);
  }

  await refreshEventList(racePayload.date);
  clearForm();
  await render();
});

// ★ 出演者追加は「追加」ボタンでのみ処理
document.querySelectorAll(".saveBtn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const field = btn.dataset.field;
    const date = document.getElementById("dateInput").value;

    if (field === "raceTitle") {
      const raceType = document.getElementById("raceTypeSelect").value;
      const raceTitle = document.getElementById("raceTitleInput").value.trim();
      await upsertRace({ date, title: raceTitle, type: raceType });
    }

    if (field === "title") {
      const role = document.getElementById("roleSelect").value;
      const title = document.getElementById("titleInput").value.trim();
      if (title) {
        await createEvent({ date, title, role });
        titleInput.value = ''; // 入力をクリア
      }
    }

    if (field === "desc") {
      const desc = document.getElementById("descInput").value.trim();
      if (desc) {
        await createEvent({ date, title: "メモ", description: desc, role: "メモ" });
        descInput.value = ''; // 入力をクリア
      }
    }

    await refreshEventList(date);
    await render();
  });
});


    // 初期化
    (async function init(){
      await tryServer();
      await render();
    })();
    roleSelect.addEventListener("click", (e) => {
  e.stopPropagation();
});
raceTypeSelect.addEventListener("click", (e) => {
  e.stopPropagation();
});


document.querySelectorAll(".closeBtn").forEach(btn => {
  btn.addEventListener("click", () => dialog.close());
});
// 開催日カラー & タグ
