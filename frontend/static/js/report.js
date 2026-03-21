/* Report page JavaScript logic has been moved to report.html's internal script block for easier template integration. */

/* Platform Logic */
  function setPlatform(btn) {
    document.querySelectorAll('.platform-button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('platform-input').value = btn.dataset.val;
  }

  /* URL Validator */
  function validateUrl(input) {
    const val = input.value.trim();
    const feedback = document.getElementById('url-feedback');
    const status = document.getElementById('url-status');
    const submitBtn = document.getElementById('submit-btn');

    if (!val) {
      input.className = 'form-input with-prefix';
      feedback.className = 'input-feedback';
      status.textContent = '';
      submitBtn.disabled = true;
      return;
    }

    try {
      new URL(val);
      input.className = 'form-input with-prefix valid';
      feedback.textContent = '✓ Credible URL format detected';
      feedback.className = 'input-feedback show valid';
      status.textContent = '✓';
      status.style.color = '#27AE60';
      submitBtn.disabled = false;
      document.getElementById('step-marker-1').classList.add('done');
      document.getElementById('step-marker-2').classList.add('active');
    } catch(e) {
      if (val.length > 5) {
        input.className = 'form-input with-prefix error';
        feedback.textContent = 'Please enter a valid URL (e.g. https://...)';
        feedback.className = 'input-feedback show error';
        status.textContent = '✗';
        status.style.color = '#E8453C';
        submitBtn.disabled = true;
      }
    }
  }

  /* Textarea Counter */
  function handleTextArea(el) {
    const len = el.value.length;
    const counter = document.getElementById('char-counter');
    counter.textContent = `${len} / 1000 chars`;
    counter.classList.toggle('near-limit', len > 900);
    
    if (len > 50) {
      document.getElementById('step-marker-2').classList.add('done');
      document.getElementById('step-marker-3').classList.add('active');
    }
  }

  /* Loading State */
  document.getElementById('report-form').addEventListener('submit', (e) => {
    const btn = document.getElementById('submit-btn');
    btn.classList.add('loading');
    btn.querySelector('#btn-text').textContent = 'Submitting...';
  });

  /* Handle Flask Success State — reads from JSON data island */
  (function() {
    try {
      var configEl = document.getElementById('report-config-data');
      var config = configEl ? JSON.parse(configEl.textContent) : {};
      if (config.submitted) {
        document.getElementById('report-form-card').style.display = 'none';
        document.getElementById('success-card').style.display = 'block';
        if (config.reportId) {
          document.getElementById('success-rid').textContent = config.reportId;
        }
        // Smooth scroll to success card
        document.getElementById('success-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch(e) { /* ignore parse errors */ }
  })();

  /* Animation for sidebar bars */
  window.addEventListener('load', () => {
    document.querySelectorAll('.activity-bar-fill').forEach(bar => {
      const w = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => { bar.style.width = w; }, 400);
    });
  });