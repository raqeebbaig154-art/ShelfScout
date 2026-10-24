'use strict';

const BASE = 'https://openlibrary.org';
const GENRES = ['fiction', 'science_fiction', 'romance', 'fantasy', 'technology', 'history', 'mystery'];
const WORK_ID = /^OL\d+W$/;
const AUTHOR_KEY = /^\/authors\/OL\d+A$/;

const FRESH_MS = 10 * 60 * 1000;      // reuse an answer for 10 minutes
const STALE_MS = 24 * 60 * 60 * 1000; // if Open Library is down, an answer up to 24 hours old is better than an error
const MAX_CACHE = 300;
const cache = new Map();
const settings = { retryDelayMs: 400 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function remember(url, data) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(url, { data, time: Date.now() });
}

async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ShelfScout/1.0 (student cloud computing project; https://github.com/raqeebbaig154-art/ShelfScout)'
      }
    });
    if (res.status === 404) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    if (!res.ok) {
      const e = new Error('Book service error ' + res.status);
      e.status = 502;
      throw e;
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Book service timed out');
      e.status = 504;
      throw e;
    }
    if (!err.status) err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Tries twice, remembers good answers, and falls back to an older answer if the service is down.
async function getJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < FRESH_MS) return hit.data;

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await fetchOnce(url, 6000);
      remember(url, data);
      return data;
    } catch (err) {
      lastErr = err;
      if (err.status === 404) throw err;
      if (attempt === 0) await sleep(settings.retryDelayMs);
    }
  }
  if (hit && Date.now() - hit.time < STALE_MS) return hit.data;
  throw lastErr;
}

function cleanParams(input) {
  input = input || {};
  const q = String(input.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const genre = GENRES.includes(input.genre) ? input.genre : '';
  const sort = input.sort === 'new' ? 'new' : 'relevance';
  let page = parseInt(input.page, 10);
  if (!(page >= 1)) page = 1;
  if (page > 20) page = 20;
  return { q, genre, sort, page };
}

async function searchBooks(input) {
  const p = cleanParams(input);
  const parts = [];
  if (p.q) parts.push(p.q);
  if (p.genre) parts.push('subject:' + p.genre);
  if (!parts.length) parts.push('subject:fiction');

  const params = new URLSearchParams({
    q: parts.join(' '),
    fields: 'key,title,author_name,cover_i,first_publish_year,ratings_average',
    limit: '20',
    page: String(p.page)
  });
  if (p.sort === 'new') params.set('sort', 'new');

  const data = await getJson(BASE + '/search.json?' + params.toString());
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const books = docs
    .filter((d) => d && typeof d.key === 'string' && /^\/works\/OL\d+W$/.test(d.key))
    .map((d) => ({
      id: d.key.replace('/works/', ''),
      title: d.title || 'Untitled',
      author: (d.author_name || []).slice(0, 2).join(', ') || 'Unknown author',
      coverId: d.cover_i || 0,
      year: d.first_publish_year || null,
      rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : null
    }));
  return { total: data.numFound || 0, page: p.page, books };
}

function cleanDescription(d) {
  let t = typeof d === 'string' ? d : d && typeof d.value === 'string' ? d.value : '';
  t = t.split(/\r?\n-{5,}/)[0];
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r/g, '').trim();
  return t.slice(0, 3000);
}

async function getBook(id) {
  if (!WORK_ID.test(String(id))) {
    const e = new Error('Invalid book id');
    e.status = 400;
    throw e;
  }
  const work = await getJson(BASE + '/works/' + id + '.json');
  if (!work || (work.type && work.type.key === '/type/redirect')) {
    const e = new Error('Not found');
    e.status = 404;
    throw e;
  }

  const authorKeys = (work.authors || [])
    .map((a) => a && a.author && a.author.key)
    .filter((k) => typeof k === 'string' && AUTHOR_KEY.test(k))
    .slice(0, 3);

  const [ratings, editions, names] = await Promise.all([
    getJson(BASE + '/works/' + id + '/ratings.json').catch(() => null),
    getJson(BASE + '/works/' + id + '/editions.json?limit=10').catch(() => null),
    Promise.all(authorKeys.map((k) => getJson(BASE + k + '.json').then((x) => x.name).catch(() => null)))
  ]);

  const entries = (editions && Array.isArray(editions.entries) && editions.entries) || [];
  const withPages = entries.find((e) => e.number_of_pages);
  const withPublisher = entries.find((e) => Array.isArray(e.publishers) && e.publishers.length);
  const summary = (ratings && ratings.summary) || {};
  const authors = names.filter(Boolean);

  return {
    id,
    title: work.title || 'Untitled',
    authors: authors.length ? authors : ['Unknown author'],
    description: cleanDescription(work.description),
    coverId: (work.covers || []).find((c) => c > 0) || 0,
    rating: summary.average ? Math.round(summary.average * 10) / 10 : null,
    ratingCount: summary.count || 0,
    pages: withPages ? withPages.number_of_pages : null,
    publisher: withPublisher ? withPublisher.publishers[0] : null,
    subjects: (work.subjects || []).filter((s) => typeof s === 'string').slice(0, 8),
    link: BASE + '/works/' + id
  };
}

module.exports = { GENRES, WORK_ID, cleanParams, searchBooks, getBook, cleanDescription, _cache: cache, _settings: settings };
