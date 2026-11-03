// Escapes user input before putting it in a RegExp, so "c++" or "(" can't
// break the query or be used for a regex denial-of-service.
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Copies only the listed keys that are present in `source`.
function pick(source, keys) {
  const out = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

// Public view of a user — never includes email, phone or password.
function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    role: user.role,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    createdAt: user.createdAt,
  };
}

module.exports = { escapeRegex, pick, publicUser };
