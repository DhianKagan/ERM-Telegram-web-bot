/** @jest-environment jsdom */
// Назначение: проверяет, что FormField не падает при undefined ребёнке
// Модули: React, @testing-library/react, FormField
import { render } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  it('не падает при undefined ребёнке', () => {
    const { container } = render(
      <FormField label="тест">{undefined}</FormField>,
    );
    expect(
      container.querySelector('[data-testid="empty-field"]'),
    ).not.toBeNull();
  });
});
