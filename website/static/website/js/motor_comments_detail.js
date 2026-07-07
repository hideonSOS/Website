const API_BASE = "/website/api/machines";
    const machineNo = document.getElementById("machine-data").dataset.machineNo;
    let allPosts = [];

    async function fetchPosts(machineNo){
    try{
        const res = await fetch(`${API_BASE}/${machineNo}/posts`, {
        cache:"no-store",
        credentials:"same-origin"
        });
        if(res.ok){
        return await res.json();
        }
        console.error("GET failed:", res.status, await res.text());
    }catch(e){
        console.error("GET error:", e);
    }
    return [];
    }

    // ====== 絞り込み ======
    function getFilteredPosts(){
    const start = document.getElementById("startDate")?.value || "";
    const end = document.getElementById("endDate")?.value || "";
    const partsOn = document.getElementById("btnParts")?.classList.contains("active");
    const otherOn = document.getElementById("btnOther")?.classList.contains("active");

    return allPosts.filter(p => {
        // 期間（開始～終了）: 指定があれば投稿日で判定。日付未設定の投稿は除外
        if(start || end){
        if(!p.scheduled_at) return false;
        if(start && p.scheduled_at < start) return false;
        if(end && p.scheduled_at > end) return false;
        }
        // 部品交換の有無: 押されているボタンのカテゴリだけ表示
        // （両方OFFなら何も表示しない）
        const isParts = !!p.parts_exchange;
        if(isParts && !partsOn) return false;
        if(!isParts && !otherOn) return false;
        return true;
    });
    }

    function renderPosts(){
    const output = document.getElementById("output");
    const posts = getFilteredPosts();

    if(allPosts.length === 0){
        output.textContent = "投稿はありません";
        return;
    }
    const partsOn = document.getElementById("btnParts")?.classList.contains("active");
    const otherOn = document.getElementById("btnOther")?.classList.contains("active");
    if(!partsOn && !otherOn){
        output.textContent = "表示するデータの種類（部品交換／コメント）を選択してください";
        return;
    }
    if(posts.length === 0){
        output.textContent = "条件に一致する投稿はありません";
        return;
    }

    // 入力日（モーダルで指定した日付）の古い順（上）→新しい順（下）で時系列に流す。
    // 入力日が未設定の投稿はDB登録日で代用し、同日内はDB登録順に並べる。
    const sortKey = p => p.scheduled_at || (p.created_at || "").slice(0, 10);
    const sorted = posts.slice().sort((a, b) => {
        const ka = sortKey(a), kb = sortKey(b);
        if(ka !== kb) return ka < kb ? -1 : 1;
        return new Date(a.created_at) - new Date(b.created_at);
    });

    const list = document.createElement("div");
    list.className = "post-list";

    sorted.forEach(p => {
        const card = document.createElement("div");
        card.className = "post-card";

        // ラベルなしで1データ1行。空のデータは行ごと省略する
        const rows = [
        { cls: "meta",    val: p.author },
        { cls: "meta",    val: p.racer },
        { cls: "meta",    val: p.scheduled_at },
        { cls: "meta",    val: p.boat_no ? `${p.boat_no} ※使用ボート` : "" },
        { cls: "title",   val: p.title },
        { cls: "parts",   val: p.parts_exchange },
        { cls: "content", val: p.content }
        ];
        rows.forEach(r => {
        if(!r.val) return;
        const el = document.createElement("div");
        el.className = r.cls;
        el.textContent = r.val;
        card.appendChild(el);
        });

        // 削除・編集は入力ページ側で行うため、出力ページには操作ボタンを置かない

        list.appendChild(card);
    });

    output.innerHTML = "";
    output.appendChild(list);
    }

    function bindFilters(){
    ["startDate", "endDate"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", renderPosts);
    });
    document.querySelectorAll(".toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        renderPosts();
        });
    });
    }

    (async function(){
    allPosts = await fetchPosts(machineNo);
    bindFilters();
    renderPosts();
    })();
