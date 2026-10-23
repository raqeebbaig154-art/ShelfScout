'use strict';

const { TableClient, odata } = require('@azure/data-tables');

const TABLE = 'favourites';
const WORK_ID = /^OL\d+W$/;

let client = null;
const memory = new Map(); // used only when no storage connection string is set (local testing)
let warned = false;

function useMemory() {
  if (process.env.STORAGE_CONNECTION_STRING) return false;
  if (!warned) {
    warned = true;
    console.warn('STORAGE_CONNECTION_STRING is not set. Favourites are kept in memory only.');
  }
  return true;
}

function safeKey(v) {
  return String(v).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
}

async function table() {
  if (!client) {
    const c = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, TABLE);
    try {
      await c.createTable();
    } catch (e) {
      if (e.statusCode !== 409) throw e;
    }
    client = c;
  }
  return client;
}

function toBook(e) {
  return {
    id: e.rowKey,
    title: e.title,
    author: e.author,
    coverId: Number(e.coverId) || 0,
    year: Number(e.year) || null,
    savedAt: e.savedAt
  };
}

function sanitizeBook(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.id !== 'string' || !WORK_ID.test(body.id)) return null;
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 300) return null;
  const author = typeof body.author === 'string' ? body.author.slice(0, 200) : '';
  const coverId = Number.isInteger(body.coverId) && body.coverId >= 0 && body.coverId < 1e11 ? body.coverId : 0;
  const year = Number.isInteger(body.year) && body.year > 0 && body.year < 3000 ? body.year : 0;
  return { id: body.id, title: body.title.trim(), author, coverId, year };
}

async function listFavourites(userId) {
  const pk = safeKey(userId);
  if (useMemory()) {
    return Array.from((memory.get(pk) || new Map()).values()).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }
  const c = await table();
  const out = [];
  for await (const e of c.listEntities({ queryOptions: { filter: odata`PartitionKey eq ${pk}` } })) {
    out.push(toBook(e));
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

async function addFavourite(userId, book) {
  const pk = safeKey(userId);
  const savedAt = new Date().toISOString();
  if (useMemory()) {
    if (!memory.has(pk)) memory.set(pk, new Map());
    memory.get(pk).set(book.id, { id: book.id, title: book.title, author: book.author, coverId: book.coverId, year: book.year || null, savedAt });
    return;
  }
  const c = await table();
  await c.upsertEntity(
    { partitionKey: pk, rowKey: book.id, title: book.title, author: book.author, coverId: book.coverId, year: book.year, savedAt },
    'Replace'
  );
}

async function removeFavourite(userId, id) {
  const pk = safeKey(userId);
  if (useMemory()) {
    if (memory.has(pk)) memory.get(pk).delete(id);
    return;
  }
  const c = await table();
  try {
    await c.deleteEntity(pk, id);
  } catch (e) {
    if (e.statusCode !== 404) throw e;
  }
}

module.exports = { sanitizeBook, listFavourites, addFavourite, removeFavourite };
