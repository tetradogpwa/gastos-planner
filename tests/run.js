/* ============================================
   tests/run.js - Test runner minimalista
   Carga los modelos y las acciones en un sandbox, luego corre los tests
   en un vm.Context con M, A, S disponibles como globales.
   ============================================ */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const tests = [];
let currentSuite = '';

function suite(name, fn) {
  const prev = currentSuite;
  currentSuite = name;
  fn();
  currentSuite = prev;
}

function test(name, fn) {
  tests.push({ suite: currentSuite, name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + (msg || ''));
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || 'assertEqual failed'}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

function assertDeepEqual(actual, expected, msg) {
  assertEqual(actual, expected, msg);
}

function assertThrows(fn, matcher, msg) {
  let thrown = null;
  try { fn(); } catch (e) { thrown = e; }
  if (!thrown) throw new Error('Expected function to throw');
  if (matcher && !matcher.test(thrown.message)) {
    throw new Error(`Expected error matching ${matcher}, got: ${thrown.message}`);
  }
}

function assertNoThrow(fn, msg) {
  try { fn(); }
  catch (e) { throw new Error(`Expected no throw, got: ${e.message}\n  ${msg || ''}`); }
}

global.suite = suite;
global.test = test;
global.assert = assert;
global.assertEqual = assertEqual;
global.assertDeepEqual = assertDeepEqual;
global.assertThrows = assertThrows;
global.assertNoThrow = assertNoThrow;

// Cargar models y actions en un sandbox
const root = path.resolve(__dirname, '..');
const sandbox = {};

function loadScript(name) {
  let code = fs.readFileSync(path.join(root, 'js', name), 'utf8');
  code = code.replace(/\bwindow\./g, 'sandbox.');
  code = code.replace(/\(function \(\s*global\s*\)\s*\{/, '(function (sandbox) {');
  code = code.replace(/\}\)\(\s*window\s*\s*\)\s*;?\s*$/, '})(sandbox);');
  code = code.replace(/\bglobal\.(Models|Storage|Actions|Console)\b/g, 'sandbox.$1');
  code = code.replace(/\bModels\.(normalize|save|load|migrate|export|import|setBalance)/g, 'sandbox.Models.$1');
  const wrapped = `(function() {
    var sandbox = arguments[0]; var window = arguments[0]; var document = arguments[1]; var localStorage = arguments[2]; var crypto = arguments[3]; var console = arguments[4]; var JSON = arguments[5]; var Date = arguments[6]; var Math = arguments[7]; var Set = arguments[8]; var Map = arguments[9]; var Object = arguments[10]; var Array = arguments[11]; var Number = arguments[12]; var String = arguments[13]; var Boolean = arguments[14]; var parseFloat = arguments[15]; var parseInt = arguments[16]; var isNaN = arguments[17]; var setTimeout = arguments[18]; var clearTimeout = arguments[19];
${code}
  })`;
  const fn = eval(wrapped);
  fn(sandbox,
    { documentElement: {}, body: { classList: { add() {}, remove() {}, contains() { return false; } } }, readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, style: {}, dataset: {}, innerHTML: '', textContent: '', value: '' }), createTextNode: () => ({}) },
    { getItem: () => null, setItem() {}, removeItem() {} },
    { randomUUID: () => 'id-' + Math.random() },
    console, JSON, Date, Math, Set, Map, Object, Array, Number, String, Boolean, parseFloat, parseInt, isNaN, setTimeout, clearTimeout);
}

loadScript('models.js');
loadScript('actions.js');
loadScript('storage.js');

// Crear un vm.Context con M, A, S disponibles como globales
const context = vm.createContext({
  M: sandbox.Models,
  A: sandbox.Actions,
  S: sandbox.Storage,
  suite,
  test,
  assert,
  assertEqual,
  assertDeepEqual,
  assertThrows,
  assertNoThrow,
  console,
  require,
  process
});

// Cargar tests en el context
const testFiles = ['./models.test.js', './actions.test.js', './creditCards.test.js', './balance.test.js', './import.test.js'];

for (const file of testFiles) {
  try {
    const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  } catch (e) {
    console.error(`Error loading ${file}: ${e.message}`);
  }
}


// Ejecutar tests
let passed = 0;
let failed = 0;
let currentSuiteName = '';

for (const t of tests) {
  if (t.suite !== currentSuiteName) {
    if (currentSuiteName) console.log('');
    currentSuiteName = t.suite;
    console.log(`\x1b[1m${currentSuiteName}\x1b[0m`);
  }
  try {
    t.fn();
    console.log(`  \x1b[32m✓\x1b[0m ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${t.name}`);
    console.log(`    \x1b[31m${e.message}\x1b[0m`);
    if (process.env.DEBUG) console.log(e.stack);
    failed++;
  }
}

console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m`);
process.exit(failed > 0 ? 1 : 0);
