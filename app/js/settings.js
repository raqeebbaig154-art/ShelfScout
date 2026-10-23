(function () {
  'use strict';
  SS.shell('settings');
  var el = SS.el;
  var app = document.getElementById('app');
  app.className = 'page';

  var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  function setTheme(t) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('ss_theme', t); } catch (e) { /* ignore */ }
  }
  function radio(value, label) {
    var input = el('input', { type: 'radio', name: 'theme', value: value, checked: current === value });
    input.addEventListener('change', function () { if (input.checked) setTheme(value); });
    return el('label', { class: 'radio' }, [input, label]);
  }

  var accountBody = el('p', { class: 'muted' }, 'Checking account...');
  app.append(
    el('h2', null, 'Settings'),
    el('section', { class: 'panel' }, [el('h3', null, 'Theme'), radio('light', 'Light'), radio('dark', 'Dark')]),
    el('section', { class: 'panel' }, [el('h3', null, 'Account'), accountBody])
  );

  SS.getUser().then(function (u) {
    accountBody.textContent = '';
    if (u) {
      accountBody.appendChild(el('p', null, 'Signed in as ' + u.userDetails));
      accountBody.appendChild(el('a', { class: 'btn secondary', href: '/.auth/logout?post_logout_redirect_uri=/' }, 'Sign out'));
    } else {
      accountBody.appendChild(el('p', { class: 'muted' }, 'You are not signed in. Sign in to save favourite books.'));
      accountBody.appendChild(el('a', { class: 'btn', href: '/login.html' }, 'Sign in'));
    }
  });
})();
