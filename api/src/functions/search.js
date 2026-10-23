'use strict';

const { app } = require('@azure/functions');
const { searchBooks } = require('../lib/openlibrary');
const { fail } = require('../lib/http');

app.http('search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'search',
  handler: async (request, context) => {
    try {
      const q = request.query;
      const data = await searchBooks({
        q: q.get('q'),
        genre: q.get('genre'),
        sort: q.get('sort'),
        page: q.get('page')
      });
      return { status: 200, jsonBody: data, headers: { 'Cache-Control': 'public, max-age=300' } };
    } catch (err) {
      context.error('search failed: ' + err.message);
      return fail(err);
    }
  }
});
