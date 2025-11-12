/** @jest-environment jsdom */
// Назначение: тесты страницы аналитики маршрутных планов с проверкой фильтров и загрузки данных.
// Основные модули: React, @testing-library/react

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsDashboard from './AnalyticsDashboard';
import { fetchRoutePlanAnalytics } from '../services/analytics';

jest.mock('react-apexcharts', () => () => <div data-testid="chart" />);

jest.mock('react-i18next', () => {
  const templates: Record<string, string> = {
    'analytics.title': 'Аналитика маршрутных планов',
    'analytics.description': 'Актуальные показатели логистики',
    'analytics.filters.from': 'Дата начала',
    'analytics.filters.to': 'Дата окончания',
    'analytics.filters.status': 'Статус',
    'analytics.status.all': 'Все статусы',
    'analytics.status.draft': 'Черновики',
    'analytics.status.approved': 'Утверждённые',
    'analytics.status.completed': 'Завершённые',
    'analytics.loading': 'Загрузка...',
    'analytics.apply': 'Применить',
    'analytics.reset': 'Сбросить',
    'analytics.loadError': 'Не удалось загрузить аналитику маршрутных планов',
    'analytics.noData': 'нет данных',
    'analytics.cards.mileage': 'Пробег',
    'analytics.cards.load': 'Средняя загрузка',
    'analytics.cards.loadHint':
      'Средняя максимальная загрузка маршрутов за период',
    'analytics.cards.slaHint': 'Доля доставок без опозданий',
    'analytics.cards.period': 'Период: {{from}} — {{to}}',
    'analytics.charts.mileage': 'Пробег по дням',
    'analytics.charts.load': 'Загрузка по маршрутам',
    'analytics.charts.sla': 'SLA выполнений',
  };

  const applyTemplate = (template: string, params: Record<string, unknown>) =>
    template.replace(/{{(.*?)}}/g, (_, token: string) => {
      const key = token.trim();
      const value = params[key];
      return value === undefined || value === null ? '' : String(value);
    });

  const translate = (key: string, params: Record<string, unknown> = {}) => {
    const template = templates[key];
    if (!template) {
      return key;
    }
    return applyTemplate(template, params);
  };

  return {
    useTranslation: () => ({
      t: translate,
    }),
  };
});

jest.mock('../services/analytics', () => ({
  fetchRoutePlanAnalytics: jest.fn(),
}));

const sampleSummary = {
  period: { from: '2024-09-11', to: '2024-10-10' },
  mileage: {
    total: 123.4,
    byPeriod: [
      { date: '2024-10-09', value: 60.2 },
      { date: '2024-10-10', value: 63.2 },
    ],
  },
  load: {
    average: 5.5,
    byPeriod: [
      { date: '2024-10-09', value: 5.2 },
      { date: '2024-10-10', value: 5.8 },
    ],
  },
  sla: {
    average: 0.92,
    byPeriod: [
      { date: '2024-10-09', onTime: 9, total: 10, rate: 0.9 },
      { date: '2024-10-10', onTime: 10, total: 10, rate: 1 },
    ],
  },
};

describe('AnalyticsDashboard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('загружает данные и повторно обращается к API при смене статуса', async () => {
    const mockedFetch = fetchRoutePlanAnalytics as unknown as jest.Mock;
    mockedFetch.mockResolvedValue(sampleSummary);

    render(<AnalyticsDashboard />);

    await screen.findByRole('heading', { level: 2, name: 'Пробег' });
    expect(mockedFetch).toHaveBeenCalled();
    expect(screen.getByText(/123,4 км/)).toBeInTheDocument();
    expect(screen.getByText(/92/)).toBeInTheDocument();

    const initialCalls = mockedFetch.mock.calls.length;
    const statusSelect = screen.getByLabelText('Статус');
    fireEvent.change(statusSelect, { target: { value: 'draft' } });
    expect(statusSelect).toHaveValue('draft');

    const applyButton = await screen.findByRole('button', {
      name: 'Применить',
    });
    fireEvent.click(applyButton);

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledTimes(initialCalls + 1),
    );
    expect(mockedFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });
});
