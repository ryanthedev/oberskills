#!/usr/bin/env node
// prose-lint: deterministic checks for the write skill's Final Edit Pass.
// Zero dependencies; runs unchanged under `bun` and `node`. Advisory: exits 0
// whenever the analysis succeeds, non-zero only on usage or IO errors.
//
//   prose-lint.mjs [file|-] [--text] [--level proofread|copy|line|developmental] [--card plain|formal]
//
// Lists and thresholds live in prose-lint.data.json, never here.

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DATA = JSON.parse(readFileSync(fileURLToPath(new URL('./prose-lint.data.json', import.meta.url)), 'utf8'));
const T = Object.fromEntries(Object.entries(DATA.thresholds).map(([k, v]) => [k, v.value]));

const LEVELS = ['proofread', 'copy', 'line', 'developmental'];
const CARDS = ['plain', 'formal'];

// Which rules each edit level licenses (references/edit-levels.md). Metrics are
// always reported; only findings are suppressed.
const WORD_SWAPS = ['kill-word', 'em-dash'];
const SENTENCE_RULES = [
  ...WORD_SWAPS, 'kill-phrase', 'hollow-opener', 'formulaic', 'sycophancy', 'stacked-hedges',
  'transition-budget', 'no-contractions', 'monotone-run', 'tight-cluster', 'no-short-sentence',
  'no-long-sentence', 'narrow-range',
];
const LICENSED = {
  proofread: [],
  copy: WORD_SWAPS,
  line: SENTENCE_RULES,
  developmental: SENTENCE_RULES,
};
// A style card narrows a core rule (references/style-cards.md). Plain-language
// cards cut off the long end of Lurch; formal cards relax the contraction rule.
const CARD_RELAXES = {
  plain: ['no-long-sentence', 'narrow-range'],
  formal: ['no-contractions'],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeQuotes = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const excerpt = (s, n = 70) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const countWords = (s) => (s.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length;

/** Strip inline markdown so only prose remains. */
export function stripInline(s) {
  return s
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<https?:[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split markdown into prose blocks. Skips frontmatter, fenced code, headings,
 * tables, rules, and HTML comments. List items are kept for phrase rules but
 * marked so they stay out of the sentence-rhythm statistics.
 * @returns {{text: string, line: number, list: boolean}[]}
 */
export function extractBlocks(markdown) {
  const lines = normalizeQuotes(markdown.replace(/\r\n?/g, '\n')).split('\n');
  const blocks = [];
  let i = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  let current = null;
  const flush = () => {
    if (current && current.parts.length) {
      const text = stripInline(current.parts.join(' '));
      if (text) blocks.push({ text, line: current.line, list: current.list });
    }
    current = null;
  };
  let fence = null;
  let inComment = false;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (fence) {
      if (line.startsWith(fence)) fence = null;
      continue;
    }
    const fenceOpen = line.match(/^(```+|~~~+)/);
    if (fenceOpen) { flush(); fence = fenceOpen[1]; continue; }
    if (inComment) { if (line.includes('-->')) inComment = false; continue; }
    if (line.startsWith('<!--')) { flush(); if (!line.includes('-->')) inComment = true; continue; }
    if (line === '') { flush(); continue; }
    if (/^#{1,6}\s/.test(line) || /^\|/.test(line) || /^([-*_]\s*){3,}$/.test(line) || /^(=+|-+)$/.test(line)) {
      flush();
      continue;
    }
    if (/^ {4,}\S/.test(raw) && !current) continue; // indented code
    const item = line.match(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (item) {
      flush();
      current = { parts: [item[1]], line: i + 1, list: true };
      continue;
    }
    const body = line.replace(/^(?:>\s?)+/, '');
    if (!current) current = { parts: [], line: i + 1, list: false };
    current.parts.push(body);
  }
  flush();
  return blocks;
}

/** Split one block of stripped prose into sentences. */
export function splitSentences(text) {
  const abbreviations = new Set(DATA.abbreviations);
  const sentences = [];
  let start = 0;
  const boundary = /([.!?]+)(["')\]]*)\s+(?=["'(\[]?[A-Z0-9])/g;
  let m;
  while ((m = boundary.exec(text)) !== null) {
    if (m[1] === '.') {
      const before = text.slice(start, m.index);
      const lastWord = (before.match(/([A-Za-z][A-Za-z.]*)$/) || [])[1] || '';
      const lower = lastWord.toLowerCase();
      if (abbreviations.has(lower)) continue;
      if (/^[A-Z]$/.test(lastWord)) continue; // an initial: "J. K. Rowling"
      if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(lastWord)) continue; // "U.S." style
    }
    const end = m.index + m[1].length + m[2].length;
    sentences.push(text.slice(start, end).trim());
    start = boundary.lastIndex;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences.filter((s) => countWords(s) > 0);
}

const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

function stats(values) {
  if (!values.length) return { count: 0, mean: 0, sd: 0, min: 0, max: 0, range: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { count: values.length, mean: round(mean), sd: round(Math.sqrt(variance)), min, max, range: max - min };
}

/** Generated inflections, so the ban list needs one entry per word. */
function killWordRegex(word) {
  const stem = escapeRe(word);
  const forms = [stem, `${stem}s`, `${stem}es`, `${stem}d`, `${stem}ed`, `${stem}ing`, `${stem}ly`];
  if (word.endsWith('e')) {
    const cut = escapeRe(word.slice(0, -1));
    forms.push(`${cut}ing`, `${cut}ed`);
  }
  if (word.endsWith('y')) forms.push(`${escapeRe(word.slice(0, -1))}ies`);
  return new RegExp(`\\b(?:${forms.join('|')})\\b`, 'gi');
}

const phraseRegex = (phrase, flags = 'gi') => new RegExp(`(?<![A-Za-z])${escapeRe(phrase)}(?![A-Za-z])`, flags);

/**
 * Analyze markdown or plain prose.
 * @param {string} markdown
 * @param {{level?: string, card?: string|null}} [options]
 */
export function analyze(markdown, options = {}) {
  const level = options.level || 'developmental';
  const card = options.card || null;
  if (!LEVELS.includes(level)) throw new Error(`unknown --level "${level}" (expected ${LEVELS.join(', ')})`);
  if (card && !CARDS.includes(card)) throw new Error(`unknown --card "${card}" (expected ${CARDS.join(', ')})`);

  const blocks = extractBlocks(markdown);
  const all = [];
  const add = (rule, where, message, text) => all.push({
    rule,
    paragraph: where.paragraph ?? null,
    sentence: where.sentence ?? null,
    line: where.line ?? null,
    message,
    excerpt: text ? excerpt(text) : null,
  });

  // Sentences, in document order. Rhythm statistics use prose paragraphs only.
  const rhythm = [];
  const paragraphWords = [];
  let paragraphNo = 0;
  let emDashes = 0;
  let hedgeTotal = 0;
  let sentenceTotal = 0;
  let contracted = 0;
  const uncontracted = [];
  const transitions = [];

  const contractedRe = new RegExp(
    `\\b\\w+(?:${DATA.contracted_suffixes.map(escapeRe).join('|')})(?![A-Za-z])|(?<![A-Za-z])(?:${DATA.contracted_words.map(escapeRe).join('|')})(?![A-Za-z])`,
    'gi',
  );

  for (const block of blocks) {
    paragraphNo += 1;
    const sentences = splitSentences(block.text);
    if (!block.list) paragraphWords.push(countWords(block.text));
    sentences.forEach((sentence, idx) => {
      const where = { paragraph: paragraphNo, sentence: idx + 1, line: block.line };
      sentenceTotal += 1;
      if (!block.list) rhythm.push({ words: countWords(sentence), text: sentence, where });

      for (const word of DATA.kill_words) {
        for (const hit of sentence.matchAll(killWordRegex(word))) {
          add('kill-word', where, `"${hit[0]}" is on the ban list`, sentence);
        }
      }
      for (const phrase of DATA.kill_phrases) {
        if (phraseRegex(phrase).test(sentence)) add('kill-phrase', where, `"${phrase}" is a measured AI phrase`, sentence);
      }
      for (const opener of DATA.hollow_openers) {
        if (phraseRegex(opener).test(sentence)) add('hollow-opener', where, `"${opener}": delete it or say the thing`, sentence);
      }
      for (const pattern of DATA.formulaic_patterns) {
        if (new RegExp(pattern.regex, 'i').test(sentence)) add('formulaic', where, `formulaic construction (${pattern.name}): make the claim directly`, sentence);
      }
      for (const phrase of DATA.sycophancy) {
        if (phraseRegex(phrase).test(sentence)) add('sycophancy', where, `"${phrase}": delete`, sentence);
      }

      const hedges = DATA.hedges.flatMap((h) => [...sentence.matchAll(phraseRegex(h))].map((x) => x[0].toLowerCase()));
      hedgeTotal += hedges.length;
      if (hedges.length > T.max_hedges_per_sentence) {
        add('stacked-hedges', where, `${hedges.length} hedges in one sentence (${hedges.join(', ')}); the limit is ${T.max_hedges_per_sentence}`, sentence);
      }

      for (const opener of DATA.formal_transitions) {
        if (new RegExp(`^["'(]?${escapeRe(opener)}\\b`, 'i').test(sentence)) transitions.push({ opener, where, sentence });
      }

      contracted += (sentence.match(contractedRe) || []).length;
      for (const form of DATA.contractible) {
        for (const hit of sentence.matchAll(phraseRegex(form))) uncontracted.push({ form: hit[0], where, sentence });
      }

      const dashes = (sentence.match(/—|(?<=\s)--(?=\s)/g) || []).length;
      for (let d = 0; d < dashes; d++) {
        emDashes += 1;
        if (emDashes > T.max_em_dashes) {
          add('em-dash', where, `em-dash ${emDashes} of the piece; the limit is ${T.max_em_dashes}. Use a comma, colon, period, or parentheses`, sentence);
        }
      }
    });
  }

  // Lurch: runs of same-length sentences.
  const lengths = rhythm.map((s) => s.words);
  for (let i = 0; i + T.monotone_run_length <= lengths.length;) {
    let j = i + 1;
    let lo = lengths[i];
    let hi = lengths[i];
    while (j < lengths.length) {
      const nextLo = Math.min(lo, lengths[j]);
      const nextHi = Math.max(hi, lengths[j]);
      if (nextHi - nextLo > T.monotone_run_within_words) break;
      lo = nextLo; hi = nextHi; j += 1;
    }
    if (j - i >= T.monotone_run_length) {
      add('monotone-run', rhythm[i].where,
        `${j - i} consecutive sentences within ${T.monotone_run_within_words} words of each other (${lengths.slice(i, j).join(', ')} words): break one`,
        rhythm[i].text);
      i = j;
    } else {
      i += 1;
    }
  }

  const sentenceStats = stats(lengths);
  const totalWords = lengths.reduce((a, b) => a + b, 0);
  const first = rhythm[0]?.where ?? {};
  if (lengths.length >= T.monotone_run_length && sentenceStats.range <= T.cluster_range_words) {
    add('tight-cluster', first, `every sentence is ${sentenceStats.min}-${sentenceStats.max} words, a ${sentenceStats.range}-word range: rewrite for spread`, null);
  }
  // Whole-piece Lurch targets only make sense past the skill's "Quick" scope.
  if (totalWords >= T.whole_piece_min_words) {
    if (sentenceStats.min >= T.short_sentence_under_words) {
      add('no-short-sentence', first, `shortest sentence is ${sentenceStats.min} words; the piece wants one under ${T.short_sentence_under_words}`, null);
    }
    if (sentenceStats.max <= T.long_sentence_over_words) {
      add('no-long-sentence', first, `longest sentence is ${sentenceStats.max} words; the piece wants one over ${T.long_sentence_over_words}`, null);
    }
    if (sentenceStats.range < T.min_range_words) {
      add('narrow-range', first, `${sentenceStats.range} words between shortest and longest sentence; under ${T.min_range_words} reads as monotone`, null);
    }
  }

  const transitionBudget = Math.max(1, Math.ceil(paragraphNo / T.paragraphs_per_formal_transition));
  transitions.slice(transitionBudget).forEach((t) => {
    add('transition-budget', t.where, `formal transition "${t.opener}" is over budget (${transitions.length} used, ${transitionBudget} allowed across ${paragraphNo} paragraph${paragraphNo === 1 ? '' : 's'}): use but/and/so/still, or cut it`, t.sentence);
  });

  // Surface rule 8 requires contractions; none at all, with forms available, is the tell.
  if (contracted === 0) {
    uncontracted.forEach((u) => add('no-contractions', u.where, `"${u.form}" could contract, and the piece has no contractions at all`, u.sentence));
  }

  const licensed = new Set(LICENSED[level]);
  for (const rule of (card ? CARD_RELAXES[card] : [])) licensed.delete(rule);
  const findings = all.filter((f) => licensed.has(f.rule));
  const suppressed = {};
  for (const f of all) if (!licensed.has(f.rule)) suppressed[f.rule] = (suppressed[f.rule] || 0) + 1;

  return {
    level,
    card,
    metrics: {
      words: totalWords,
      paragraphs: paragraphWords.length,
      sentence_length: sentenceStats,
      paragraph_words: stats(paragraphWords),
      em_dashes: emDashes,
      hedges_per_sentence: sentenceTotal ? round(hedgeTotal / sentenceTotal) : 0,
      contractions: {
        contracted,
        uncontracted: uncontracted.length,
        rate: contracted + uncontracted.length ? round(contracted / (contracted + uncontracted.length)) : null,
      },
      formal_transition_openers: transitions.length,
    },
    findings,
    suppressed,
  };
}

/** Short human-readable report. */
export function formatText(result) {
  const m = result.metrics;
  const s = m.sentence_length;
  const out = [
    `prose-lint  level=${result.level}${result.card ? ` card=${result.card}` : ''}`,
    `${m.words} words, ${s.count} sentences, ${m.paragraphs} paragraphs`,
    `sentence length: mean ${s.mean}, SD ${s.sd}, min ${s.min}, max ${s.max}, range ${s.range}`,
    `paragraph words: mean ${m.paragraph_words.mean}, SD ${m.paragraph_words.sd}, min ${m.paragraph_words.min}, max ${m.paragraph_words.max}`,
    `em-dashes ${m.em_dashes} | hedges/sentence ${m.hedges_per_sentence} | contractions ${m.contractions.contracted} used, ${m.contractions.uncontracted} available | formal transition openers ${m.formal_transition_openers}`,
    '',
  ];
  if (!result.findings.length) out.push('No findings at this level.');
  for (const f of result.findings) {
    const at = f.paragraph ? `p${f.paragraph}${f.sentence ? ` s${f.sentence}` : ''} (line ${f.line})` : 'piece';
    out.push(`[${f.rule}] ${at}: ${f.message}`);
    if (f.excerpt) out.push(`    "${f.excerpt}"`);
  }
  const hidden = Object.entries(result.suppressed);
  if (hidden.length) out.push('', `Not licensed at this level or card: ${hidden.map(([r, n]) => `${r} x${n}`).join(', ')}`);
  return out.join('\n');
}

function main(argv) {
  const usage = 'usage: prose-lint.mjs [file|-] [--text] [--level proofread|copy|line|developmental] [--card plain|formal]';
  let file = null;
  let text = false;
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--text') text = true;
    else if (arg === '--level' || arg === '--card') {
      const value = argv[++i];
      if (!value) { process.stderr.write(`${arg} needs a value\n${usage}\n`); return 2; }
      options[arg.slice(2)] = value;
    } else if (arg === '-h' || arg === '--help') { process.stdout.write(`${usage}\n`); return 0; }
    else if (arg.startsWith('--')) { process.stderr.write(`unknown option ${arg}\n${usage}\n`); return 2; }
    else if (file === null) file = arg;
    else { process.stderr.write(`unexpected argument ${arg}\n${usage}\n`); return 2; }
  }
  let input;
  try {
    input = readFileSync(file === null || file === '-' ? 0 : file, 'utf8');
  } catch (err) {
    process.stderr.write(`cannot read ${file ?? 'stdin'}: ${err.message}\n`);
    return 1;
  }
  let result;
  try {
    result = analyze(input, options);
  } catch (err) {
    process.stderr.write(`${err.message}\n${usage}\n`);
    return 2;
  }
  process.stdout.write(`${text ? formatText(result) : JSON.stringify(result)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
