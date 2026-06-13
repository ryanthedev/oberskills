/**
 * Shared JS helper strings and the evaluate expression builder — pure string
 * constants with no puppeteer dependency. Lives in src/lib/ so both the tool
 * layer (evaluate.ts) and the adapter (connection.ts) can import without
 * violating the hexagonal boundary (tools must not import from adapters/).
 *
 * The injected JS constants are ADAPTER-INTERNAL in terms of execution (they
 * run in the browser via page.evaluate), but the string values are just data —
 * they belong in lib/ so the tool layer can reference them safely.
 */

/** Recursive shadow-DOM query (first match). */
export const QUERY_SELECTOR_DEEP_JS =
  `(function(selector) {
    function search(root) {
        var found = root.querySelector(selector);
        if (found) return found;
        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if (all[i].shadowRoot) {
                var inner = search(all[i].shadowRoot);
                if (inner) return inner;
            }
        }
        return null;
    }
    return search(document);
})` as const;

/** Recursive shadow-DOM query (all matches). */
export const QUERY_SELECTOR_ALL_DEEP_JS =
  `(function(selector) {
    var results = [];
    function search(root) {
        var matches = root.querySelectorAll(selector);
        for (var i = 0; i < matches.length; i++) results.push(matches[i]);
        var all = root.querySelectorAll('*');
        for (var j = 0; j < all.length; j++) {
            if (all[j].shadowRoot) search(all[j].shadowRoot);
        }
    }
    search(document);
    return results;
})` as const;

/**
 * Wrap a user-supplied JS expression with querySelectorDeep/querySelectorAllDeep
 * helpers in scope. Passes through unchanged if already an IIFE.
 * Used by the evaluate tool; the adapter uses the expression as-is.
 */
export function buildEvaluateExpression(userExpression: string): string {
  const trimmed = userExpression.trimStart();
  if (trimmed.startsWith("(function")) {
    return userExpression;
  }
  const helpers =
    `var querySelectorDeep = ${QUERY_SELECTOR_DEEP_JS}; ` +
    `var querySelectorAllDeep = ${QUERY_SELECTOR_ALL_DEEP_JS}; `;

  const isSingleExpr =
    !userExpression.includes(";") && !userExpression.includes("\n");

  if (isSingleExpr) {
    return `(function(){ ${helpers}return ${userExpression}; })()`;
  }
  return `(function(){ ${helpers}${userExpression} })()`;
}
