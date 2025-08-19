// Страница управления файлами
import React from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import { fetchFiles, removeFile } from "../services/storage";

interface FileItem {
  name: string;
  size: number;
  url: string;
}

export default function StoragePage() {
  const [files, setFiles] = React.useState<FileItem[]>([]);

  const load = React.useCallback(() => {
    fetchFiles().then(setFiles);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const del = React.useCallback(
    (name: string) => {
      removeFile(name).then(load);
    },
    [load],
  );

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Файлы" }]} />
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.name} className="flex items-center justify-between">
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accentPrimary underline"
            >
              {f.name}
            </a>
            <button
              onClick={() => del(f.name)}
              className="btn-blue rounded px-2"
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
