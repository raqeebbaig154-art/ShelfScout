(function () {
  'use strict';

  var GENRES = [
    ['fiction', 'Fiction'], ['science_fiction', 'Science Fiction'], ['romance', 'Romance'],
    ['fantasy', 'Fantasy'], ['technology', 'Technology'], ['history', 'History'], ['mystery', 'Mystery']
  ];
  var state = { genre: 'fiction', q: '', sort: 'relevance', page: 1, total: 0, count: 0, seq: 0, lastReset: true };

  SS.shell('home');
  var app = document.getElementById('app');
  var el = SS.el;

  var chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Genres' });
  var input = el('input', { type: 'search', id: 'q', placeholder: 'Search by title or author', autocomplete: 'off', 'aria-label': 'Search books', maxlength: '100' });
  var sortSel = el('select', { class: 'sort', 'aria-label': 'Sort results' }, [
    el('option', { value: 'relevance' }, 'Sort: Relevance'),
    el('option', { value: 'new' }, 'Sort: Newest first')
  ]);
  var search = el('div', { class: 'search' });
  search.appendChild(SS.iconNode('search'));
  search.appendChild(input);
  var statusHolder = el('div');
  var list = el('ul', { class: 'cards' });
  var more = el('button', { class: 'btn btn-more', type: 'button', hidden: true }, 'Load more');

  app.className = 'page';
  app.append(chips, el('div', { class: 'toolbar' }, [search, sortSel]), statusHolder, list, more);

  function renderChips() {
    chips.textContent = '';
    GENRES.forEach(function (g) {
      var selected = state.genre === g[0];
      var b = el('button', { class: 'chip', type: 'button', 'aria-pressed': selected ? 'true' : 'false' });
      if (selected) b.appendChild(SS.iconNode('check'));
      b.appendChild(document.createTextNode(g[1]));
      b.addEventListener('click', function () {
        if (state.genre === g[0]) return;
        state.genre = g[0];
        renderChips();
        load(true);
      });
      chips.appendChild(b);
    });
  }

  function setStatus(node) {
    statusHolder.textContent = '';
    if (node) statusHolder.appendChild(node);
  }

  async function load(reset) {
    var my = ++state.seq;
    state.lastReset = reset;
    if (reset) {
      state.page = 1; state.count = 0;
      list.textContent = '';
      more.hidden = true;
      setStatus(SS.statusBox('loading', 'Loading books...'));
    } else {
      state.page += 1;
      more.disabled = true;
      more.textContent = 'Loading...';
    }
    try {
      var params = new URLSearchParams({ q: state.q, genre: state.genre, sort: state.sort, page: String(state.page) });
      var results = await Promise.all([
        SS.api('/api/search?' + params.toString()),
        SS.loadFavs().catch(function () { return []; })
      ]);
      if (my !== state.seq) return; // an newer search was started, ignore this old answer
      var data = results[0];
      state.total = data.total;
      data.books.forEach(function (b) { list.appendChild(SS.bookCard(b)); });
      state.count += data.books.length;
      if (state.count === 0) setStatus(SS.statusBox('empty', 'No books found. Try a different title, author or genre.'));
      else setStatus(null);
      more.hidden = !(data.books.length > 0 && state.count < state.total && state.page < 20);
    } catch (err) {
      if (my !== state.seq) return;
      if (!reset) state.page -= 1;
      setStatus(SS.statusBox('error', SS.friendlyError(err), function () { load(state.lastReset && state.count === 0); }));
    } finally {
      if (my === state.seq) { more.disabled = false; more.textContent = 'Load more'; }
    }
  }

  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var v = input.value.trim();
      if (v === state.q) return;
      state.q = v;
      load(true);
    }, 400);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      clearTimeout(timer);
      state.q = input.value.trim();
      load(true);
    }
  });
  sortSel.addEventListener('change', function () { state.sort = sortSel.value; load(true); });
  more.addEventListener('click', function () { load(false); });

  renderChips();
  load(true);
})();
