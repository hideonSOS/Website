const RUN_COLS     = JSON.parse(document.getElementById('run-cols-data').textContent);
const CSRF         = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
let   MANUAL_CELLS = new Set(JSON.parse(document.getElementById('manual-cells-data').textContent));

const SCORE_HEADERS = Array.from(document.querySelectorAll('#scoreTable thead th')).map(th => th.textContent.trim());

// ── 初期表示：手入力セルに filled クラスを付与 ──────────
(function applyInitialGlow() {
  document.querySelectorAll('#scoreBody tr').forEach(tr => {
    const toban = parseInt(tr.dataset.toban);
    tr.querySelectorAll('td').forEach((td, i) => {
      const h = SCORE_HEADERS[i];
      if (RUN_COLS.includes(h) && MANUAL_CELLS.has(`${toban}_${h}`)) {
        td.classList.add('filled');
      }
    });
  });
})();

let currentRaceNo   = null;
let currentRacers   = [];
let currentRaceType = null;

// ── レース種別ボタン ──────────────────────────────────────
document.querySelectorAll('.race-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.race-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRaceType = btn.dataset.type;
    refreshPointCells();
    _resetConfirm();
  });
});

// ── レース番号ボタン ──────────────────────────────────────
document.querySelectorAll('.race-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.race-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRaceNo = parseInt(btn.dataset.race);
    _unlockForm();    // 新レース選択時のみ確定状態を解除
    _resetConfirm();
    loadRaceProgram(currentRaceNo);
  });
});

// ── 出走番組を取得してフォームを展開 ──────────────────────
async function loadRaceProgram(raceNo, afterLoad) {
  const form = document.getElementById('raceForm');
  const msg  = document.getElementById('statusMsg');
  msg.textContent = '読み込み中...';
  form.style.display = 'block';
  document.getElementById('raceLabel').textContent = `第${raceNo}レース`;

  const res  = await fetch(`/live_score/api/race_program/?race_no=${raceNo}`);
  const data = await res.json();

  if (data.error) {
    msg.textContent = `エラー: ${data.error}`;
    return;
  }

  currentRacers = data.racers;
  if (currentRacers.length === 0) {
    msg.textContent = '取得できませんでした。もう一度レース番号を押してください。';
    msg.className = 'status-msg';
    return;
  }
  msg.textContent = '読込完了';
  msg.className = 'status-msg status-ok';
  renderEntryForm(currentRacers);
  if (afterLoad) afterLoad();
}

// ── 入力フォームを描画 ────────────────────────────────────
function renderEntryForm(racers) {
  const tbody = document.getElementById('entryBody');
  tbody.innerHTML = '';

  for (let rank = 1; rank <= 6; rank++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-cell">${rank}着</td>
      <td>
        <select class="boat-select" data-rank="${rank}">
          <option value="">--</option>
          ${racers.map(r =>
            `<option value="${r.toban}" data-name="${r.name}" data-boat="${r.boat}" data-slot="${r.next_slot || ''}">
              ${r.boat}号艇
            </option>`
          ).join('')}
        </select>
      </td>
      <td class="name-cell" id="name-${rank}">-</td>
      <td class="point-cell" id="point-${rank}">-</td>
      <td class="slot-cell"  id="slot-${rank}">-</td>
    `;
    tbody.appendChild(tr);
  }

  // selectが変わったら選手名・得点・入力先を更新
  tbody.querySelectorAll('.boat-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const rank = parseInt(sel.dataset.rank);
      const opt  = sel.selectedOptions[0];
      document.getElementById(`name-${rank}`).textContent  = opt.dataset.name || '-';
      document.getElementById(`point-${rank}`).textContent = sel.value ? getPoint(rank) : '-';
      document.getElementById(`slot-${rank}`).textContent  = opt.dataset.slot || '(なし)';
      _resetConfirm();
    });
  });
}

// 着順→得点を POINT_TABLE から取得
function getPoint(rank) {
  if (!currentRaceType || !POINT_TABLE[currentRaceType]) return '-';
  return POINT_TABLE[currentRaceType][rank] ?? '-';
}

// レース種別が変わったら得点列を再描画
function refreshPointCells() {
  document.querySelectorAll('.boat-select').forEach(sel => {
    const rank = parseInt(sel.dataset.rank);
    const cell = document.getElementById(`point-${rank}`);
    if (cell) {
      cell.textContent = sel.value ? getPoint(rank) : '-';
    }
  });
}

// ── 確認・確定の共通ヘルパー ──────────────────────────────
let previewParams       = null;
let isConfirmed         = false;
let participatingTobans = new Set();  // 確認時に出走したtoban一覧（確定後シアン用）
const LS_KEY = 'liveScoreFormState';

function _resetConfirm() {
  // 確定済み状態では何もしない（誤操作でボタンが復活しない）
  if (isConfirmed) return;
  previewParams = null;
  document.getElementById('previewBtn').disabled = false;
  document.getElementById('confirmBtn').disabled = true;
}

function _afterConfirm() {
  isConfirmed   = true;
  previewParams = null;
  document.getElementById('previewBtn').disabled = true;
  document.getElementById('confirmBtn').disabled = true;
  // フォームをグレーアウト（値は見えたまま変更不可）
  document.querySelectorAll('.boat-select').forEach(sel => sel.disabled = true);
}

function _unlockForm() {
  // 新しいレースを選んだときだけ解除
  isConfirmed = false;
  document.querySelectorAll('.boat-select').forEach(sel => sel.disabled = false);
}

function _buildParams() {
  const selects = document.querySelectorAll('.boat-select');
  const results = [];
  selects.forEach(sel => {
    if (sel.value) {
      results.push({ toban: parseInt(sel.value), rank: parseInt(sel.dataset.rank) });
    }
  });
  return { race_no: currentRaceNo, race_type: currentRaceType, point_table: POINT_TABLE, results };
}

// ── フォーム状態の保存・復元 ──────────────────────────────
function _saveFormState() {
  const boats = [];
  document.querySelectorAll('.boat-select').forEach(sel => {
    if (sel.value) {
      boats.push({ rank: parseInt(sel.dataset.rank), toban: parseInt(sel.value) });
    }
  });
  localStorage.setItem(LS_KEY, JSON.stringify({
    raceNo:   currentRaceNo,
    raceType: currentRaceType,
    boats,
  }));
}

function _restoreFormState() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(LS_KEY)); } catch { return; }
  if (!saved || !saved.raceNo) return;

  // レース種別を復元
  if (saved.raceType) {
    document.querySelectorAll('.race-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === saved.raceType);
    });
    currentRaceType = saved.raceType;
  }

  // レース番号ボタンを復元
  document.querySelectorAll('.race-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.race) === saved.raceNo);
  });
  currentRaceNo = saved.raceNo;

  // 番組を取得して号艇選択を復元
  loadRaceProgram(saved.raceNo, () => {
    (saved.boats || []).forEach(({ rank, toban }) => {
      const sel = document.querySelector(`.boat-select[data-rank="${rank}"]`);
      if (sel) {
        sel.value = toban;
        sel.dispatchEvent(new Event('change'));
      }
    });
    refreshPointCells();
    // 確定済みレースなら両ボタン無効化
    _afterConfirm();
  });
}

// ── 確認ボタン ────────────────────────────────────────────
document.getElementById('previewBtn').addEventListener('click', async () => {
  const params = _buildParams();
  if (params.results.length === 0) { alert('着順が入力されていません'); return; }
  if (!currentRaceType)            { alert('レース種別を選択してください'); return; }

  // 出走者tobanを記録（確定後の得点・得点率シアンハイライト用）
  participatingTobans = new Set(params.results.map(r => String(r.toban)));
  console.log('[preview] participatingTobans:', [...participatingTobans]);

  // 確認対象セル（toban_slot）を収集
  const previewCells = new Set();
  document.querySelectorAll('.boat-select').forEach(sel => {
    if (sel.value) {
      const slot = sel.selectedOptions[0].dataset.slot;
      if (slot) previewCells.add(`${sel.value}_${slot}`);
    }
  });

  const res  = await fetch('/live_score/api/preview/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
    body:    JSON.stringify(params),
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  if (data.rows) {
    updateScoreTable(data.rows, previewCells, participatingTobans);
    previewParams = params;
    document.getElementById('confirmBtn').disabled = false;
  }
});

// ── 確定ボタン ────────────────────────────────────────────
document.getElementById('confirmBtn').addEventListener('click', async () => {
  if (!previewParams) return;

  const res  = await fetch('/live_score/api/confirm/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
    body:    JSON.stringify(previewParams),
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  if (data.rows) {
    if (data.manual_cells) MANUAL_CELLS = new Set(data.manual_cells);
    updateScoreTable(data.rows, new Set(), participatingTobans);
    _saveFormState();
    _afterConfirm();
  }
});

// ── 初期化ボタン ──────────────────────────────────────────
document.getElementById('resetSessionBtn').addEventListener('click', async () => {
  if (!confirm('手入力情報を削除します。')) return;
  try {
    const res  = await fetch('/live_score/api/reset_session/', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'ok') {
      localStorage.removeItem(LS_KEY);
      location.reload();
    } else {
      alert(`エラー: ${data.error}`);
    }
  } catch (e) {
    alert(`通信エラー: ${e}`);
  }
});

// ── 得点率表を更新 ────────────────────────────────────────
function updateScoreTable(rows, extraCells = new Set(), changedTobans = null) {
  const tbody   = document.getElementById('scoreBody');
  const headers = Array.from(document.querySelectorAll('#scoreTable thead th')).map(th => th.textContent);
  const cells   = new Set([...MANUAL_CELLS, ...extraCells]);
  if (changedTobans) console.log('[updateScoreTable] changedTobans:', [...changedTobans], '/ row 登録番号 sample:', rows.slice(0,3).map(r => r['登録番号']));

  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.toban = row['登録番号'];
    const tobanStr = String(row['登録番号']);

    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = row[h] ?? '';
      if (RUN_COLS.includes(h) && cells.has(`${row['登録番号']}_${h}`)) {
        td.classList.add('filled');
      }
      // 確定時：出走した選手の得点・得点率セルをシアンでハイライト
      if (changedTobans && changedTobans.has(tobanStr) && (h === '得点' || h === '得点率')) {
        console.log('[changed] toban:', tobanStr, 'col:', h);
        td.classList.add('changed');
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ── ページ読み込み時にフォーム状態を復元 ──────────────────
_restoreFormState();
