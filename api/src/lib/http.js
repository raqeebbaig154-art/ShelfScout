'use strict';

function fail(err) {
  const status = [400, 404, 502, 504].includes(err.status) ? err.status : 500;
  const messages = {
    400: 'Invalid request.',
    404: 'Not found.',
    502: 'The book service is not responding properly. Please try again.',
    504: 'The book service took too long to respond. Please try again.',
    500: 'Something went wrong on the server.'
  };
  return { status, jsonBody: { error: messages[status] } };
}

module.exports = { fail };
