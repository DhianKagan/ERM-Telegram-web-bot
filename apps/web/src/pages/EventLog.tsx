// Назначение файла: журнал событий по объектам и автопарку
// Основные модули: React, collections service, DataTable, Modal
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/simple-table';
import {
  CalendarDaysIcon,
  EyeIcon,
  PencilSquareIcon,
  ShareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Breadcrumbs from '../components/Breadcrumbs';
import ConfirmDialog from '../components/ConfirmDialog';
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
import FilterGrid from '@/components/FilterGrid';
import PageHeader from '@/components/PageHeader';
import {
  buildEventLogColumns,
  type EventLogRow,
} from '../columns/eventLogColumns';
import type { RowActionItem } from '../components/RowActionButtons';
import type { FleetVehicleDto } from 'shared';
import extractCoords from '../utils/extractCoords';

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
  transferLocationObjectId?: string;
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
  transferLocationObjectId: string;
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
  transferLocationObjectId: '',
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

type LocationDetails = {
  title?: string;
  address?: string;
  coords?: string;
  source?: 'object' | 'link' | 'manual';
};

const truncateWords = (value: string, limit = 3): string => {
  const normalized = value.trim();
  if (!normalized) return '';
  const words = normalized.split(/\s+/);
  if (words.length <= limit) return normalized;
  return words.slice(0, limit).join(' ');
};

const formatCoords = (
  coords?: { lat?: number; lng?: number } | null,
): string | undefined => {
  if (!coords || coords.lat === undefined || coords.lng === undefined)
    return undefined;
  const lat = Number.isFinite(coords.lat)
    ? coords.lat.toFixed(6)
    : String(coords.lat);
  const lng = Number.isFinite(coords.lng)
    ? coords.lng.toFixed(6)
    : String(coords.lng);
  return `${lat}, ${lng}`;
};

const resolveCoordsFromValue = (
  value?: unknown,
): { lat: number; lng: number } | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const lat =
    typeof candidate.lat === 'number'
      ? candidate.lat
      : typeof candidate.latitude === 'number'
        ? candidate.latitude
        : undefined;
  const lng =
    typeof candidate.lng === 'number'
      ? candidate.lng
      : typeof candidate.longitude === 'number'
        ? candidate.longitude
        : undefined;
  if (lat === undefined || lng === undefined) return null;
  return { lat, lng };
};

const resolveObjectCoords = (
  object?: CollectionObject,
): { lat: number; lng: number } | null => {
  if (!object) return null;
  const meta = object.meta ?? {};
  const lat =
    typeof object.latitude === 'number'
      ? object.latitude
      : typeof meta.latitude === 'number'
        ? meta.latitude
        : typeof meta.location?.lat === 'number'
          ? meta.location.lat
          : undefined;
  const lng =
    typeof object.longitude === 'number'
      ? object.longitude
      : typeof meta.longitude === 'number'
        ? meta.longitude
        : typeof meta.location?.lng === 'number'
          ? meta.location.lng
          : undefined;
  if (lat === undefined || lng === undefined) return null;
  return { lat, lng };
};

const decodeLabel = (raw?: string | null): string => {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  } catch {
    return raw.replace(/\+/g, ' ').trim();
  }
};

const parseGoogleLabel = (
  link: string,
): { name?: string; address?: string } => {
  const candidates: string[] = [];
  const placeMatch = link.match(/\/place\/([^/@]+)/);
  if (placeMatch?.[1]) {
    candidates.push(decodeLabel(placeMatch[1]));
  }
  const qMatch = link.match(/[?&]q=([^&]+)/);
  if (qMatch?.[1]) {
    candidates.push(decodeLabel(qMatch[1]));
  }
  try {
    const parsed = new URL(link);
    const params = ['q', 'query', 'destination'];
    for (const key of params) {
      const value = decodeLabel(parsed.searchParams.get(key));
      if (value) {
        candidates.push(value);
      }
    }
  } catch {
    // игнорируем ошибки парсинга — в этом случае просто вернём пустую метку
  }

  const label = candidates.find(Boolean);
  if (!label) return {};
  const parts = label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) {
    const [single] = parts;
    const words = single.split(/\s+/);
    if (words.length <= 3) {
      return { name: single };
    }
    return { name: truncateWords(single), address: single };
  }
  const [first, ...rest] = parts;
  return { name: truncateWords(first), address: rest.join(', ') };
};

const buildLocationDetails = ({
  object,
  link,
  text,
}: {
  object?: CollectionObject;
  link?: string;
  text?: string;
}): LocationDetails | null => {
  if (object) {
    const coords = formatCoords(resolveObjectCoords(object));
    const meta = object.meta ?? {};
    const address =
      typeof object.address === 'string' && object.address.trim()
        ? object.address.trim()
        : typeof meta.address === 'string'
          ? meta.address.trim()
          : undefined;
    return {
      title: object.name?.trim() || undefined,
      address,
      coords,
      source: 'object',
    };
  }

  const trimmedLink =
    typeof link === 'string'
      ? link.trim()
      : formatCoords(resolveCoordsFromValue(link));
  if (trimmedLink) {
    const coords = formatCoords(extractCoords(trimmedLink));
    const { name, address } = parseGoogleLabel(trimmedLink);
    return {
      title: name || undefined,
      address: address || undefined,
      coords: coords || undefined,
      source: 'link',
    };
  }

  const coordsFromObject = formatCoords(resolveCoordsFromValue(text));
  const trimmedText = typeof text === 'string' ? text.trim() : '';
  if (trimmedText || coordsFromObject) {
    const coords =
      coordsFromObject || formatCoords(extractCoords(trimmedText)) || undefined;
    return {
      title: undefined,
      address: trimmedText,
      coords: coords || undefined,
      source: 'manual',
    };
  }

  return null;
};

const formatLocationDetails = (details?: LocationDetails | null): string => {
  if (!details) return '';
  const lines: string[] = [];
  if (details.title) {
    lines.push(details.title);
  }
  if (details.address) {
    lines.push(details.address);
  }
  if (details.coords) {
    if (lines.length) {
      lines.push('');
    }
    lines.push(details.coords);
  }
  return lines.join('\n').trim();
};

const parseCoordsFromString = (
  value?: string,
): { lat: number; lng: number } | null => {
  if (!value) return null;
  const [latRaw, lngRaw] = value.split(',').map((part) => part.trim());
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
};

const buildMapLink = (
  details?: LocationDetails | null,
  link?: string,
  text?: string,
): string | undefined => {
  const trimmedLink = typeof link === 'string' ? link.trim() : '';
  if (trimmedLink) {
    return trimmedLink;
  }
  const coordsFromDetails = parseCoordsFromString(details?.coords);
  const coordsFromText =
    (typeof text === 'string'
      ? extractCoords(text)
      : resolveCoordsFromValue(text)) ?? coordsFromDetails;
  const coords = coordsFromDetails ?? coordsFromText;
  if (coords) {
    const latValue = Number.isFinite(coords.lat)
      ? coords.lat
      : Number.parseFloat(String(coords.lat));
    const lngValue = Number.isFinite(coords.lng)
      ? coords.lng
      : Number.parseFloat(String(coords.lng));
    if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
      return `https://www.google.com/maps/search/?api=1&query=${latValue},${lngValue}`;
    }
  }
  return undefined;
};

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

const resolveAssetLocation = (
  asset: CollectionItem | undefined,
  objectsMap: Map<string, CollectionObject>,
): { location: string; locationObjectId?: string } => {
  if (!asset) return { location: '', locationObjectId: undefined };
  const meta = (asset.meta ?? {}) as Record<string, unknown>;
  const locationObjectId =
    typeof meta.locationObjectId === 'string'
      ? meta.locationObjectId
      : undefined;

  if (locationObjectId) {
    const object = objectsMap.get(locationObjectId);
    const formatted = formatLocationDetails(buildLocationDetails({ object }));
    if (formatted) {
      return { location: formatted, locationObjectId };
    }
  }

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
  return { location: candidate?.trim() ?? '', locationObjectId };
};

export default function EventLog() {
  const [items, setItems] = React.useState<CollectionItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [eventTotal, setEventTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [searchDraft, setSearchDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<EventLogForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [rowDeleteId, setRowDeleteId] = React.useState<string | null>(null);

  const [assets, setAssets] = React.useState<CollectionItem[]>([]);
  const [objects, setObjects] = React.useState<CollectionObject[]>([]);
  const [fleetVehicles, setFleetVehicles] = React.useState<FleetVehicleDto[]>(
    [],
  );
  const { user: currentUser } = useAuth();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const refreshEventTotal = React.useCallback(async (): Promise<number> => {
    try {
      const data = (await fetchCollectionItems('event_logs', '', 1, 1)) as {
        items?: CollectionItem[];
        total?: number;
      };
      const itemsCount = Array.isArray(data.items) ? data.items.length : 0;
      const resolvedTotal =
        typeof data.total === 'number' ? data.total : itemsCount;
      setEventTotal(resolvedTotal);
      return resolvedTotal;
    } catch (error) {
      console.error('Не удалось обновить счётчик событий', error);
      return eventTotal;
    }
  }, [eventTotal]);

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
      const resolvedTotal =
        typeof data.total === 'number' ? data.total : (data.items?.length ?? 0);
      setTotal(resolvedTotal);
      if (!search.trim()) {
        setEventTotal(resolvedTotal);
      }
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
    void refreshEventTotal();
  }, [refreshEventTotal]);

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

  const objectsMap = React.useMemo(() => {
    const map = new Map<string, CollectionObject>();
    objects.forEach((object) => map.set(object._id, object));
    return map;
  }, [objects]);

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
    const { location: locationFromAsset, locationObjectId } =
      resolveAssetLocation(asset, objectsMap);
    if (!locationFromAsset) return;
    setForm((prev) => ({
      ...prev,
      location: prev.location || locationFromAsset,
      locationObjectId: prev.locationObjectId || locationObjectId || '',
    }));
  }, [
    assets,
    form.assetId,
    form.assetType,
    form.location,
    form.operation,
    objectsMap,
  ]);

  const locationObject = React.useMemo(
    () =>
      form.locationObjectId ? objectsMap.get(form.locationObjectId) : undefined,
    [form.locationObjectId, objectsMap],
  );

  const transferObject = React.useMemo(
    () =>
      form.transferLocationObjectId
        ? objectsMap.get(form.transferLocationObjectId)
        : undefined,
    [form.transferLocationObjectId, objectsMap],
  );

  const locationDetails = React.useMemo(
    () =>
      buildLocationDetails({
        object: locationObject,
        link: form.locationLink,
        text: form.location || form.locationLink,
      }),
    [form.location, form.locationLink, locationObject],
  );

  const transferDetails = React.useMemo(
    () =>
      buildLocationDetails({
        object: transferObject,
        link: form.transferLocation,
        text: form.transferLocation,
      }),
    [form.transferLocation, transferObject],
  );

  const locationPreview = React.useMemo(
    () => formatLocationDetails(locationDetails),
    [locationDetails],
  );

  const transferPreview = React.useMemo(
    () => formatLocationDetails(transferDetails),
    [transferDetails],
  );

  const locationMapLink = React.useMemo(
    () => buildMapLink(locationDetails, form.locationLink, form.location),
    [form.location, form.locationLink, locationDetails],
  );

  const transferMapLink = React.useMemo(
    () => buildMapLink(transferDetails, undefined, form.transferLocation),
    [form.transferLocation, transferDetails],
  );

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
          ? objectsMap.get(meta.locationObjectId)
          : undefined;
        const locationDetails = buildLocationDetails({
          object: locationObject,
          link: meta.locationLink,
          text: meta.location,
        });
        const locationLabel =
          formatLocationDetails(locationDetails) ||
          meta.location ||
          locationObject?.address ||
          locationObject?.name ||
          '';
        const eventType = (meta.eventType as EventType) ?? '';
        const operation = (meta.operation as EventOperation) ?? 'self_service';
        const dateTime = meta.datetime || meta.date || '';
        const performer = meta.performer?.trim() || '—';
        const transferObject = meta.transferLocationObjectId
          ? objectsMap.get(meta.transferLocationObjectId)
          : undefined;
        const transferDetails = buildLocationDetails({
          object: transferObject,
          link: meta.transferLocation,
          text: meta.transferLocation,
        });
        const transferLocation = formatLocationDetails(transferDetails);
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
          locationLink: buildMapLink(
            locationDetails,
            meta.locationLink,
            meta.location,
          ),
          transferLocation,
          isTransfer,
          description: meta.description || item.value || '—',
        };
      }),
    [items, assetMap, fleetMap, objectsMap],
  );

  const openCreate = async () => {
    const now = toLocalDateTimeInput(new Date());
    const latestTotal = await refreshEventTotal();
    const baseTotal = latestTotal || eventTotal || total;
    setForm({
      ...emptyForm,
      number: formatEventNumber(baseTotal + 1),
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
      transferLocationObjectId: meta.transferLocationObjectId ?? '',
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
    const transferLocationObjectId = form.transferLocationObjectId.trim();
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
          transferLocationObjectId:
            eventType === 'transfer' && transferLocationObjectId
              ? transferLocationObjectId
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
      await refreshEventTotal();
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
      await refreshEventTotal();
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

  const resetSearch = () => {
    setSearchDraft('');
    setSearch('');
    setPage(1);
  };

  const handleShare = React.useCallback(async (row: EventLogRow) => {
    const link = `${window.location.origin}${window.location.pathname}?event=${row.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        showToast('Ссылка на событие скопирована', 'success');
        return;
      }
    } catch {
      // fallback
    }
    showToast('Не удалось скопировать ссылку', 'error');
  }, []);

  const confirmRowDelete = React.useCallback(async () => {
    if (!rowDeleteId) return;
    try {
      await removeCollectionItem(rowDeleteId);
      showToast('Событие удалено', 'success');
      await load();
      await refreshEventTotal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось удалить событие';
      showToast(message, 'error');
    } finally {
      setRowDeleteId(null);
    }
  }, [load, refreshEventTotal, rowDeleteId]);

  const rowActions = (row: EventLogRow): RowActionItem[] => {
    const actions: RowActionItem[] = [];
    const item = items.find((entry) => entry._id === row.id);
    if (item) {
      actions.push({
        label: 'Открыть',
        icon: <EyeIcon className="size-4" />,
        onClick: () => openEdit(item),
      });
      actions.push({
        label: 'Редактировать',
        icon: <PencilSquareIcon className="size-4" />,
        onClick: () => openEdit(item),
      });
    }
    actions.push({
      label: 'Удалить',
      icon: <TrashIcon className="size-4" />,
      onClick: () => setRowDeleteId(row.id),
    });
    actions.push({
      label: 'Поделиться',
      icon: <ShareIcon className="size-4" />,
      onClick: () => void handleShare(row),
    });
    return actions;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Журнал событий' }]} />}
        icon={CalendarDaysIcon}
        title="Журнал событий"
        description="Фиксация событий по основным средствам и автопарку."
        filters={
          <FilterGrid
            variant="plain"
            onSearch={applySearch}
            onReset={resetSearch}
            actions={
              <Button
                size="sm"
                variant="primary"
                onClick={() => void openCreate()}
              >
                Новое событие
              </Button>
            }
          >
            <div className="flex w-full flex-1 flex-col gap-1">
              <label
                htmlFor="events-search"
                className="text-xs font-semibold text-foreground"
              >
                Поиск
              </label>
              <Input
                id="events-search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applySearch();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    resetSearch();
                  }
                }}
                placeholder="Номер, описание или место"
                className="shadow-xs"
              />
              <span className="text-xs text-muted-foreground">
                Поиск по журналу событий
              </span>
            </div>
          </FilterGrid>
        }
      />

      <Card>
        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Spinner className="h-6 w-6 text-[color:var(--color-brand-500)]" />
          </div>
        ) : (
          <SimpleTable
            columns={buildEventLogColumns({ rowActions })}
            data={rows}
            pageIndex={page - 1}
            pageSize={PAGE_LIMIT}
            pageCount={totalPages}
            onPageChange={(index) => setPage(index + 1)}
            showGlobalSearch={false}
            showFilters={false}
            wrapCellsAsBadges
            rowHeight={56}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={closeModal}>
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">
              {form.id ? 'Карточка события' : 'Новое событие'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Номер
                </label>
                <Input
                  value={form.number}
                  placeholder="SRV_000001"
                  readOnly
                  aria-readonly
                  className="bg-muted/40"
                />
              </div>
              {form.id ? (
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                    ID
                  </label>
                  <Input
                    value={form.id}
                    readOnly
                    aria-readonly
                    className="bg-muted/40"
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[color:var(--color-gray-700)]">
                  Дата и время
                </label>
                <Input
                  type="datetime-local"
                  value={form.dateTime}
                  readOnly
                  aria-readonly
                  className="bg-muted/40"
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
                    data-tone="primary"
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
                          locationObjectId: '',
                          transferLocationObjectId: '',
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
                          locationObjectId: '',
                          transferLocationObjectId: '',
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
                    {assets.map((asset) => {
                      const meta = (asset.meta ?? {}) as Record<
                        string,
                        unknown
                      >;
                      const locationObjectId =
                        typeof meta.locationObjectId === 'string'
                          ? meta.locationObjectId
                          : '';
                      const locationObject = objectsMap.get(locationObjectId);
                      const objectLabel =
                        locationObject?.name || locationObject?.address;
                      const label = objectLabel
                        ? `${asset.name} — ${objectLabel}`
                        : asset.name;
                      return (
                        <option key={asset._id} value={asset._id}>
                          {label}
                        </option>
                      );
                    })}
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
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={form.locationLink}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              locationLink: event.target.value,
                            }))
                          }
                          placeholder="https://maps.app..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-[var(--touch-target)]"
                          disabled={!locationMapLink}
                          onClick={() => {
                            if (locationMapLink) {
                              window.open(
                                locationMapLink,
                                '_blank',
                                'noopener',
                              );
                            }
                          }}
                        >
                          Google Map
                        </Button>
                      </div>
                    </div>
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
                        const selectedObject = objectsMap.get(value);
                        const formatted = formatLocationDetails(
                          buildLocationDetails({ object: selectedObject }),
                        );
                        setForm((prev) => ({
                          ...prev,
                          locationObjectId: value,
                          location:
                            formatted ||
                            selectedObject?.address ||
                            prev.location,
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
                {locationPreview ? (
                  <div className="whitespace-pre-line rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[color:var(--color-gray-700)]">
                    {locationPreview}
                  </div>
                ) : null}
                {form.eventType === 'transfer' ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
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
                              transferLocationObjectId: '',
                            }))
                          }
                          placeholder="Адрес нового местоположения"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-[color:var(--color-gray-600)]">
                          Адрес перемещения из коллекции
                        </span>
                        <select
                          className="min-h-[var(--touch-target)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--color-primary-300)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-200)] focus-visible:outline-none"
                          value={form.transferLocationObjectId}
                          onChange={(event) => {
                            const value = event.target.value;
                            const selectedObject = objectsMap.get(value);
                            const formatted = formatLocationDetails(
                              buildLocationDetails({ object: selectedObject }),
                            );
                            setForm((prev) => ({
                              ...prev,
                              transferLocationObjectId: value,
                              transferLocation:
                                formatted ||
                                selectedObject?.address ||
                                prev.transferLocation,
                            }));
                          }}
                        >
                          <option value="">
                            Выберите объект (опционально)
                          </option>
                          {objects.map((object) => (
                            <option key={object._id} value={object._id}>
                              {object.name} — {object.address}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {transferPreview ? (
                      <div className="space-y-1">
                        <div className="whitespace-pre-line rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[color:var(--color-gray-700)]">
                          {transferPreview}
                        </div>
                        {transferMapLink ? (
                          <a
                            href={transferMapLink}
                            target="_blank"
                            rel="noopener"
                            className="text-xs font-medium text-[color:var(--color-primary-600)] hover:underline"
                          >
                            Открыть в Google Maps
                          </a>
                        ) : null}
                      </div>
                    ) : null}
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
      <ConfirmDialog
        open={Boolean(rowDeleteId)}
        message="Удалить событие? Это действие нельзя отменить."
        confirmText="Удалить"
        onConfirm={() => {
          void confirmRowDelete();
        }}
        onCancel={() => setRowDeleteId(null)}
      />
    </div>
  );
}
