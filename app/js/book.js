(function () {
  'use strict';
  SS.shell('');
  var el = SS.el;
  var app = document.getElementById('app');
  app.className = 'page';

  var id = new URLSearchParams(location.search).get('id') || '';
  var back = el('a', { class: 'back', href: '/' }, [SS.iconNode('back'), 'Back to books']);
  var holder = el('div');
  app.append(back, holder);

  if (!/^OL\d+W$/.test(id)) {
    holder.appendChild(SS.statusBox('error', 'This book link is not valid.'));
    return;
  }

  function copyLink() {
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function render(book) {
    document.title = book.title + ' | ShelfScout';
    var facts = el('ul', { class: 'facts' });
    function fact(label, value) {
      if (value === null || value === undefined || value === '') return;
      facts.appendChild(el('li', null, [el('span', null, label), String(value)]));
    }
    fact('Rating', book.rating ? '\u2605 ' + book.rating + ' (' + book.ratingCount + ' ratings)' : '');
    fact('Pages', book.pages);
    fact('Publisher', book.publisher);

    var favBtn = el('button', { class: 'btn fav-btn', type: 'button' });
    function paintFav() {
      var on = SS.isFav(book.id);
      favBtn.classList.toggle('on', on);
      favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      favBtn.textContent = on ? '\u2665 Saved to favourites' : '\u2661 Add to favourites';
    }
    favBtn.addEventListener('click', async function () {
      favBtn.disabled = true;
      try {
        var now = await SS.toggleFav(book);
        if (now !== null) paintFav();
      } catch (err) {
        SS.toast(SS.friendlyError(err));
      } finally {
        favBtn.disabled = false;
      }
    });
    var copyBtn = el('button', { class: 'btn secondary', type: 'button' }, 'Copy link');
    copyBtn.addEventListener('click', function () {
      copyLink().then(function () { SS.toast('Link copied'); }, function () { SS.toast('Could not copy the link'); });
    });
    var actions = el('div', { class: 'actions' }, [favBtn, copyBtn, el('a', { class: 'btn secondary', href: book.link, target: '_blank', rel: 'noopener noreferrer' }, 'Open on Open Library')]);

    var info = el('div', { class: 'detail-info' }, [
      el('h2', null, book.title),
      el('p', { class: 'muted' }, 'by ' + book.authors.join(', ')),
      facts
    ]);
    if (book.subjects.length) {
      info.appendChild(el('ul', { class: 'tags', 'aria-label': 'Categories' }, book.subjects.map(function (s) { return el('li', null, s); })));
    }
    info.appendChild(actions);

    var box = el('article', { class: 'detail' }, [el('div', { class: 'detail-top' }, [SS.cover(book, 'M'), info])]);
    if (book.description) {
      box.appendChild(el('div', { class: 'desc' }, [el('h3', null, 'Description'), el('p', null, book.description)]));
    }
    holder.textContent = '';
    holder.appendChild(box);
    paintFav();
  }

  function load() {
    holder.textContent = '';
    holder.appendChild(SS.statusBox('loading', 'Loading book details...'));
    Promise.all([
      SS.api('/api/book/' + encodeURIComponent(id)),
      SS.loadFavs().catch(function () { return []; })
    ]).then(function (r) { render(r[0]); }, function (err) {
      holder.textContent = '';
      holder.appendChild(SS.statusBox('error', SS.friendlyError(err), err.status === 404 ? null : load));
    });
  }
  load();
})();
