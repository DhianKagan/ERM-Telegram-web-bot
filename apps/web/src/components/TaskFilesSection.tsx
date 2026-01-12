// Раздел файлов задачи с общим списком и модалкой привязки
// Основные модули: React, SimpleTable, storageService, authFetch
import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownTrayIcon,
  PaperClipIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { SimpleTable, type SimpleTableAction } from '@/components/ui/simple-table';
import { Button } from '@/components/ui/button';
import Modal from './Modal';
import { fetchFiles, removeFile, type StoredFile } from '../services/storage';
import authFetch from '../utils/authFetch';
import { showToast } from '../utils/toast';
import { ACCESS_ADMIN, hasAccess } from '../utils/access';
import { useAuth } from '../context/useAuth';
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';
import type { Attachment } from '../types/task';

const PAGE_SIZE = 10;

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

function formatSize(bytes: number | undefined): string {
  if (!bytes || Number.isNaN(bytes)) return '—';
  if (bytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '—';
  const label = dateTimeFormatter.format(new Date(time)).replace(', ', ' ');
  return `${label} ${PROJECT_TIMEZONE_LABEL}`;
}

const buildAttachmentFromFile = (file: StoredFile): Attachment => ({
  fileId: file.id,
  name: file.name || 'Файл',
  url: file.url || `/api/v1/files/${file.id}`,
  thumbnailUrl: file.thumbnailUrl,
  type: file.type || 'application/octet-stream',
  size: file.size ?? 0,
});

type Props = {
  taskId?: string | null;
  canEdit?: boolean;
  onAddAttachment: (attachment: Attachment) => void;
  onRemoveAttachment: (fileId: string) => void;
};

export default function TaskFilesSection({
  taskId,
  canEdit = false,
  onAddAttachment,
  onRemoveAttachment,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManageStorage = hasAccess(user?.access ?? 0, ACCESS_ADMIN);
  const [files, setFiles] = React.useState<StoredFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalPageIndex, setModalPageIndex] = React.useState(0);
  const [attachLoadingId, setAttachLoadingId] = React.useState<string | null>(
    null,
  );

  const loadFiles = React.useCallback(() => {
    setLoading(true);
    return fetchFiles()
      .then((list) => setFiles(Array.isArray(list) ? list : []))
      .catch(() => showToast(t('storage.loadError'), 'error'))
      .finally(() => setLoading(false));
  }, [t]);

  React.useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const pageCount = Math.max(1, Math.ceil(files.length / PAGE_SIZE));
  const pagedFiles = React.useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return files.slice(start, start + PAGE_SIZE);
  }, [files, pageIndex]);

  const modalPageCount = Math.max(1, Math.ceil(files.length / PAGE_SIZE));
  const modalFiles = React.useMemo(() => {
    const start = modalPageIndex * PAGE_SIZE;
    return files.slice(start, start + PAGE_SIZE);
  }, [files, modalPageIndex]);

  const resolveTaskLabel = React.useCallback(
    (file: StoredFile) => {
      if (file.taskNumber) {
        return t('storage.taskNumberLabel', { number: file.taskNumber });
      }
      if (file.taskId) {
        return t('storage.taskLabel', { id: file.taskId });
      }
      return t('storage.taskMissing');
    },
    [t],
  );

  const handleDownload = React.useCallback(
    (file: StoredFile) => {
      if (!file.url) return;
      window.open(file.url, '_blank', 'noopener,noreferrer');
      showToast(t('storage.openedInNewTab'), 'success');
    },
    [t],
  );

  const handleDelete = React.useCallback(
    (file: StoredFile) => {
      if (!canManageStorage) return;
      const confirmed = window.confirm(
        t('storage.deleteConfirm', { name: file.name }),
      );
      if (!confirmed) return;
      removeFile(file.id)
        .then((res) => {
          if (!res.ok) throw new Error('delete');
          showToast(t('storage.deleteSuccess'), 'success');
          setFiles((current) =>
            current.filter((candidate) => candidate.id !== file.id),
          );
          onRemoveAttachment(file.id);
        })
        .catch(() => {
          showToast(t('storage.deleteError'), 'error');
        });
    },
    [canManageStorage, onRemoveAttachment, t],
  );

  const handleAttach = React.useCallback(
    async (file: StoredFile) => {
      if (attachLoadingId) return;
      if (taskId) {
        setAttachLoadingId(file.id);
        try {
          const response = await authFetch(
            `/api/v1/files/${encodeURIComponent(file.id)}/attach`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId }),
            },
          );
          if (!response.ok) {
            if (response.status === 403) {
              showToast(t('storage.attach.forbidden'), 'error');
              return;
            }
            throw new Error('attach');
          }
          await response.json().catch(() => ({}));
          onAddAttachment(buildAttachmentFromFile(file));
          showToast(t('storage.attach.success'), 'success');
          await loadFiles();
        } catch {
          showToast(t('storage.attach.error'), 'error');
        } finally {
          setAttachLoadingId(null);
        }
        return;
      }
      onAddAttachment(buildAttachmentFromFile(file));
      showToast(t('storage.attach.success'), 'success');
    },
    [attachLoadingId, loadFiles, onAddAttachment, taskId, t],
  );

  const columns = React.useMemo<ColumnDef<StoredFile>[]>(
    () => [
      {
        header: t('storage.columns.name'),
        accessorKey: 'name',
        meta: { minWidth: '10rem', renderAsBadges: false, truncate: true },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name || 'Файл'}</span>
        ),
      },
      {
        header: t('storage.columns.type'),
        accessorKey: 'type',
        meta: { minWidth: '8rem', truncate: true },
        cell: ({ row }) => row.original.type || '',
      },
      {
        header: t('storage.columns.size'),
        accessorKey: 'size',
        meta: { minWidth: '6rem' },
        cell: ({ row }) => formatSize(row.original.size),
      },
      {
        header: t('storage.columns.task'),
        accessorKey: 'task',
        meta: { minWidth: '10rem', renderAsBadges: false, truncate: true },
        cell: ({ row }) => {
          const file = row.original;
          return (
            <span className="block">
              {resolveTaskLabel(file)}
              {file.taskTitle ? (
                <span className="block text-xs text-muted-foreground">
                  {file.taskTitle}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        header: t('storage.columns.uploaded'),
        accessorKey: 'uploadedAt',
        meta: { minWidth: '8rem', truncate: true },
        cell: ({ row }) => formatDate(row.original.uploadedAt),
      },
    ],
    [resolveTaskLabel, t],
  );

  const rowActions = React.useCallback(
    (file: StoredFile): SimpleTableAction<StoredFile>[] => [
      {
        id: 'download',
        label: t('storage.download'),
        icon: <ArrowDownTrayIcon className="size-4" />,
        onClick: handleDownload,
      },
      {
        id: 'delete',
        label: t('storage.delete'),
        icon: <TrashIcon className="size-4" />,
        onClick: handleDelete,
        variant: 'destructive',
        disabled: !canManageStorage || !canEdit,
      },
    ],
    [canEdit, canManageStorage, handleDelete, handleDownload, t],
  );

  const modalActions = React.useCallback(
    (file: StoredFile): SimpleTableAction<StoredFile>[] => {
      const isAttached =
        taskId && file.taskId && String(file.taskId) === String(taskId);
      const isBusy = attachLoadingId === file.id;
      const label = isAttached
        ? t('storage.attach.attached')
        : taskId
          ? t('storage.attach.button')
          : t('storage.attach.addToTask');
      return [
        {
          id: 'attach',
          label,
          icon: <PaperClipIcon className="size-4" />,
          onClick: handleAttach,
          disabled: isAttached || isBusy || !canEdit,
        },
      ];
    },
    [attachLoadingId, canEdit, handleAttach, t, taskId],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {loading ? t('loading') : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(true)}
            >
              {t('storage.attach.selectExisting')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadFiles()}
            disabled={loading}
          >
            {t('storage.refresh')}
          </Button>
        </div>
      </div>
      <SimpleTable<StoredFile>
        columns={columns}
        data={pagedFiles}
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        pageCount={pageCount}
        onPageChange={setPageIndex}
        showGlobalSearch={false}
        showFilters={false}
        wrapCellsAsBadges
        getRowActions={rowActions}
        actionsLabel={t('storage.actions')}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t('storage.attach.modalTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('storage.attach.modalDescription')}
            </p>
          </div>
          <SimpleTable<StoredFile>
            columns={columns}
            data={modalFiles}
            pageIndex={modalPageIndex}
            pageSize={PAGE_SIZE}
            pageCount={modalPageCount}
            onPageChange={setModalPageIndex}
            showGlobalSearch={false}
            showFilters={false}
            wrapCellsAsBadges
            getRowActions={modalActions}
            actionsLabel={t('storage.attach.actions')}
          />
        </div>
      </Modal>
    </div>
  );
}
