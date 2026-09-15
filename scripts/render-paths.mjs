// The path matching Render applies to static-site header rules, per its documentation (read
// 2026-09-14): "/*" matches every request path; "/blog/*" matches "/blog/", "/blog/latest-post/",
// and everything under "/blog/"; "/*.css" matches "/tokens.css" but not "/assets/theme.css";
// "/**/*.css" matches "/assets/theme.css" but not "/tokens.css". So a single "*" never crosses a
// slash, "**" crosses any number, and a trailing "/*" is a prefix rule for the whole subtree.
// The local header server and the header scan share this so a rule that works here works on
// Render, which the Phase 19 staging scan showed was not true of a matcher that let "*" cross.
export function matches(pattern, path) {
  let regex = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      regex += '.*';
      i++;
    } else if (c === '*' && i === pattern.length - 1 && pattern[i - 1] === '/') {
      regex += '.*';
    } else if (c === '*') {
      regex += '[^/]*';
    } else {
      regex += c.replace(/[.+^${}()|[\]\\/]/g, '\\$&');
    }
  }
  return new RegExp('^' + regex + '$').test(path);
}

/** The headers a rule list declares for one path; when several rules name the same header, the later one wins. */
export function headersFor(rules, path) {
  const out = {};
  for (const rule of rules) if (matches(rule.path, path)) out[rule.name] = String(rule.value);
  return out;
}
