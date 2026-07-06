// ====== 基本設定 ======
const API_BASE = "/website/api/machines"; // エンドポイントの共通プレフィックス

// === CSRF ===
function getCSRFToken(){
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
function assertCSRF(){
  if(!getCSRFToken()){
    console.warn("CSRFトークンが見つかりません。ページ配信ビューに ensure_csrf_cookie を付けてください。");
  }
}

// ====== バックエンドからデータ取得 ======
async function fetchMachineData(){
  try{
    const res = await fetch(`${API_BASE}/grid-data`, { 
      cache:"no-store", 
      credentials:"same-origin" 
    });
    if(res.ok){ 
      return await res.json(); 
    }
    console.error("Grid data fetch failed:", res.status);
  }catch(e){ 
    console.error("Grid data fetch error:", e); 
  }
  // フォールバック: エラー時は空のデータを返す
  return { machine_numbers: [], display_values: [] };
}

// ====== グリッド生成 ======
async function generateGrid(){
  const grid = document.getElementById("grid");
  if(!grid) return;

  // バックエンドからデータを取得
  const data = await fetchMachineData();
  const machineNumbers = data.machine_numbers || []; // 例: [1,2,3,4]
  const displayValues = data.display_values || [];   // 例: [a,b,c,d]

  // ★追加: Pythonから送られてきた上位6機のリストを受け取る
  const top6 = data.top6 || [];

  const targetIndex = 2;
  // 既存のグリッドをクリア
  grid.innerHTML = "";

  // データに基づいてグリッドを生成
  for (let idx = 0; idx < machineNumbers.length; idx++) {
    const machineNo = machineNumbers[idx];
    const displayValue = displayValues[idx] || ""; // 対応する値がない場合は空文字

    const d = document.createElement("div");
    d.id = `box-${idx}`;
    d.className = "sq";

    // ★追加: もし現在のモーター番号がtop6に含まれていればクラスを追加
    if (top6.includes(machineNo)) {
      d.classList.add("highlight-orange"); // 専用クラス
    }
    if (idx === targetIndex) {
      d.classList.add("highlight");
    }
    d.title = `#${machineNo}`;
    d.setAttribute("aria-label", `${machineNo}号機`);
    
    // 機械名とディスプレイ値を設定
    const machineText = document.createElement("span");
    machineText.textContent = `${machineNo}号機`;
    const numberText = document.createElement("span");
    numberText.textContent = `${displayValue}％`;
    numberText.style.color = "#fbbf24";  // 黄色
    numberText.style.fontSize = "0.8em"; // サイズを小さく
    
    d.appendChild(machineText);
    d.appendChild(numberText);
    d.tabIndex = 0;
    d.setAttribute("role","button");
    d.addEventListener("click", () => openPosts(machineNo));
    d.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { 
        e.preventDefault(); 
        openPosts(machineNo); 
      }
    });
    grid.appendChild(d);

  }
}

// ====== 投稿一覧（表示/取得/作成） ======
let currentMachine = null;
let editingPostId = null;   // 修正中の投稿ID（nullなら新規投稿）

async function fetchPosts(machineNo){
  try{
    const res = await fetch(`${API_BASE}/${machineNo}/posts`, { cache:"no-store", credentials:"same-origin" });
    if(res.ok){ return await res.json(); }
    console.error("GET failed:", res.status, await res.text());
  }catch(e){ console.error("GET error:", e); }
  return []; // 失敗時は空配列
}
async function deletePost(machineNo, postId){
  let res = await fetch(`${API_BASE}/${machineNo}/posts/${postId}`, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": getCSRFToken(),
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "same-origin",
  });

  if(res.status !== 204){
    res = await fetch(`${API_BASE}/${machineNo}/posts/${postId}/delete`, {
      method: "POST",
      headers: {
        "X-CSRFToken": getCSRFToken(),
        "X-Requested-With": "XMLHttpRequest",
      },
    });
  }

  if(res.status !== 204){
    const text = await res.text().catch(()=> "");
    alert(`削除に失敗しました（${res.status}）\n${text.slice(0,400)}`);
    throw new Error(`Delete failed ${res.status}`);
  }
}

async function createPost(machineNo, payload){
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": getCSRFToken(),
    "X-Requested-With": "XMLHttpRequest"
  };
  
  try{
    const res = await fetch(`${API_BASE}/${machineNo}/posts`, {
      method:"POST",
      headers,
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    if(res.status === 201){ return await res.json(); }

    // エラーメッセージを拾って通知（400/403など）
    const msg = await res.text();
    alert(`投稿に失敗しました（${res.status}）\n${msg || "サーバーからの応答なし"}`);
    throw new Error(`POST failed ${res.status}`);
  }catch(e){
    console.error("POST error:", e);
    throw e;
  }
}

async function updatePost(machineNo, postId, payload){
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": getCSRFToken(),
    "X-Requested-With": "XMLHttpRequest"
  };
  // まず PUT、弾かれる環境向けに POST /update をフォールバック
  let res = await fetch(`${API_BASE}/${machineNo}/posts/${postId}`, {
    method:"PUT", headers, body: JSON.stringify(payload), credentials:"same-origin",
  });
  if(res.status !== 200){
    res = await fetch(`${API_BASE}/${machineNo}/posts/${postId}/update`, {
      method:"POST", headers, body: JSON.stringify(payload), credentials:"same-origin",
    });
  }
  if(res.status === 200){ return await res.json(); }
  const msg = await res.text().catch(()=> "");
  alert(`更新に失敗しました（${res.status}）\n${msg || "サーバーからの応答なし"}`);
  throw new Error(`Update failed ${res.status}`);
}

// 修正ボタン: 投稿内容をフォームに読み込み、更新モードへ
function enterEditMode(p){
  editingPostId = p.id;
  const authorInput  = document.getElementById("authorInput");
  const racerInput   = document.getElementById("titleInput");
  const dateInput    = document.getElementById("dateInput");
  const boatInput    = document.getElementById("boatInput");
  const partsInput   = document.getElementById("partsInput");
  const contentInput = document.getElementById("contentInput");
  const titleSel     = document.getElementById("titleSelect");
  if(authorInput)  authorInput.value  = p.author || "スタッフ";
  if(racerInput)   racerInput.value   = p.racer || "";
  if(dateInput)    dateInput.value    = p.scheduled_at || "";
  if(titleSel)     titleSel.value     = p.title || "";
  if(boatInput)    boatInput.value    = p.boat_no || "";
  if(partsInput)   partsInput.value   = p.parts_exchange || "";
  if(contentInput) contentInput.value = p.content || "";

  const submitBtn = document.getElementById("submitPost");
  if(submitBtn) submitBtn.textContent = "更新";
  const cancelBtn = document.getElementById("cancelEdit");
  if(cancelBtn) cancelBtn.hidden = false;
  document.getElementById("postForm")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

// 更新モードを解除して新規投稿モードへ戻す
function exitEditMode(){
  editingPostId = null;
  const racerInput   = document.getElementById("titleInput");
  const boatInput    = document.getElementById("boatInput");
  const partsInput   = document.getElementById("partsInput");
  const contentInput = document.getElementById("contentInput");
  const titleSel     = document.getElementById("titleSelect");
  if(racerInput)   racerInput.value   = "";
  if(boatInput)    boatInput.value    = "";
  if(partsInput)   partsInput.value   = "";
  if(contentInput) contentInput.value = "";
  if(titleSel)     titleSel.selectedIndex = 0;

  const submitBtn = document.getElementById("submitPost");
  if(submitBtn) submitBtn.textContent = "投稿";
  const cancelBtn = document.getElementById("cancelEdit");
  if(cancelBtn) cancelBtn.hidden = true;
}

async function loadPostsIntoList(machineNo){
  const statusEl = document.getElementById("postsStatus");
  const listEl = document.getElementById("postsList");
  listEl.innerHTML = "";
  statusEl.textContent = "読み込み中...";
  try{
    const posts = await fetchPosts(machineNo);
    if(!posts || posts.length === 0){ statusEl.textContent = "投稿はありません"; return; }
    statusEl.textContent = "";
    // 古い順（上）→新しい順（下）で時系列に流す
    const sorted = posts.slice().sort((a,b)=> new Date(a.created_at||0) - new Date(b.created_at||0));
    for(const p of sorted){
      const card = document.createElement("div"); card.className = "postCard";
      const meta = document.createElement("div"); meta.className = "meta";
      const author = p.author || "匿名";
      const racer  = p.racer || "";  // ★追加
      const when = fmtDateTime(p.created_at);
      const sched = p.scheduled_at || "";
      const boat  = p.boat_no || "";
      meta.textContent =(author ? `投稿者 ${author}`:"") +(racer ? ` ／ 使用選手 ${racer}` : "") +(sched ? ` ／ 投稿日 ${sched}` : "") +(boat ? ` ／ 使用ボート ${boat}` : "");
      // コメント（入力があるときだけ表示。空なら領域ごと非表示）
      let contentEl = null;
      if(p.content){
        contentEl = document.createElement("div");
        contentEl.className = "content";
        contentEl.textContent = p.content;
      }
      // 部品交換（入力があるときだけ表示）
      let partsEl = null;
      if(p.parts_exchange){
        partsEl = document.createElement("div");
        partsEl.className = "parts";
        partsEl.textContent = `部品交換: ${p.parts_exchange}`;
      }
      // ★修正ボタン
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "修正";
      editBtn.style.marginTop = "8px";
      editBtn.style.marginRight = "8px";
      editBtn.addEventListener("click", ()=> enterEditMode(p));
      // ★削除ボタン
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "削除";
      delBtn.style.marginTop = "8px";
      delBtn.addEventListener("click", async ()=>{
        if(!confirm("この投稿を削除します。よろしいですか？")) return;
        try{
          await deletePost(currentMachine, p.id);
          await loadPostsIntoList(currentMachine); // 再描画
        }catch(e){
          alert("削除に失敗しました");
        } });
      card.appendChild(meta);
      if(partsEl) card.appendChild(partsEl);
      if(contentEl) card.appendChild(contentEl);
      card.appendChild(editBtn); // ★追加
      card.appendChild(delBtn);  // ★追加
      listEl.appendChild(card);
    }
  }catch(e){
    statusEl.textContent = "読み込みに失敗しました";
  }
}

// ====== 使用ボートの選択肢（1〜100）を生成 ======
function populateBoatOptions(){
  const sel = document.getElementById("boatInput");
  if(!sel || sel.options.length > 1) return; // 生成済みなら何もしない
  for(let i = 1; i <= 100; i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    sel.appendChild(opt);
  }
}

// ====== モーダル制御 ======
function bindPostForm(){
  const form = document.getElementById("postForm");
  const authorInput = document.getElementById("authorInput");
  const racerInput = document.getElementById("titleInput");
  const contentInput = document.getElementById("contentInput");
  const dateInput = document.getElementById("dateInput");
  const boatInput = document.getElementById("boatInput");
  const partsInput = document.getElementById("partsInput");
  if(!form) return;

  form.onsubmit = async (e)=>{
    e.preventDefault();
    assertCSRF();
    // 追加: 開催選択チェック
    const selectedTitleId = titleSelect?.value;
    const selectedTitleText = titleSelect?.options[titleSelect.selectedIndex]?.textContent || "";
    if(!selectedTitleId){
      alert("開催を選択してください");
      titleSelect?.focus();
      return;
    }
    const payload = {
      title: selectedTitleText,   // DB保存用にテキストを渡す
      author: (authorInput?.value || "").trim() || "匿名",
      racer: (racerInput?.value || "").trim(),
      content: (contentInput?.value || "").trim(),
      scheduled_at: (dateInput?.value) ? dateInput.value : null,
      boat_no: (boatInput?.value || "").trim(),
      parts_exchange: (partsInput?.value || "").trim()
    };
    if(payload.boat_no && !/^\d{1,3}$/.test(payload.boat_no)){
      alert("使用ボートは3桁までの数字で入力してください");
      boatInput?.focus();
      return;
    }
    // 部品交換の入力があれば本文は空欄でも投稿できる
    if(!payload.content && !payload.parts_exchange){
      alert("本文を入力してください（部品交換を入力した場合は空欄可）");
      contentInput?.focus();
      return;
    }
    try{
      if(editingPostId != null){
        // 更新モード → その場で更新し、モーダル内の一覧を再描画（遷移しない）
        await updatePost(currentMachine, editingPostId, payload);
        exitEditMode();
        await loadPostsIntoList(currentMachine);
      }else{
        // 新規投稿 → モーダルを閉じて、その号機の投稿一覧ページへ遷移
        await createPost(currentMachine, payload);
        const dlg = document.getElementById("postsDialog");
        if(dlg && dlg.open) dlg.close();
        window.location.href = `/website/machines/${currentMachine}/`;
      }
    }catch(e){
      // createPost / updatePost でアラート済み
    }
  };
}

function fmtDateTime(dtStr){
  if(!dtStr) return "";
  const d = new Date(dtStr);
  if(isNaN(d)) return dtStr;
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  const hh=String(d.getHours()).padStart(2,"0"), mm=String(d.getMinutes()).padStart(2,"0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

async function openPosts(machineNo){
  const dlg = document.getElementById("postsDialog");
  const titleEl = document.getElementById("dialogMachine");
  const linkEl = document.getElementById("openPageLink");

  currentMachine = machineNo;
  exitEditMode();   // 前回の修正状態が残っていてもリセット
  if(titleEl) titleEl.textContent = `${machineNo}号機`;

  //if(linkEl) linkEl.href = `/machines/${machineNo}/posts`;
  if(linkEl) linkEl.href = `/website/machines/${machineNo}/`;
  if(dlg && typeof dlg.showModal === "function") dlg.showModal();

  // 初期状態で今日の日付をセット（未入力の場合）
  const dEl = document.getElementById("dateInput");
  if(dEl && !dEl.value){
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth()+1).padStart(2,"0");
    const d = String(t.getDate()).padStart(2,"0");
    dEl.value = `${y}-${m}-${d}`;
  }
  bindPostForm();
  await loadPostsIntoList(machineNo);
}

// 画面ロード時のセットアップ
(async function(){
  const dlg = document.getElementById("postsDialog");
  const closeBtn = document.getElementById("closeDialog");
  if(closeBtn) closeBtn.addEventListener("click", ()=> dlg.close());
  if (dlg) dlg.addEventListener("click", (e) => {
    if (e.target === dlg) {
      dlg.close();
    }
  });
  assertCSRF(); // CSRFクッキー警告（無い場合だけconsoleに出す）

  // 「編集をやめる」ボタン（修正モード解除）
  const cancelBtn = document.getElementById("cancelEdit");
  if(cancelBtn) cancelBtn.addEventListener("click", exitEditMode);

  // 使用ボートの選択肢を生成
  populateBoatOptions();

  // グリッドを生成
  await generateGrid();
})();