(function () {
  try {
    if (localStorage.getItem('ss_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) { /* storage may be blocked, light theme is used */ }
})();
