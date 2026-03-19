/* ═══════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════ */
var CATS = [{
    name: 'Health',
    count: 2847,
    color: '#E24B4A',
    pct: 35
  },
  {
    name: 'Politics',
    count: 2210,
    color: '#7F77DD',
    pct: 27
  },
  {
    name: 'Finance',
    count: 1430,
    color: '#EF9F27',
    pct: 18
  },
  {
    name: 'Technology',
    count: 890,
    color: '#378ADD',
    pct: 11
  },
  {
    name: 'International',
    count: 630,
    color: '#1D9E75',
    pct: 8
  },
  {
    name: 'Local',
    count: 320,
    color: '#D85A30',
    pct: 4
  }
];
var CAT_TOTAL = CATS.reduce(function(s, c) {
  return s + c.count
}, 0);

var MAP_DATA = {
  all: {
    '840': 82,
    '356': 74,
    '076': 68,
    '156': 77,
    '643': 63,
    '484': 58,
    '586': 70,
    '056': 45,
    '276': 40,
    '250': 42,
    '380': 50,
    '724': 38,
    '826': 35,
    '036': 48,
    '392': 55,
    '410': 60,
    '566': 72,
    '818': 65,
    '710': 69,
    '320': 44,
    '458': 57,
    '764': 62,
    '360': 71,
    '170': 49,
    '032': 41,
    '704': 55,
    '050': 67,
    '144': 52,
    '800': 48,
    '512': 43
  },
  health: {
    '840': 88,
    '356': 82,
    '076': 71,
    '156': 65,
    '643': 58,
    '484': 62,
    '586': 79,
    '056': 38,
    '276': 32,
    '250': 36,
    '380': 44,
    '724': 30,
    '826': 28,
    '036': 41,
    '392': 48,
    '410': 52,
    '566': 77,
    '818': 69,
    '710': 63,
    '320': 38,
    '458': 50,
    '764': 58,
    '360': 74,
    '170': 43,
    '032': 35,
    '704': 50,
    '050': 70,
    '144': 48,
    '800': 42,
    '512': 37
  },
  politics: {
    '840': 91,
    '356': 78,
    '076': 65,
    '156': 80,
    '643': 72,
    '484': 55,
    '586': 68,
    '056': 50,
    '276': 44,
    '250': 40,
    '380': 48,
    '724': 42,
    '826': 39,
    '036': 52,
    '392': 60,
    '410': 65,
    '566': 70,
    '818': 61,
    '710': 73,
    '320': 48,
    '458': 60,
    '764': 65,
    '360': 69,
    '170': 52,
    '032': 44,
    '704': 58,
    '050': 72,
    '144': 55,
    '800': 50,
    '512': 46
  },
  finance: {
    '840': 75,
    '356': 68,
    '076': 60,
    '156': 82,
    '643': 55,
    '484': 50,
    '586': 63,
    '056': 52,
    '276': 48,
    '250': 46,
    '380': 54,
    '724': 36,
    '826': 40,
    '036': 44,
    '392': 57,
    '410': 62,
    '566': 66,
    '818': 58,
    '710': 67,
    '320': 40,
    '458': 54,
    '764': 60,
    '360': 64,
    '170': 46,
    '032': 38,
    '704': 52,
    '050': 64,
    '144': 50,
    '800': 44,
    '512': 40
  },
  tech: {
    '840': 95,
    '356': 72,
    '076': 58,
    '156': 88,
    '643': 60,
    '484': 52,
    '586': 64,
    '056': 62,
    '276': 54,
    '250': 50,
    '380': 56,
    '724': 46,
    '826': 58,
    '036': 59,
    '392': 76,
    '410': 68,
    '566': 60,
    '818': 54,
    '710': 66,
    '320': 44,
    '458': 62,
    '764': 70,
    '360': 68,
    '170': 50,
    '032': 42,
    '704': 60,
    '050': 66,
    '144': 54,
    '800': 46,
    '512': 42
  }
};

var PLATFORMS = [{
    name: 'WhatsApp',
    pct: 38,
    color: '#25D366'
  },
  {
    name: 'Facebook',
    pct: 27,
    color: '#1877F2'
  },
  {
    name: 'Twitter/X',
    pct: 18,
    color: '#000000'
  },
  {
    name: 'Telegram',
    pct: 11,
    color: '#2AABEE'
  },
  {
    name: 'Instagram',
    pct: 6,
    color: '#E1306C'
  }
];

var TREND = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  health: [320, 410, 380, 480, 520, 390, 460],
  politics: [280, 360, 330, 420, 450, 310, 400],
  finance: [140, 190, 170, 210, 240, 180, 220]
};

var COUNTRY_NAMES = {
  '840': 'United States',
  '356': 'India',
  '076': 'Brazil',
  '156': 'China',
  '643': 'Russia',
  '484': 'Mexico',
  '586': 'Pakistan',
  '056': 'Belgium',
  '276': 'Germany',
  '250': 'France',
  '380': 'Italy',
  '724': 'Spain',
  '826': 'United Kingdom',
  '036': 'Australia',
  '392': 'Japan',
  '410': 'South Korea',
  '566': 'Nigeria',
  '818': 'Egypt',
  '710': 'South Africa',
  '320': 'Guatemala',
  '458': 'Malaysia',
  '764': 'Thailand',
  '360': 'Indonesia',
  '170': 'Colombia',
  '032': 'Argentina',
  '704': 'Vietnam',
  '050': 'Bangladesh',
  '144': 'Sri Lanka',
  '800': 'Uganda',
  '512': 'Oman'
};

/* ═══════════════════════════════════════════════
   STAT COUNTERS
═══════════════════════════════════════════════ */
function animateCounter(id, target, suffix, duration) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = 0,
    step = target / (duration / 16);
  var timer = setInterval(function() {
    start = Math.min(start + step, target);
    el.textContent = (start >= 1000 ?
      (start / 1000).toFixed(1) + 'k' :
      Math.round(start)) + (suffix || '');
    if (start >= target) clearInterval(timer);
  }, 16);
}
setTimeout(function() {
  animateCounter('s1', 152, '', 1500);
  animateCounter('s2', 87, '%', 1600);
  animateCounter('s3', 30, '', 1400);
  animateCounter('s4', 8327, '', 1800);
}, 300);

/* ═══════════════════════════════════════════════
   CATEGORY BARS (Horizontal animated)
═══════════════════════════════════════════════ */
(function() {
  var container = document.getElementById('cat-bars');
  if (!container) return;
  var maxCount = Math.max.apply(null, CATS.map(function(c) {
    return c.count
  }));
  var html = '';
  CATS.forEach(function(c) {
    var widthPct = (c.count / maxCount * 100).toFixed(1);
    html += '<div class="cat-bar-row">' +
      '<div class="cat-bar-label"><span>' + c.name + '</span><span style="font-family:\'DM Mono\',monospace;color:' + c.color + '">' + c.count.toLocaleString() + '</span></div>' +
      '<div class="cat-bar-track"><div class="cat-bar-fill" style="background:' + c.color + '" data-width="' + widthPct + '%"></div></div>' +
      '</div>';
  });
  container.innerHTML = html;
  // Animate
  setTimeout(function() {
    container.querySelectorAll('.cat-bar-fill').forEach(function(bar) {
      bar.style.width = bar.getAttribute('data-width');
    });
  }, 200);
})();

/* ═══════════════════════════════════════════════
   DONUT CHART (Chart.js)
═══════════════════════════════════════════════ */
(function() {
  var ctx = document.getElementById('donut-chart');
  if (!ctx) return;
  var isDark = document.documentElement.classList.contains('dark');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: CATS.map(function(c) {
        return c.name
      }),
      datasets: [{
        data: CATS.map(function(c) {
          return c.count
        }),
        backgroundColor: CATS.map(function(c) {
          return c.color
        }),
        borderWidth: 2,
        borderColor: isDark ? '#1a1a28' : '#fff',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var total = ctx.dataset.data.reduce(function(a, b) {
                return a + b
              }, 0);
              return ' ' + ctx.label + ': ' + ((ctx.raw / total) * 100).toFixed(1) + '%';
            }
          }
        }
      }
    }
  });
  // Custom legend
  var leg = document.getElementById('donut-legend');
  if (leg) {
    var total = CATS.reduce(function(s, c) {
      return s + c.count
    }, 0);
    CATS.forEach(function(c) {
      leg.innerHTML += '<div class="legend-row">' +
        '<span class="legend-dot" style="background:' + c.color + '"></span>' +
        '<span>' + c.name + '</span>' +
        '<span class="legend-pct">' + ((c.count / total) * 100).toFixed(1) + '%</span>' +
        '</div>';
    });
  }
})();

/* ═══════════════════════════════════════════════
   WORLD HEATMAP (D3)
═══════════════════════════════════════════════ */
(function() {
  var svgEl = document.getElementById('world-map-svg');
  if (!svgEl) return;
  var svg = d3.select('#world-map-svg');
  var container = document.getElementById('map-container');
  var tooltip = document.getElementById('map-tooltip');
  var activeFilter = 'all';

  var width = container.offsetWidth || 900;
  var height = Math.round(width * 0.52);
  svg.attr('viewBox', '0 0 ' + width + ' ' + height);

  var projection = d3.geoNaturalEarth1()
    .scale(width / 6.3)
    .translate([width / 2, height / 2]);

  var path = d3.geoPath().projection(projection);
  var colorScale = d3.scaleSequential([0, 100], function(t) {
    return d3.interpolateRgb('#ffd5d5', '#c0392b')(t);
  });
  var unknownColor = function() {
    return document.documentElement.classList.contains('dark') ? '#2a2a3e' : '#e8e0d0';
  };

  var g = svg.append('g');
  var countriesSel;

  function getScore(id) {
    return MAP_DATA[activeFilter][id] || null;
  }

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(function(r) {
      return r.json()
    })
    .then(function(world) {
      var countries = topojson.feature(world, world.objects.countries);
      countriesSel = g.selectAll('path')
        .data(countries.features)
        .enter().append('path')
        .attr('d', path)
        .attr('stroke', function() {
          return document.documentElement.classList.contains('dark') ? '#1a1a28' : '#fff'
        })
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .attr('fill', function(d) {
          var s = getScore(d.id);
          return s != null ? colorScale(s) : unknownColor();
        })
        .on('mousemove', function(event, d) {
          var s = getScore(d.id);
          var name = COUNTRY_NAMES[d.id] || ('Country #' + d.id);
          if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.style.left = (event.offsetX + 16) + 'px';
            tooltip.style.top = (event.offsetY - 10) + 'px';
            tooltip.innerHTML = '<strong>' + name + '</strong>' +
              (s != null ? 'Fake Index: <b>' + s + '</b>/100' : '<span style="color:var(--text-secondary)">No data</span>');
          }
        })
        .on('mouseleave', function() {
          if (tooltip) tooltip.style.display = 'none';
        })
        .on('click', function(event, d) {
          var name = COUNTRY_NAMES[d.id] || ('Country #' + d.id);
          window.location.href = '/?q=' + encodeURIComponent('fake news from ' + name);
        });
    }).catch(function() {
      svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle').attr('fill', 'var(--text-secondary)').text('Map loading failed. Check network connection.');
    });

  // Filter buttons
  var filterRow = document.getElementById('map-filters');
  if (filterRow) {
    filterRow.addEventListener('click', function(e) {
      var btn = e.target.closest('.map-filter-btn');
      if (!btn) return;
      document.querySelectorAll('.map-filter-btn').forEach(function(b) {
        b.classList.remove('active')
      });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      if (countriesSel) {
        countriesSel.transition().duration(500)
          .attr('fill', function(d) {
            var s = getScore(d.id);
            return s != null ? colorScale(s) : unknownColor();
          });
      }
    });
  }
})();

/* ═══════════════════════════════════════════════
   PLATFORM BARS
═══════════════════════════════════════════════ */
(function() {
  var container = document.getElementById('platform-bars');
  if (!container) return;
  var html = '';
  PLATFORMS.forEach(function(p) {
    var letter = p.name.charAt(0);
    html += '<div class="platform-row">' +
      '<div class="platform-avatar" style="background:' + p.color + '">' + letter + '</div>' +
      '<div class="platform-name">' + p.name + '</div>' +
      '<div class="platform-bar-track"><div class="platform-bar-fill" style="background:' + p.color + ';opacity:.85" data-w="' + p.pct + '%"></div></div>' +
      '<div class="platform-pct">' + p.pct + '%</div>' +
      '</div>';
  });
  container.innerHTML = html;
  setTimeout(function() {
    container.querySelectorAll('.platform-bar-fill').forEach(function(b) {
      b.style.width = b.getAttribute('data-w');
    });
  }, 400);
})();

/* ═══════════════════════════════════════════════
   WEEKLY TREND (Chart.js)
═══════════════════════════════════════════════ */
(function() {
  var ctx = document.getElementById('trend-chart');
  if (!ctx) return;
  var isDark = document.documentElement.classList.contains('dark');
  var gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  var textColor = isDark ? '#9090a8' : '#6b6b6b';

  function makeDataset(label, data, color) {
    return {
      label: label,
      data: data,
      borderColor: color,
      borderWidth: 2.5,
      backgroundColor: hexToRgba(color, 0.1),
      fill: true,
      tension: 0.4,
      pointBackgroundColor: color,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  }

  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: TREND.labels,
      datasets: [
        makeDataset('Health', TREND.health, '#E24B4A'),
        makeDataset('Politics', TREND.politics, '#7F77DD'),
        makeDataset('Finance', TREND.finance, '#EF9F27')
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              size: 11
            }
          },
          beginAtZero: true
        }
      }
    }
  });
})();

/* ═══════════════════════════════════════════════
   RADAR CHARTS
═══════════════════════════════════════════════ */
(function() {
  var isDark = document.documentElement.classList.contains('dark');
  var gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
  var tickColor = isDark ? '#9090a8' : '#6b6b6b';
  var ptLabelColor = isDark ? '#c8c8d8' : '#444';

  function radarOpts(max) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        r: {
          min: 0,
          max: max || 100,
          grid: {
            color: gridColor
          },
          angleLines: {
            color: gridColor
          },
          ticks: {
            color: tickColor,
            backdropColor: 'transparent',
            font: {
              size: 9
            },
            stepSize: max ? max / 5 : 20
          },
          pointLabels: {
            color: ptLabelColor,
            font: {
              size: 10,
              weight: '600'
            }
          }
        }
      }
    };
  }

  function hexRgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ── Radar 1: Month-over-Month Threat Profile ── */
  var ctx1 = document.getElementById('radar-mom');
  if (ctx1) {
    new Chart(ctx1, {
      type: 'radar',
      data: {
        labels: ['Virality', 'Reach', 'Severity', 'Speed', 'Impact', 'Recurrence'],
        datasets: [{
            label: 'This Month',
            data: [82, 74, 68, 91, 76, 60],
            borderColor: '#E24B4A',
            borderWidth: 2.5,
            backgroundColor: hexRgba('#E24B4A', .15),
            pointBackgroundColor: '#E24B4A',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Last Month',
            data: [65, 58, 72, 70, 61, 55],
            borderColor: '#378ADD',
            borderWidth: 2.5,
            backgroundColor: hexRgba('#378ADD', .13),
            pointBackgroundColor: '#378ADD',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: radarOpts(100)
    });
  }

  /* ── Radar 2: Platform Risk — WhatsApp vs Social ── */
  var ctx2 = document.getElementById('radar-platform');
  if (ctx2) {
    new Chart(ctx2, {
      type: 'radar',
      data: {
        labels: ['Spread Rate', 'Fake Share', 'Engagement', 'Reach', 'Anonymity', 'Moderation Gap'],
        datasets: [{
            label: 'WhatsApp',
            data: [88, 79, 65, 72, 92, 85],
            borderColor: '#25D366',
            borderWidth: 2.5,
            backgroundColor: hexRgba('#25D366', .15),
            pointBackgroundColor: '#25D366',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Social Media',
            data: [74, 68, 81, 88, 55, 62],
            borderColor: '#1877F2',
            borderWidth: 2.5,
            backgroundColor: hexRgba('#1877F2', .13),
            pointBackgroundColor: '#1877F2',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: radarOpts(100)
    });
  }

  /* ── Radar 3: Category Vulnerability Index ── */
  var ctx3 = document.getElementById('radar-cat');
  if (ctx3) {
    new Chart(ctx3, {
      type: 'radar',
      data: {
        labels: ['Health', 'Politics', 'Finance', 'Technology', 'International', 'Local'],
        datasets: [{
          label: 'Vulnerability',
          data: [88, 82, 65, 58, 70, 44],
          borderColor: '#7F77DD',
          borderWidth: 2.5,
          backgroundColor: hexRgba('#7F77DD', .18),
          pointBackgroundColor: ['#E24B4A', '#7F77DD', '#EF9F27', '#378ADD', '#1D9E75', '#D85A30'],
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5
        }]
      },
      options: radarOpts(100)
    });
  }
})();

/* ═══════════════════════════════════════════════
   SOURCE CREDIBILITY
═══════════════════════════════════════════════ */
var credDB = {
  'bbc.com': {
    score: 95,
    status: 'Highly Reliable',
    desc: 'Global news leader with rigorous editorial standards and fact-checking processes.'
  },
  'ndtv.com': {
    score: 85,
    status: 'Reliable',
    desc: 'Major Indian news outlet with established editorial policies.'
  },
  'thehindu.com': {
    score: 90,
    status: 'Highly Reliable',
    desc: "One of India's most respected newspapers with strong journalism standards."
  },
  'snopes.com': {
    score: 92,
    status: 'Highly Reliable',
    desc: 'Leading fact-checking website, frequently cited as a reference.'
  },
  'altnews.in': {
    score: 88,
    status: 'Reliable',
    desc: 'Indian fact-checking organisation known for debunking misinformation.'
  },
  'boomlive.in': {
    score: 87,
    status: 'Reliable',
    desc: 'Independent digital journalism initiative focused on fact-checking.'
  },
  'reuters.com': {
    score: 96,
    status: 'Highly Reliable',
    desc: 'International news agency known for accuracy and neutrality.'
  },
  'apnews.com': {
    score: 95,
    status: 'Highly Reliable',
    desc: 'Associated Press — one of the most trusted news agencies worldwide.'
  },
  'randomnewsblog.xyz': {
    score: 18,
    status: 'Unverified',
    desc: 'Unknown site with no editorial standards or authorship info.'
  },
  'worldnewsdailyreport.com': {
    score: 5,
    status: 'Fake / Satire',
    desc: 'Known satirical site that publishes fictional stories.'
  }
};

function checkCredibility() {
  var input = document.getElementById('cred-domain-input');
  if (!input) return;
  var d = input.value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
  var card = document.getElementById('cred-result-card');
  if (!d) {
    if (card) card.style.display = 'none';
    return
  }
  if (card) card.style.display = 'block';
  var nameEl = document.getElementById('cred-domain-name');
  if (nameEl) nameEl.textContent = d;

  var info = credDB[d];
  var scoreEl = document.getElementById('cred-score-value');
  var statusEl = document.getElementById('cred-status-label');
  var descEl = document.getElementById('cred-desc');

  if (info) {
    var color = info.score >= 70 ? 'var(--green)' : info.score >= 40 ? 'var(--amber)' : 'var(--red)';
    if (scoreEl) {
      scoreEl.textContent = info.score + '% Credibility';
      scoreEl.style.color = color;
    }
    if (statusEl) {
      statusEl.textContent = info.status;
      statusEl.style.color = color;
    }
    if (descEl) descEl.textContent = info.desc;
  } else {
    if (scoreEl) {
      scoreEl.textContent = 'Unknown';
      scoreEl.style.color = 'var(--amber)';
    }
    if (statusEl) {
      statusEl.textContent = 'Not in our database';
      statusEl.style.color = 'var(--amber)';
    }
    if (descEl) descEl.textContent = 'This domain is not in our credibility database. Treat information from unknown sources with caution and cross-verify with established outlets.';
  }
}
var credInput = document.getElementById('cred-domain-input');
if (credInput) {
  credInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') checkCredibility();
  });
}

/* ═══════════════════════════════════════════════
   LIVE FACT-CHECKED
═══════════════════════════════════════════════ */
var fallback = [{
    headline: 'US Marines deployed to Middle East amid Iran tensions',
    result: 'Real',
    category: 'World'
  },
  {
    headline: 'Senator made satirical comment about Noem hearing',
    result: 'Fake',
    category: 'Politics'
  },
  {
    headline: '90% of US healthcare spending goes to treating chronic disease',
    result: 'Fake',
    category: 'Health'
  },
  {
    headline: 'New 5G towers linked to bird deaths, study claims',
    result: 'Fake',
    category: 'Technology'
  },
  {
    headline: 'Vitamin C cures COVID-19 in 24 hours, viral post claims',
    result: 'Fake',
    category: 'Health'
  }
];

function loadFactChecked() {
  var list = document.getElementById('fc-list');
  if (!list) return;
  list.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>';
  fetch('/api/latest-factchecked').then(function(r) {
    return r.json()
  }).then(function(data) {
    if (!data || !data.length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:14px">No data yet — verify a claim on the <a href="/">homepage</a>!</div>';
      return
    }
    renderFC(data);
  }).catch(function() {
    renderFC(fallback);
  });
}

function renderFC(data) {
  var list = document.getElementById('fc-list');
  if (!list) return;
  var html = '';
  data.forEach(function(item) {
    var cls = item.result === 'Real' ? 'pill-green' : 'pill-red';
    html += '<div class="fc-row"><span class="fc-headline">' + item.headline + '</span><span class="pill ' + cls + '">' + item.result + '</span><span class="fc-cat">' + item.category + '</span></div>';
  });
  list.innerHTML = html;
}
loadFactChecked();
