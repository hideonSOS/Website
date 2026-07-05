document.addEventListener('DOMContentLoaded', () => {
  const raceSelect = document.getElementById('raceNo');
  const borderInput = document.getElementById('borderScore');
  const rows = document.querySelectorAll('.score-v2-table tbody tr');

  // 着順による得点（1着〜6着）
  const RANK_POINTS = [10, 8, 6, 4, 2, 1];

  // 必要得点 = ボーダー × (出走回数 + 残り走数) − (得点 − 減点)
  // 残り走数: 2走情報あり=2走（選択レース+後続）/ なし=ラスト1走
  function calcRequiredPoints(racer, border) {
    const remaining = racer.next_race != null ? 2 : 1;
    const needed = border * (racer.races + remaining) - (racer.points - racer.deduction);
    return Math.max(needed, 0);
  }

  // 早見表: 次走が rank 着だった場合の得点率
  function calcSimulatedScore(racer, rankIndex) {
    return (racer.points + RANK_POINTS[rankIndex] - racer.deduction) / (racer.races + 1);
  }

  // 早見表下段: その着順で必要得点を満たすかの判定
  // 残り2走の場合、後続レースは最低でも6着=1点は取れる（無事故完走）前提で当確判定
  function judgeCell(racer, rankIndex, border) {
    const remaining = racer.next_race != null ? 2 : 1;
    const needed = border * (racer.races + remaining) - (racer.points - racer.deduction);
    const shortfall = needed - RANK_POINTS[rankIndex];
    const guaranteed = remaining - 1; // 後続レースで最低限取れる点
    if (shortfall <= guaranteed) {
      return { ok: true, text: '無事故当確' };
    }
    return { ok: false, text: shortfall.toFixed(2) };
  }

  async function loadRaceProgram() {
    // 読み込み中表示
    rows.forEach((tr) => {
      tr.cells[1].textContent = '…';
      tr.cells[2].textContent = '';
      tr.cells[3].textContent = '';
      for (let c = 4; c <= 9; c++) {
        tr.cells[c].querySelector('.sim-upper').textContent = '';
        const lower = tr.cells[c].querySelector('.sim-lower');
        lower.textContent = '';
        lower.classList.remove('sim-ok', 'sim-lack');
      }
      tr.cells[10].textContent = '';
      tr.cells[11].textContent = '';
    });
    try {
      const res = await fetch(`api/race_program/?rno=${raceSelect.value}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const border = parseFloat(borderInput.value) || 0;
      rows.forEach((tr, i) => {
        const racer = (data.racers || []).find((r) => r.boat === i + 1);
        tr.cells[1].textContent = racer ? racer.name : '';
        tr.cells[2].textContent = racer && racer.score != null ? racer.score.toFixed(2) : '';
        tr.cells[3].textContent = racer && racer.rank != null ? racer.rank : '';
        for (let ri = 0; ri < 6; ri++) {
          tr.cells[4 + ri].querySelector('.sim-upper').textContent =
            racer ? calcSimulatedScore(racer, ri).toFixed(2) : '';
          const lower = tr.cells[4 + ri].querySelector('.sim-lower');
          lower.classList.remove('sim-ok', 'sim-lack');
          if (racer) {
            const judge = judgeCell(racer, ri, border);
            lower.textContent = judge.text;
            lower.classList.add(judge.ok ? 'sim-ok' : 'sim-lack');
          } else {
            lower.textContent = '';
          }
        }
        tr.cells[10].textContent = racer ? calcRequiredPoints(racer, border).toFixed(2) : '';
        tr.cells[11].textContent = racer && racer.next_race != null ? `${racer.next_race}R` : '';
        tr.dataset.toban = racer ? racer.toban : '';
      });
    } catch (e) {
      console.error('[live_score_v2] 出走表取得エラー:', e);
      rows.forEach((tr) => { tr.cells[1].textContent = ''; });
    }
  }

  const runBtn = document.getElementById('runBtn');
  const overlay = document.getElementById('loadingOverlay');
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    overlay.hidden = false;   // 通信中オーバーレイ表示（操作を遮断）
    try {
      await loadRaceProgram();
    } finally {
      overlay.hidden = true;  // 通信完了で解除
      runBtn.disabled = false;
    }
  });
});
