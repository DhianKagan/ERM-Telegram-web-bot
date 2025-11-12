// Компонент загрузки файлов с drag-and-drop и прогрессом
// Основные модули: React, authFetch, типы задач
import React from 'react';
import { useTranslation } from 'react-i18next';
import authFetch from '../utils/authFetch';
import { showToast } from '../utils/toast';
import type { Attachment } from '../types/task';

const ACCEPTED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.heic',
  '.heif',
  '.pdf',
  '.doc',
  '.docx',
  '.docm',
  '.dotx',
  '.dotm',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xlsb',
  '.xltm',
  '.xltx',
  '.xlam',
  '.ppt',
  '.pptx',
  '.pptm',
  '.potx',
  '.potm',
  '.ppsx',
  '.ppsm',
  '.txt',
  '.csv',
  '.odt',
  '.ods',
  '.odp',
  '.zip',
  '.rar',
  '.7z',
  '.mp4',
  '.mov',
  '.mkv',
]);

const ACCEPT_ATTR = ['image/*', 'video/*', ...Array.from(ACCEPTED_EXTENSIONS)];

const cleanupUrl = (url: string) => {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
};

const ensureInlineMode = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }
  if (value.includes('mode=inline')) {
    return value;
  }
  const separator = value.includes('?') ? '&' : '?';
  return `${value}${separator}mode=inline`;
};

interface UploadItem {
  file: File;
  url: string;
  name: string;
  isImage: boolean;
  size: number;
  progress: number;
  attachment?: Attachment;
}

interface Props {
  disabled?: boolean;
  onUploaded: (a: Attachment) => void;
  onRemove: (a: Attachment) => void;
  taskId?: string | null;
}

export default function FileUploader({
  disabled,
  onUploaded,
  onRemove,
  taskId,
}: Props) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const { t } = useTranslation();
  const fileInputId = React.useId();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const dotIndex = file.name.lastIndexOf('.');
      const ext =
        dotIndex === -1 ? '' : file.name.slice(dotIndex).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.has(ext)) {
        showToast(t('invalidFileType'), 'error');
        return;
      }
      const it: UploadItem = {
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        isImage: file.type.startsWith('image/'),
        size: file.size,
        progress: 0,
      };
      setItems((p) => [...p, it]);
      uploadFile(file, (p) => {
        setItems((prev) =>
          prev.map((f) => (f === it ? { ...f, progress: p } : f)),
        );
      })
        .then((att) => {
          let previousUrl: string | null = null;
          setItems((prev) =>
            prev.map((f) => {
              if (f !== it) return f;
              previousUrl = f.url;
              const previewUrl =
                ensureInlineMode(att.thumbnailUrl) ||
                ensureInlineMode(att.url) ||
                f.url;
              return {
                ...f,
                attachment: att,
                progress: 100,
                url: previewUrl,
                isImage: att.type.startsWith('image/'),
              };
            }),
          );
          if (previousUrl) cleanupUrl(previousUrl);
          onUploaded(att);
        })
        .catch((error: unknown) => {
          setItems((prev) => prev.filter((f) => f !== it));
          const message =
            error instanceof Error && error.message
              ? error.message
              : t('uploadFailed');
          showToast(message, 'error');
          cleanupUrl(it.url);
        });
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const openFileDialog = () => {
    if (disabled) return;
    const node = fileInputRef.current;
    if (!node) return;
    const picker = (node as HTMLInputElement & { showPicker?: () => void })
      .showPicker;
    if (typeof picker === 'function') {
      picker.call(node);
      return;
    }
    node.click();
  };

  const handleZoneClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('label')) {
      return;
    }
    event.preventDefault();
    openFileDialog();
  };

  const handleZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFileDialog();
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const uploadFile = async (
    file: File,
    onProgress: (p: number) => void,
  ): Promise<Attachment> => {
    const chunkSize = 1024 * 1024;
    const total = Math.ceil(file.size / chunkSize);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let attachment: Attachment | undefined;
    for (let i = 0; i < total; i++) {
      const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
      const fd = new FormData();
      fd.append('fileId', id);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(total));
      fd.append('file', chunk, file.name);
      if (taskId && typeof taskId === 'string' && taskId.trim()) {
        fd.append('taskId', taskId);
      }
      const res = await authFetch('/api/v1/tasks/upload-chunk', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const copy = res.clone();
        let message = t('uploadFailed');
        try {
          const data = (await copy.json()) as { error?: string };
          if (typeof data?.error === 'string' && data.error.trim()) {
            message = data.error;
          }
        } catch {
          try {
            const text = await res.text();
            if (text.trim()) message = text.trim();
          } catch {
            /* игнорируем */
          }
        }
        throw new Error(message);
      }
      if (i === total - 1) attachment = (await res.json()) as Attachment;
      onProgress(Math.round(((i + 1) / total) * 100));
    }
    return attachment!;
  };

  const removeItem = (it: UploadItem) => {
    setItems((prev) => prev.filter((f) => f !== it));
    cleanupUrl(it.url);
    if (it.attachment) onRemove(it.attachment);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onDrop}
        onClick={handleZoneClick}
        onKeyDown={handleZoneKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={t('dragFilesOrSelect')}
        className={`mt-2 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentPrimary focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
          disabled
            ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 opacity-70'
            : 'cursor-pointer border-accentPrimary/60 bg-accentPrimary/5 text-slate-700 hover:border-accentPrimary hover:bg-accentPrimary/10'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <p className="text-base font-medium">{t('dragFilesOrSelect')}</p>
          <label
            htmlFor={fileInputId}
            className={`rounded-full border border-accentPrimary px-4 py-1.5 text-sm font-semibold text-accentPrimary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
              disabled
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:bg-accentPrimary/10 focus-visible:ring-accentPrimary'
            }`}
          >
            {t('chooseFiles')}
          </label>
          <p className="text-xs text-slate-500">{t('uploadTapHint')}</p>
        </div>
        <input
          ref={fileInputRef}
          id={fileInputId}
          name="attachments"
          type="file"
          multiple
          onChange={handleChange}
          disabled={disabled}
          accept={ACCEPT_ATTR.join(',')}
          className="sr-only"
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              {it.isImage && (
                <img
                  srcSet={`${
                    ensureInlineMode(it.attachment?.thumbnailUrl) ||
                    ensureInlineMode(it.attachment?.url) ||
                    it.url
                  } 1x, ${
                    ensureInlineMode(it.attachment?.url) ||
                    ensureInlineMode(it.attachment?.thumbnailUrl) ||
                    it.url
                  } 2x`}
                  sizes="48px"
                  src={
                    ensureInlineMode(it.attachment?.thumbnailUrl) ||
                    ensureInlineMode(it.attachment?.url) ||
                    it.url
                  }
                  alt={it.name}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm">
                  {it.name} ({(it.size / 1024 / 1024).toFixed(1)} {t('mb')})
                </p>
                <div className="h-2 rounded bg-gray-200">
                  <div
                    className="bg-accentPrimary h-2 rounded"
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="text-red-500"
                onClick={() => removeItem(it)}
              >
                {t('delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
