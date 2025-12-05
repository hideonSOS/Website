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
  // 既存のグリッドをクリア
  grid.innerHTML = "";

  // データに基づいてグリッドを生成
  for (let idx = 0; idx < machineNumbers.length; idx++) {
    const machineNo = machineNumbers[idx];
    const displayValue = displayValues[idx] || ""; // 対応する値がない場合は空文字

    const d = document.createElement("div");
    d.className = "sq";

    // ★追加: もし現在のモーター番号がtop6に含まれていればクラスを追加
    if (top6.includes(machineNo)) {
      d.classList.add("highlight-orange"); // 専用クラス
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
async function openPosts(machineNo){
  currentMachine = machineNo;
  
  // 有効な号機番号かチェック（バックエンドデータに基づく）
  const data = await fetchMachineData();
  const validMachines = data.machine_numbers || [];
  
  if (!validMachines.includes(machineNo)) {
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
(async function(){
  assertCSRF(); // CSRFクッキー警告（無い場合だけconsoleに出す）
  
  // グリッドを生成
  await generateGrid();
  
  console.log("🎯 グリッドが初期化されました");
  console.log("💡 グリッドをクリックすると詳細ページに遷移します");
})();