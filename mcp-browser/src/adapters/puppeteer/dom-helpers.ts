/**
 * Injected-JS string constants for shadow-DOM piercing queries, dialog scoring,
 * and collect diff — ported from cdp-browser.js (svelte-foundations.skill).
 *
 * These are DATA (string literals), not code — they are passed to page.evaluate()
 * and run in the browser context, NEVER in the Node/server process.
 *
 * The common helpers (QUERY_SELECTOR_DEEP_JS, QUERY_SELECTOR_ALL_DEEP_JS,
 * buildEvaluateExpression) live in src/lib/dom-helpers.ts so the tool layer
 * can import them without crossing the hexagonal boundary. This adapter file
 * re-exports those plus adds the adapter-only helpers (FIND_DIALOG_JS, etc.)
 * that only the puppeteer adapter uses.
 */
export {
  QUERY_SELECTOR_ALL_DEEP_JS,
  QUERY_SELECTOR_DEEP_JS,
  buildEvaluateExpression,
} from "../../lib/dom-helpers.ts";

/** Shadow-DOM-piercing text extraction (recursive walker). */
export const TEXT_CONTENT_DEEP_JS =
  `function deepText(el) {
    if (!el) return "";
    if (!el.shadowRoot) return el.textContent.trim();
    var text = "";
    function walk(node) {
        if (node.nodeType === 3) { text += node.textContent; return; }
        if (node.nodeType !== 1) return;
        if (node.shadowRoot) { node.shadowRoot.childNodes.forEach(walk); }
        node.childNodes.forEach(walk);
    }
    walk(el);
    return text.trim();
}` as const;

/**
 * Shadow-DOM-scoped querySelector — searches within a container's own shadow roots,
 * not from the document root. Used by extract for per-container child field lookup.
 */
export const QUERY_SELECTOR_SCOPED_JS =
  `function querySelectorScoped(root, selector) {
    var found = root.querySelector(selector);
    if (found) return found;
    var all = root.querySelectorAll('*');
    for (var k = 0; k < all.length; k++) {
        if (all[k].shadowRoot) {
            found = querySelectorScoped(all[k].shadowRoot, selector);
            if (found) return found;
        }
    }
    if (root.shadowRoot) {
        found = querySelectorScoped(root.shadowRoot, selector);
        if (found) return found;
    }
    return null;
}` as const;

/**
 * Dialog/overlay scoring heuristic — ported faithfully from cdp-browser.js lines ~719-965.
 * Collects dialogs (open <dialog>, [role=dialog], custom elements, high-z overlays) across
 * all shadow roots, deduplicates, sorts by z-index descending, scores close-button candidates.
 *
 * Returns: { dismissed: true, method: "click", element: string, coords: {x,y} }
 *        | { dismissed: false, method: "escape", element: string, coords: null }
 *        | null when no dialog found.
 */
export const FIND_DIALOG_JS =
  `(function() {
    var dialogs = [];

    function collectDialogs(root) {
        var openDialogs = root.querySelectorAll('dialog[open]');
        for (var i = 0; i < openDialogs.length; i++) dialogs.push(openDialogs[i]);

        function isElementVisible(el) {
            var r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            var node = el;
            while (node && node !== document) {
                if (node.nodeType === 1) {
                    var s = window.getComputedStyle(node);
                    if (s.display === 'none' || s.visibility === 'hidden') return false;
                    var cls = (node.className || '').toString();
                    if (cls.indexOf('displayHidden') !== -1 || cls.indexOf('visually-hidden') !== -1) return false;
                }
                if (node.nodeType === 11 && node.host) { node = node.host; }
                else { node = node.parentNode; }
            }
            return true;
        }

        var roleDialogs = root.querySelectorAll('[role="dialog"]');
        for (var j = 0; j < roleDialogs.length; j++) {
            if (isElementVisible(roleDialogs[j])) dialogs.push(roleDialogs[j]);
        }

        var customDialogs = root.querySelectorAll('[is="dialog"], sl-dialog, md-dialog, ion-modal, vaadin-dialog-overlay');
        for (var k = 0; k < customDialogs.length; k++) {
            if (isElementVisible(customDialogs[k])) dialogs.push(customDialogs[k]);
        }

        var allEls = root.querySelectorAll('*');
        for (var m = 0; m < allEls.length; m++) {
            var style = window.getComputedStyle(allEls[m]);
            var z = parseInt(style.zIndex, 10);
            if (z > 999 && style.display !== 'none' && style.visibility !== 'hidden') {
                var rect = allEls[m].getBoundingClientRect();
                if (rect.width > 50 && rect.height > 50) {
                    dialogs.push(allEls[m]);
                }
            }
        }

        var shadowed = root.querySelectorAll('*');
        for (var sh = 0; sh < shadowed.length; sh++) {
            if (shadowed[sh].shadowRoot) collectDialogs(shadowed[sh].shadowRoot);
        }
    }

    collectDialogs(document);

    var unique = [];
    var seen = new Set();
    for (var u = 0; u < dialogs.length; u++) {
        if (!seen.has(dialogs[u])) { seen.add(dialogs[u]); unique.push(dialogs[u]); }
    }

    unique.sort(function(a, b) {
        var zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
        var zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
        return zB - zA;
    });

    if (unique.length === 0) return null;

    var topmost = unique[0];

    function findCloseButton(el) {
        var allCandidates = [];
        function collectCandidates(root) {
            var buttons = root.querySelectorAll('button');
            for (var b = 0; b < buttons.length; b++) allCandidates.push(buttons[b]);
            var closeByClass = root.querySelectorAll('.close-button, .btn-close, .close, [class*="close-btn"], [class*="dialog-close"]');
            for (var c = 0; c < closeByClass.length; c++) allCandidates.push(closeByClass[c]);
            var all = root.querySelectorAll('*');
            for (var a = 0; a < all.length; a++) {
                if (all[a].shadowRoot) collectCandidates(all[a].shadowRoot);
            }
        }
        collectCandidates(el);
        if (el.shadowRoot) collectCandidates(el.shadowRoot);

        var deduped = [];
        var deupSeen = new Set();
        for (var d = 0; d < allCandidates.length; d++) {
            if (!deupSeen.has(allCandidates[d])) { deupSeen.add(allCandidates[d]); deduped.push(allCandidates[d]); }
        }

        var best = null;
        var bestScore = 0;
        var dialogRect = el.getBoundingClientRect();
        for (var i = 0; i < deduped.length; i++) {
            var btn = deduped[i];
            var label = (btn.getAttribute('aria-label') || '').toLowerCase();
            var text = btn.textContent.trim().toLowerCase();
            var cls = (btn.className && typeof btn.className === 'string') ? btn.className.toLowerCase() : '';
            var bRect = btn.getBoundingClientRect();
            if (bRect.width === 0 || bRect.height === 0) continue;

            var score = 0;
            if (label.indexOf('close') !== -1 || label.indexOf('dismiss') !== -1) score += 3;
            if (text === 'close' || text === 'dismiss') score += 3;
            if (text === 'x' || text === '×') score += 2;
            if (cls.indexOf('close') !== -1) score += 2;
            if (dialogRect.width > 0 && dialogRect.height > 0) {
                if (bRect.x > dialogRect.x + dialogRect.width * 0.6 &&
                    bRect.y < dialogRect.y + dialogRect.height * 0.3) {
                    score += 1;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                best = {
                    method: 'click',
                    element: btn.tagName + (cls ? '.' + cls.split(' ')[0] : ''),
                    coords: { x: bRect.x + bRect.width / 2, y: bRect.y + bRect.height / 2 }
                };
            }
        }
        return best;
    }

    var closeBtn = findCloseButton(topmost);

    if (!closeBtn) {
        var ancestor = topmost.parentNode || (topmost.getRootNode && topmost.getRootNode().host);
        var searched = new Set();
        searched.add(topmost);
        while (!closeBtn && ancestor && ancestor !== document) {
            if (!searched.has(ancestor)) {
                searched.add(ancestor);
                closeBtn = findCloseButton(ancestor);
            }
            if (ancestor.nodeType === 11 && ancestor.host) { ancestor = ancestor.host; }
            else { ancestor = ancestor.parentNode; }
        }
    }

    if (!closeBtn) {
        for (var f = 0; f < unique.length; f++) {
            if (unique[f] === topmost) continue;
            closeBtn = findCloseButton(unique[f]);
            if (closeBtn) break;
        }
    }

    if (closeBtn) {
        return { dismissed: true, method: closeBtn.method, element: closeBtn.element, coords: closeBtn.coords };
    }

    return { dismissed: false, method: 'escape', element: topmost.tagName, coords: null };
})()` as const;
