// The text rule the site enforces on every file (scripts/validate.mjs) that the editor can carry:
// no em dash (U+2014), applied as a pattern to every free-text field. The private-term rule stays
// with validate and CI on purpose: validate forbids those terms anywhere else in the repository, so
// the Studio's bundle cannot carry the list. The body editor has no pattern hook, so on the body
// both rules stay with validate and CI.
export const EM_DASH = String.fromCharCode(0x2014);

// Matches any text without an em dash.
export function textRule(): RegExp {
  return new RegExp('^(?![\\s\\S]*' + EM_DASH + ')[\\s\\S]*$');
}

export const TEXT_RULE_MESSAGE = 'no em dash (the site refuses one anywhere)';
