// Navbar scroll effect
window.addEventListener('scroll', function() {
  document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 10)
});
// Close mobile menu on link click
document.querySelectorAll('.navbar-links a').forEach(function(a) {
  a.addEventListener('click', function() {
    document.getElementById('nav-links').classList.remove('open')
  })
});
// Day/Night mode toggle with localStorage
(function() {
  var html = document.documentElement;
  var label = document.getElementById('dt-label');

  function applyMode(dark) {
    if (dark) {
      html.classList.add('dark');
      if (label) label.textContent = 'NIGHTMODE';
    } else {
      html.classList.remove('dark');
      if (label) label.textContent = 'DAYMODE';
    }
  }
  var saved = localStorage.getItem('darkMode');
  applyMode(saved === 'true');
  var toggle = document.getElementById('dark-toggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      var isDark = !html.classList.contains('dark');
      applyMode(isDark);
      localStorage.setItem('darkMode', isDark);
    });
  }
})();
