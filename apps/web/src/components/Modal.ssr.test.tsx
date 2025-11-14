/** @jest-environment node */
// Назначение файла: проверяет, что Modal возвращает null при отсутствии document.
// Основные модули: React, Modal.
import React from 'react';
import Modal from './Modal';

test('возвращает null без document', () => {
  const result = Modal({ open: true, onClose: () => {}, children: <div /> });
  expect(result).toBeNull();
});
