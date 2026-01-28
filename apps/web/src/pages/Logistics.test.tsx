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
const createRoutePlanMock = jest.fn();
const updateRoutePlanMock = jest.fn();
const getRoutePlanMock = jest.fn();
const changeRoutePlanStatusMock = jest.fn();
const deleteRoutePlanMock = jest.fn();
const addToastMock = jest.fn();
let authUser: { role?: string; access?: number } = { role: 'user' };

jest.mock('../services/routePlans', () => ({
  listRoutePlans: (...args: unknown[]) => listRoutePlansMock(...args),
  createRoutePlan: (...args: unknown[]) => createRoutePlanMock(...args),
  updateRoutePlan: (...args: unknown[]) => updateRoutePlanMock(...args),
  getRoutePlan: (...args: unknown[]) => getRoutePlanMock(...args),
  changeRoutePlanStatus: (...args: unknown[]) =>
    changeRoutePlanStatusMock(...args),
  deleteRoutePlan: (...args: unknown[]) => deleteRoutePlanMock(...args),
}));

jest.mock('../context/useToast', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

jest.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: authUser }),
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
    createRoutePlanMock.mockReset();
    updateRoutePlanMock.mockReset();
    getRoutePlanMock.mockReset();
    changeRoutePlanStatusMock.mockReset();
    deleteRoutePlanMock.mockReset();
    addToastMock.mockReset();
    authUser = { role: 'user' };
  });

  it('отображает карточки с основными данными маршрутного плана', async () => {
    listRoutePlansMock.mockResolvedValue({ items: [basePlan], total: 1 });

    await renderPage();

    expect(await screen.findByText('Маршрутные листы')).toBeInTheDocument();
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

  it('открывает диалог создания маршрутного листа и отправляет запрос', async () => {
    authUser = { role: 'admin' };
    listRoutePlansMock.mockResolvedValue({ items: [], total: 0 });
    createRoutePlanMock.mockResolvedValue(basePlan);

    await renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Создать маршрутный лист' }),
    );

    expect(
      await screen.findByText('Создать маршрутный лист'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Новый лист' },
    });
    fireEvent.change(screen.getByLabelText('Описание'), {
      target: { value: 'Описание' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(createRoutePlanMock).toHaveBeenCalledWith({
        title: 'Новый лист',
        notes: 'Описание',
      });
    });
  });

  it('открывает диалог редактирования маршрутного листа', async () => {
    authUser = { role: 'admin' };
    listRoutePlansMock.mockResolvedValue({ items: [basePlan], total: 1 });
    getRoutePlanMock.mockResolvedValue(basePlan);

    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }));

    await waitFor(() => {
      expect(getRoutePlanMock).toHaveBeenCalledWith('plan-1');
    });

    expect(
      await screen.findByText('Редактировать маршрутный лист'),
    ).toBeInTheDocument();
  });
});
