Chart.defaults.elements.bar.borderWidth = 0.6;
    Chart.defaults.elements.bar.borderColor = 'rgba(255,255,255,0.6)';
    Chart.defaults.elements.bar.backgroundColor = 'rgba(54, 162, 235, 0.7)';
    Chart.defaults.elements.bar.borderRadius = 2;
    Chart.defaults.elements.bar.borderSkipped = false;

const labels = JSON.parse(document.getElementById('labels-json').textContent);
    const data   = JSON.parse(document.getElementById('values-json').textContent);

    const ctx = document.getElementById('myChart');
    const myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '得点率',
          data: data,
          // ★ バー見た目の最小調整（データは触らない）
          categoryPercentage: 0.82,
          barPercentage: 0.90,
          maxBarThickness: 10,
          borderWidth: 0.6,
          borderColor: 'rgba(255,255,255,0.6)',
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderRadius: 2,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#fff' } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: {
            ticks: { color: '#fff', maxRotation: 90, minRotation: 90, autoSkip: false, font: { size: 8 } },
            grid: { color: 'rgba(255,255,255,0.1)' }
          },
          y: {
            ticks: { color: '#fff', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        }
      }
    });

    // ------ 以下は既存の機能（データは変更しない） ------
    function findDataset(pred) { return myChart.data.datasets.findIndex(pred); }
    function computeAverage(arr){ return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }

    function sortChart(ascending = true) {
      const combined = myChart.data.labels.map((label, i) => ({ label, value: myChart.data.datasets[0].data[i] }));
      combined.sort((a,b)=> ascending ? (a.value-b.value) : (b.value-a.value));
      myChart.data.labels = combined.map(i=>i.label);
      myChart.data.datasets[0].data = combined.map(i=>i.value);

      const thrIdx = findDataset(ds => ds._isThresholdLine === true);
      if (thrIdx !== -1) {
        const val = myChart.data.datasets[thrIdx]._thresholdValue;
        myChart.data.datasets[thrIdx].data = Array(myChart.data.labels.length).fill(val);
      }
      myChart.update();
    }

    

    function setOrUpdateThresholdLine(value) {
      const num = Number(value);
      const idx = findDataset(ds => ds._isThresholdLine === true);

      if (!value?.toString().trim() || Number.isNaN(num)) {
        if (idx !== -1) myChart.data.datasets.splice(idx, 1);
        myChart.update(); return;
      }

      const rounded = Math.round(num * 100) / 100;
      const lineData = Array(myChart.data.labels.length).fill(rounded);

      if (idx !== -1) {
        const ds = myChart.data.datasets[idx];
        ds.data = lineData; ds._thresholdValue = rounded;
      } else {
        myChart.data.datasets.push({
          type:'line', label:'想定ボーダー', data: lineData,
          borderColor:'#00e5ff', borderWidth:2, pointRadius:0, borderDash:[2,2], tension:0,
          _isThresholdLine:true, _thresholdValue: rounded
        });
      }
      myChart.update();
    }

    document.getElementById('sort-asc').addEventListener('click', () => sortChart(true));
    document.getElementById('sort-desc').addEventListener('click', () => sortChart(false));
    
    const thrInput = document.getElementById('threshold-input');
    thrInput.addEventListener('input', (e) => setOrUpdateThresholdLine(e.target.value));
    thrInput.addEventListener('change', (e) => setOrUpdateThresholdLine(e.target.value));