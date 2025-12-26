// Назначение файла: журнал событий по объектам и автопарку
// Основные модули: React, collections service, DataTable, Modal
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActionBar from '../components/ActionBar';
import Breadcrumbs from '../components/Breadcrumbs';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { showToast } from '../utils/toast';
import { useAuth } from '../context/useAuth';
import type { User } from '../types/user';
import {
  fetchCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  fetchAllCollectionItems,
  fetchAllCollectionObjects,
  type CollectionItem,
  type CollectionObject,
} from '../services/collections';
import { listFleetVehicles } from '../services/fleets';
import { eventLogColumns, type EventLogRow } from '../columns/eventLogColumns';
import type { FleetVehicleDto } from 'shared';

const PAGE_LIMIT = 10;

type AssetType = 'fixed_asset' | 'fleet' | '';

type EventType = 'refuel' | 'maintenance' | 'repair' | 'transfer' | '';
type EventOperation = 'self_service' | 'service';

type EventLogMeta = {
  date?: string;
  datetime?: string;
  assetType?: AssetType;
  assetId?: string;
  assetName?: string;
  location?: string;
  locationObjectId?: string;
  locationLink?: string;
  transferLocation?: string;
  description?: string;
  performer?: string;
  eventType?: EventType;
  operation?: EventOperation;
};

type EventLogForm = {
  id?: string;
  number: string;
  date: string;
  dateTime: string;
  assetType: AssetType;
  assetId: string;
  performer: string;
  eventType: EventType;
  operation: EventOperation;
  locationLink: string;
  location: string;
  locationObjectId: string;
  transferLocation: string;
  description: string;
};

const emptyForm: EventLogForm = {
  number: '',
  date: '',
  dateTime: '',
  assetType: '',
  assetId: '',
  performer: '',
  eventType: '',
  operation: 'self_service',
  locationLink: '',
  location: '',
  locationObjectId: '',
  transferLocation: '',
  description: '',
};

const formatEventNumber = (value: number): string =>
  `SRV_${String(value).padStart(6, '0')}`;

const EVENT_TYPE_OPTIONS: { value: Exclude<EventType, ''>; label: string }[] = [
  { value: 'refuel', label: 'Заправка' },
  { value: 'maintenance', label: 'Обслуживание' },
  { value: 'repair', label: 'Ремонт' },
  { value: 'transfer', label: 'Перемещение' },
];

const EVENT_OPERATION_OPTIONS: { value: EventOperation; label: string }[] = [
  { value: 'self_service', label: 'Самообслуживание' },
  { value: 'service', label: 'Сервис' },
];

const toLocalDateTimeInput = (value?: string | Date): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const withOffset = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );
  return withOffset.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string): string | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

const formatDateTimeLabel = (value?: string): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const resolveEventTypeLabel = (value: EventType): string =>
  EVENT_TYPE_OPTIONS.find((option) => option.value === value)?.label || '—';

const resolveOperationLabel = (value: EventOperation): string =>
  EVENT_OPERATION_OPTIONS.find((option) => option.value === value)?.label ||
  '—';

const resolvePerformerLabel = (user: User | null): string => {
  if (!user) return '';
  const name = (user.name ?? '').trim();
  if (name) return name;
  const username = (user.username ?? user.telegram_username ?? '').trim();
  if (username) return username;
  if (user.telegram_id) return String(user.telegram_id);
  return '';
};

const resolveAssetLocation = (asset: CollectionItem | undefined): string => {
  if (!asset) return '';
  const meta = (asset.meta ?? {}) as Record<string, unknown>;
  const locationFromMeta =
    typeof meta.location === 'string'
      ? meta.location
      : typeof meta.location === 'object' && meta.location
        ? ''
        : undefined;
  const addressFromMeta =
    typeof meta.address === 'string' ? meta.address : undefined;
  const candidate =
    locationFromMeta ||
    addressFromMeta ||
    (asset.value ? asset.value.trim() : '');
  return candidate?.trim() ?? '';
};

export default function EventLog() {
  const [items, setItems] = React.useState<CollectionItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [searchDraft, setSearchDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<EventLogForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const [assets, setAssets] = React.useState<CollectionItem[]>([]);
  const [objects, setObjects] = React.useState<CollectionObject[]>([]);
  const [fleetVehicles, setFleetVehicles] = React.useState<FleetVehicleDto[]>(
    [],
  );
  const { user: currentUser } = useAuth();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = (await fetchCollectionItems(
        'event_logs',
        search,
        page,
        PAGE_LIMIT,
      )) as { items?: CollectionItem[]; total?: number };
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(
        typeof data.total === 'number' ? data.total : (data.items?.length ?? 0),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить события';
      showToast(message, 'error');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadReferences = React.useCallback(async () => {
    try {
      const [assetsList, objectsList] = await Promise.all([
        fetchAllCollectionItems('fixed_assets'),
        fetchAllCollectionObjects('', 200),
      ]);
      setAssets(assetsList);
      setObjects(objectsList);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить справочники';
      showToast(message, 'error');
      setAssets([]);
      setObjects([]);
    }
    try {
      const fleets = await listFleetVehicles('', 1, 200);
      setFleetVehicles(fleets.items);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить автопарк';
      showToast(message, 'error');
      setFleetVehicles([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  React.useEffect(() => {
    if (!modalOpen || form.id) return;
    const performerLabel = resolvePerformerLabel(currentUser);
    if (!performerLabel) return;
    if (performerLabel === form.performer) return;
    setForm((prev) => ({ ...prev, performer: performerLabel }));
  }, [currentUser, form.id, form.performer, modalOpen]);

  const assetMap = React.useMemo(() => {
    const map = new Map<string, string>();
    assets.forEach((asset) => map.set(asset._id, asset.name));
    return map;
  }, [assets]);

  const fleetMap = React.useMemo(() => {
    const map = new Map<string, string>();
    fleetVehicles.forEach((vehicle) => map.set(vehicle.id, vehicle.name));
    return map;
  }, [fleetVehicles]);

  React.useEffect(() => {
    if (form.operation !== 'self_service') return;
    if (form.assetType !== 'fixed_asset') return;
    if (!form.assetId) return;
    if (form.location.trim()) return;
    const asset = assets.find((candidate) => candidate._id === form.assetId);
    const locationFromAsset = resolveAssetLocation(asset);
    if (!locationFromAsset) return;
    setForm((prev) => ({
      ...prev,
      location: prev.location || locationFromAsset,
    }));
  }, [assets, form.assetId, form.assetType, form.location, form.operation]);

  const rows = React.useMemo<EventLogRow[]>(
    () =>
      items.map((item) => {
        const meta = (item.meta ?? {}) as EventLogMeta;
        const assetType = meta.assetType ?? '';
        const assetId = meta.assetId ?? '';
        const assetName =
          assetType === 'fixed_asset'
            ? assetMap.get(assetId)
            : assetType === 'fleet'
              ? fleetMap.get(assetId)
              : undefined;
        const assetLabel = assetName || meta.assetName || assetId || '—';
        const locationObject = meta.locationObjectId
          ? objects.find((object) => object._id === meta.locationObjectId)
          : undefined;
        const locationLabel =
          meta.location ||
          locationObject?.address ||
          locationObject?.name ||
          '';
        const eventType = (meta.eventType as EventType) ?? '';
        const operation = (meta.operation as EventOperation) ?? 'self_service';
        const dateTime = meta.datetime || meta.date || '';
        const performer = meta.performer?.trim() || '—';
        const transferLocation =
          typeof meta.transferLocation === 'string'
            ? meta.transferLocation.trim()
            : '';
        const isTransfer = eventType === 'transfer';
        return {
          id: item._id,
          number: item.name ?? '—',
          dateTime: formatDateTimeLabel(dateTime),
          eventType: resolveEventTypeLabel(eventType),
          operation: resolveOperationLabel(operation),
          performer,
          asset: assetLabel,
          location: locationLabel,
          locationLink: meta.locationLink,
          transferLocation,
          isTransfer,
          description: meta.description || item.value || '—',
        };
      }),
    [items, assetMap, fleetMap, objects],
  );

  const openCreate = () => {
    const now = toLocalDateTimeInput(new Date());
    setForm({
      ...emptyForm,
      number: formatEventNumber(total + 1),
      dateTime: now,
      date: now ? now.slice(0, 10) : '',
      eventType: 'refuel',
      performer: resolvePerformerLabel(currentUser),
    });
    setModalOpen(true);
  };

  const openEdit = (item: CollectionItem) => {
    const meta = (item.meta ?? {}) as EventLogMeta;
    const dateTime = toLocalDateTimeInput(meta.datetime ?? meta.date);
    setForm({
      id: item._id,
      number: item.name ?? '',
      date: meta.date ?? dateTime.slice(0, 10),
      dateTime,
      assetType: meta.assetType ?? '',
      assetId: meta.assetId ?? '',
      performer: meta.performer ?? '',
      eventType: (meta.eventType as EventType) ?? '',
      operation: meta.operation ?? 'self_service',
      locationLink: meta.locationLink ?? '',
      location: meta.location ?? '',
      locationObjectId: meta.locationObjectId ?? '',
      transferLocation: meta.transferLocation ?? '',
      description: meta.description ?? item.value ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
    setConfirmDelete(false);
  };

  const submit = async () => {
    const number = form.number.trim();
    const dateTimeValue = form.dateTime.trim();
    const isoDateTime = toIsoDateTime(dateTimeValue);
    const date = dateTimeValue ? dateTimeValue.slice(0, 10) : form.date.trim();
    const performer = form.performer.trim();
    const transferLocation = form.transferLocation.trim();
    const eventType = form.eventType;
    const operation = form.operation;
    const description = form.description.trim();
    if (!number) {
      showToast('Укажите номер события.', 'error');
      return;
    }
    if (!dateTimeValue || !isoDateTime) {
      showToast('Укажите дату и время события.', 'error');
      return;
    }
    if (!eventType) {
      showToast('Выберите тип события.', 'error');
      return;
    }
    if (!performer) {
      showToast('Создатель события не определён.', 'error');
      return;
    }
    if (eventType === 'transfer' && !transferLocation) {
      showToast('Укажите место перемещения.', 'error');
      return;
    }
    if (!description) {
      showToast('Добавьте описание события.', 'error');
      return;
    }
    setSaving(true);
    try {
      const assetName =
        form.assetType === 'fixed_asset'
          ? assetMap.get(form.assetId)
          : form.assetType === 'fleet'
            ? fleetMap.get(form.assetId)
            : undefined;
      const locationLink = form.locationLink.trim();
      const payload = {
        name: number,
        value: description,
        meta: {
          date,
          datetime: isoDateTime,
          performer,
          eventType,
          operation,
          assetType: form.assetType || undefined,
          assetId: form.assetId || undefined,
          assetName,
          location: form.location || undefined,
          locationObjectId: form.locationObjectId || undefined,
          locationLink: locationLink || undefined,
          transferLocation:
            eventType === 'transfer' && transferLocation
              ? transferLocation
              : undefined,
          description,
        },
      };
      if (form.id) {
        await updateCollectionItem(form.id, payload, {
          collectionType: 'event_logs',
        });
      } else {
        await createCollectionItem('event_logs', payload);
      }
      showToast('Событие сохранено', 'success');
      closeModal();
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось сохранить событие';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!form.id) return;
    try {
      await removeCollectionItem(form.id);
      showToast('Событие удалено', 'success');
      closeModal();
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось удалить событие';
      showToast(message, 'error');
    }
  };

  const applySearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  return (
    <div className="space-y-4">
      <ActionBar
        breadcrumbs={<Breadcrumbs items={[{ label: 'Журнал событий' }]} />}
        title="Журнал событий"
        description="Фиксация событий по основным средствам и автопарку."
        toolbar={
          <>
            <Button size="sm" variant="outline" onClick={applySearch}>
              Поиск
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchDraft('');
                setSearch('');
                setPage(1);
              }}
            >
              Сбросить
            </Button>
            <Button size="sm" variant="success" onClick={openCreate}>
              Новое событие
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-1 sm:w-72">
            <label
              htmlFor="events-search"
              className="text-xs font-semibold text-[color:var(--color-gray-700)]"
            >
              Поиск
            </label>
            <Input
              id="events-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Номер, описание или место"
              className="shadow-xs"
            />
            <span className="text-[11px] text-[color:var(--color-gray-500)] dark:text-[color:var(--color-gray-300)]">
              Поиск по журналу событий
            </span>
          </div>
        </div>
      </ActionBar>

      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-[color:var(--color-gray-200)] bg-white shadow-sm dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)]">
          <Spinner className="h-6 w-6 text-[color:var(--color-brand-500)]" />
        </div>
      ) : (
        <DataTable
          columns={eventLogColumns}
          data={rows}
          pageIndex={page - 1}
          pageSize={PAGE_LIMIT}
          pageCount={totalPages}
          onPageChange={(index) => setPage(index + 1)}
          showGlobalSearch={false}
          showFilters={false}
          wrapCellsAsBadges
          onRowClick={(row) => {
            const item = items.find((entry) => entry._id === row.id);
            if (item) {
              openEdit(item);
            }
          }}
        />
      )}

      <Modal open={modalOpen} onClose={closeModal}>
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              {form.id ? 'Карточка события' : 'Новое событие'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Номер
                </label>
                <Input
                  value={form.number}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      number: event.target.value,
                    }))
                  }
                  placeholder="SRV_000001"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Дата и время
                </label>
                <Input
                  type="datetime-local"
                  value={form.dateTime}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      dateTime: event.target.value,
                      date: event.target.value.slice(0, 10),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Событие
                </label>
                <div className="flex flex-wrap gap-2">
                  <span
                    className="ui-status-badge"
                    data-badge-label={form.performer || '—'}
                    data-tone="brand"
                  >
                    {form.performer || '—'}
                  </span>
                </div>
                <p className="text-xs text-[color:var(--color-gray-600)]">
                  Создатель события определяется автоматически и недоступен для
                  редактирования.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Тип события
                </label>
                <select
                  className="min-h-[var(--touch-target)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                  value={form.eventType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      eventType: event.target.value as EventType,
                    }))
                  }
                >
                  <option value="">Выберите тип</option>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Операция
                </label>
                <select
                  className="min-h-[var(--touch-target)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                  value={form.operation}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      operation: event.target.value as EventOperation,
                    }))
                  }
                >
                  {EVENT_OPERATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-dashed border-[color:var(--color-gray-200)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Объект события
                </p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="event-asset-type"
                      value="fixed_asset"
                      className="h-4 w-4 text-[color:var(--color-primary)]"
                      checked={form.assetType === 'fixed_asset'}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          assetType: 'fixed_asset',
                          assetId: '',
                          location: '',
                        }))
                      }
                    />
                    Основные средства
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="event-asset-type"
                      value="fleet"
                      className="h-4 w-4 text-[color:var(--color-primary)]"
                      checked={form.assetType === 'fleet'}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          assetType: 'fleet',
                          assetId: '',
                          location: '',
                        }))
                      }
                    />
                    Автопарк
                  </label>
                </div>
                {form.assetType === 'fixed_asset' ? (
                  <select
                    className="min-h-[var(--touch-target)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                    value={form.assetId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        assetId: event.target.value,
                        location:
                          prev.operation === 'self_service'
                            ? ''
                            : prev.location,
                      }))
                    }
                  >
                    <option value="">Выберите объект</option>
                    {assets.map((asset) => (
                      <option key={asset._id} value={asset._id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                ) : form.assetType === 'fleet' ? (
                  <select
                    className="min-h-[var(--touch-target)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                    value={form.assetId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        assetId: event.target.value,
                        location: '',
                      }))
                    }
                  >
                    <option value="">Выберите транспорт</option>
                    {fleetVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Место события
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs text-[color:var(--color-gray-600)]">
                      Ссылка на карту или вложения
                    </span>
                    <Input
                      value={form.locationLink}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          locationLink: event.target.value,
                        }))
                      }
                      placeholder="https://maps.app..."
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[color:var(--color-gray-600)]">
                      Адрес из коллекции
                    </span>
                    <select
                      className="min-h-[var(--touch-target)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                      value={form.locationObjectId}
                      onChange={(event) => {
                        const value = event.target.value;
                        const selectedObject = objects.find(
                          (object) => object._id === value,
                        );
                        setForm((prev) => ({
                          ...prev,
                          locationObjectId: value,
                          location: selectedObject?.address || '',
                        }));
                      }}
                    >
                      <option value="">Выберите объект (опционально)</option>
                      {objects.map((object) => (
                        <option key={object._id} value={object._id}>
                          {object.name} — {object.address}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  value={form.location}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      location: event.target.value,
                      locationObjectId: '',
                    }))
                  }
                  placeholder="Адрес или описание места"
                />
                {form.eventType === 'transfer' ? (
                  <div className="space-y-1">
                    <span className="text-xs text-[color:var(--color-gray-600)]">
                      Место перемещения
                    </span>
                    <Input
                      value={form.transferLocation}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          transferLocation: event.target.value,
                        }))
                      }
                      placeholder="Адрес нового местоположения"
                    />
                  </div>
                ) : null}
                <p className="text-xs text-[color:var(--color-gray-500)]">
                  При самообслуживании адрес подставляется из карточки объекта.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Описание
                </label>
                <textarea
                  className="min-h-[120px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Описание события"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="success"
              onClick={submit}
              disabled={saving}
            >
              Сохранить
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                Удалить
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={closeModal}>
              Закрыть
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        message="Удалить событие?"
        confirmText="Удалить"
        onConfirm={() => {
          setConfirmDelete(false);
          void executeDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
