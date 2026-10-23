'use strict';

const { app } = require('@azure/functions');
const { getUser } = require('../lib/auth');
const { sanitizeBook, listFavourites, addFavourite, removeFavourite } = require('../lib/store');
const { WORK_ID } = require('../lib/openlibrary');
const { fail } = require('../lib/http');

const noUser = { status: 401, jsonBody: { error: 'Please sign in first.' } };

app.http('favouritesListAdd', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'favourites',
  handler: async (request, context) => {
    const user = getUser(request);
    if (!user) return noUser;
    try {
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return { status: 400, jsonBody: { error: 'Invalid request.' } };
        }
        const book = sanitizeBook(body);
        if (!book) return { status: 400, jsonBody: { error: 'Invalid book details.' } };
        await addFavourite(user.id, book);
        return { status: 201, jsonBody: { ok: true } };
      }
      const books = await listFavourites(user.id);
      return { status: 200, jsonBody: { books }, headers: { 'Cache-Control': 'no-store' } };
    } catch (err) {
      context.error('favourites failed: ' + err.message);
      return fail(err);
    }
  }
});

app.http('favouritesDelete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'favourites/{id}',
  handler: async (request, context) => {
    const user = getUser(request);
    if (!user) return noUser;
    const id = request.params.id;
    if (!WORK_ID.test(String(id))) return { status: 400, jsonBody: { error: 'Invalid book id.' } };
    try {
      await removeFavourite(user.id, id);
      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      context.error('favourite delete failed: ' + err.message);
      return fail(err);
    }
  }
});
