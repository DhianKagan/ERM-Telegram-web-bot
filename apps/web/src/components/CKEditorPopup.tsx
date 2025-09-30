// Поле редактирования текста в модальном окне CKEditor 5
// Модули: React, CKEditor 5, DOMPurify, Modal
import React, { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import Modal from "./Modal";
import { ensureWebpackNonce } from "../utils/ensureWebpackNonce";
import authFetch from "../utils/authFetch";
import { showToast } from "../utils/toast";
import { PhotoIcon, SparklesIcon } from "@heroicons/react/24/outline";
import "@ckeditor/ckeditor5-build-classic/build/translations/ru";

ensureWebpackNonce();

class InlineUploadAdapter {
  private loader: unknown;
  private controller = new AbortController();
  private onError?: (message: string) => void;

  constructor(loader: unknown, onError?: (message: string) => void) {
    this.loader = loader;
    this.onError = onError;
  }

  async upload() {
    try {
      const file = await (this.loader as { file?: Promise<File> }).file;
      if (!file) {
        throw new Error("Файл не выбран");
      }
      const fd = new FormData();
      fd.append("upload", file);
      const response = await authFetch("/api/v1/tasks/upload-inline", {
        method: "POST",
        body: fd,
        signal: this.controller.signal,
      });
      if (!response.ok) {
        let message = "Не удалось загрузить файл";
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
        throw new Error("Сервер не вернул ссылку на файл");
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
    import("@ckeditor/ckeditor5-react"),
    import("@ckeditor/ckeditor5-build-classic"),
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
}

export default function CKEditorPopup({ value, onChange, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const sanitizedPreview = useMemo(
    () => (value ? DOMPurify.sanitize(value) : ""),
    [value],
  );
  const uploadAdapterPlugin = useMemo(
    () =>
      function InlineUploadPlugin(editor: unknown) {
        const fileRepository = (editor as {
          plugins: {
            get(name: string):
              | {
                  createUploadAdapter: (loader: unknown) => unknown;
                }
              | undefined;
          };
        }).plugins.get("FileRepository");
        if (fileRepository) {
          fileRepository.createUploadAdapter = (loader: unknown) =>
            new InlineUploadAdapter(loader, (message) =>
              showToast(message, "error"),
            );
        }
      },
    [],
  );
  const editorConfig = useMemo(
    () => ({
      language: {
        ui: "ru",
        content: "ru",
      },
      toolbar: [
        "undo",
        "redo",
        "|",
        "heading",
        "|",
        "bold",
        "italic",
        "link",
        "bulletedList",
        "numberedList",
        "|",
        "blockQuote",
        "insertTable",
        "uploadImage",
        "mediaEmbed",
        "removeFormat",
      ],
      image: {
        toolbar: [
          "imageStyle:inline",
          "imageStyle:block",
          "imageStyle:side",
          "|",
          "imageTextAlternative",
        ],
      },
      table: {
        contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
      },
      placeholder:
        "Опишите задачу, добавьте изображения, ссылки или форматирование…",
      extraPlugins: [uploadAdapterPlugin],
      link: {
        decorators: {
          openInNewTab: {
            mode: "manual",
            label: "Открывать в новой вкладке",
            defaultValue: true,
            attributes: {
              target: "_blank",
              rel: "noopener noreferrer",
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

  if (readOnly) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div
          className="ql-snow"
          dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
        />
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
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setDraft(value);
            setOpen(true);
          }
        }}
        className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring focus:ring-indigo-200"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="flex items-center gap-1 text-indigo-600">
            <SparklesIcon className="h-4 w-4" /> Расширенный редактор
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-medium text-indigo-700">
            <PhotoIcon className="h-3 w-3" /> Drag & Drop
          </span>
        </div>
        <div className="max-h-48 overflow-auto px-4 py-3 text-sm leading-relaxed text-slate-700">
          {sanitizedPreview ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
            />
          ) : (
            <p className="flex items-center gap-2 text-slate-400">
              <PhotoIcon className="h-5 w-5" /> Добавьте описание, изображения или
              форматированный текст
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-500">
            Поддерживает списки, таблицы, изображения и ссылки.
          </span>
          <div className="flex gap-2">
            {value && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring focus:ring-slate-200"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange?.("");
                }}
              >
                Очистить
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring focus:ring-indigo-300"
              onClick={() => {
                setDraft(value);
                setOpen(true);
              }}
            >
              Открыть редактор
            </button>
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
                      writer.setStyle("min-height", "320px", root);
                    }
                  });
                }}
                onChange={(_event, editor) => setDraft(editor.getData())}
              />
            </React.Suspense>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Перетащите изображение в редактор или вставьте его из буфера
                обмена.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring focus:ring-slate-200"
                  onClick={() => setOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring focus:ring-indigo-300"
                  onClick={() => {
                    onChange?.(draft);
                    setOpen(false);
                  }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
