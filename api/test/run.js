'use strict';
// Simple tests with a fake Open Library, run with: npm test (inside the api folder)
const assert = require('assert');

let calls = [];
global.fetch = async (url) => {
  calls.push(String(url));
  const u = String(url);
  const json = (obj, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => obj });
  if (u.includes('/search.json')) {
    return json({
      numFound: 3,
      docs: [
        { key: '/works/OL1W', title: 'The Wonderful Wizard of Oz', author_name: ['L. Frank Baum'], cover_i: 123, first_publish_year: 1900, ratings_average: 4.0567 },
        { key: '/works/OL2W', title: 'No Cover Book' },
        { key: '/authors/OL9A', title: 'Not a work' }
      ]
    });
  }
  if (u.endsWith('/works/OL1W.json')) {
    return json({ title: 'Wizard', description: { value: 'A story.\r\n----------\nSource: x' }, covers: [-1, 55], subjects: ['Fantasy', 'Magic', 7], authors: [{ author: { key: '/authors/OL5A' } }, { author: { key: '/evil/path' } }] });
  }
  if (u.endsWith('/works/OL1W/ratings.json')) return json({ summary: { average: 4.123, count: 118 } });
  if (u.includes('/works/OL1W/editions.json')) return json({ entries: [{ title: 'a' }, { number_of_pages: 154, publishers: ['Dover'] }] });
  if (u.endsWith('/authors/OL5A.json')) return json({ name: 'L. Frank Baum' });
  if (u.endsWith('/works/OL404W.json')) return json({}, 404);
  if (u.endsWith('/works/OL500W.json')) return json({}, 500);
  return json({}, 404);
};

const ol = require('../src/lib/openlibrary');
const { getUser } = require('../src/lib/auth');
const store = require('../src/lib/store');

(async () => {
  // parameter cleaning
  assert.deepStrictEqual(ol.cleanParams({ q: '  hello   world ', genre: 'bad', sort: 'x', page: '99' }), { q: 'hello world', genre: '', sort: 'relevance', page: 20 });
  assert.strictEqual(ol.cleanParams({ page: '-3' }).page, 1);
  assert.strictEqual(ol.cleanParams({ q: 'a'.repeat(500) }).q.length, 100);

  // search
  let r = await ol.searchBooks({ q: 'oz', genre: 'fantasy', sort: 'new', page: '2' });
  assert.strictEqual(r.total, 3);
  assert.strictEqual(r.books.length, 2);
  assert.deepStrictEqual(r.books[0], { id: 'OL1W', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', coverId: 123, year: 1900, rating: 4.1 });
  assert.strictEqual(r.books[1].author, 'Unknown author');
  const used = new URL(calls[calls.length - 1]);
  assert.strictEqual(used.searchParams.get('q'), 'oz subject:fantasy');
  assert.strictEqual(used.searchParams.get('sort'), 'new');
  assert.strictEqual(used.searchParams.get('page'), '2');
  await ol.searchBooks({});
  assert.strictEqual(new URL(calls[calls.length - 1]).searchParams.get('q'), 'subject:fiction');

  // book details
  const b = await ol.getBook('OL1W');
  assert.strictEqual(b.title, 'Wizard');
  assert.strictEqual(b.description, 'A story.');
  assert.strictEqual(b.coverId, 55);
  assert.deepStrictEqual(b.authors, ['L. Frank Baum']);
  assert.strictEqual(b.rating, 4.1);
  assert.strictEqual(b.ratingCount, 118);
  assert.strictEqual(b.pages, 154);
  assert.strictEqual(b.publisher, 'Dover');
  assert.deepStrictEqual(b.subjects, ['Fantasy', 'Magic']);
  assert.ok(!calls.some((c) => c.includes('/evil/path')), 'unsafe author key must not be fetched');
  await assert.rejects(() => ol.getBook('../x'), (e) => e.status === 400);
  await assert.rejects(() => ol.getBook('OL404W'), (e) => e.status === 404);
  await assert.rejects(() => ol.getBook('OL500W'), (e) => e.status === 502);

  // auth header
  const principal = (o) => ({ headers: { get: () => Buffer.from(JSON.stringify(o)).toString('base64') } });
  assert.strictEqual(getUser({ headers: { get: () => null } }), null);
  assert.strictEqual(getUser(principal({ userId: 'abc', userRoles: ['anonymous'] })), null);
  assert.deepStrictEqual(getUser(principal({ userId: 'abc', userDetails: 'raqeeb', userRoles: ['anonymous', 'authenticated'] })), { id: 'abc', name: 'raqeeb' });
  assert.strictEqual(getUser({ headers: { get: () => 'not base64 json' } }), null);

  // store (memory mode, because no connection string is set)
  delete process.env.STORAGE_CONNECTION_STRING;
  assert.strictEqual(store.sanitizeBook({ id: 'bad', title: 'x' }), null);
  assert.strictEqual(store.sanitizeBook({ id: 'OL1W', title: '' }), null);
  const book = store.sanitizeBook({ id: 'OL1W', title: ' Wizard ', author: 'Baum', coverId: 5, year: 1900, extra: 'ignored' });
  assert.deepStrictEqual(book, { id: 'OL1W', title: 'Wizard', author: 'Baum', coverId: 5, year: 1900 });
  await store.addFavourite('user/1', book);
  await store.addFavourite('user/1', store.sanitizeBook({ id: 'OL2W', title: 'Two' }));
  await store.addFavourite('user2', book);
  let list = await store.listFavourites('user/1');
  assert.strictEqual(list.length, 2);
  await store.removeFavourite('user/1', 'OL1W');
  list = await store.listFavourites('user/1');
  assert.deepStrictEqual(list.map((x) => x.id), ['OL2W']);
  assert.strictEqual((await store.listFavourites('user2')).length, 1);
  await store.removeFavourite('user/1', 'OL999W'); // removing a missing item is fine

  console.log('All API tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
