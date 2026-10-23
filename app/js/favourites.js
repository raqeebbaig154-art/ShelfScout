(function () {
  'use strict';
  SS.shell('favourites');
  var el = SS.el;
  var app = document.getElementById('app');
  app.className = 'page';
  var holder = el('div');
  var list = el('ul', { class: 'cards' });
  app.append(el('h2', null, 'Your favourites'), holder, list);

  function empty() {
    holder.textContent = '';
    holder.appendChild(SS.statusBox('empty', 'You have not saved any books yet. Tap the heart on a book to save it.'));
    holder.appendChild(el('a', { class: 'btn', href: '/' }, 'Browse books'));
  }

  async function load() {
    holder.textContent = '';
    list.textContent = '';
    var user = await SS.getUser();
    if (!user) {
      holder.appendChild(SS.statusBox('empty', 'Please sign in to see your favourite books.'));
      holder.appendChild(el('a', { class: 'btn', href: '/login.html?next=%2Ffavourites.html' }, 'Sign in'));
      return;
    }
    holder.appendChild(SS.statusBox('loading', 'Loading your favourites...'));
    try {
      var books = await SS.loadFavs();
      holder.textContent = '';
      if (!books.length) { empty(); return; }
      books.forEach(function (b) {
        list.appendChild(SS.bookCard(b, {
          onToggle: function (now, card) {
            if (!now) {
              card.remove();
              if (!list.children.length) empty();
            }
          }
        }));
      });
    } catch (err) {
      holder.textContent = '';
      holder.appendChild(SS.statusBox('error', SS.friendlyError(err), load));
    }
  }
  load();
})();
