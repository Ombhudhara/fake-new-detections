/* ============================================================
   GLOBAL STATE
   ============================================================ */
const state = {
  activeFilter: 'overall',
  activeCountry: null,
  activeRegion: 'worldwide',
  lastSyncTime: null
};

// Reference to AnalyticsState from analytics-state.js
// This will be available after analytics-state.js is loaded
const getSelectedCountry = () => window.AnalyticsState?.selectedCountry || 'Worldwide';

/* ============================================================
   DATA SETS
   ============================================================ */
// map: country name (as TopoJSON) → score
const mapData = {
  overall: {
    'United States of America':92,'India':88,'Brazil':76,'Nigeria':84,
    'Indonesia':71,'Russia':79,'Pakistan':82,'Bangladesh':69,
    'Philippines':73,'Mexico':65,'United Kingdom':58,'Germany':45,
    'France':42,'Italy':48,'Spain':40,'China':66,'Japan':32,
    'South Korea':30,'Australia':35,'South Africa':61,'Kenya':55,
    'Egypt':67,'Turkey':70,'Iran':74,'Saudi Arabia':52,'Argentina':60,
    'Colombia':58,'Thailand':54,'Vietnam':50,'Canada':38
  },
  health: {
    'United States of America':95,'India':91,'Brazil':82,'Nigeria':88,
    'Pakistan':86,'Bangladesh':75,'Philippines':79,'Mexico':71,
    'Indonesia':78,'Russia':60,'United Kingdom':50,'Germany':38,
    'China':58,'Egypt':72,'Turkey':68,'Iran':76
  },
  politics: {
    'Russia':92,'China':75,'United States of America':89,'India':84,
    'Brazil':71,'Turkey':78,'Iran':80,'Nigeria':77,'United Kingdom':65,
    'Germany':52,'France':50,'Italy':55,'Pakistan':75,'Mexico':59
  },
  finance: {
    'India':80,'China':70,'United States of America':82,'Brazil':70,
    'Nigeria':76,'Indonesia':64,'Argentina':65,'Colombia':62,
    'South Africa':58,'Russia':68,'Pakistan':60,'Egypt':63
  },
  deepfakes: {
    'United States of America':88,'China':82,'Russia':78,
    'United Kingdom':65,'India':72,'South Korea':60,'Japan':45,
    'Germany':55,'France':48,'Brazil':58,'Iran':70,'Turkey':65
  }
};

// Category data per filter (with display counts)
const catData = {
  overall:  { h:2847, po:2210, fi:1430, te:890,  in:630, lo:320 },
  health:   { h:4200, po:800,  fi:400,  te:320,  in:180, lo:100 },
  politics: { h:500,  po:3600, fi:600,  te:420,  in:840, lo:220 },
  finance:  { h:380,  po:610,  fi:3200, te:540,  in:290, lo:160 },
  deepfakes:{ h:620,  po:940,  fi:380,  te:2800, in:420, lo:130 }
};

// Radar data per filter
const radarData = {
  overall: {
    r1_this:  [75,60,80,70,65,55],
    r1_last:  [55,70,60,50,75,65],
    r2_wh:    [85,78,70,90,95,88],
    r2_pub:   [60,55,75,65,40,50],
    r3_vuln:  [90,72,45,58,38,65]
  },
  health: {
    r1_this:  [88,65,92,75,80,60],
    r1_last:  [60,55,70,58,68,52],
    r2_wh:    [92,86,75,95,96,90],
    r2_pub:   [58,62,70,60,38,45],
    r3_vuln:  [96,55,38,42,30,50]
  },
  politics: {
    r1_this:  [70,75,78,60,72,68],
    r1_last:  [52,68,58,48,70,60],
    r2_wh:    [76,80,68,82,92,84],
    r2_pub:   [70,68,80,72,44,58],
    r3_vuln:  [62,90,42,55,72,60]
  },
  finance: {
    r1_this:  [68,55,72,65,60,48],
    r1_last:  [50,62,55,45,68,58],
    r2_wh:    [78,72,65,85,88,80],
    r2_pub:   [55,50,70,60,36,45],
    r3_vuln:  [52,65,88,60,42,55]
  },
  deepfakes: {
    r1_this:  [82,72,75,88,70,60],
    r1_last:  [60,65,58,72,62,55],
    r2_wh:    [80,75,68,88,90,82],
    r2_pub:   [72,65,78,82,42,52],
    r3_vuln:  [68,72,48,90,40,58]
  }
};

const regionCountries = {
  'asia-pacific': ['China','Japan','South Korea','Australia','Indonesia','Philippines','Thailand','Vietnam'],
  'south-asia':   ['India','Pakistan','Bangladesh'],
  'europe':       ['United Kingdom','Germany','France','Italy','Spain','Russia'],
  'americas':     ['United States of America','Brazil','Mexico','Argentina','Colombia','Canada'],
  'mea':          ['Nigeria','South Africa','Kenya','Egypt','Saudi Arabia','Iran','Turkey']
};

/* ============================================================
   CHART.JS UTILS
   ============================================================ */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ============================================================
   CATEGORY DONUT CHART (categoryChart)
   ============================================================ */
let categoryChart;
const DONUT_COLORS = ['#E8453C','#7F77DD','#F5A623','#4A90D9','#27AE60','#e07b35'];

function buildDonut() {
  const ctx = document.getElementById('donutChart').getContext('2d');
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Health','Politics','Finance','Technology','International','Local'],
      datasets: [{
        data: [34.2, 26.5, 17.2, 10.7, 7.6, 3.8],
        backgroundColor: DONUT_COLORS,
        borderWidth: 2,
        borderColor: '#fff',
        hoverBorderWidth: 0
      }]
    },
    options: {
      cutout: '65%',
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      animation: { duration: 600 }
    }
  });
}

function updateDonut(filter, countryName) {
  const cd = getCatValues(filter, countryName);
  const total = cd.h + cd.po + cd.fi + cd.te + cd.in + cd.lo;
  const pcts = [cd.h, cd.po, cd.fi, cd.te, cd.in, cd.lo].map(v => parseFloat((v/total*100).toFixed(1)));

  categoryChart.data.datasets[0].data = pcts;
  categoryChart.update();

  // update legend percentages
  const ids = ['l-health','l-politics','l-finance','l-tech','l-intl','l-local'];
  ids.forEach((id,i) => { document.getElementById(id).textContent = pcts[i]+'%'; });
}

/* ============================================================
   RADAR CHARTS
   ============================================================ */
let radar1, radar2, radar3;

const radarDefaults = {
  scales: {
    r: {
      min: 0, max: 100,
      ticks: { stepSize: 20, font: { size: 9 }, color: '#999', backdropColor: 'transparent' },
      grid: { color: 'rgba(0,0,0,0.08)' },
      pointLabels: { font: { size: 11, family: 'Space Grotesk' }, color: '#444' },
      angleLines: { color: 'rgba(0,0,0,0.08)' }
    }
  },
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  responsive: true,
  animation: { duration: 600 }
};

function buildRadars() {
  const d = radarData.overall;

  radar1 = new Chart(document.getElementById('radarChart1').getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Virality','Reach','Severity','Speed','Impact','Recurrence'],
      datasets: [
        { label:'This Month', data: d.r1_this, borderColor:'#E8453C', backgroundColor: hexToRgba('#E8453C',.15), pointBackgroundColor:'#E8453C', pointRadius:3, borderWidth:2, fill:true },
        { label:'Last Month', data: d.r1_last, borderColor:'#4A90D9', backgroundColor: hexToRgba('#4A90D9',.15), pointBackgroundColor:'#4A90D9', pointRadius:3, borderWidth:2, fill:true }
      ]
    },
    options: radarDefaults
  });

  radar2 = new Chart(document.getElementById('radarChart2').getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Spread Rate','Fake Share','Engagement','Reach','Anonymity','Moderation Gap'],
      datasets: [
        { label:'WhatsApp Internal', data: d.r2_wh,  borderColor:'#27AE60', backgroundColor: hexToRgba('#27AE60',.15), pointBackgroundColor:'#27AE60', pointRadius:3, borderWidth:2, fill:true },
        { label:'Public Platforms',  data: d.r2_pub, borderColor:'#4A90D9', backgroundColor: hexToRgba('#4A90D9',.15), pointBackgroundColor:'#4A90D9', pointRadius:3, borderWidth:2, fill:true }
      ]
    },
    options: radarDefaults
  });

  radar3 = new Chart(document.getElementById('radarChart3').getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Health','Politics','Finance','Technology','International','Local'],
      datasets: [
        { label:'Sector-specific Risk Score', data: d.r3_vuln,
          borderColor:'#7F77DD', backgroundColor: hexToRgba('#7F77DD',.15),
          pointBackgroundColor: ['#E8453C','#7F77DD','#F5A623','#4A90D9','#27AE60','#e07b35'],
          pointRadius: 4, borderWidth:2, fill:true }
      ]
    },
    options: radarDefaults
  });
}

function updateRadars(filter, countryName) {
  let d;
  if (countryName) {
    // Generate country-specific offsets
    const score = mapData[filter][countryName] || mapData.overall[countryName] || 50;
    const jitter = (base) => Math.min(100, Math.max(10, base + (score - 65) * 0.4 + (Math.random()-0.5)*8));
    const rd = radarData[filter] || radarData.overall;
    d = {
      r1_this:  rd.r1_this.map(jitter),
      r1_last:  rd.r1_last.map(v => jitter(v-10)),
      r2_wh:    rd.r2_wh.map(jitter),
      r2_pub:   rd.r2_pub.map(v => jitter(v-5)),
      r3_vuln:  rd.r3_vuln.map(jitter)
    };
  } else {
    d = radarData[filter] || radarData.overall;
  }

  radar1.data.datasets[0].data = d.r1_this;
  radar1.data.datasets[1].data = d.r1_last;
  radar1.update();

  radar2.data.datasets[0].data = d.r2_wh;
  radar2.data.datasets[1].data = d.r2_pub;
  radar2.update();

  radar3.data.datasets[0].data = d.r3_vuln;
  radar3.update();
}

/* ============================================================
   CATEGORY BARS
   ============================================================ */
function getCatValues(filter, countryName) {
  let base = catData[filter] || catData.overall;
  if (countryName) {
    const score = mapData[filter]?.[countryName] || mapData.overall?.[countryName] || 50;
    const scale = score / 80;
    return { h: Math.round(base.h * scale), po: Math.round(base.po * scale),
             fi: Math.round(base.fi * scale), te: Math.round(base.te * scale),
             in: Math.round(base.in * scale), lo: Math.round(base.lo * scale) };
  }
  return base;
}

function animateBars(filter, countryName) {
  const cd = getCatValues(filter, countryName);
  const max = Math.max(cd.h, cd.po, cd.fi, cd.te, cd.in, cd.lo);

  const bars = [
    { fill:'fill-health',   cnt:'cnt-health',  val:cd.h  },
    { fill:'fill-politics', cnt:'cnt-politics', val:cd.po },
    { fill:'fill-finance',  cnt:'cnt-finance',  val:cd.fi },
    { fill:'fill-tech',     cnt:'cnt-tech',     val:cd.te },
    { fill:'fill-intl',     cnt:'cnt-intl',     val:cd.in },
    { fill:'fill-local',    cnt:'cnt-local',    val:cd.lo }
  ];

  bars.forEach(b => {
    const fillEl = document.getElementById(b.fill);
    const cntEl  = document.getElementById(b.cnt);
    // reset first for re-animation
    fillEl.style.width = '0%';
    setTimeout(() => {
      fillEl.style.width = (b.val / max * 100).toFixed(1) + '%';
    }, 50);
    cntEl.textContent = b.val.toLocaleString();
  });
}

/* ============================================================
   D3 WORLD MAP
   ============================================================ */
let svgEl, pathGroup, colorScale, worldFeatures, projection, pathGen;
const tooltip = document.getElementById('map-tooltip');

function getColorScale(filter) {
  const vals = Object.values(mapData[filter] || mapData.overall);
  const max = Math.max(...vals, 1);
  return d3.scaleSequential()
    .domain([0, max])
    .interpolator(d3.interpolateRgbBasis(['#f5c0be','#d9534f','#8b1a1a']));
}

function buildMap(topo) {
  worldFeatures = topojson.feature(topo, topo.objects.countries).features;

  const container = document.getElementById('map-container');
  const W = container.clientWidth || 960;
  const H = Math.round(W * 0.52);

  projection = d3.geoNaturalEarth1()
    .scale(W / 6.4)
    .translate([W/2, H/2]);
  pathGen = d3.geoPath().projection(projection);

  svgEl = d3.select('#world-map')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('border-radius','10px');

  pathGroup = svgEl.append('g');

  colorScale = getColorScale('overall');

  pathGroup.selectAll('path')
    .data(worldFeatures)
    .enter().append('path')
    .attr('d', pathGen)
    .attr('fill', d => {
      const name = d.properties.name;
      const val  = mapData.overall[name];
      return val !== undefined ? colorScale(val) : '#e8e0d8';
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      const name = d.properties.name;
      const filter = state.activeFilter;
      const val = mapData[filter]?.[name] ?? mapData.overall?.[name];
      const topCat = val !== undefined ? getTopCat(filter, name) : '—';
      tooltip.style.opacity = '1';
      tooltip.style.left = (event.clientX + 14) + 'px';
      tooltip.style.top  = (event.clientY - 10) + 'px';
      tooltip.innerHTML = `
        <div class="t-country">${name}</div>
        <div class="t-score">Fake Index: ${val !== undefined ? val : 'No data'}</div>
        <div class="t-top">Top: ${topCat}</div>`;
    })
    .on('mouseleave', () => { tooltip.style.opacity = '0'; })
    .on('click', (event, d) => {
      const name = d.properties.name;
      if (!mapData[state.activeFilter]?.[name] && !mapData.overall?.[name]) return;
      selectCountry(name);
    });
}

function getTopCat(filter, name) {
  const labels = { overall:'Overall', health:'Health', politics:'Politics', finance:'Finance', deepfakes:'Deepfakes & AI' };
  return labels[filter] || 'General';
}

function updateMap(filter, highlightCountries) {
  colorScale = getColorScale(filter);
  const data = mapData[filter] || {};

  pathGroup.selectAll('path')
    .transition().duration(400)
    .attr('fill', d => {
      const name = d.properties.name;
      if (highlightCountries && !highlightCountries.includes(name)) return '#e8e0d8';
      const val = data[name];
      return val !== undefined ? colorScale(val) : '#e8e0d8';
    })
    .attr('opacity', d => {
      if (!highlightCountries) return 1;
      return highlightCountries.includes(d.properties.name) ? 1 : 0.35;
    });
}

function selectCountry(name) {
  state.activeCountry = name;
  // Show badge
  document.getElementById('badge-country-name').textContent = name;
  document.getElementById('country-badge').classList.remove('hidden');
  
  // Update through AnalyticsState if available
  if (window.AnalyticsState) {
    AnalyticsState.handleCountryChange(name);
  } else {
    updateAllCharts();
    triggerFeedRefresh();
  }
}

function clearCountry() {
  state.activeCountry = null;
  document.getElementById('country-badge').classList.add('hidden');
  
  // Reset to Worldwide through AnalyticsState if available
  if (window.AnalyticsState) {
    AnalyticsState.handleCountryChange('Worldwide');
  } else {
    updateAllCharts();
    triggerFeedRefresh();
  }
}

document.getElementById('clear-country-btn').addEventListener('click', clearCountry);

/* ============================================================
   FILTER PILLS - Integrated with AnalyticsState
   ============================================================ */
document.querySelectorAll('.pill[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill[data-filter]').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    state.activeFilter = btn.dataset.filter;
    
    // If AnalyticsState is available, update through state management
    if (window.AnalyticsState) {
      AnalyticsState.handleCategoryChange(btn.dataset.filter);
    } else {
      updateAllCharts();
      triggerFeedRefresh();
    }
  });
});

/* ============================================================
   REGION SELECTOR & LIVE DATA - Integrated with AnalyticsState
   ============================================================ */
document.getElementById('region-select').addEventListener('change', function() {
  state.activeRegion = this.value;
  state.activeCountry = null;
  document.getElementById('country-badge').classList.add('hidden');
  
  // Trigger refresh through AnalyticsState if available, otherwise direct fetch
  if (window.AnalyticsState) {
    AnalyticsState.refreshAnalytics();
  } else {
    fetchLiveData(this.value);
  }
});

function hideLoader(data) {
  const ts = data.timestamp || new Date().toLocaleTimeString();
  document.querySelectorAll('.chart-footer').forEach(el => {
    el.innerHTML = `<span class="live-status-pill active">● LIVE</span> Last synced: ${ts}`;
  });
}

// 5. FETCH FUNCTION - Uses API service with backend country filtering
function fetchLiveData(region, isAutoRefresh) {
  if (!isAutoRefresh) showLoader();
  
  // Get selected country from state
  const country = getSelectedCountry();
  
  // Fetch analytics data from backend via API service
  API.fetchAnalytics(country)
    .then(data => {
      updateCharts(data);
      state.lastSyncTime = new Date().toLocaleTimeString();
      hideLoader(data);
    })
    .catch(err => {
      console.error("[analytics.js] Live fetch error:", err);
      document.querySelectorAll('.chart-footer').forEach(el => {
        el.textContent = 'Connection lost. Retrying...';
      });
    });
}

// 4. AUTO LIVE REFRESH - Integrated with AnalyticsState auto-refresh
let analyticsRefreshTimer = null;
function startAnalyticsAutoRefresh() {
  // Auto-refresh is now managed by AnalyticsState.js
  // This function kept for backward compatibility
  console.log('[analytics.js] Auto-refresh is managed by AnalyticsState module');
}

// 6. UPDATE EXISTING CHARTS ONLY
function updateCharts(data) {
  // 1. Category Chart
  if (categoryChart && data.category_data) {
    categoryChart.data.datasets[0].data = data.category_data;
    categoryChart.update();
    
    // Legend percentages
    const total = data.category_data.reduce((a,b)=>a+b, 0) || 1;
    const pcts = data.category_data.map(v => parseFloat((v/total*100).toFixed(1)));
    const ids = ['l-health','l-politics','l-finance','l-tech','l-intl','l-local'];
    ids.forEach((id,i) => { 
      const el = document.getElementById(id);
      if (el) el.textContent = (pcts[i] || 0) + '%'; 
    });
  }

  // 2. Timeline Chart (velocityChart instance renamed concept)
  if (timelineChart && data.timeline_labels && data.timeline_values) {
    timelineChart.data.labels = data.timeline_labels;
    const platData = data.platform_data || [60, 25, 15];
    const totPlat = platData.reduce((a,b)=>a+b, 0) || 1;
    
    // Distribute live volume into the 3 platform lines
    timelineChart.data.datasets[0].data = data.timeline_values.map(v => Math.round(v * (platData[0]/totPlat)));
    timelineChart.data.datasets[1].data = data.timeline_values.map(v => Math.round(v * (platData[1]/totPlat)));
    timelineChart.data.datasets[2].data = data.timeline_values.map(v => Math.round(v * (platData[2]/totPlat)));
    timelineChart.update('none'); // silent update for performance
  }

  // 3. Heatmap
  if (data.heatmap_data) {
    updateHeatmap(data.heatmap_data);
  }

  // 4. Category Bars
  if (data.category_data) {
    const maxVal = Math.max(...data.category_data, 1);
    const mapping = ['health','politics','finance','tech','intl','local'];
    mapping.forEach((cat, i) => {
      const fillEl = document.getElementById('fill-' + cat);
      const cntEl = document.getElementById('cnt-' + cat);
      if (fillEl) fillEl.style.width = (data.category_data[i] / maxVal * 100).toFixed(1) + '%';
      if (cntEl) cntEl.textContent = Math.round(data.category_data[i] * 85).toLocaleString();
    });
  }
  
  // Secondary sync
  const highlight = (state.activeRegion !== 'worldwide' ? regionCountries[state.activeRegion] : null);
  updateMap(state.activeFilter, highlight);
  updateRadars(state.activeFilter, state.activeCountry);
  updateBubbleChart();
  updateTreemap();
}

function updateHeatmap(heatmap_data) {
  const grid = document.getElementById('heatmap-act-grid');
  if (!grid) return;
  const cells = grid.querySelectorAll('.heatmap-cell');
  cells.forEach(cell => {
    const r = parseInt(cell.dataset.h || 0);
    const c = parseInt(cell.dataset.d || 0);
    if (heatmap_data[r] && heatmap_data[r][c] !== undefined) {
      const val = heatmap_data[r][c];
      cell.dataset.v = val;
      cell.style.background = hmColor(val);
    }
  });
}

/* ============================================================
   UPDATE ALL CHARTS
   ============================================================ */
function updateAllCharts() {
  const f = state.activeFilter;
  const c = state.activeCountry;
  const r = state.activeRegion;

  // Map
  const highlight = r !== 'worldwide' ? regionCountries[r] : null;
  updateMap(f, highlight);

  // Bars
  animateBars(f, c);

  // Donut
  updateDonut(f, c);

  // Radars
  updateRadars(f, c);

  // 8 new charts
  updateVelocityChart();
  updateBubbleChart();
  updateHeatmapGrid();
  updateFunnelChart();
  updateTreemap();
  updateLifecycleChart();

  // Refresh footers
  const now = Date.now();
  document.querySelectorAll('.chart-footer').forEach(el => {
    el.textContent = 'Updated just now';
  });
}

/* ============================================================
   LIVE FEED LOGIC
   ============================================================ */

/* ── State maps for country → states ── */
const FEED_STATE_MAP = {
  'India': [
    'Maharashtra','Delhi','Karnataka','Tamil Nadu',
    'Gujarat','Uttar Pradesh','West Bengal','Rajasthan',
    'Kerala','Punjab','Telangana','Andhra Pradesh',
    'Madhya Pradesh','Bihar','Odisha'
  ],
  'United States': [
    'California','Texas','New York','Florida','Illinois',
    'Pennsylvania','Ohio','Georgia','North Carolina',
    'Michigan','New Jersey','Virginia','Washington',
    'Arizona','Tennessee'
  ],
  'Brazil': [
    'São Paulo','Rio de Janeiro','Minas Gerais','Bahia',
    'Paraná','Rio Grande do Sul','Pernambuco',
    'Ceará','Amazonas','Goiás'
  ],
  'United Kingdom': [
    'England','Scotland','Wales','Northern Ireland',
    'London','Manchester','Birmingham','Leeds','Glasgow'
  ],
  'Russia': [
    'Moscow','Saint Petersburg','Novosibirsk',
    'Siberia','Yekaterinburg','Kazan',
    'Nizhny Novgorod','Chelyabinsk'
  ],
  'Pakistan': [
    'Punjab','Sindh','KPK','Balochistan',
    'Islamabad','Gilgit-Baltistan','AJK'
  ],
  'Nigeria': [
    'Lagos','Abuja','Kano','Ibadan','Kaduna',
    'Port Harcourt','Benin City','Maiduguri'
  ],
  'Indonesia': [
    'Java','Sumatra','Kalimantan','Sulawesi',
    'Papua','Bali','West Java','East Java','Central Java'
  ],
  'Germany': [
    'Bavaria','Berlin','Hamburg',
    'North Rhine-Westphalia','Baden-Württemberg',
    'Saxony','Hesse','Brandenburg'
  ],
  'China': [
    'Guangdong','Beijing','Shanghai','Sichuan',
    'Zhejiang','Jiangsu','Hunan','Hebei'
  ],
  'Mexico': [
    'Mexico City','Jalisco','Nuevo León','Veracruz',
    'Puebla','Guanajuato','Chihuahua','Oaxaca'
  ],
  'South Africa': [
    'Gauteng','Western Cape','KwaZulu-Natal',
    'Eastern Cape','Limpopo','Mpumalanga'
  ],
  'Australia': [
    'New South Wales','Victoria','Queensland',
    'Western Australia','South Australia','Tasmania'
  ],
  'Canada': [
    'Ontario','Quebec','British Columbia','Alberta',
    'Manitoba','Saskatchewan','Nova Scotia'
  ],
  'France': [
    'Île-de-France','Provence','Normandy',
    'Brittany','Occitanie','Nouvelle-Aquitaine'
  ],
  'Italy': [
    'Lombardy','Lazio','Campania','Sicily',
    'Veneto','Piedmont','Tuscany','Emilia-Romagna'
  ],
  'Spain': [
    'Madrid','Catalonia','Andalusia','Valencia',
    'Galicia','Basque Country','Aragon'
  ],
  'Turkey': [
    'Istanbul','Ankara','Izmir','Bursa',
    'Adana','Gaziantep','Antalya','Konya'
  ]
};

/* ── Feed local state ── */
const feedState = {
  country:  'worldwide',
  state:    'all',
  source:   'all',
  category: 'all',
  autoRefresh: true,
  countdown: 45,
  loadedItems: [],
  page: 1
};

let feedCountdownTimer = null;

/* ── Country change handler ── */
function onFeedCountryChange(country) {
  feedState.country = country;
  feedState.state   = 'all';
  feedState.page    = 1;
  
  const stateGroup  = document.getElementById('feed-state-group');
  const stateSelect = document.getElementById('feed-state-select');
  
  const states = FEED_STATE_MAP[country];
  
  if (!states || country === 'worldwide') {
    stateGroup.style.display = 'none';
    stateSelect.value = 'all';
    state.activeCountry = null;
    state.activeRegion = 'worldwide';
  } else {
    stateGroup.style.display = 'flex';
    stateSelect.innerHTML =
      '<option value="all">📍 All States</option>' +
      states.map(s => `<option value="${s}">${s}</option>`).join('');
    stateSelect.value = 'all';
    
    // Sync with global analytics state
    state.activeCountry = country;
    state.activeRegion = 'worldwide'; // We'll treat country selection as global worldwide base for regions
  }
  
  updateFeedSummary();
  loadFeed();
  
  // Update Analytics Charts
  fetchLiveData(country);
}

/* ── State change handler ── */
function onFeedStateChange(selectedState) {
  feedState.state = selectedState;
  feedState.page  = 1;
  updateFeedSummary();
  loadFeed();
  
  // Update Analytics Charts dynamically based on state
  const location = selectedState === 'all' ? feedState.country : selectedState;
  fetchLiveData(location);
}

/* ── Source change handler ── */
function onFeedSourceChange(source) {
  feedState.source = source;
  feedState.page   = 1;
  updateFeedSummary();
  loadFeed();
}

/* ── Category change handler ── */
function onFeedCategoryChange(category) {
  feedState.category = category;
  feedState.page     = 1;
  updateFeedSummary();
  loadFeed();
}

/* ── Auto-refresh toggle ── */
function onAutoRefreshToggle(checkbox) {
  feedState.autoRefresh = checkbox.checked;
  if (feedState.autoRefresh) {
    startFeedCountdown();
  } else {
    clearInterval(feedCountdownTimer);
    document.getElementById('feed-countdown').textContent = 'Auto-refresh off';
  }
}

/* ── Update summary line ── */
function updateFeedSummary() {
  const parts = [];
  if (feedState.country !== 'worldwide') parts.push(feedState.country);
  if (feedState.state !== 'all') parts.push(feedState.state);
  if (feedState.source !== 'all') parts.push(feedState.source);
  if (feedState.category !== 'all') parts.push(feedState.category);
  
  const summary = parts.length > 0
    ? 'Showing: ' + parts.join(' · ')
    : 'Showing: Worldwide · All Platforms · All Categories';
  
  document.getElementById('feed-filter-summary').textContent = summary;
}

/* ── Platform badge class ── */
function platformBadgeClass(platform) {
  const map = {
    'whatsapp':  'badge-whatsapp',
    'facebook':  'badge-facebook',
    'twitter':   'badge-twitter',
    'telegram':  'badge-telegram',
    'instagram': 'badge-instagram',
    'youtube':   'badge-youtube'
  };
  return platform ? (map[platform.toLowerCase()] || 'badge-location') : 'badge-location';
}

/* ── Format share count ── */
function formatShares(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return n;
}

/* ── Show skeleton loaders ── */
function showFeedSkeleton() {
  const grid = document.getElementById('feed-grid');
  grid.innerHTML = Array(6).fill(0).map((_, i) => `
    <div class="feed-card" style="animation-delay:${i*50}ms">
      <div class="skel" style="height:14px;width:90%;margin-bottom:6px"></div>
      <div class="skel" style="height:14px;width:70%;margin-bottom:10px"></div>
      <div class="skel" style="height:11px;width:80%;margin-bottom:10px"></div>
      <div style="display:flex;gap:6px">
        <div class="skel" style="height:20px;width:70px;border-radius:10px"></div>
        <div class="skel" style="height:20px;width:60px;border-radius:10px"></div>
        <div class="skel" style="height:20px;width:50px;border-radius:10px"></div>
      </div>
    </div>
  `).join('');
  document.getElementById('feed-error').style.display = 'none';
  document.getElementById('feed-load-more').style.display = 'none';
}

/* ── Render feed cards ── */
function renderFeedCards(items, append) {
  const grid = document.getElementById('feed-grid');
  if (!append) grid.innerHTML = '';
  
  if (!items || items.length === 0) {
    if (!append) {
      grid.innerHTML = `
        <div class="feed-error">
          No results found for the selected filters.
        </div>`;
    }
    return;
  }
  
  const isNew = !append;
  const html = items.map((item, i) => {
    const platClass = platformBadgeClass(item.platform || '');
    const delay     = i * 60;
    const newBadge  = isNew && i < 3
      ? '<span class="badge" style="background:rgba(74,222,128,0.15);color:#27AE60;font-size:9px;margin-right:6px">NEW</span>'
      : '';
    
    return `
      <div class="feed-card" style="animation-delay:${delay}ms">
        <div class="feed-headline">${item.headline || 'Unknown headline'}</div>
        <div class="feed-reason">${item.credibilityReason || ''}</div>
        <div class="feed-meta">
          ${newBadge}
          <span class="badge badge-location">📍 ${item.location || ''}</span>
          <span class="badge ${platClass}">${item.platform || ''}</span>
          <span class="badge badge-fake">Score: ${item.fakeScore || '??'}%</span>
          <span class="feed-shares">🔁 ${formatShares(item.shareCount || 0)}</span>
          <span class="feed-time">${item.timeAgo || ''}</span>
        </div>
      </div>`;
  }).join('');
  
  grid.insertAdjacentHTML('beforeend', html);
  document.getElementById('feed-load-more').style.display = 'block';
}

/* ── MAIN LOAD FUNCTION ── */
async function loadFeed(append) {
  const refreshBtn = document.getElementById('feed-refresh-btn');
  
  if (!append) {
    showFeedSkeleton();
    refreshBtn.classList.add('loading');
    refreshBtn.textContent = '↺ Loading...';
  }
  
  try {
    const response = await fetch('/api/live-feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country:   feedState.country,
        state:     feedState.state,
        source:    feedState.source,
        category:  feedState.category,
        timeRange: '7days',
        page:      feedState.page
      })
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Server error');
    
    feedState.loadedItems = append ? [...feedState.loadedItems, ...data.items] : data.items;
    renderFeedCards(data.items, append);
    feedState.countdown = 45;
  } catch (err) {
    console.error('Feed error:', err);
    document.getElementById('feed-error').style.display = 'block';
    // Fallback static data in case of AI failure
    renderFeedCards([
      { headline: 'Viral: New health guideline issued for summer', credibilityReason: 'Not found on official WHO or Ministry sites.', location: 'India', platform: 'WhatsApp', fakeScore: 88, shareCount: 12500, timeAgo: '5m ago' },
      { headline: 'Election Commission to change voting hours', credibilityReason: 'Explicitly denied by government spokespersons.', location: 'Delhi', platform: 'Facebook', fakeScore: 92, shareCount: 34000, timeAgo: '12m ago' }
    ], false);
  } finally {
    refreshBtn.classList.remove('loading');
    refreshBtn.textContent = '↺ Refresh Now';
  }
}

function loadMoreFeed() {
  feedState.page++;
  loadFeed(true);
}

function triggerFeedRefresh() {
  feedState.page = 1;
  feedState.countdown = 45;
  loadFeed(false);
}

function startFeedCountdown() {
  if (feedCountdownTimer) clearInterval(feedCountdownTimer);
  feedCountdownTimer = setInterval(() => {
    if (!feedState.autoRefresh) return;
    feedState.countdown--;
    
    const el = document.getElementById('feed-countdown');
    if (el) el.textContent = `Refreshes in ${feedState.countdown}s`;
    
    if (feedState.countdown <= 0) {
      feedState.countdown = 45;
      feedState.page = 1;
      loadFeed(false);
    }
  }, 1000);
}

/* ============================================================
   COUNTRY MULTIPLIER HELPER
   ============================================================ */
function countryMultiplier() {
  const c = state.activeCountry;
  if (!c) return 1;
  const score = mapData[state.activeFilter]?.[c] || mapData.overall?.[c] || 65;
  return score / 65;
}

/* ============================================================
   BASE CHART.JS OPTIONS
   ============================================================ */
const baseOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#fff', titleColor: '#1a1a1a',
      bodyColor: '#6b6b6b', borderColor: 'rgba(0,0,0,0.08)',
      borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4
    }
  },
  scales: {
    x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#9c9890', font: { family: 'Space Grotesk', size: 11 } } },
    y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#9c9890', font: { family: 'Space Grotesk', size: 11 } } }
  }
};

/* ============================================================
   CHART 1 — VELOCITY LINE CHART
   ============================================================ */
const VEL_HOURS = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'].map(h=>h+':00');
const VEL_WA  = [12,8,5,3,4,6,18,42,68,95,110,128,145,132,118,142,168,155,180,210,195,172,148,95];
const VEL_SM  = [8,5,3,2,3,5,15,35,55,78,92,108,125,118,105,128,145,138,162,185,170,152,128,82];
const VEL_NW  = [5,3,2,1,2,3,10,22,38,52,68,75,88,82,76,90,105,98,115,132,120,108,90,58];
let timelineChart;

function buildVelocityChart() {
  const ctx = document.getElementById('velocityChart').getContext('2d');
  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: VEL_HOURS,
      datasets: [
        { label:'WhatsApp', data:[...VEL_WA],   borderColor:'#25D366', backgroundColor:hexToRgba('#25D366',.10), tension:.4, pointRadius:0, fill:true, borderWidth:2 },
        { label:'Social Media', data:[...VEL_SM], borderColor:'#E8453C', backgroundColor:hexToRgba('#E8453C',.08), tension:.4, pointRadius:0, fill:true, borderWidth:2 },
        { label:'News Sites', data:[...VEL_NW],  borderColor:'#4A90D9', backgroundColor:hexToRgba('#4A90D9',.06), tension:.4, pointRadius:0, fill:true, borderWidth:2 }
      ]
    },
    options: {
      ...baseOpts,
      scales: {
        x: { ...baseOpts.scales.x },
        y: { ...baseOpts.scales.y, title: { display:true, text:'Articles / hour', color:'#9c9890', font:{ size:11 } } }
      },
      plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip,
        callbacks: { title: items => 'Hour: '+items[0].label }
      }}
    }
  });
}

function updateVelocityChart() {
  if (!timelineChart) return;
  const m = countryMultiplier();
  // filter multipliers by category
  const catM = { overall:1, health:1.15, politics:0.9, finance:0.8, deepfakes:1.05 };
  const cm = catM[state.activeFilter] || 1;
  timelineChart.data.datasets[0].data = VEL_WA.map(v => Math.round(v*m*cm));
  timelineChart.data.datasets[1].data = VEL_SM.map(v => Math.round(v*m*cm));
  timelineChart.data.datasets[2].data = VEL_NW.map(v => Math.round(v*m*cm));
  timelineChart.update('active');
}

/* ============================================================
   CHART 2 — BUBBLE CHART
   ============================================================ */
const BUBBLE_BASE = [
  { label:'Health',        x:15, y:88, r:28, color:'#E8453C' },
  { label:'Politics',      x:22, y:72, r:22, color:'#7F77DD' },
  { label:'Finance',       x:35, y:55, r:16, color:'#F5A623' },
  { label:'Technology',    x:48, y:42, r:12, color:'#4A90D9' },
  { label:'International', x:60, y:35, r:10, color:'#27AE60' },
  { label:'Local',         x:42, y:28, r:8,  color:'#D85A30' }
];
let bubbleChart;

function buildBubbleChart() {
  const ctx = document.getElementById('bubbleChart').getContext('2d');
  bubbleChart = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: BUBBLE_BASE.map(b => ({
        label: b.label,
        data: [{ x:b.x, y:b.y, r:b.r }],
        backgroundColor: hexToRgba(b.color,.7),
        borderColor: b.color,
        borderWidth: 2
      }))
    },
    options: {
      ...baseOpts,
      scales: {
        x: { ...baseOpts.scales.x, min:0, max:100,
          title:{ display:true, text:'Credibility Score (0-100)', color:'#9c9890', font:{size:11} } },
        y: { ...baseOpts.scales.y, min:0, max:100,
          title:{ display:true, text:'Virality Score (0-100)', color:'#9c9890', font:{size:11} } }
      },
      plugins: { ...baseOpts.plugins,
        tooltip: { ...baseOpts.plugins.tooltip,
          callbacks: {
            label: ctx => {
              const d=ctx.raw;
              return `${ctx.dataset.label} — Cred:${d.x} Viral:${d.y}`;
            }
          }
        }
      }
    }
  });
}

function updateBubbleChart() {
  if (!bubbleChart) return;
  const m = countryMultiplier();
  const activeF = state.activeFilter;
  const catLabels = { overall:null, health:'Health', politics:'Politics', finance:'Finance', deepfakes:'Technology' };
  const sel = catLabels[activeF];
  BUBBLE_BASE.forEach((b,i) => {
    const alpha = (!sel || b.label===sel) ? .7 : .18;
    bubbleChart.data.datasets[i].backgroundColor = hexToRgba(b.color, alpha);
    const rScale = (!sel || b.label===sel) ? Math.min(40, b.r*m) : b.r*.7;
    bubbleChart.data.datasets[i].data = [{ x:b.x, y:Math.min(100,b.y*m*.9+b.y*.1), r:Math.max(4,rScale) }];
  });
  bubbleChart.update('active');
}


/* ============================================================
   CHART 4 — ACTIVITY HEATMAP GRID
   ============================================================ */
const ACT_DAYS_N = 7;
const ACT_BASE = (() => {
  const grid = [];
  const peak1 = [9,10,11,12,13], peak2 = [18,19,20,21];
  const weekendBoost = [0,0,0,0,0,6,6]; // sat=5 sun=6
  for (let h=0;h<24;h++) {
    const row = [];
    for (let d=0;d<7;d++) {
      let v = 8;
      if (h>=6&&h<9)  v = 30+Math.random()*25;
      if (peak1.includes(h)) v = 65+Math.random()*30;
      if (peak2.includes(h)) v = 70+Math.random()*28;
      if (h>=22||h<6) v = 5+Math.random()*18;
      if (d>=5) v = v*0.8 + (h>=17&&h<23?15:0); // weekend
      row.push(Math.round(Math.min(100,v)));
    }
    grid.push(row);
  }
  return grid;
})();

const HM_TOOLTIP = document.createElement('div');
HM_TOOLTIP.className = 'map-tooltip';
HM_TOOLTIP.style.opacity = '0';
document.body.appendChild(HM_TOOLTIP);

function hmColor(v) {
  if (v<=20) return '#fef9f9';
  if (v<=40) return '#fcd9d8';
  if (v<=60) return '#f8a8a6';
  if (v<=80) return '#f26b68';
  return '#E8453C';
}

function buildHeatmapGrid() {
  const grid = document.getElementById('heatmap-act-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (let h=0;h<24;h++) {
    const lbl = document.createElement('div');
    lbl.className = 'heatmap-row-label';
    lbl.textContent = String(h).padStart(2,'0')+':00';
    grid.appendChild(lbl);
    for (let d=0;d<7;d++) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.background = hmColor(ACT_BASE[h][d]);
      cell.dataset.h = h; cell.dataset.d = d; cell.dataset.v = ACT_BASE[h][d];
      cell.addEventListener('mouseenter', e => {
        HM_TOOLTIP.style.opacity='1';
        HM_TOOLTIP.innerHTML = `<b>${days[d]} ${String(h).padStart(2,'0')}:00</b><br>${cell.dataset.v} articles`;
      });
      cell.addEventListener('mousemove', e => {
        HM_TOOLTIP.style.left=(e.clientX+12)+'px';
        HM_TOOLTIP.style.top=(e.clientY-10)+'px';
      });
      cell.addEventListener('mouseleave', ()=>{ HM_TOOLTIP.style.opacity='0'; });
      grid.appendChild(cell);
    }
  }
}

function updateHeatmapGrid() {
  const m = countryMultiplier();
  const grid = document.getElementById('heatmap-act-grid');
  if (!grid) return;
  const cells = grid.querySelectorAll('.heatmap-cell');
  cells.forEach(cell => {
    const base = ACT_BASE[+cell.dataset.h][+cell.dataset.d];
    const newV = Math.min(100, Math.round(base*m));
    cell.dataset.v = newV;
    cell.style.background = hmColor(newV);
  });
}

/* ============================================================
   CHART 5 — FUNNEL CHART
   ============================================================ */
const FUNNEL_STAGES = [
  { name:'Claims Submitted',  pct:100, color:'#E8453C', count:8327 },
  { name:'AI Pre-screened',   pct:78,  color:'#F5A623', count:6495 },
  { name:'Web Verified',      pct:52,  color:'#7F77DD', count:4330 },
  { name:'Fact-checked',      pct:31,  color:'#4A90D9', count:2581 },
  { name:'Confirmed Fake',    pct:18,  color:'#27AE60', count:1499 }
];

function buildFunnelChart() {
  updateFunnelChart();
}

function updateFunnelChart() {
  const wrap = document.getElementById('funnel-wrap');
  if (!wrap) return;
  const m = countryMultiplier();
  wrap.innerHTML = '';
  FUNNEL_STAGES.forEach((s,i) => {
    if (i>0) {
      const drop = document.createElement('div');
      drop.className = 'funnel-dropoff';
      const prev = FUNNEL_STAGES[i-1].pct;
      const diff = Math.round((s.pct-prev)/prev*100);
      drop.textContent = `↓ ${diff}%`;
      wrap.appendChild(drop);
    }
    const el = document.createElement('div');
    el.className = 'funnel-stage';
    el.style.width = s.pct+'%';
    el.style.background = s.color;
    el.innerHTML = `
      <span class="funnel-stage-name">${s.name}</span>
      <span class="funnel-stage-pct">${s.pct}%</span>
      <span class="funnel-stage-count">${Math.round(s.count*m).toLocaleString()} articles</span>`;
    wrap.appendChild(el);
  });
}

/* ============================================================
   CHART 6 — D3 TREEMAP
   ============================================================ */
const TREEMAP_DATA = {
  name:'root', children: [
    { name:'Health', color:'#E8453C', children:[
      {name:'COVID myths',       value:680},{name:'Cancer cures',        value:520},
      {name:'Vaccine claims',    value:480},{name:'Diet misinformation',  value:420},
      {name:'Mental health',     value:380},{name:'Other health',         value:367}
    ]},
    { name:'Politics', color:'#7F77DD', children:[
      {name:'Election fraud',    value:620},{name:'Gov corruption',       value:510},
      {name:'War propaganda',    value:480},{name:'Diplomatic fake',      value:350},
      {name:'Policy misinfo',    value:250}
    ]},
    { name:'Finance', color:'#F5A623', children:[
      {name:'Crypto scams',      value:480},{name:'Stock manip.',         value:380},
      {name:'Banking fraud',     value:320},{name:'Investment fake',      value:250}
    ]},
    { name:'Technology', color:'#4A90D9', children:[
      {name:'AI fear',           value:320},{name:'Privacy myths',        value:280},
      {name:'Tech rumors',       value:180},{name:'Cyber fear',           value:110}
    ]},
    { name:'International', color:'#27AE60', children:[
      {name:'War claims',        value:280},{name:'Refugee crisis',       value:180},
      {name:'Climate fake',      value:170}
    ]},
    { name:'Local', color:'#D85A30', children:[
      {name:'Crime myths',       value:180},{name:'Local gov',            value:140}
    ]}
  ]
};
const TMTT = document.createElement('div');
TMTT.className='treemap-tooltip'; TMTT.style.opacity='0';
document.body.appendChild(TMTT);

function buildTreemap() {
  renderTreemap(1);
}

function renderTreemap(multiplier) {
  const container = document.getElementById('treemap-container');
  if (!container || typeof d3==='undefined') return;
  const W = container.clientWidth || 400;
  const H = 340;
  container.innerHTML = '';
  const catColors = {};
  TREEMAP_DATA.children.forEach(c=>{ catColors[c.name]=c.color; });

  const root = d3.hierarchy(TREEMAP_DATA)
    .sum(d => d.children ? 0 : d.name ? (d[Object.keys(d).find(k=>typeof d[k]==='number')] || 0)*multiplier : 0)
    .sort((a,b)=>b.value-a.value);

  // fix: correctly pass leaf value
  root.leaves().forEach(leaf=>{ leaf.value = (leaf.data.children ? 0 : Object.values(leaf.data).find(v=>typeof v==='number')||1)*multiplier; });
  root.sum(d => d.children ? 0 : (Object.values(d).find(v=>typeof v==='number')||1)*multiplier);

  d3.treemap().size([W,H]).padding(2).paddingInner(3)(root);

  const svg = d3.select(container).append('svg').attr('width',W).attr('height',H);
  const activeF = state.activeFilter;
  const selCat = { overall:null,health:'Health',politics:'Politics',finance:'Finance',deepfakes:'Technology' }[activeF];

  const node = svg.selectAll('g').data(root.leaves()).enter().append('g')
    .attr('transform', d=>`translate(${d.x0},${d.y0})`);

  node.append('rect')
    .attr('width',  d=>Math.max(0,d.x1-d.x0))
    .attr('height', d=>Math.max(0,d.y1-d.y0))
    .attr('rx', 3).attr('ry', 3)
    .attr('fill', d=>{
      const cat = d.parent.data.name;
      const col = catColors[cat] || '#ccc';
      const dim = selCat && cat!==selCat;
      return dim ? hexToRgba(col,.35) : col;
    })
    .attr('stroke','#fff').attr('stroke-width',2)
    .style('cursor','pointer')
    .on('mousemove',(event,d)=>{
      TMTT.style.opacity='1';
      TMTT.style.left=(event.clientX+12)+'px';
      TMTT.style.top=(event.clientY-10)+'px';
      const v=Object.values(d.data).find(x=>typeof x==='number')||0;
      TMTT.innerHTML=`<b>${d.data.name}</b><br>Articles: ${Math.round(v*multiplier).toLocaleString()}<br>Category: ${d.parent.data.name}`;
    })
    .on('mouseleave',()=>{ TMTT.style.opacity='0'; });

  node.append('text')
    .attr('x',4).attr('y',14)
    .attr('fill','#fff')
    .attr('font-size','11px')
    .attr('font-family','Space Grotesk')
    .each(function(d){
      const w=d.x1-d.x0, h=d.y1-d.y0;
      if (w*h < 2500) { d3.select(this).remove(); return; }
      d3.select(this).text(d.data.name.length>12?d.data.name.slice(0,11)+'…':d.data.name);
    });
}

function updateTreemap() {
  renderTreemap(countryMultiplier());
}


/* ============================================================
   CHART 8 — LIFECYCLE TIMELINE
   ============================================================ */
const LC_LABELS = ['Origin','First Share','Viral Peak','Fact Check','Debunk Published','Decline','Resurface'];
const LC_AVG = [1,45,320,280,190,85,42];
const LC_FAST = [1,38,180,85,35,15,8];
const LC_CAT_PEAKS = { overall:320, health:380, politics:280, finance:220, deepfakes:350 };
const LC_RESURGE   = { overall:42,  health:35,  politics:65,  finance:28,  deepfakes:55 };
let lifecycleChart;

function buildLifecycleChart() {
  const ctx = document.getElementById('lifecycleChart').getContext('2d');
  lifecycleChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: LC_LABELS,
      datasets: [
        { label:'Avg Fake News', data:[...LC_AVG],
          borderColor:'#E8453C', backgroundColor:hexToRgba('#E8453C',.08),
          tension:.5, pointRadius:6, pointBackgroundColor:'#E8453C',
          pointBorderColor:'#fff', pointBorderWidth:2, fill:true, borderWidth:2 },
        { label:'Fast-Debunked', data:[...LC_FAST],
          borderColor:'#27AE60', backgroundColor:hexToRgba('#27AE60',.06),
          tension:.5, pointRadius:6, pointBackgroundColor:'#27AE60',
          pointBorderColor:'#fff', pointBorderWidth:2, fill:true, borderWidth:2 }
      ]
    },
    options: {
      ...baseOpts,
      scales: {
        x: { ...baseOpts.scales.x },
        y: { ...baseOpts.scales.y, title:{ display:true, text:'Reach (thousands)', color:'#9c9890', font:{size:11} } }
      },
      plugins: { ...baseOpts.plugins,
        tooltip: { ...baseOpts.plugins.tooltip,
          callbacks: { label: i => `${i.dataset.label}: ${i.parsed.y.toLocaleString()}k` }
        }
      }
    }
  });
}

function updateLifecycleChart() {
  if (!lifecycleChart) return;
  const m = countryMultiplier();
  const f = state.activeFilter;
  const peak = LC_CAT_PEAKS[f]||320;
  const resurge = LC_RESURGE[f]||42;
  const newAvg = [1, Math.round(45*m), Math.round(peak*m), Math.round(280*m*.9),
                  Math.round(190*m*.8), Math.round(85*m*.7), Math.round(resurge*m)];
  const newFast= [1, Math.round(38*m), Math.round(peak*m*.56), Math.round(85*m*.4),
                  Math.round(35*m*.5), Math.round(15*m), Math.round(8*m)];
  lifecycleChart.data.datasets[0].data = newAvg;
  lifecycleChart.data.datasets[1].data = newFast;
  lifecycleChart.update('active');
}

/* ============================================================
   LIVE FEED LOGIC
   ============================================================ */
let feedPage = 1;
let feedCountdown = 45;
let feedTimer = null;
let lastSyncedVal = 0;
let syncInterval = null;

function triggerFeedRefresh() {
  feedPage = 1;
  feedCountdown = 45;
  updateFeedUI();
  fetchLiveFeed(false, 1);
}

function startFeedCountdown() {
  if (feedTimer) clearInterval(feedTimer);
  feedTimer = setInterval(() => {
    const toggle = document.getElementById('feed-auto-toggle');
    if (toggle && !toggle.checked) return;

    feedCountdown--;
    if (feedCountdown <= 0) {
      feedCountdown = 45;
      fetchLiveFeed(true, 1);
    }
    updateFeedUI();
  }, 1000);
}

function updateFeedUI() {
  const cd = document.getElementById('feed-countdown');
  if (cd) cd.textContent = `Refreshes in ${feedCountdown}s`;
}

async function fetchLiveFeed(isAutoRefresh = false, page = 1) {
  const country = document.getElementById('feed-country-select').value;
  const platform = document.getElementById('feed-source-select').value;
  const category = document.getElementById('feed-category-select').value;
  
  const container = document.getElementById('feed-grid');
  const errorBox = document.getElementById('feed-error');
  const loadMore = document.getElementById('feed-load-more');
  
  // Show loading indicator only on initial load (page 1) and not for background auto-refresh
  if (page === 1 && !isAutoRefresh) {
    container.innerHTML = '<div class="feed-loading">Scraping live data...</div>';
  }
  
  try {
    const resp = await fetch(`/api/live-feed?country=${country}&platform=${platform}&category=${category}&page=${page}`);
    if (!resp.ok) throw new Error('Feed fetch failed');
    
    const data = await resp.json();
    
    if (data.status === 'success' && data.articles && data.articles.length > 0) {
      errorBox.style.display = 'none';
      renderFeedCards(data.articles, page > 1);
      
      // Update filter summary
      const summary = document.getElementById('feed-filter-summary');
      if (summary) {
        let text = `Showing: ${data.region} · ${platform === 'all' ? 'All Platforms' : platform} · ${category === 'all' ? 'All Categories' : category}`;
        if (data.fallback) text += " <span style='color:var(--red); font-weight:700'>(Fallback: Last 30d)</span>";
        summary.innerHTML = text;
      }
      
      // Reset sync timer
      lastSyncedVal = 0;
      updateSyncTimestamp();
      if (!syncInterval) {
        syncInterval = setInterval(() => {
          lastSyncedVal++;
          updateSyncTimestamp();
        }, 1000);
      }
      
      // Handle "Load More" visibility
      if (loadMore) loadMore.style.display = data.articles.length >= 10 ? 'block' : 'none';
      feedPage = page;
    } else {
      if (page === 1) {
        container.innerHTML = '';
        errorBox.style.display = 'block';
        if (loadMore) loadMore.style.display = 'none';
      }
    }
  } catch (e) {
    console.error("Feed error:", e);
    if (page === 1) {
      container.innerHTML = '';
      errorBox.style.display = 'block';
      if (loadMore) loadMore.style.display = 'none';
    }
  }
}

function renderFeedCards(articles, append) {
  const container = document.getElementById('feed-grid');
  if (!container) return;
  if (!append) container.innerHTML = '';
  
  articles.forEach(item => {
    const card = document.createElement('div');
    card.className = 'feed-card animate-in';
    
    // Platform-specific styling classes
    const p = item.platform.toLowerCase();
    let pClass = 'badge-gray';
    if (p.includes('whatsapp')) pClass = 'badge-whatsapp';
    else if (p.includes('facebook')) pClass = 'badge-facebook';
    else if (p.includes('twitter') || p === 'x') pClass = 'badge-twitter';
    else if (p.includes('telegram')) pClass = 'badge-telegram';
    
    card.innerHTML = `
      <div class="card-border-red"></div>
      <div class="card-content">
        <h3 class="card-title">${item.title}</h3>
        <p class="card-summary"><em>${item.summary}</em></p>
        <div class="card-badges">
          ${item.is_new ? '<span class="badge-new">NEW</span>' : ''}
          ${item.is_trending ? '<span class="badge-trending">🔥 Trending</span>' : ''}
          <span class="badge-region">📍 ${item.region}</span>
          <span class="badge-platform ${pClass}">${item.platform}</span>
          <span class="badge-score">Critical Score: ${item.score}%</span>
          <span class="badge-shares">${item.shares} shares</span>
          <span class="badge-time">${item.time_ago}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateSyncTimestamp() {
  const el = document.getElementById('last-synced-time');
  if (el) el.textContent = `Last synced: ${lastSyncedVal}s ago`;
}

// Filter Event Handlers
function onFeedCountryChange(v) { triggerFeedRefresh(); }
function onFeedSourceChange(v) { triggerFeedRefresh(); }
function onFeedCategoryChange(v) { triggerFeedRefresh(); }
function onAutoRefreshToggle(el) {
  if (el.checked) {
    feedCountdown = 45;
    updateFeedUI();
  } else {
    const cd = document.getElementById('feed-countdown');
    if (cd) cd.textContent = 'Auto-refresh off';
  }
}
function loadMoreFeed() {
  fetchLiveFeed(false, feedPage + 1);
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  // Build chart containers first
  buildDonut();
  buildRadars();

  // 8 new charts
  buildVelocityChart();
  buildBubbleChart();
  buildHeatmapGrid();
  buildFunnelChart();
  buildTreemap();
  buildLifecycleChart();

  // Load world map
  try {
    const topo = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    buildMap(topo);
  } catch(e) {
    console.error('[Map load error]', e);
    document.getElementById('map-container').innerHTML = '<p style="text-align:center;padding:40px;color:#999">Map unavailable — check network connection.</p>';
  }

  // Animate bars on load
  setTimeout(() => animateBars('overall', null), 200);

  // Start live feed
  triggerFeedRefresh();
  startFeedCountdown();

  // 3 & 4. Load backend live analytics and start auto-refresh
  fetchLiveData('Worldwide');
  startAnalyticsAutoRefresh();

  // Footer ticker
  setInterval(() => {
    document.querySelectorAll('.chart-footer').forEach(el => {
      el.textContent = 'Updated just now';
    });
  }, 5000);

  // Apply theme immediately (user may already be in dark mode)
  applyThemeToCharts();
}

/* ============================================================
   DARK MODE — CHART.JS + CSS CHARTS
   ============================================================ */
function getTheme() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    dark,
    text:    dark ? '#7070a0' : '#9c9890',
    grid:    dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    tipBg:   dark ? '#242336' : '#ffffff',
    tipTitle:dark ? '#e8e8f0' : '#1a1a1a',
    tipBody: dark ? '#9090a8' : '#6b6b6b',
    gaugeBg: dark ? '#0f0f17' : '#f0ede6',
    radarGrid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    pointLabel: dark ? '#aaaacc' : '#444444'
  };
}

function applyThemeToCharts() {
  const t = getTheme();

  // Helper: apply standard x/y scale + tooltip to a chart
  function themeChart(ch) {
    if (!ch || !ch.options) return;
    if (ch.options.scales) {
      ['x','y','r'].forEach(axis => {
        const sc = ch.options.scales[axis];
        if (!sc) return;
        if (sc.ticks) sc.ticks.color = t.text;
        if (sc.grid)  sc.grid.color  = t.grid;
        if (sc.pointLabels) sc.pointLabels.color = t.pointLabel;
        if (sc.angleLines) sc.angleLines.color = t.radarGrid;
      });
    }
    if (ch.options.plugins?.tooltip) {
      ch.options.plugins.tooltip.backgroundColor = t.tipBg;
      ch.options.plugins.tooltip.titleColor       = t.tipTitle;
      ch.options.plugins.tooltip.bodyColor        = t.tipBody;
      ch.options.plugins.tooltip.borderColor      = t.dark
        ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    }
    if (ch.options.scales?.r?.grid) {
      ch.options.scales.r.grid.color = t.radarGrid;
    }
    ch.update('none');
  }

  // All Chart.js line/bar/bubble/doughnut instances
  [categoryChart, timelineChart, bubbleChart, lifecycleChart,
   radar1, radar2, radar3]
    .forEach(themeChart);

  // Heatmap empty column (row-label column is CSS, only cells need check)
  // Cells are styled by hmColor() — no separate "dark" needed because
  // the pink-red palette reads fine on dark. Nothing to do.

  // Treemap re-render picks up new container bg automatically.
  // Funnel is pure CSS bg-color on colored stages — readable in both modes.

  // Update radar-specific scale
  [radar1, radar2, radar3].forEach(ch => {
    if (!ch?.options?.scales?.r) return;
    ch.options.scales.r.ticks = ch.options.scales.r.ticks || {};
    ch.options.scales.r.ticks.color = t.text;
    ch.options.scales.r.ticks.backdropColor = 'transparent';
    ch.options.scales.r.grid.color = t.radarGrid;
    ch.options.scales.r.angleLines.color = t.radarGrid;
    ch.options.scales.r.pointLabels.color = t.pointLabel;
    ch.update('none');
  });
}

// Watch for html.dark toggle and instantly re-theme all charts
const _themeObserver = new MutationObserver(() => {
  applyThemeToCharts();
  // Also re-render treemap so its SVG background adapts
  updateTreemap();
});
_themeObserver.observe(document.documentElement, {
  attributes: true, attributeFilter: ['class']
});

document.addEventListener('DOMContentLoaded', init);