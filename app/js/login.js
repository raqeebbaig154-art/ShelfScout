(function () {
  'use strict';
  SS.shell('');
  var el = SS.el;
  var app = document.getElementById('app');
  app.className = 'page';

  var next = new URLSearchParams(location.search).get('next') || '/';
  if (next.charAt(0) !== '/' || next.charAt(1) === '/' || next.indexOf('\\') !== -1) next = '/';
  var redirect = encodeURIComponent(next);

  var box = el('section', { class: 'panel login-box' }, [el('p', { class: 'muted' }, 'Checking account...')]);
  app.appendChild(box);

  SS.getUser().then(function (u) {
    box.textContent = '';
    if (u) {
      box.appendChild(el('h2', null, 'You are signed in'));
      box.appendChild(el('p', { class: 'muted' }, 'Signed in as ' + u.userDetails));
      box.appendChild(el('a', { class: 'btn', href: next }, 'Continue'));
      return;
    }
    box.appendChild(el('h2', null, 'Sign in to ShelfScout'));
    box.appendChild(el('p', { class: 'muted' }, 'Sign in to save your favourite books. Your account is created automatically the first time you sign in.'));
    box.appendChild(el('a', { class: 'btn', href: '/.auth/login/github?post_login_redirect_uri=' + redirect }, 'Continue with GitHub'));
    box.appendChild(el('a', { class: 'btn secondary', href: '/.auth/login/aad?post_login_redirect_uri=' + redirect }, 'Continue with Microsoft'));
    box.appendChild(el('p', { class: 'credit' }, 'A Cloud Computing project by Raqeeb Baig, Adeel Shad and Muhammad Moonam.'));
  });
})();
