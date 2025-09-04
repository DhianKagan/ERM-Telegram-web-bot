// Страница управления файлами на Chonky
// Основные модули: React, Chonky, Modal, Breadcrumbs
import React from "react";
import {
  FileBrowser,
  FileNavbar,
  FileToolbar,
  FileList,
  ChonkyActions,
  type FileActionData,
  type FileArray,
  type FileData,
} from "chonky";
// Стили Chonky включены в пакет, отдельный CSS не подключается.

import Breadcrumbs from "../components/Breadcrumbs";
import Modal from "../components/Modal";
import { Input } from "../components/ui/input";
import { fetchFiles } from "../services/storage";

interface StoredFile {
  path: string;
  userId: number;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
}

interface FsEntry extends FileData {
  url?: string;
  type?: string;
  parentId?: string;
  thumbnailUrl?: string;
}

export default function StoragePage() {
  const [fileMap, setFileMap] = React.useState<Record<string, FsEntry>>({
    root: { id: "root", name: "Корень", isDir: true },
  });
  const [currentFolderId, setCurrentFolderId] = React.useState("root");
  const [search, setSearch] = React.useState("");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [preview, setPreview] = React.useState<{
    url: string;
    thumbnailUrl?: string;
    type: "image" | "video";
  } | null>(null);

  React.useEffect(() => {
    fetchFiles().then((list: StoredFile[]) => {
      const map: Record<string, FsEntry> = {
        root: { id: "root", name: "Корень", isDir: true },
      };
      list.forEach((f) => {
        const folderId = `user-${f.userId}`;
        if (!map[folderId]) {
          map[folderId] = {
            id: folderId,
            name: `Пользователь ${f.userId}`,
            isDir: true,
            parentId: "root",
          };
        }
        map[f.path] = {
          id: f.path,
          name: f.name,
          parentId: folderId,
          url: f.url,
          type: f.type,
          thumbnailUrl: f.thumbnailUrl,
        };
      });
      setFileMap(map);
    });
  }, []);

  const files = React.useMemo<FileArray>(() => {
    const children = Object.values(fileMap).filter(
      (f) => f.parentId === currentFolderId,
    );
    const filtered = children.filter((f) =>
      f.name.toLowerCase().includes(search.toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
    return sorted;
  }, [fileMap, currentFolderId, search, sortAsc]);

  const folderChain = React.useMemo<FileArray>(() => {
    const chain: FsEntry[] = [];
    let id: string | undefined = currentFolderId;
    while (id) {
      const item = fileMap[id];
      if (item) chain.unshift(item);
      id = item?.parentId;
    }
    return chain;
  }, [fileMap, currentFolderId]);

  const openFile = React.useCallback((file: FsEntry) => {
    if (file.isDir) {
      setCurrentFolderId(file.id);
      return;
    }
    if (!file.url || !file.type) return;
    if (file.type.startsWith("image/")) {
      setPreview({ url: file.url, thumbnailUrl: file.thumbnailUrl, type: "image" });
    } else if (file.type.startsWith("video/")) {
      setPreview({ url: file.url, type: "video" });
    } else {
      const viewer = `https://docs.google.com/gview?url=${encodeURIComponent(
        file.url,
      )}&embedded=1`;
      window.open(viewer, "_blank", "noopener");
    }
  }, []);

  const handleAction = React.useCallback(
    (data: FileActionData<FsEntry>) => {
      if (data.id !== ChonkyActions.OpenFiles.id) return;
      const file = data.payload.targetFile as FsEntry | undefined;
      if (file) openFile(file);
    },
    [openFile],
  );

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Файлы" }]} />
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск..."
        />
        <select
          value={sortAsc ? "asc" : "desc"}
          onChange={(e) => setSortAsc(e.target.value === "asc")}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-4 py-2 text-sm"
        >
          <option value="asc">Имя ↑</option>
          <option value="desc">Имя ↓</option>
        </select>
      </div>
      <FileBrowser
        files={files}
        folderChain={folderChain}
        onFileAction={handleAction}
      >
        <FileNavbar />
        <FileToolbar />
        <FileList />
      </FileBrowser>
      <Modal open={!!preview} onClose={() => setPreview(null)}>
        {preview?.type === "image" && (
          <img
            srcSet={`${(preview.thumbnailUrl || preview.url)} 1x, ${preview.url} 2x`}
            sizes="(max-width: 800px) 100vw, 800px"
            src={preview.thumbnailUrl || preview.url}
            alt=""
            className="max-h-[80vh]"
          />
        )}
        {preview?.type === "video" && (
          <video src={preview.url} controls className="max-h-[80vh]" />
        )}
      </Modal>
    </div>
  );
}
