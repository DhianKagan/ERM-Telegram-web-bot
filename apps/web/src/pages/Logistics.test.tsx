/** @jest-environment jsdom */
// Назначение: тесты карточек маршрутных планов без карты и геометрии
// Основные модули: React, @testing-library/react

import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RoutePlan } from 'shared';

import Logistics from './Logistics';

const listRoutePlansMock = jest.fn();
const addToastMock = jest.fn();

jest.mock('../services/routePlans', () => ({
  listRoutePlans: (...args: unknown[]) => listRoutePlansMock(...args),
}));

jest.mock('../context/useToast', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

jest.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'user' } }),
}));

jest.mock(
  '../components/Breadcrumbs',
  () => (props: { items: Array<{ label: string }> }) => (
    <nav aria-label="breadcrumbs">
      {props.items.map((item) => item.label).join(' / ')}
    </nav>
  ),
);

jest.mock('../components/SkeletonCard', () => () => (
  <div data-testid="skeleton">Загрузка…</div>
));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...rest}>
      {children}
    </button>
  ),
}));

const basePlan: RoutePlan = {
  id: 'plan-1',
  title: 'Маршрут 1',
  status: 'draft',
  notes: 'Доставка оборудования',
  metrics: {
    totalDistanceKm: null,
    totalRoutes: 1,
    totalTasks: 2,
    totalStops: 2,
    totalEtaMinutes: null,
    totalLoad: null,
  },
  routes: [
    {
      id: 'route-1',
      order: 1,
      vehicleId: 'v-1',
      vehicleName: 'Фургон',
      driverId: 1,
      driverName: 'Иван',
      tasks: [
        { taskId: 't-1', order: 1, title: 'Забрать посылку' },
        { taskId: 't-2', order: 2, title: 'Доставить клиенту' },
      ],
      stops: [],
    },
  ],
  tasks: ['t-1', 't-2'],
  createdAt: '2024-01-10T10:00:00.000Z',
  updatedAt: '2024-01-10T10:00:00.000Z',
};

const renderPage = async () => {
  render(
    <MemoryRouter>
      <Logistics />
    </MemoryRouter>,
  );
  await waitFor(() => expect(listRoutePlansMock).toHaveBeenCalled());
};

describe('Logistics page (карточки)', () => {
  beforeEach(() => {
    listRoutePlansMock.mockReset();
    addToastMock.mockReset();
  });

  it('отображает карточки с основными данными маршрутного плана', async () => {
    listRoutePlansMock.mockResolvedValue({ items: [basePlan], total: 1 });

    await renderPage();

    expect(await screen.findByText('Маршрутные планы')).toBeInTheDocument();
    expect(screen.getByText('Маршрут 1')).toBeInTheDocument();
    expect(screen.getByText('Новый')).toBeInTheDocument();
    expect(screen.getByText('Иван')).toBeInTheDocument();
    expect(screen.getByText('Фургон')).toBeInTheDocument();
    expect(screen.getByText('Забрать посылку')).toBeInTheDocument();
    expect(screen.getByText('Доставить клиенту')).toBeInTheDocument();
  });

  it('фильтрует карточки по статусу', async () => {
    const approvedPlan: RoutePlan = {
      ...basePlan,
      id: 'plan-2',
      title: 'Маршрут 2',
      status: 'approved',
    };
    listRoutePlansMock.mockResolvedValue({
      items: [basePlan, approvedPlan],
      total: 2,
    });

    await renderPage();

    fireEvent.change(screen.getByLabelText('Статус'), {
      target: { value: 'approved' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Маршрут 1')).not.toBeInTheDocument();
      expect(screen.getByText('Маршрут 2')).toBeInTheDocument();
      expect(screen.getByText('В работе')).toBeInTheDocument();
    });
  });

  it('показывает сообщение об ошибке при недоступности сервиса', async () => {
    listRoutePlansMock.mockRejectedValueOnce(new Error('network error'));

    await renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('network error');
    expect(addToastMock).toHaveBeenCalled();
  });
});
