(function () {
  'use strict';
  SS.shell('about');
  var el = SS.el;
  var app = document.getElementById('app');
  app.className = 'page';

  var members = [['Raqeeb Baig', 'K22SW036'], ['Adeel Shad', 'K22SW007'], ['Muhammad Moonam', 'K22SW014']];
  var table = el('table', { class: 'team' }, [
    el('thead', null, el('tr', null, [el('th', null, 'Name'), el('th', null, 'Roll No')])),
    el('tbody', null, members.map(function (m) { return el('tr', null, [el('td', null, m[0]), el('td', null, m[1])]); }))
  ]);
  app.append(
    el('h2', null, 'About the Team'),
    el('section', { class: 'panel' }, [
      el('h3', null, 'ShelfScout'),
      el('p', null, 'ShelfScout is a book discovery website. Search books by title or author, browse by genre, read the details and save your favourites. Book data comes from the Open Library API and the site is hosted on Microsoft Azure.')
    ]),
    el('section', { class: 'panel' }, [el('h3', null, 'Project members'), table]),
    el('section', { class: 'panel' }, [
      el('h3', null, 'Course'),
      el('p', null, 'SW 425 Cloud Computing, Department of Software Engineering, Mehran University of Engineering and Technology, SZAB Campus Khairpur Mir\u2019s.'),
      el('p', { class: 'muted' }, 'Teacher: Asad Raza Malik')
    ])
  );
})();
