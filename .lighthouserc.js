// Назначение файла: конфигурация Lighthouse CI для проверки веб-клиента
// Модули: collect, assert, upload

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm --filter apps/web preview',
      url: ['http://localhost:4173'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
