/** @jest-environment jsdom */
// Назначение файла: проверяет отсутствие перезагрузки при 401 в AttachmentMenu.
// Основные модули: React, @testing-library/react.
import '@testing-library/jest-dom';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import AttachmentMenu from '../apps/web/src/pages/AttachmentMenu';
import { ToastContext } from '../apps/web/src/context/ToastContext';

test('не перезагружает страницу при 401', async () => {
  localStorage.setItem('csrfToken', 't');
  const addToast = jest.fn();
  const removeToast = jest.fn();
  const originalHref = window.location.href;
  const originalFetch = global.fetch;
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(null, { status: 401 })) as any;
  render(
    <ToastContext.Provider value={{ toasts: [], addToast, removeToast }}>
      <AttachmentMenu />
    </ToastContext.Provider>,
  );
  await waitFor(() => expect(addToast).toHaveBeenCalled());
  expect(window.location.href).toBe(originalHref);
  global.fetch = originalFetch;
});
