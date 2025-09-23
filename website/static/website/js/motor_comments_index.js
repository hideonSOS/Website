// ====== 基本設定 ======
const COUNT = 100; // 正方形の数（1～100）
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

// ====== グリッド生成 ======
const grid = document.getElementById("grid");
for (let i = 1; i <= COUNT; i++) {
  const d = document.createElement("div");
  d.className = "sq";
  d.title = `#${i}`;
  d.setAttribute("aria-label", `${i}号機`);
  d.textContent = `${i}号機`;
  d.tabIndex = 0;
  d.setAttribute("role","button");
  d.addEventListener("click", () => openPosts(i));
  d.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPosts(i); }
  });
  grid.appendChild(d);
}

// ====== 投稿データ取得（詳細ページで使用される可能性があるため残す） ======
let currentMachine = null;

async function fetchPosts(machineNo){
  try{
    const res = await fetch(`${API_BASE}/${machineNo}/posts`, { cache:"no-store", credentials:"same-origin" });
    if(res.ok){ return await res.json(); }
    console.error("GET failed:", res.status, await res.text());
  }catch(e){ console.error("GET error:", e); }
  return []; // 失敗時は空配列
}

function fmtDateTime(dtStr){
  if(!dtStr) return "";
  const d = new Date(dtStr);
  if(isNaN(d)) return dtStr;
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  const hh=String(d.getHours()).padStart(2,"0"), mm=String(d.getMinutes()).padStart(2,"0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

// ====== メイン処理（ページ遷移版） ======
function openPosts(machineNo){
  currentMachine = machineNo;
  
  // 1～100の範囲チェック（念のため）
  if (machineNo < 1 || machineNo > 100) {
    console.error(`無効な号機番号: ${machineNo}`);
    alert(`無効な号機番号です: ${machineNo}`);
    return;
  }
  
  console.log(`${machineNo}号機の詳細ページに遷移します...`);
  
  // 詳細ページに遷移
  const detailUrl = `/website/machines/${machineNo}/`;
  window.location.href = detailUrl;
}

// 画面ロード時のセットアップ
(function(){
  assertCSRF(); // CSRFクッキー警告（無い場合だけconsoleに出す）
  console.log("🎯 グリッドが初期化されました");
  console.log("💡 グリッドをクリックすると詳細ページに遷移します");
})();