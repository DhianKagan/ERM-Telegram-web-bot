/** @jest-environment jsdom */
// Назначение файла: проверка режима только чтение формы коллекций.
// Основные модули: React, @testing-library/react, CollectionForm.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import CollectionForm from './CollectionForm';

jest.mock('../../components/ConfirmDialog', () => ({
  __esModule: true,
  default: ({
    open,
    onConfirm,
    onCancel,
    message,
    confirmText,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    message: string;
    confirmText: string;
  }) =>
    open ? (
      <div data-testid="confirm">
        <span>{message}</span>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    ) : null,
}));

describe('CollectionForm', () => {
  it('отображает предупреждение и блокирует действия в режиме readonly', () => {
    const handleChange = jest.fn();
    const handleSubmit = jest.fn();
    const handleDelete = jest.fn();
    const handleReset = jest.fn();

    render(
      <CollectionForm
        form={{ _id: '123', name: 'Департамент', value: 'val' }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onReset={handleReset}
        readonly
        readonlyNotice="Элемент доступен только для чтения"
      />,
    );

    expect(
      screen.getByText('Элемент доступен только для чтения'),
    ).toBeInTheDocument();

    const [nameInput, valueInput] = screen.getAllByRole('textbox');
    expect(nameInput).toBeDisabled();
    expect(valueInput).toBeDisabled();

    const saveButton = screen.getByRole('button', { name: 'Сохранить' });
    expect(saveButton).toBeDisabled();
    const deleteButton = screen.getByRole('button', { name: 'Удалить' });
    expect(deleteButton).toBeDisabled();

    const form = saveButton.closest('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(handleDelete).not.toHaveBeenCalled();
    expect(handleChange).not.toHaveBeenCalled();
  });
});
