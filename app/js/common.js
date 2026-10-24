(function () {
  'use strict';

  var SS = {};
  window.SS = SS;

  var ICONS = {
    menu: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
  };
  SS.icon = function (name) { return ICONS[name]; };

  // small helper to build elements safely (text is always set with textContent)
  SS.el = function (tag, props, children) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') node.className = v;
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    });
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  };
  var el = SS.el;

  function iconSpan(name) {
    var s = document.createElement('span');
    s.style.display = 'inline-flex';
    s.innerHTML = ICONS[name]; // constant strings only
    return s;
  }
  SS.iconNode = iconSpan;

  /* ---------- network ---------- */
  async function request(path, options) {
    options = options || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, options.timeout || 20000);
    var headers = { Accept: 'application/json' };
    if (options.body) headers['Content-Type'] = 'application/json';
    var res;
    try {
      res = await fetch(path, { method: options.method || 'GET', body: options.body, headers: headers, signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      var err = new Error('network');
      err.code = e && e.name === 'AbortError' ? 'timeout' : (navigator.onLine === false ? 'offline' : 'network');
      throw err;
    }
    clearTimeout(timer);
    var data = null;
    try { data = await res.json(); } catch (e) { /* no json body */ }
    if (!res.ok) {
      var herr = new Error((data && data.error) || 'Request failed');
      herr.code = 'http';
      herr.status = res.status;
      throw herr;
    }
    return data;
  }

  SS.retryDelay = 800;
  // reading data is tried a second time automatically when the server is busy or slow
  SS.api = async function (path, options) {
    options = options || {};
    var attempts = (options.method || 'GET') === 'GET' ? 2 : 1;
    for (var i = 0; ; i++) {
      try {
        return await request(path, options);
      } catch (err) {
        var busy = err.code === 'timeout' || err.code === 'network' || err.status === 502 || err.status === 504;
        if (!busy || i >= attempts - 1) throw err;
        await new Promise(function (r) { setTimeout(r, SS.retryDelay); });
      }
    }
  };

  SS.friendlyError = function (err) {
    if (!err) return 'Something went wrong. Please try again.';
    if (err.code === 'offline') return 'You seem to be offline. Check your internet connection and try again.';
    if (err.code === 'timeout') return 'The server took too long to respond. Please try again.';
    if (err.code === 'network') return 'Could not reach the server. Please check your connection and try again.';
    if (err.status === 401) return 'Please sign in first.';
    if (err.status === 404) return 'This book could not be found.';
    if (err.status === 502 || err.status === 504) return 'The book service is busy right now. Please try again in a moment.';
    return 'Something went wrong. Please try again.';
  };

  /* ---------- user and favourites ---------- */
  var userPromise = null;
  SS.getUser = function () {
    if (!userPromise) {
      userPromise = fetch('/.auth/me')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return (d && d.clientPrincipal) || null; })
        .catch(function () { return null; });
    }
    return userPromise;
  };

  var favMap = new Map();
  var favPromise = null;
  SS.loadFavs = function () {
    if (!favPromise) {
      favPromise = SS.getUser()
        .then(function (u) {
          if (!u) return [];
          return SS.api('/api/favourites').then(function (d) { return (d && d.books) || []; });
        })
        .then(function (list) {
          favMap.clear();
          list.forEach(function (b) { favMap.set(b.id, b); });
          return list;
        })
        .catch(function (err) { favPromise = null; throw err; });
    }
    return favPromise;
  };
  SS.isFav = function (id) { return favMap.has(id); };

  function slim(b) {
    return {
      id: b.id,
      title: b.title,
      author: b.author || (b.authors ? b.authors.join(', ') : ''),
      coverId: b.coverId || 0,
      year: b.year || b.firstPublishYear || 0
    };
  }

  // returns true when the book is now a favourite, false when removed, null when the user was sent to sign in
  SS.toggleFav = async function (book) {
    var user = await SS.getUser();
    if (!user) {
      location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return null;
    }
    await SS.loadFavs();
    if (favMap.has(book.id)) {
      await SS.api('/api/favourites/' + encodeURIComponent(book.id), { method: 'DELETE' });
      favMap.delete(book.id);
      return false;
    }
    var s = slim(book);
    await SS.api('/api/favourites', { method: 'POST', body: JSON.stringify(s) });
    favMap.set(book.id, s);
    return true;
  };

  /* ---------- small ui helpers ---------- */
  var toastTimer = null;
  SS.toast = function (text) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = el('div', { class: 'toast', role: 'status' }, text);
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 3000);
  };

  SS.setHeart = function (btn, on) {
    btn.classList.toggle('on', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
  };

  SS.cover = function (book, size) {
    if (book.coverId) {
      var img = el('img', {
        class: 'cover', loading: 'lazy', alt: '',
        src: 'https://covers.openlibrary.org/b/id/' + encodeURIComponent(book.coverId) + '-' + (size || 'S') + '.jpg'
      });
      img.addEventListener('error', function () { img.replaceWith(SS.placeholder(book)); });
      return img;
    }
    return SS.placeholder(book);
  };
  SS.placeholder = function (book) {
    var letter = (book.title || '?').trim().charAt(0).toUpperCase() || '?';
    return el('div', { class: 'cover ph', 'aria-hidden': 'true' }, letter);
  };

  SS.bookCard = function (book, opts) {
    opts = opts || {};
    var sub = [book.author];
    if (book.year) sub.push(String(book.year));
    var main = el('a', { class: 'card-main', href: '/book.html?id=' + encodeURIComponent(book.id) }, [
      SS.cover(book, 'S'),
      el('div', { class: 'card-text' }, [
        el('h3', { class: 'card-title' }, book.title),
        el('p', { class: 'card-sub' }, sub.filter(Boolean).join(' \u00B7 '))
      ])
    ]);
    var heart = el('button', { class: 'icon-btn heart', type: 'button' });
    heart.innerHTML = ICONS.heart;
    SS.setHeart(heart, SS.isFav(book.id));
    var chev = el('a', { class: 'icon-btn chev', href: '/book.html?id=' + encodeURIComponent(book.id), 'aria-label': 'Open ' + book.title });
    chev.innerHTML = ICONS.chevron;
    var card = el('li', { class: 'card' }, [main, heart, chev]);

    heart.addEventListener('click', async function () {
      heart.disabled = true;
      try {
        var now = await SS.toggleFav(book);
        if (now === null) return;
        SS.setHeart(heart, now);
        if (opts.onToggle) opts.onToggle(now, card);
      } catch (err) {
        SS.toast(SS.friendlyError(err));
      } finally {
        heart.disabled = false;
      }
    });
    return card;
  };

  /* ---------- header and sidebar ---------- */
  SS.shell = function (active) {
    var menuBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false' });
    menuBtn.innerHTML = ICONS.menu;
    var header = el('header', { class: 'topbar' }, [menuBtn, el('h1', { class: 'brand' }, 'ShelfScout'), el('span', { class: 'spacer' })]);
    var overlay = el('div', { class: 'overlay' });

    var who = el('p', null, 'Browse and save books');
    var links = [
      ['home', '/', 'Home'],
      ['favourites', '/favourites.html', 'Favourites'],
      ['settings', '/settings.html', 'Settings'],
      ['about', '/about.html', 'About the Team']
    ].map(function (l) {
      return el('a', { href: l[1], class: l[0] === active ? 'active' : '', 'aria-current': l[0] === active ? 'page' : false }, l[2]);
    });
    var account = el('div', { class: 'account' });
    var drawer = el('aside', { class: 'drawer', 'aria-label': 'Menu', 'aria-hidden': 'true' }, [
      el('div', { class: 'drawer-head' }, [el('h2', null, 'ShelfScout'), who]),
      el('nav', null, links),
      account
    ]);

    function open() {
      drawer.classList.add('open'); overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false'); menuBtn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      drawer.classList.remove('open'); overlay.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true'); menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.focus();
    }
    menuBtn.addEventListener('click', open);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });

    document.body.prepend(header, overlay, drawer);

    SS.getUser().then(function (u) {
      if (u) {
        who.textContent = 'Signed in as ' + u.userDetails;
        account.appendChild(el('a', { class: 'btn secondary', href: '/.auth/logout?post_logout_redirect_uri=/', style: 'display:block' }, 'Sign out'));
      } else {
        account.appendChild(el('a', { class: 'btn', href: '/login.html', style: 'display:block' }, 'Sign in'));
      }
    });
  };

  SS.statusBox = function (kind, text, onRetry) {
    var box = el('div', { class: 'status' + (kind === 'error' ? ' error' : ''), 'aria-live': 'polite' });
    if (kind === 'loading') box.appendChild(el('div', { class: 'spinner' }));
    box.appendChild(el('p', null, text));
    if (kind === 'error' && onRetry) {
      var b = el('button', { class: 'btn secondary', type: 'button' }, 'Try again');
      b.addEventListener('click', onRetry);
      box.appendChild(b);
    }
    return box;
  };
})();
