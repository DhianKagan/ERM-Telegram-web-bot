// Компонент загрузки файлов с drag-and-drop и прогрессом
// Основные модули: React, authFetch, типы задач
import React from "react";
import authFetch from "../utils/authFetch";
import type { Attachment } from "../types/task";

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

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
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
          setItems((prev) =>
            prev.map((f) =>
              f === it ? { ...f, attachment: att, progress: 100 } : f,
            ),
          );
          onUploaded(att);
        })
        .catch(() => {
          setItems((prev) => prev.filter((f) => f !== it));
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
      if (!res.ok) throw new Error("upload failed");
      if (i === total - 1) attachment = (await res.json()) as Attachment;
      onProgress(Math.round(((i + 1) / total) * 100));
    }
    return attachment!;
  };

  const removeItem = (it: UploadItem) => {
    setItems((prev) => prev.filter((f) => f !== it));
    if (it.attachment) onRemove(it.attachment);
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`mt-2 flex flex-col items-center justify-center rounded border-2 border-dashed p-4 text-sm ${disabled ? "opacity-50" : ""}`}
      >
        <p>Перетащите файлы сюда или выберите</p>
        <input
          type="file"
          multiple
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              {it.isImage && (
                <img
                  src={it.url}
                  alt={it.name}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm">
                  {it.name} ({(it.size / 1024 / 1024).toFixed(1)} МБ)
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
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
