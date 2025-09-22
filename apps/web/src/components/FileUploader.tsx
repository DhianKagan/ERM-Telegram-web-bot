// Компонент загрузки файлов с drag-and-drop и прогрессом
// Основные модули: React, authFetch, типы задач
import React from "react";
import { useTranslation } from "react-i18next";
import authFetch from "../utils/authFetch";
import { showToast } from "../utils/toast";
import type { Attachment } from "../types/task";

const ACCEPTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".heic",
  ".heif",
  ".pdf",
  ".doc",
  ".docx",
  ".docm",
  ".dotx",
  ".dotm",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".xlsb",
  ".xltm",
  ".xltx",
  ".xlam",
  ".ppt",
  ".pptx",
  ".pptm",
  ".potx",
  ".potm",
  ".ppsx",
  ".ppsm",
  ".txt",
  ".csv",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
  ".rar",
  ".7z",
  ".mp4",
  ".mov",
  ".mkv",
]);

const ACCEPT_ATTR = [
  "image/*",
  "video/*",
  ...Array.from(ACCEPTED_EXTENSIONS),
];

const cleanupUrl = (url: string) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
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
}

export default function FileUploader({
  disabled,
  onUploaded,
  onRemove,
}: Props) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const { t } = useTranslation();

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const dotIndex = file.name.lastIndexOf(".");
      const ext = dotIndex === -1 ? "" : file.name.slice(dotIndex).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.has(ext)) {
        showToast(t("invalidFileType"), "error");
        return;
      }
      const it: UploadItem = {
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        isImage: file.type.startsWith("image/"),
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
              return {
                ...f,
                attachment: att,
                progress: 100,
                url: att.thumbnailUrl || att.url || f.url,
                isImage: att.type.startsWith("image/"),
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
              : t("uploadFailed");
          showToast(message, "error");
          cleanupUrl(it.url);
        });
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
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
      fd.append("fileId", id);
      fd.append("chunkIndex", String(i));
      fd.append("totalChunks", String(total));
      fd.append("file", chunk, file.name);
      const res = await authFetch("/api/v1/tasks/upload-chunk", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const copy = res.clone();
        let message = t("uploadFailed");
        try {
          const data = (await copy.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error.trim()) {
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
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`mt-2 flex flex-col items-center justify-center rounded border-2 border-dashed p-4 text-sm ${disabled ? "opacity-50" : ""}`}
      >
        <p>{t("dragFilesOrSelect")}</p>
        <input
          type="file"
          multiple
          onChange={handleChange}
          disabled={disabled}
          accept={ACCEPT_ATTR.join(",")}
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              {it.isImage && (
                <img
                  srcSet={`${it.attachment?.thumbnailUrl || it.url} 1x, ${it.attachment?.url || it.url} 2x`}
                  sizes="48px"
                  src={it.attachment?.thumbnailUrl || it.url}
                  alt={it.name}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm">
                  {it.name} ({(it.size / 1024 / 1024).toFixed(1)} {t("mb")})
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
                {t("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
