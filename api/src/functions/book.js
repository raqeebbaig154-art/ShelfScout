'use strict';

const { app } = require('@azure/functions');
const { getBook } = require('../lib/openlibrary');
const { fail } = require('../lib/http');

app.http('book', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'book/{id}',
  handler: async (request, context) => {
    try {
      const data = await getBook(request.params.id);
      return { status: 200, jsonBody: data, headers: { 'Cache-Control': 'public, max-age=300' } };
    } catch (err) {
      context.error('book failed: ' + err.message);
      return fail(err);
    }
  }
});
