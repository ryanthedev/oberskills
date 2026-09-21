// Runs under both `bun test` and `node --test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { analyze, extractBlocks, formatText, splitSentences } from './prose-lint.mjs';

const { test } = await import(typeof Bun !== 'undefined' ? 'bun:test' : 'node:test');

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const DATA = JSON.parse(readFileSync(here('./prose-lint.data.json'), 'utf8'));
const rules = (result) => result.findings.map((f) => f.rule);
const words = (n) => `${['Word', ...Array.from({ length: n - 1 }, () => 'word')].join(' ')}.`;

// --- sentence splitting -----------------------------------------------------

test('splits on terminal punctuation followed by a capital', () => {
  assert.deepEqual(splitSentences('It works. Does it? Yes! Good.'), ['It works.', 'Does it?', 'Yes!', 'Good.']);
});

test('does not split on abbreviations, initials, decimals, or dotted acronyms', () => {
  assert.equal(splitSentences('Use a cache, e.g. Redis, for this.').length, 1);
  assert.equal(splitSentences('We asked Dr. Okafor and Prof. Lindqvist about it.').length, 1);
  assert.equal(splitSentences('The book is by J. K. Rowling and nobody else.').length, 1);
  assert.equal(splitSentences('Latency fell to 3.5 seconds. Nobody noticed.').length, 2);
  assert.equal(splitSentences('The U.S. Treasury said no. Markets shrugged.').length, 2);
});

test('keeps closing quotes with their sentence', () => {
  assert.deepEqual(splitSentences('She said "stop." Then she left.'), ['She said "stop."', 'Then she left.']);
});

// --- markdown skipping ------------------------------------------------------

test('skips frontmatter, fenced code, headings, tables, rules, and comments', () => {
  const md = [
    '---', 'title: delve into the tapestry', '---', '',
    '# A crucial heading', '',
    'Real prose lives here.', '',
    '```js', 'const pivotal = "delve";', '```', '',
    '| crucial | tapestry |', '|---|---|', '| delve | foster |', '',
    '---', '',
    '<!-- moreover, a comment -->', '',
    'More prose.',
  ].join('\n');
  assert.deepEqual(extractBlocks(md).map((b) => b.text), ['Real prose lives here.', 'More prose.']);
  assert.equal(analyze(md).findings.length, 0);
});

test('strips inline code, links, URLs, and emphasis before matching', () => {
  const md = 'Call `delve()` and read [the **docs**](https://example.com/crucial-tapestry) or https://example.com/pivotal today.';
  const [block] = extractBlocks(md);
  assert.equal(block.text, 'Call and read the docs or today.');
  assert.equal(analyze(md).findings.length, 0);
});

test('list items feed phrase rules but stay out of rhythm statistics', () => {
  const md = 'One real sentence sits up here.\n\n- We delve\n- Short item\n- Another item';
  const result = analyze(md);
  assert.equal(result.metrics.sentence_length.count, 1);
  assert.deepEqual(rules(result), ['kill-word']);
  assert.equal(result.findings[0].line, 3);
});

// --- each rule on a minimal fixture ------------------------------------------

test('kill-word catches inflected forms and reports position', () => {
  const result = analyze('First sentence is clean.\n\nThey keep leveraging the cache and it navigates well.');
  assert.deepEqual(rules(result), ['kill-word', 'kill-word']);
  assert.deepEqual([result.findings[0].paragraph, result.findings[0].sentence, result.findings[0].line], [2, 1, 3]);
  assert.match(result.findings[0].excerpt, /leveraging/);
});

test('kill-phrase, hollow-opener, formulaic, sycophancy', () => {
  assert.ok(rules(analyze('The ruins stand as a powerful reminder of the war.')).includes('kill-phrase'));
  assert.ok(rules(analyze("It's important to note that the cache is cold.")).includes('hollow-opener'));
  assert.ok(rules(analyze('It is not only fast but also cheap.')).includes('formulaic'));
  assert.ok(rules(analyze("The tool isn't just a linter; it's a teacher.")).includes('formulaic'));
  assert.ok(rules(analyze('Great question! The answer is four.')).includes('sycophancy'));
});

test('stacked-hedges fires above one hedge per sentence, not at one', () => {
  assert.ok(rules(analyze('It seems like it might potentially be an issue.')).includes('stacked-hedges'));
  assert.ok(!rules(analyze('This might cause issues.')).includes('stacked-hedges'));
});

test('em-dash flags every dash after the first', () => {
  assert.ok(!rules(analyze('One dash — here – is allowed.')).includes('em-dash'));
  const result = analyze('One — two — three — done.');
  assert.equal(result.metrics.em_dashes, 3);
  assert.equal(rules(result).filter((r) => r === 'em-dash').length, 2);
});

test('transition-budget allows one formal opener per three paragraphs', () => {
  const within = 'However, it rained.\n\nWe stayed in.\n\nThe day passed.';
  assert.ok(!rules(analyze(within)).includes('transition-budget'));
  const over = 'However, it rained.\n\nMoreover, it was cold.\n\nFurthermore, the roof leaked.';
  assert.equal(rules(analyze(over)).filter((r) => r === 'transition-budget').length, 2);
});

test('no-contractions fires only when the piece has none at all', () => {
  assert.ok(rules(analyze('We do not ship on Fridays. It is a rule.')).includes('no-contractions'));
  assert.ok(!rules(analyze("We do not ship on Fridays. It's a rule.")).includes('no-contractions'));
  assert.equal(analyze("The team's plan is fine.").metrics.contractions.contracted, 0); // possessive, not a contraction
});

test('monotone-run and tight-cluster catch same-length sentences', () => {
  const flat = [words(10), words(11), words(12), words(10)].join(' ');
  const result = analyze(flat);
  assert.ok(rules(result).includes('monotone-run'));
  assert.ok(rules(result).includes('tight-cluster'));
  const varied = [words(3), words(24), words(9)].join(' ');
  assert.ok(!rules(analyze(varied)).includes('monotone-run'));
});

test('whole-piece Lurch targets wait for a piece past the Quick scope', () => {
  const short = [words(12), words(20), words(8)].join(' ');
  assert.ok(!rules(analyze(short)).includes('no-short-sentence'));
  // 15 sentences alternating 10 and 18 words: 210 words, range 8.
  const long = Array.from({ length: 15 }, (_, i) => words(i % 2 ? 18 : 10)).join(' ');
  const found = rules(analyze(long));
  for (const rule of ['no-short-sentence', 'no-long-sentence', 'narrow-range']) assert.ok(found.includes(rule), rule);
  // Same length, but with a fragment and a long sentence: all three clear.
  const spread = [words(3), words(34), ...Array.from({ length: 12 }, (_, i) => words(i % 2 ? 19 : 9))].join(' ');
  const clear = rules(analyze(spread));
  for (const rule of ['no-short-sentence', 'no-long-sentence', 'narrow-range']) assert.ok(!clear.includes(rule), rule);
});

// --- levels and cards ---------------------------------------------------------

const MESSY = 'Moreover, we delve into it — slowly — and it seems like it might possibly work. It is important to note that we do not know.';

test('proofread suppresses every finding but still reports metrics', () => {
  const result = analyze(MESSY, { level: 'proofread' });
  assert.equal(result.findings.length, 0);
  assert.ok(Object.keys(result.suppressed).length > 0);
  assert.equal(result.metrics.em_dashes, 2);
});

test('copy licenses word swaps only; line and developmental license the rest', () => {
  assert.deepEqual([...new Set(rules(analyze(MESSY, { level: 'copy' })))].sort(), ['em-dash', 'kill-word']);
  const line = new Set(rules(analyze(MESSY, { level: 'line' })));
  for (const rule of ['kill-word', 'em-dash', 'stacked-hedges', 'hollow-opener', 'no-contractions']) assert.ok(line.has(rule), rule);
  assert.deepEqual(analyze(MESSY).findings, analyze(MESSY, { level: 'developmental' }).findings);
});

test('--card plain relaxes the long end only; --card formal relaxes contractions', () => {
  const long = Array.from({ length: 15 }, (_, i) => words(i % 2 ? 18 : 10)).join(' ');
  const plain = rules(analyze(long, { card: 'plain' }));
  assert.ok(!plain.includes('no-long-sentence'));
  assert.ok(!plain.includes('narrow-range'));
  assert.ok(plain.includes('no-short-sentence'));
  assert.ok(!rules(analyze('We do not ship on Fridays.', { card: 'formal' })).includes('no-contractions'));
});

test('unknown level or card throws', () => {
  assert.throws(() => analyze('x', { level: 'heavy' }));
  assert.throws(() => analyze('x', { card: 'economist' }));
});

// --- CLI ------------------------------------------------------------------------

test('CLI reads stdin, emits JSON, exits 0 with findings; exits non-zero on IO error', () => {
  const runtime = process.execPath;
  const script = here('./prose-lint.mjs');
  const ok = spawnSync(runtime, [script, '-'], { input: 'We delve.', encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).findings[0].rule, 'kill-word');
  const text = spawnSync(runtime, [script, '--text'], { input: 'We delve.', encoding: 'utf8' });
  assert.match(text.stdout, /\[kill-word\] p1 s1 \(line 1\)/);
  const missing = spawnSync(runtime, [script, here('./no-such-file.md')], { encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /cannot read/);
  assert.match(formatText(analyze('Fine.')), /No findings/);
});

// --- one canonical home: the data file must agree with the skill's prose ----------

test('every threshold quotes a sentence that still exists in the skill', () => {
  for (const [name, t] of Object.entries(DATA.thresholds)) {
    const text = readFileSync(here(`../${t.file}`), 'utf8');
    assert.ok(text.includes(t.quote), `${name}: "${t.quote}" not found in ${t.file}`);
  }
});

test('phrases explained in surface-rules.md are the ones the lint matches', () => {
  const surface = readFileSync(here('../references/surface-rules.md'), 'utf8').replace(/[‘’]/g, "'").toLowerCase();
  const explained = [...DATA.kill_phrases, ...DATA.sycophancy, ...DATA.formal_transitions,
    ...DATA.hollow_openers.filter((o) => !o.startsWith('it is '))];
  for (const phrase of explained) assert.ok(surface.includes(phrase), `"${phrase}" is not in surface-rules.md`);
});
