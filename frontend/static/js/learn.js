/* ── Reading Progress Logic ── */
  window.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    const pct = Math.round((scrollTop / scrollHeight) * 100);
    const fill = document.getElementById('read-progress-fill');
    if (fill) fill.style.width = pct + '%';
  });

  /* ── Test Your Skills Quiz ── */
  let QUIZ_DATA    = []; // Loaded dynamically
  let quizCurrent  = 0;
  let quizScore    = 0;
  let quizAnswered = false;

  async function loadQuiz() {
    const card = document.getElementById('quiz-card');
    if (!card) return;

    try {
      const response = await fetch('/api/quiz');
      if (!response.ok) throw new Error('Failed to load quiz');
      QUIZ_DATA = await response.json();
      quizRender();
    } catch (err) {
      console.error('Quiz Error:', err);
      card.innerHTML = `<div style="text-align:center;padding:40px;color:#E8453C">
        <p>⚠️ Failed to load quiz. Please check your connection and try again.</p>
        <button onclick="loadQuiz()" style="margin-top:10px;padding:10px 20px;cursor:pointer">Retry</button>
      </div>`;
    }
  }

  let quizStartTime = Date.now();

  function quizRender() {
    const card = document.getElementById('quiz-card');
    if (!card || QUIZ_DATA.length === 0) return;
    
    if (quizCurrent === 0) {
      quizStartTime = Date.now();
    }

    if (quizCurrent >= QUIZ_DATA.length) {
      quizShowResult(); return;
    }
    const q = QUIZ_DATA[quizCurrent];
    const pct = ((quizCurrent + 1) / QUIZ_DATA.length) * 100;

    const counter = document.getElementById('quiz-counter');
    const fill = document.getElementById('quiz-progress-fill');
    const scoreDisp = document.getElementById('quiz-score-display');
    const question = document.getElementById('quiz-question');
    const options = document.getElementById('quiz-options');
    const fb = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('quiz-next-btn');

    if (counter) counter.textContent = `Question ${quizCurrent + 1} of ${QUIZ_DATA.length}`;
    if (fill) fill.style.width = pct + '%';
    if (scoreDisp) scoreDisp.textContent = `Score: ${quizScore}`;
    if (question) question.textContent = q.q;

    if (options) {
      options.innerHTML = q.options.map((opt, i) => `
        <button class="quiz-option" data-index="${i}" onclick="quizAnswer(${i})">${opt}</button>
      `).join('');
    }

    if (fb) {
      fb.className = 'quiz-feedback';
      fb.textContent = '';
    }

    if (nextBtn) nextBtn.style.display = 'none';
    quizAnswered = false;
  }

  function quizAnswer(chosen) {
    if (quizAnswered) return;
    quizAnswered = true;
    const q = QUIZ_DATA[quizCurrent];
    const correct = chosen === q.correct;
    if (correct) quizScore++;

    document.querySelectorAll('.quiz-option').forEach((btn, i) => {
      if (i === q.correct) btn.classList.add('correct');
      else if (i === chosen && !correct) btn.classList.add('wrong');
      else btn.classList.add('dimmed');
    });

    const fb = document.getElementById('quiz-feedback');
    if (fb) {
      fb.textContent = q.explanation;
      fb.className = 'quiz-feedback visible ' + (correct ? 'correct' : 'wrong');
    }

    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) {
      nextBtn.style.display = 'block';
      nextBtn.textContent = quizCurrent < QUIZ_DATA.length - 1 ? 'Next Question →' : 'See My Results →';
    }
  }

  function quizNext() {
    quizCurrent++;
    quizRender();
  }


  async function quizShowResult() {
    const pct      = Math.round((quizScore / QUIZ_DATA.length) * 100);
    const timeTaken= Math.round((Date.now() - quizStartTime) / 1000);

    /* Save to backend */
    let globalStats = null;
    try {
      const res = await fetch('/api/quiz/save-score', {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ score: quizScore, total: QUIZ_DATA.length, time_taken: timeTaken })
      });
      const d = await res.json();
      if (d.success) globalStats = d;
    } catch(e) {}

    /* Build result HTML */
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚';
    const badge = globalStats?.badge || (pct >= 80 ? 'Excellent!' : 'Good try!');
    const level = globalStats?.level || 'Fact-Checker';

    const globalHtml = globalStats?.global_stats
      ? `<div class="quiz-global-stats">
          <div class="qgs-item">
            <div class="qgs-val">${globalStats.global_stats.total_players}</div>
            <div class="qgs-label">Total players</div>
          </div>
          <div class="qgs-item">
            <div class="qgs-val">${globalStats.global_stats.avg_score}%</div>
            <div class="qgs-label">Average score</div>
          </div>
          <div class="qgs-item">
            <div class="qgs-val">${globalStats.global_stats.perfect_scores}</div>
            <div class="qgs-label">Perfect scores</div>
          </div>
        </div>`
      : '';

    const card = document.getElementById('quiz-card');
    if (card) {
      card.innerHTML =
        `<div style="text-align:center;padding:20px 0">
          <div style="font-size:48px;margin-bottom:12px">${emoji}</div>
          <div class="quiz-result-score">${quizScore}/${QUIZ_DATA.length}</div>
          <div class="quiz-result-badge">${badge}</div>
          <div class="quiz-result-level">Level: ${level}</div>
          <div class="quiz-result-time">⏱ Completed in ${timeTaken}s</div>
          ${globalHtml}
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px">
            <button onclick="quizRestart()" class="btn btn-primary" style="padding:14px 28px; border-radius:12px; border:none; background:#E8453C; color:#fff; font-size:15px; font-weight:700; cursor:pointer; font-family:'Space Grotesk',sans-serif">Try Again</button>
            <a href="/" class="btn btn-outline" style="padding:14px 28px; border-radius:12px; border:1px solid var(--learn-card-border); background:var(--bg-page); color:var(--navy); font-size:15px; font-weight:700; cursor:pointer; text-decoration:none; font-family:'Space Grotesk',sans-serif; display:inline-block">Check Real News →</a>
          </div>
        </div>`;
    }
  }

  function quizRestart() {
    location.reload();
  }

  async function checkCredibilityInline() {
    const input = document.getElementById('cw-input');
    const result= document.getElementById('cw-result');
    const val   = input.value.trim();
    if (!val) return;

    result.style.display = 'block';
    result.className     = 'cw-result';
    result.innerHTML     = '⏳ Checking...';

    try {
      const res = await fetch('/api/check-credibility', {
        method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ domain: val })
      });
      const d = await res.json();
      if (d.success) {
        result.className = `cw-result ${d.color}`;
        result.innerHTML = `<strong>${d.domain}</strong> — ${d.tier} · Score: <strong>${d.score}/100</strong><br>${d.advice}`;
      } else {
        result.className = 'cw-result amber';
        result.innerHTML = '⚠ Could not check. Try entering just the domain name.';
      }
    } catch(e) {
      result.className = 'cw-result red';
      result.innerHTML = '⚠ Connection error. Try again.';
    }
  }

  async function loadLiveStats() {
    try {
      const res = await fetch('/api/model-stats');
      const d   = await res.json();

      const accEl = document.getElementById('cta-accuracy');
      if (accEl) animateStat(accEl, Math.round(d.accuracy || 84), '%');

      const langEl = document.getElementById('cta-languages');
      if (langEl) langEl.textContent = d.languages_supported || 5;

      const predEl = document.getElementById('cta-predictions');
      if (predEl) {
        const n = d.total_predictions || 4821;
        animateStat(predEl, n >= 1000 ? Math.round(n/1000) : n, n >= 1000 ? 'K+' : '+');
      }
    } catch(e) {
      const acc = document.getElementById('cta-accuracy');
      if (acc) acc.textContent = '84%';
      const lang = document.getElementById('cta-languages');
      if (lang) lang.textContent = '5';
      const pred = document.getElementById('cta-predictions');
      if (pred) pred.textContent = '4.8K+';
    }
  }

  function animateStat(el, target, suffix) {
    let n = 0;
    const dur = 1000;
    const t0  = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + (suffix || '');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target + (suffix || '');
    })(t0);
  }

  /* ── Scroll Entrance Animations ── */
  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        scrollObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.addEventListener('DOMContentLoaded', () => {
    loadQuiz();
    loadLiveStats();
    
    document.querySelectorAll('.tip-card, .misinfo-card, .resource-card, .learn-section-header, .quiz-card, .learn-cta-banner').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms`;
      scrollObserver.observe(el);
    });
  });