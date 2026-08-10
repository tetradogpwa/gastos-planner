/* ============================================
   tests/run.js - Test runner minimalista
   Uso: node tests/run.js
   ============================================ */

const path = require('path');
const fs = require('fs');

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

global.suite = suite;
global.test = test;
global.assert = assert;
global.assertEqual = assertEqual;
global.assertDeepEqual = assertDeepEqual;
global.assertThrows = assertThrows;

// Cargar models y actions para tests
const root = path.resolve(__dirname, '..');
const sandbox = {};
function loadScript(name) {
  let code = fs.readFileSync(path.join(root, 'js', name), 'utf8');
  // Convertir IIFE que exporta a window.X → inyectar en sandbox en su lugar
  code = code.replace(/\bwindow\./g, 'sandbox.');
  // Cambiar nombres de parámetros y referencias
  code = code.replace(/\(function \(\s*global\s*\)\s*\{/, '(function (sandbox) {');
  code = code.replace(/\}\)\(\s*window\s*\)\s*;?\s*$/, '})(sandbox);');
  code = code.replace(/\bglobal\.(Models|Storage|Actions|Console)\b/g, 'sandbox.$1');

  const wrapped = `(function() {
    var sandbox = arguments[0];
    var window = arguments[0];
    var document = arguments[1];
    var localStorage = arguments[2];
    var crypto = arguments[3];
    var console = arguments[4];
    var JSON = arguments[5];
    var Date = arguments[6];
    var Math = arguments[7];
    var Set = arguments[8];
    var Map = arguments[9];
    var Object = arguments[10];
    var Array = arguments[11];
    var Number = arguments[12];
    var String = arguments[13];
    var Boolean = arguments[14];
    var parseFloat = arguments[15];
    var parseInt = arguments[16];
    var isNaN = arguments[17];
    var setTimeout = arguments[18];
    var clearTimeout = arguments[19];
${code}
  })`;
  const fn = eval(wrapped);
  fn(sandbox,
    {
      documentElement: { dataset: {} },
      body: { classList: { add() {}, remove() {}, contains() { return false; } } },
      readyState: 'complete',
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute() {}, removeAttribute() {}, addEventListener() {},
        appendChild() {}, style: {}, dataset: {}, innerHTML: '', textContent: '', value: ''
      }),
      createTextNode: () => ({})
    },
    {
      getItem: () => null,
      setItem() {},
      removeItem() {}
    },
    { randomUUID: () => 'id-' + Math.random() },
    console, JSON, Date, Math, Set, Map, Object, Array, Number, String, Boolean, parseFloat, parseInt, isNaN, setTimeout, clearTimeout);
}

loadScript('models.js');
loadScript('actions.js');

global.M = sandbox.Models;
global.A = sandbox.Actions;

// Cargar tests
require('./models.test.js');
require('./actions.test.js');
require('./creditCards.test.js');
// require('./balance.test.js'); // DESHABILITADO

// Ejecutar
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
