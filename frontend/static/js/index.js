function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active')
  });
  document.querySelectorAll('.panel').forEach(function(p) {
    p.classList.remove('active')
  });
  el.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active')
}

function selectMode(mode, el) {
  document.querySelectorAll('.how-box[data-mode]').forEach(function(box) {
    box.classList.toggle('active', box === el)
  });
  clearClientError()
}

function setClientError(msg) {
  var err = document.getElementById('client-error');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block'
  }
}

function clearClientError() {
  var err = document.getElementById('client-error');
  if (err) {
    err.style.display = 'none';
    err.textContent = ''
  }
}

function selectLanguage(el) {
  document.querySelectorAll('.lang-tag').forEach(function(tag) {
    tag.classList.toggle('active', tag === el)
  });
  var hiddenInput = document.getElementById('selected_language');
  if (hiddenInput) {
    hiddenInput.value = el.getAttribute('data-lang')
  }
}

function checkClaim(text) {
  var i = document.getElementById('news-input');
  if (i) {
    i.value = text;
    var shortModeBtn = document.querySelector('.how-box[data-mode="short"]');
    if (shortModeBtn) shortModeBtn.click();
    var tabTextBtn = document.getElementById('tab-text');
    if (tabTextBtn) tabTextBtn.click();
    window.scrollTo({
      top: i.offsetTop - 80,
      behavior: 'smooth'
    })
  }
}

var mainForm = document.getElementById('main-form');
if (mainForm) {
  mainForm.addEventListener('submit', function(evt) {
    var activeMode = document.querySelector('.how-box[data-mode].active');
    var mode = activeMode ? activeMode.getAttribute('data-mode') : 'short';
    var textInput = document.getElementById('news-input');
    var text = textInput ? textInput.value.trim() : '';
    var ap = document.querySelector('.panel.active');

    if (ap && ap.id === 'panel-text') {
      var wc = text ? text.split(/\s+/).filter(Boolean).length : 0;
      if (mode === 'short' && wc > 60) {
        evt.preventDefault();
        setClientError('This is longer than 60 words. Switch to "Full Articles".');
        return
      }
      if (mode === 'full' && wc > 0 && wc <= 60) {
        evt.preventDefault();
        setClientError('This is shorter than 60 words. Switch to "Short Claims".');
        return
      }
    }
    clearClientError();
    var btn = document.getElementById('submit-btn');
    if (btn) {
      btn.textContent = 'Verifying...';
      btn.disabled = true
    }
  });
}

/* ════════════════════════════════════════
   Trending Misinformation State Machine
   ════════════════════════════════════════ */
var TS = (function() {
  var state = {
    allCards: [],
    activeCategory: 'All',
    searchTerm: '',
    customCategories: []
  };

  var els = {};

  function init() {
    els.grid = document.getElementById('trending-grid');
    els.empty = document.getElementById('ts-empty');
    els.emptyText = document.getElementById('ts-empty-text');
    els.searchInput = document.getElementById('ts-search');
    els.searchTag = document.getElementById('ts-search-tag');
    els.searchTagText = document.getElementById('ts-search-tag-text');
    els.filterRow = document.getElementById('ts-filter-row');
    els.customInput = document.getElementById('ts-custom-input');
    els.customError = document.getElementById('ts-custom-error');

    if (els.searchInput) {
      els.searchInput.addEventListener('input', function() {
        liveFilter();
      });
      els.searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchSubmit();
        }
      });
    }

    if (els.customInput) {
      els.customInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addCustom();
        }
      });
    }

    if (els.grid) {
      fetchData();
    }
  }

  function showSkeleton() {
    if (!els.grid) return;
    var s = '';
    for (var i = 0; i < 4; i++) {
      s += '<div class="trending-card ts-skeleton">' +
        '<div class="ts-shimmer" style="height:16px;width:' + (60 + Math.random() * 30) + '%;border-radius:4px"></div>' +
        '<div style="height:8px"></div>' +
        '<div class="ts-shimmer" style="height:12px;width:90%;border-radius:4px"></div>' +
        '<div style="height:12px"></div>' +
        '<div style="display:flex;gap:6px">' +
        '<div class="ts-shimmer" style="height:22px;width:70px;border-radius:12px"></div>' +
        '<div class="ts-shimmer" style="height:22px;width:60px;border-radius:12px"></div>' +
        '<div class="ts-shimmer" style="height:22px;width:80px;border-radius:12px"></div>' +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<div class="ts-shimmer" style="height:30px;width:120px;border-radius:6px"></div>' +
        '</div>';
    }
    els.grid.innerHTML = s;
    if (els.empty) els.empty.style.display = 'none';
  }

  function fetchData(category) {
    showSkeleton();
    var url = '/api/trending';
    if (category) url += '?category=' + encodeURIComponent(category);
    fetch(url).then(function(r) {
      return r.json();
    }).then(function(items) {
      state.allCards = items || [];
      renderCards();
    }).catch(function() {
      state.allCards = [];
      renderCards();
    });
  }

  function getFiltered() {
    var items = state.allCards;
    var cat = state.activeCategory;
    var term = state.searchTerm.toLowerCase().trim();
    return items.filter(function(c) {
      var catMatch = (cat === 'All') || (c.category === cat);
      var termMatch = !term || c.headline.toLowerCase().indexOf(term) !== -1;
      return catMatch && termMatch;
    });
  }

  function renderCards() {
    if (!els.grid) return;
    var filtered = getFiltered();
    if (filtered.length === 0) {
      els.grid.innerHTML = '';
      if (els.empty) {
        els.empty.style.display = 'flex';
        var msg;
        if (state.activeCategory !== 'All' && !state.searchTerm) {
          msg = '\u26A0\uFE0F No fake news available for "' + state.activeCategory + '" right now. Try another category or click Refresh.';
        } else if (state.searchTerm) {
          msg = '\u26A0\uFE0F No fake news found for "' + state.searchTerm + '". Try a different keyword.';
        } else {
          msg = '\u26A0\uFE0F No fake news available right now — click Refresh to try again.';
        }
        if (els.emptyText) els.emptyText.textContent = msg;
      }
      return;
    }
    if (els.empty) els.empty.style.display = 'none';
    var html = '';
    filtered.forEach(function(item, i) {
      var escaped = item.headline.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      html += '<div class="trending-card animate-in delay-' + (Math.min(i + 1, 4)) + '">' +
        '<div class="t-headline">"' + item.headline + '"</div>' +
        '<div class="t-meta">' +
        '<span class="pill pill-muted">' + item.platform + '</span>' +
        '<span class="pill pill-muted">' + item.category + '</span>' +
        '<span class="pill pill-red">Fake — ' + item.fake_pct + '%</span>' +
        '</div>' +
        '<button class="check-claim-btn" onclick="checkClaim(\'' + escaped + '\')">Check This Claim</button>' +
        '</div>';
    });
    els.grid.innerHTML = html;
  }

  function liveFilter() {
    if (els.searchInput) {
      state.searchTerm = els.searchInput.value;
      renderCards();
    }
  }

  function searchSubmit() {
    if (!els.searchInput) return;
    var term = els.searchInput.value.trim();
    if (!term) return;
    state.searchTerm = term;
    state.activeCategory = 'All';
    activateFilterBtn('All');
    if (els.searchTag) {
      els.searchTag.style.display = 'inline-flex';
      if (els.searchTagText) els.searchTagText.textContent = 'Showing results for "' + term + '"';
    }
    fetchData(term);
  }

  function clearSearch() {
    state.searchTerm = '';
    state.activeCategory = 'All';
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchTag) els.searchTag.style.display = 'none';
    activateFilterBtn('All');
    fetchData();
  }

  function setCategory(cat, btn) {
    state.activeCategory = cat;
    state.searchTerm = ''; // clear local search when switching category
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchTag) els.searchTag.style.display = 'none';
    activateFilterBtn(cat);
    if (cat === 'All') {
      fetchData(); // general fetch
    } else {
      fetchData(cat); // category-specific fetch from API
    }
  }

  function activateFilterBtn(cat) {
    if (els.filterRow) {
      els.filterRow.querySelectorAll('.ts-filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
      });
    }
  }

  function addCustom() {
    if (!els.customInput || !els.customError || !els.filterRow) return;
    var val = els.customInput.value.trim();
    els.customError.style.display = 'none';
    if (val.length < 2) {
      els.customError.textContent = 'Category must be at least 2 characters.';
      els.customError.style.display = 'block';
      return;
    }
    if (val.length > 20) {
      els.customError.textContent = 'Category must be 20 characters or less.';
      els.customError.style.display = 'block';
      return;
    }
    var exists = els.filterRow.querySelector('[data-cat="' + val + '"]');
    if (exists) {
      state.activeCategory = val;
      activateFilterBtn(val);
      els.customInput.value = '';
      renderCards();
      return;
    }
    var btn = document.createElement('button');
    btn.className = 'ts-filter-btn ts-filter-custom';
    btn.setAttribute('data-cat', val);
    btn.textContent = val;
    btn.onclick = function() {
      setCategory(val, btn);
    };
    els.filterRow.appendChild(btn);
    state.customCategories.push(val);
    state.activeCategory = val;
    activateFilterBtn(val);
    els.customInput.value = '';
    fetchData(val);
  }

  function refresh() {
    state.searchTerm = '';
    state.activeCategory = 'All';
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchTag) els.searchTag.style.display = 'none';
    if (els.customError) els.customError.style.display = 'none';
    activateFilterBtn('All');
    fetchData();
  }

  return {
    init: init,
    refresh: refresh,
    searchSubmit: searchSubmit,
    clearSearch: clearSearch,
    setCategory: setCategory,
    addCustom: addCustom
  };
})();

TS.init();
