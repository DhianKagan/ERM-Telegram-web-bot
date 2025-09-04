/**
 * Назначение файла: конфигурация Lighthouse CI.
 * Модули: collect, assert, upload.
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: 'apps/api/public',
    },
    assert: {
      preset: 'lighthouse:recommended',
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
