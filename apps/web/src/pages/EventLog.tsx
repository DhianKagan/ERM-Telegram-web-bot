// Назначение файла: журнал событий по объектам и автопарку
// Основные модули: React, collections service, DataTable, Modal
import React from 'react';

import { Button } from '@/components/ui/button';
import ActionBar from '../components/ActionBar';
import Breadcrumbs from '../components/Breadcrumbs';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { showToast } from '../utils/toast';
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

type EventLogMeta = {
  date?: string;
  assetType?: AssetType;
  assetId?: string;
  assetName?: string;
  location?: string;
  locationObjectId?: string;
  description?: string;
};

type EventLogForm = {
  id?: string;
  number: string;
  date: string;
  assetType: AssetType;
  assetId: string;
  location: string;
  locationObjectId: string;
  description: string;
};

const emptyForm: EventLogForm = {
  number: '',
  date: '',
  assetType: '',
  assetId: '',
  location: '',
  locationObjectId: '',
  description: '',
};

const formatEventNumber = (value: number): string =>
  `SRV_${String(value).padStart(6, '0')}`;

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
        typeof data.total === 'number' ? data.total : data.items?.length ?? 0,
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
        error instanceof Error ? error.message : 'Не удалось загрузить справочники';
      showToast(message, 'error');
      setAssets([]);
      setObjects([]);
    }
    try {
      const fleets = await listFleetVehicles('', 1, 200);
      setFleetVehicles(fleets.items);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить автопарк';
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
        const assetLabel =
          assetName || meta.assetName || assetId || '—';
        const locationLabel =
          meta.location ||
          (meta.locationObjectId
            ? objects.find((object) => object._id === meta.locationObjectId)
                ?.address
            : '') ||
          '—';
        return {
          id: item._id,
          number: item.name,
          date: meta.date || '—',
          asset: assetLabel,
          location: locationLabel,
          description: meta.description || item.value || '—',
        };
      }),
    [items, assetMap, fleetMap, objects],
  );

  const openCreate = () => {
    setForm({
      ...emptyForm,
      number: formatEventNumber(total + 1),
      date: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEdit = (item: CollectionItem) => {
    const meta = (item.meta ?? {}) as EventLogMeta;
    setForm({
      id: item._id,
      number: item.name ?? '',
      date: meta.date ?? '',
      assetType: meta.assetType ?? '',
      assetId: meta.assetId ?? '',
      location: meta.location ?? '',
      locationObjectId: meta.locationObjectId ?? '',
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
    const date = form.date.trim();
    const description = form.description.trim();
    if (!number) {
      showToast('Укажите номер события.', 'error');
      return;
    }
    if (!date) {
      showToast('Укажите дату события.', 'error');
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
      const payload = {
        name: number,
        value: description,
        meta: {
          date,
          assetType: form.assetType || undefined,
          assetId: form.assetId || undefined,
          assetName,
          location: form.location || undefined,
          locationObjectId: form.locationObjectId || undefined,
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
            <label htmlFor="events-search" className="sr-only">
              Поиск
            </label>
            <input
              id="events-search"
              className="h-10 w-full rounded-2xl border border-[color:var(--color-gray-200)] bg-white px-3 text-sm text-[color:var(--color-gray-900)] shadow-sm outline-none transition focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-200)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] dark:text-white"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Номер, описание или место"
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
          onRowClick={(row) => {
            const item = items.find((entry) => entry._id === row.id);
            if (item) {
              openEdit(item);
            }
          }}
        />
      )}

      <Modal open={modalOpen} onClose={closeModal}>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {form.id ? 'Карточка события' : 'Новое событие'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Номер</label>
                <input
                  className="h-10 w-full rounded border px-3"
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
              <div>
                <label className="block text-sm font-medium">Дата</label>
                <input
                  type="date"
                  className="h-10 w-full rounded border px-3"
                  value={form.date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">
                Объект события
              </label>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="event-asset-type"
                    value="fixed_asset"
                    checked={form.assetType === 'fixed_asset'}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        assetType: 'fixed_asset',
                        assetId: '',
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
                    checked={form.assetType === 'fleet'}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        assetType: 'fleet',
                        assetId: '',
                      }))
                    }
                  />
                  Автопарк
                </label>
              </div>
              {form.assetType === 'fixed_asset' ? (
                <select
                  className="mt-2 h-10 w-full rounded border px-3"
                  value={form.assetId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      assetId: event.target.value,
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
                  className="mt-2 h-10 w-full rounded border px-3"
                  value={form.assetId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      assetId: event.target.value,
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
            <div>
              <label className="block text-sm font-medium">
                Место события
              </label>
              <select
                className="mt-2 h-10 w-full rounded border px-3"
                value={form.locationObjectId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    locationObjectId: event.target.value,
                    location: '',
                  }))
                }
              >
                <option value="">Выберите объект (опционально)</option>
                {objects.map((object) => (
                  <option key={object._id} value={object._id}>
                    {object.name} — {object.address}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 h-10 w-full rounded border px-3"
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
            </div>
            <div>
              <label className="block text-sm font-medium">Описание</label>
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
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
