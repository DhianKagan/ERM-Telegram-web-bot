/* preload для диагностики: выведет why-is-node-running при beforeExit */
try {
  const why = require('why-is-node-running');
  process.on('beforeExit', () => {
    console.error('=== WHY IS NODE RUNNING DUMP ===');
    why();
    console.error('=== END DUMP ===');
  });
} catch (e) {
  console.error('why-is-node-running not available', e);
}
