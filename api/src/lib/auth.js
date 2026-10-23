'use strict';

// Azure Static Web Apps adds the x-ms-client-principal header after a user signs in.
function getUser(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const p = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (!p || !p.userId) return null;
    const roles = Array.isArray(p.userRoles) ? p.userRoles : [];
    if (!roles.includes('authenticated')) return null;
    return { id: String(p.userId), name: p.userDetails || '' };
  } catch (e) {
    return null;
  }
}

module.exports = { getUser };
