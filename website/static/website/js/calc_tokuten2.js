const data = JSON.parse(document.getElementById("data-json").textContent);

const { createApp, ref, reactive, onMounted, watch, computed } = Vue;
const labels = ref([...data["name"]]); // 名前配列（Y軸ラベルは選手名）
const points = ref([...data["point"]]); // 得点配列（数値）
const counts = ref([...data["count"]]);
const cyakujyun = ref([...data["cyakujyun"]]);

// 元の順序を “現在のデータ” でスナップショット（名前も得点も保持）
const originalLabels = ref([...labels.value]);
const originalPoints = ref([...points.value]);
const originalCounts = ref([...counts.value]);
const originalcyakujyun = ref([...cyakujyun.value]);
createApp({
  setup() {
    /** -------------------------
     * データ定義（まとめて宣言）
     * ------------------------- */
    const borderValue = ref(6.00); // ボーダー値
    const sortOrder = ref(null); // ソート状態
    const currentTime = ref(""); // 現在時刻表示
    // 左パネル：追加データ（targets は選手名の配列に）
    const adds = reactive(
      Array.from({ length: 6 }, () => ({ value: "", target: "" }))
    );
    // 合格ライン計算用
    const selectedPlayer = ref("");
    const remainingRaces = ref(1);
    const requiredPointsText = computed(() => {
      if (!selectedPlayer.value) return "";
      const idx = labels.value.indexOf(selectedPlayer.value);
      if (idx === -1) return "";

      const currentP = points.value[idx] ?? 0;
      const currentC = counts.value[idx] ?? 0;
      const totalC = currentC + remainingRaces.value;
      const target = borderValue.value * totalC;
      const needed = target - currentP;

      if (needed <= 0) return "無事故当確";
      const maxPossible = remainingRaces.value * 12;
      if (needed > maxPossible)
        return `必要 ${needed.toFixed(2)}点 (到達不可能)`;
      return `必要 ${needed.toFixed(2)}点`;
    });
    // 左パネル用：選手名のドロップダウン候補（右の labels はそのまま）
    const nameOptions = computed(() => labels.value);
    const addedMap = computed(() => {
      const m = Object.create(null);
      labels.value.forEach((n) => {
        m[n] = 0;
      });
      adds.forEach((a) => {
        // 両方が選ばれている場合のみ加算
        if (a.target && a.value !== "" && a.value != null) {
          m[a.target] = (m[a.target] || 0) + Number(a.value);
        }
      });
      return m;
    });
    // 追加回数：選手ごとの件数（選択があれば1カウント／値が0でも出走としてカウント）
    const addedCountMap = computed(() => {
      const m = Object.create(null);
      labels.value.forEach((n) => {
        m[n] = 0;
      });
      adds.forEach((a) => {
        // 両方が選ばれている場合のみカウント
        if (a.target && a.value !== "" && a.value != null) {
          m[a.target] = (m[a.target] || 0) + 1;
        }
      });
      return m;
    });
    // 現在の平均（point / count）
    const currentAvg = computed(() =>
      labels.value.map((_, idx) => {
        const p = Number(points.value[idx] ?? 0);
        const c = Number(counts.value[idx] ?? 0);
        return c ? p / c : 0;
      })
    );
    // 追加適用後の平均 = (point + 追加合計) / (count + 追加回数)
    const newAvg = computed(() =>
      labels.value.map((name, idx) => {
        const p = Number(points.value[idx] ?? 0);
        const c = Number(counts.value[idx] ?? 0);
        const ap = Number(addedMap.value[name] ?? 0);
        const ac = Number(addedCountMap.value[name] ?? 0);
        const denom = c + ac;
        return denom ? (p + ap) / denom : 0;
      })
    );
    // スタック表示用の差分（新平均 - 現平均）
    const deltaAvg = computed(() =>
      newAvg.value.map((v, i) => v - currentAvg.value[i])
    );
    // 平均 = point / count をリストで用意（分母0は 0 とする）
    const averages = computed(() =>
      labels.value.map((_, idx) => {
        const p = Number(points.value[idx] ?? 0);
        const c = Number(counts.value[idx] ?? 0);
        return c ? p / c : 0;
      })
    );

    // Chart.js インスタンス保持用
    let chartInstance = null;
    let axisInstance = null;

    /** -------------------------
     * 補助関数
     * ------------------------- */
    function getBorderColors() {
      return labels.map((label) => {
        const v = originalData[label];
        return v > borderValue.value
          ? "rgba(255,152,0,0.8)"
          : "rgba(102,126,234,0.8)";
      });
    }

    function parseTargets(str) {
      if (!str) return [];
      const items = [];
      str.split(",").forEach((part) => {
        if (part.includes("-")) {
          const [s, e] = part.split("-").map(Number);
          for (let i = s; i <= e; i++) items.push(`項目 ${i}`);
        } else {
          const n = Number(part);
          if (n >= 1 && n <= 60) items.push(`項目 ${n}`);
        }
      });
      return items;
    }

    function getDataset() {
      const datasets = [
        {
          label: "元の値",
          data: labels.map((l) => originalData[l]),
          backgroundColor: getBorderColors(),
          borderColor: getBorderColors().map((c) => c.replace("0.8", "1")),
          borderWidth: 2,
        },
      ];
      adds.forEach((add, i) => {
        const targets = parseTargets(add.targets);
        const map = labels.map((l) => (targets.includes(l) ? add.value : 0));
        datasets.push({
          label: `追加${i + 1}`,
          data: map,
          backgroundColor: "rgba(200,200,200,0.4)",
        });
      });
      return datasets;
    }

    /** -------------------------
     * Chart描画処理
     * ------------------------- */

    function renderChart() {
      const ctx = document.getElementById("myChart");
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels.value,
          datasets: (() => {
            const basePart = labels.value.map((_, i) =>
   Math.min(currentAvg.value[i], newAvg.value[i])
 );
 const incPart = labels.value.map((_, i) =>
   Math.max(newAvg.value[i] - currentAvg.value[i], 0)
 );

 return [
   {
     label: "得点率",
     data: basePart,
     backgroundColor: "rgba(102,126,234,0.8)", // 青
     borderColor: "rgba(102,126,234,1)",
     borderWidth: 2,
     stack: "score"
   },
   {
     label: "増加分",
     data: incPart,
     backgroundColor: "rgba(255,152,0,0.8)", // オレンジ
     borderColor: "rgba(255,152,0,1)",
     borderWidth: 2,
     stack: "score"
   }
 ]; 
 




 
          })(),
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: { color: "#fff" }, // ★凡例ラベルを白に
            },
            annotation: {
              annotations: {
                borderLine: {
                  type: "line",
                  xMin: borderValue.value,
                  xMax: borderValue.value,
                  borderColor: "red",
                  borderWidth: 2,
                  borderDash: [6, 6],
                  label: {
                    content: `ボーダー ${borderValue.value.toFixed(2)}`,
                    enabled: true,
                    position: "start",
                    color: "white",
                    backgroundColor: "rgba(0,0,0,0.6)",
                  },
                },
              },
            },
          },
          scales: {
            y: {
              stacked: true,
              ticks: {
                autoSkip: false,
                font: { size: 14 },
                color: "#fff",
                callback: function(value, index) {
                  const total = newAvg.value[index];
                  const rank = cyakujyun.value[index] || "";
                  return `${labels.value[index]} (${total.toFixed(2)}) 着順:${rank}`;
                }
              },
              grid: {
                color: (ctx) => {
                  if (ctx.index === 18) return "cyan"; // 18行目だけ色
                  if (ctx.index % 6 === 0) return "white";
                  return `rgba(255,255,255,0.1)`;
                },
                lineWidth: (ctx) => (ctx.index === 18 ? 3 : 1),
                drawTicks: false,
                drawBorder: false,
              }
            },
            x: {
              display: false,
              beginAtZero: true ,  // ★ 追加：棒グラフ開始位置を0に固定
              min: 0,              // ★ 追加：軸チャートと完全一致
              max: 13              // ★ 追加：軸チャートと完全一致
            }
          }




        },

      });

      const axisCtx = document.getElementById("axisChart");
      if (axisInstance) axisInstance.destroy();
      axisInstance = new Chart(axisCtx, {
        type: "bar",
        data: {
          labels: labels.value,
          datasets: [
            {
              data: labels.value.map(() => 0),
              backgroundColor: "rgba(0,0,0,0)",
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
           x: {
              min: 0,
              max: 13,
              ticks: { stepSize: 1, color: "#fff" },
            },      

            y: {
              type: "category",
              ticks: { 
                autoSkip: false,
                font: { size: 14 },
                color: "rgba(0,0,0,0)",  // ★ 透明にして見えなくする
                callback: function(value, index) {
                  const total = newAvg.value[index];
                  return `${labels.value[index]} (${total.toFixed(2)})`;
                }
              },
              grid: { display: false }



            }

          },
        },
      });
    }

    /** -------------------------
     * UI操作関数
     * ------------------------- */
    function updateData() {
      labels.forEach((label) => {
        originalData[label] = Math.floor(Math.random() * 13);
      });
      sortOrder.value = null;
      renderChart();
      updateTime();
    }
    function toggleSort() {
      if (sortOrder.value) {
        // 元に戻す：初期スナップショットから完全復元（元の並び＋元の点数）
        sortOrder.value = null;
        labels.value = [...originalLabels.value];
        points.value = [...originalPoints.value];
        counts.value = [...originalCounts.value];
      } else {
        // 新平均（(point+追加)/(count+追加回数)）で降順ソート
        sortOrder.value = "desc";
        // 名前→元点 のマップを作成
        const baseByName = Object.create(null);
        labels.value.forEach((name, idx) => {
          baseByName[name] = points.value[idx];
        });

        const countByName = Object.create(null);
        labels.value.forEach((name, idx) => {
          countByName[name] = counts.value[idx];
        });
        const addedSumByName = Object.create(null);
        const addedTimesByName = Object.create(null);
        labels.value.forEach((name) => {
          addedSumByName[name] = addedMap.value[name] ?? 0;
          addedTimesByName[name] = addedCountMap.value[name] ?? 0;
        });
        const avgOf = (name) => {
          const p = baseByName[name] || 0;
          const c = countByName[name] || 0;
          const ap = addedSumByName[name] || 0;
          const ac = addedTimesByName[name] || 0;
          const denom = c + ac;
          return denom ? (p + ap) / denom : 0;
        };
        const sortedNames = [...labels.value].sort(
          (a, b) => avgOf(b) - avgOf(a)
        );

        // 並びを適用：labels は名前順、points は対応する元点を再配置
        labels.value = sortedNames;
        points.value = sortedNames.map((n) => baseByName[n]);
        counts.value = sortedNames.map((n) => countByName[n]);
      }
      renderChart();
    }

    function updateTime() {
      const now = new Date();
      currentTime.value = `${
        now.getMonth() + 1
      }月${now.getDate()}日 ${now.getHours()}時${now.getMinutes()}分 現在`;
    }

    /** -------------------------
     * ライフサイクル
     * ------------------------- */
    onMounted(() => {
      renderChart();
      updateTime();
      setInterval(updateTime, 60000);
    });

    watch([borderValue, adds], renderChart, { deep: true });

    return {
      borderValue,
      adds,
      currentTime,
      updateData,
      toggleSort,
      sortOrder,
      nameOptions,
      averages,
      selectedPlayer,
      remainingRaces,
      requiredPointsText,
    };
  },
}).mount("#app");
