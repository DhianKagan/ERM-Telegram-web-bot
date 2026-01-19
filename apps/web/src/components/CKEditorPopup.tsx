// Поле редактирования текста в модальном окне CKEditor 5
// Модули: React, CKEditor 5, DOMPurify, Modal
import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import '@ckeditor/ckeditor5-build-classic/build/translations/ru';
import { PhotoIcon, SparklesIcon } from '@heroicons/react/24/outline';

import { Button } from '@/components/ui/button';
import Modal from './Modal';
import { ensureWebpackNonce } from '../utils/ensureWebpackNonce';
import authFetch from '../utils/authFetch';
import { showToast } from '../utils/toast';

ensureWebpackNonce();

const INLINE_MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const ensureInlineFileUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (!trimmed.includes('/api/v1/files/')) {
    return trimmed;
  }
  if (/[?&]mode=inline(?:&|$)/.test(trimmed)) {
    return trimmed;
  }
  const hashIndex = trimmed.indexOf('#');
  const base = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : trimmed.slice(hashIndex);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}mode=inline${hash}`;
};

const normalizeSrcSet = (
  value: string | null | undefined,
): string | undefined => {
  if (!value) return undefined;
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [urlPart, ...rest] = entry.split(/\s+/);
      const normalizedUrl = ensureInlineFileUrl(urlPart) ?? urlPart;
      return rest.length ? `${normalizedUrl} ${rest.join(' ')}` : normalizedUrl;
    })
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries.join(', ') : undefined;
};

const sanitizeWithInlineMode = (value: string): string => {
  if (!value) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return DOMPurify.sanitize(value);
  }
  let fragment: DocumentFragment | null = null;
  try {
    const sanitized = DOMPurify.sanitize(value, {
      RETURN_DOM_FRAGMENT: true,
    }) as unknown;
    fragment =
      sanitized instanceof DocumentFragment
        ? sanitized
        : sanitized &&
            typeof (sanitized as { cloneNode?: unknown }).cloneNode ===
              'function'
          ? (sanitized as DocumentFragment)
          : null;
  } catch {
    fragment = null;
  }
  if (!fragment) {
    return DOMPurify.sanitize(value);
  }
  const images = fragment.querySelectorAll<HTMLImageElement>('img');
  images.forEach((img) => {
    const src = img.getAttribute('src');
    const normalizedSrc = ensureInlineFileUrl(src);
    if (normalizedSrc) {
      img.setAttribute('src', normalizedSrc);
    }
    const srcset = normalizeSrcSet(img.getAttribute('srcset'));
    if (srcset) {
      img.setAttribute('srcset', srcset);
    } else if (img.hasAttribute('srcset')) {
      img.removeAttribute('srcset');
    }
  });
  const sources = fragment.querySelectorAll<HTMLSourceElement>('source');
  sources.forEach((source) => {
    const srcset = normalizeSrcSet(source.getAttribute('srcset'));
    if (srcset) {
      source.setAttribute('srcset', srcset);
    }
    const src = ensureInlineFileUrl(source.getAttribute('src'));
    if (src) {
      source.setAttribute('src', src);
    }
  });
  const anchors = fragment.querySelectorAll<HTMLAnchorElement>('a[href]');
  anchors.forEach((anchor) => {
    const href = ensureInlineFileUrl(anchor.getAttribute('href'));
    if (href) {
      anchor.setAttribute('href', href);
    }
  });
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);
  return wrapper.innerHTML;
};

export function ensureInlineUploadFileName(file: File): string {
  const rawName = typeof file.name === 'string' ? file.name.trim() : '';
  const lowerName = rawName.toLowerCase();
  const hasExtension = /\.[0-9a-z_-]{1,16}$/.test(lowerName);
  if (hasExtension) {
    return rawName;
  }
  const normalizedType =
    typeof file.type === 'string' ? file.type.toLowerCase() : '';
  const extension = INLINE_MIME_EXTENSION_MAP[normalizedType] ?? '.png';
  const baseCandidate = rawName.replace(/\.[^./\\]+$/, '');
  const sanitizedBase = baseCandidate
    .replace(/[^0-9a-z_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = sanitizedBase || 'image';
  return `${base}${extension}`;
}

class InlineUploadAdapter {
  private loader: unknown;
  private controller = new AbortController();
  private onError?: (message: string) => void;
  private taskId?: string | null;

  constructor(
    loader: unknown,
    onError?: (message: string) => void,
    taskId?: string | null,
  ) {
    this.loader = loader;
    this.onError = onError;
    this.taskId = taskId;
  }

  async upload() {
    try {
      const file = await (this.loader as { file?: Promise<File> }).file;
      if (!file) {
        throw new Error('Файл не выбран');
      }
      const fd = new FormData();
      fd.append('upload', file, ensureInlineUploadFileName(file));
      if (this.taskId && typeof this.taskId === 'string') {
        const trimmed = this.taskId.trim();
        if (trimmed) {
          fd.append('taskId', trimmed);
        }
      }
      const response = await authFetch('/api/v1/tasks/upload-inline', {
        method: 'POST',
        body: fd,
        signal: this.controller.signal,
      });
      if (!response.ok) {
        let message = 'Не удалось загрузить файл';
        try {
          const data = (await response.clone().json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          try {
            const text = await response.text();
            if (text.trim()) message = text.trim();
          } catch {
            /* игнорируем */
          }
        }
        throw new Error(message);
      }
      const payload = (await response.json()) as { url?: string };
      if (!payload?.url) {
        throw new Error('Сервер не вернул ссылку на файл');
      }
      return { default: payload.url };
    } catch (error) {
      if (error instanceof Error) {
        this.onError?.(error.message);
      }
      throw error;
    }
  }

  abort() {
    this.controller.abort();
  }
}

const LazyCKEditor = React.lazy(async () => {
  const [{ CKEditor }, { default: ClassicEditor }] = await Promise.all([
    import('@ckeditor/ckeditor5-react'),
    import('@ckeditor/ckeditor5-build-classic'),
  ]);
  type Props = React.ComponentProps<typeof CKEditor>;
  return {
    default: (props: Props) => <CKEditor editor={ClassicEditor} {...props} />,
  };
});

interface Props {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  taskId?: string | null;
}

export default function CKEditorPopup({
  value,
  onChange,
  readOnly,
  taskId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const sanitizedPreview = useMemo(
    () => (value ? sanitizeWithInlineMode(value) : ''),
    [value],
  );
  const uploadAdapterPlugin = useMemo(
    () =>
      function InlineUploadPlugin(editor: unknown) {
        const fileRepository = (
          editor as {
            plugins: {
              get(name: string):
                | {
                    createUploadAdapter: (loader: unknown) => unknown;
                  }
                | undefined;
            };
          }
        ).plugins.get('FileRepository');
        if (fileRepository) {
          fileRepository.createUploadAdapter = (loader: unknown) =>
            new InlineUploadAdapter(
              loader,
              (message) => showToast(message, 'error'),
              taskId,
            );
        }
      },
    [taskId],
  );
  const editorConfig = useMemo(
    () => ({
      language: {
        ui: 'ru',
        content: 'ru',
      },
      toolbar: [
        'undo',
        'redo',
        '|',
        'heading',
        '|',
        'bold',
        'italic',
        'link',
        'bulletedList',
        'numberedList',
        '|',
        'blockQuote',
        'insertTable',
        'uploadImage',
        'mediaEmbed',
      ],
      image: {
        toolbar: [
          'imageStyle:inline',
          'imageStyle:block',
          'imageStyle:side',
          '|',
          'imageTextAlternative',
        ],
      },
      table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
      },
      placeholder:
        'Опишите задачу, добавьте изображения, ссылки или форматирование…',
      extraPlugins: [uploadAdapterPlugin],
      link: {
        decorators: {
          openInNewTab: {
            mode: 'manual',
            label: 'Открывать в новой вкладке',
            defaultValue: true,
            attributes: {
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
        },
      },
    }),
    [uploadAdapterPlugin],
  );

  React.useEffect(() => {
    if (!open) {
      setDraft(value);
    }
  }, [open, value]);

  const previewContent = sanitizedPreview ? (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
    />
  ) : (
    <p className="flex items-center gap-2 text-slate-400">
      <PhotoIcon className="h-5 w-5" /> Добавьте описание, изображения или
      форматированный текст
    </p>
  );

  const previewHeader = (
    <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span className="flex items-center gap-1 text-indigo-600">
        <SparklesIcon className="h-4 w-4" /> Расширенный редактор
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-medium text-indigo-700">
        <PhotoIcon className="h-3 w-3" /> Drag & Drop
      </span>
    </div>
  );

  if (readOnly) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {previewHeader}
        <div className="px-4 py-3 text-sm leading-relaxed text-slate-700">
          {previewContent}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Комментарий доступен только для чтения
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setDraft(value);
            setOpen(true);
          }
        }}
        className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring focus:ring-indigo-200"
      >
        {previewHeader}
        <div className="px-4 py-3 text-sm leading-relaxed text-slate-700">
          {previewContent}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <span className="hidden text-xs text-slate-500 sm:block">
            Поддерживает списки, таблицы, изображения и ссылки.
          </span>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            {value && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="gap-1"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange?.('');
                }}
              >
                Очистить
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="xs"
              onClick={() => {
                setDraft(value);
                setOpen(true);
              }}
            >
              Открыть редактор
            </Button>
          </div>
        </div>
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Редактирование текста
                </h3>
                <p className="text-xs text-slate-500">
                  Добавляйте изображения, таблицы, списки и ссылки — всё
                  сохраняется автоматически.
                </p>
              </div>
            </div>
            <React.Suspense
              fallback={
                <div className="flex h-64 items-center justify-center text-slate-500">
                  Загрузка редактора…
                </div>
              }
            >
              <LazyCKEditor
                data={draft}
                config={editorConfig}
                onReady={(editor) => {
                  const root = editor.editing.view.document.getRoot();
                  editor.editing.view.change((writer) => {
                    if (root) {
                      writer.setStyle('min-height', '320px', root);
                    }
                  });
                }}
                onChange={(_event, editor) => setDraft(editor.getData())}
              />
            </React.Suspense>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  onChange?.(draft);
                  setOpen(false);
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
