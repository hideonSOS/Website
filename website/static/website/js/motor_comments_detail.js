const API_BASE = "/website/api/machines";
    const machineNo = document.getElementById("machine-data").dataset.machineNo;
    
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

    
    async function renderPosts(machineNo){
    const output = document.getElementById("output");
    const posts = await fetchPosts(machineNo);

    if(posts.length === 0){
        output.textContent = "投稿はありません";
    }else{
        const sorted = posts.slice().sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
        );

        const list = document.createElement("div");
        list.className = "post-list";

        sorted.forEach(p => {
        const card = document.createElement("div");
        card.className = "post-card";

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `投稿者: ${p.author || "匿名"} ／ 使用していた選手: ${p.racer || "不明"} ／ 投稿日: ${p.scheduled_at || "未設定"}`;

        const content = document.createElement("div");
        content.className = "content";
        content.textContent = p.content || "";

        const titleEl = document.createElement("div");
        titleEl.className = "title";
        titleEl.textContent = `開催タイトル: ${p.title || "未設定"}`;

        card.appendChild(meta);
        card.appendChild(titleEl);   // ★ 追加
        card.appendChild(content);
        list.appendChild(card);
        });

        output.innerHTML = "";
        output.appendChild(list);
    }
    }

    
    function initMachineSelect(){
    const select = document.getElementById("machineSelect");
    for(let i=1; i<=100; i++){
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `${i}号機`;
        select.appendChild(opt);
    }
    
    select.value = machineNo;
    renderPosts(machineNo);

    select.addEventListener("change", (e)=>{
        const machineNo = e.target.value;
        renderPosts(machineNo);
    });
    }

    initMachineSelect();