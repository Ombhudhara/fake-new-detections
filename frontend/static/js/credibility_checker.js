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
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ domain: val })
      });
      const d = await res.json();

      if (d.success) {
        result.className = `cw-result ${d.color}`;
        result.innerHTML =
          `<strong>${d.domain}</strong> — ` +
          `${d.tier} · Score: ` +
          `<strong>${d.score}/100</strong><br>` +
          `${d.advice}`;
      } else {
        result.className = 'cw-result amber';
        result.innerHTML = '⚠ Could not check. Try entering just the domain name.';
      }
    } catch(e) {
      result.className = 'cw-result red';
      result.innerHTML = '⚠ Connection error. Try again.';
    }
  }