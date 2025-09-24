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

  // 既存のグリッドをクリア
  grid.innerHTML = "";

  // データに基づいてグリッドを生成
  for (let idx = 0; idx < machineNumbers.length; idx++) {
    const machineNo = machineNumbers[idx];
    const displayValue = displayValues[idx] || ""; // 対応する値がない場合は空文字

    const d = document.createElement("div");
    d.className = "sq";
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

async function loadPostsIntoList(machineNo){
  const statusEl = document.getElementById("postsStatus");
  const listEl = document.getElementById("postsList");
  listEl.innerHTML = "";
  statusEl.textContent = "読み込み中...";
  try{
    const posts = await fetchPosts(machineNo);
    if(!posts || posts.length === 0){ statusEl.textContent = "投稿はありません"; return; }
    statusEl.textContent = "";
    const sorted = posts.slice().sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
    for(const p of sorted){
      const card = document.createElement("div"); card.className = "postCard";
      const meta = document.createElement("div"); meta.className = "meta";
      const author = p.author || "匿名";
      const racer  = p.racer || "";  // ★追加
      const when = fmtDateTime(p.created_at);
      const sched = p.scheduled_at || "";
      meta.textContent =(author ? `投稿者 ${author}`:"") +(racer ? ` ／ 使用選手 ${racer}` : "") +(sched ? ` ／ 投稿日 ${sched}` : "");
      const content = document.createElement("div"); content.className = "content";
      content.textContent = p.content || "";
      // ★削除ボタン
      const delBtn = document.createElement("button");
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
      card.appendChild(meta); card.appendChild(content);
      card.appendChild(delBtn); // ★追加
      listEl.appendChild(card);
    }
  }catch(e){
    statusEl.textContent = "読み込みに失敗しました";
  }
}

// ====== モーダル制御 ======
function bindPostForm(){
  const form = document.getElementById("postForm");
  const authorInput = document.getElementById("authorInput");
  const racerInput = document.getElementById("titleInput");
  const contentInput = document.getElementById("contentInput");
  const dateInput = document.getElementById("dateInput");
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
      scheduled_at: (dateInput?.value) ? dateInput.value : null
    };
    if(!payload.content){
      alert("本文を入力してください");
      contentInput?.focus();
      return;
    }
    try{
      await createPost(currentMachine, payload);
      if(contentInput) contentInput.value = "";
      if(racerInput) racerInput.value = "";
      if(titleSelect) titleSelect.selectedIndex = 0; // 追加
      await loadPostsIntoList(currentMachine);
    }catch(e){
      // createPost でアラート済み
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
  
  // グリッドを生成
  await generateGrid();
})();