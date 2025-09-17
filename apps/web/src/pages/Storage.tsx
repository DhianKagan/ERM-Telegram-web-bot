// Страница управления файлами на Chonky
// Основные модули: React, Chonky, heroicons, i18next, Modal, Breadcrumbs
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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { fetchFiles } from "../services/storage";
import authFetch from "../utils/authFetch";
import { showToast } from "../utils/toast";
import { useTranslation } from "react-i18next";
import {
  ArrowDownTrayIcon,
  DocumentIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface StoredFile {
  path: string;
  userId: number;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  previewUrl: string;
}

interface FsEntry extends FileData {
  url?: string;
  type?: string;
  parentId?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  icon?: string;
  description?: string;
}

type PreviewMode = "image" | "video" | "pdf" | "text";

const previewIcons: Record<PreviewMode, React.ComponentType<{ className?: string }>> = {
  image: PhotoIcon,
  video: VideoCameraIcon,
  pdf: DocumentIcon,
  text: DocumentTextIcon,
};

function resolveFileIcon(mime?: string): string | undefined {
  if (!mime) return undefined;
  if (mime.startsWith("image/")) return "file-image";
  if (mime.startsWith("video/")) return "file-video";
  if (mime === "application/pdf") return "file-pdf";
  if (mime.startsWith("text/")) return "file-text";
  if (mime.includes("json")) return "file-code";
  return "file";
}

function isTextLike(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.endsWith("xml") ||
    mime === "application/sql"
  );
}

export default function StoragePage() {
  const { t } = useTranslation();
  const [fileMap, setFileMap] = React.useState<Record<string, FsEntry>>({
    root: { id: "root", name: "Корень", isDir: true },
  });
  const [currentFolderId, setCurrentFolderId] = React.useState("root");
  const [search, setSearch] = React.useState("");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [preview, setPreview] = React.useState<{
    url: string;
    inlineUrl: string;
    thumbnailUrl?: string;
    mime: string;
    name: string;
    mode: PreviewMode;
    content?: string;
    loading?: boolean;
    error?: string;
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
          previewUrl: f.previewUrl,
          icon: resolveFileIcon(f.type),
          description: f.type,
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

  const openFile = React.useCallback(
    (file: FsEntry) => {
      if (file.isDir) {
        setCurrentFolderId(file.id);
        return;
      }
      if (!file.url) return;
      const mime = file.type ?? "application/octet-stream";
      const inlineUrl = file.previewUrl ?? `${file.url}?mode=inline`;
      if (mime.startsWith("image/")) {
        setPreview({
          url: file.url,
          inlineUrl,
          thumbnailUrl: file.thumbnailUrl,
          mime,
          name: file.name,
          mode: "image",
        });
        return;
      }
      if (mime.startsWith("video/")) {
        setPreview({
          url: file.url,
          inlineUrl,
          mime,
          name: file.name,
          mode: "video",
        });
        return;
      }
      if (mime === "application/pdf") {
        setPreview({
          url: file.url,
          inlineUrl,
          mime,
          name: file.name,
          mode: "pdf",
        });
        return;
      }
      if (isTextLike(mime)) {
        const base = {
          url: file.url,
          inlineUrl,
          mime,
          name: file.name,
          mode: "text" as const,
        };
        setPreview({ ...base, loading: true });
        authFetch(inlineUrl)
          .then((res) => {
            if (!res.ok) throw new Error("preview");
            return res.text();
          })
          .then((content) => {
            setPreview((current) =>
              current && current.name === file.name
                ? { ...current, content, loading: false, error: undefined }
                : current,
            );
          })
          .catch(() => {
            setPreview((current) =>
              current && current.name === file.name
                ? {
                    ...current,
                    loading: false,
                    error: t("storage.previewError"),
                  }
                : current,
            );
          });
        return;
      }
      window.open(file.url, "_blank", "noopener,noreferrer");
      showToast(t("storage.openedInNewTab"), "success");
    },
    [t],
  );

  const downloadFile = React.useCallback(
    (file: FsEntry) => {
      if (!file.url) return;
      window.open(file.url, "_blank", "noopener,noreferrer");
      showToast(t("storage.openedInNewTab"), "success");
    },
    [t],
  );

  const handleAction = React.useCallback(
    (data: FileActionData<FsEntry>) => {
      if (!data || !data.payload) return;
      const file = data.payload.targetFile as FsEntry | undefined;
      if (!file) return;
      if (data.id === ChonkyActions.OpenFiles.id) {
        openFile(file);
        return;
      }
      if (data.id === ChonkyActions.DownloadFiles.id) {
        downloadFile(file);
      }
    },
    [downloadFile, openFile],
  );

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: t("storage.title") }]} />
      <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900 shadow-xs dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
        <div className="flex items-center gap-2 font-medium">
          <InformationCircleIcon className="size-5" aria-hidden />
          <span>{t("storage.previewTitle")}</span>
        </div>
        <p className="text-sm leading-relaxed text-blue-900/90 dark:text-blue-50/80">
          {t("storage.previewHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "image", label: t("storage.typeImage"), icon: PhotoIcon },
            { key: "video", label: t("storage.typeVideo"), icon: VideoCameraIcon },
            { key: "pdf", label: t("storage.typePdf"), icon: DocumentIcon },
            { key: "text", label: t("storage.typeText"), icon: DocumentTextIcon },
          ] as Array<{
            key: PreviewMode;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }>).map(({ key, label, icon: Icon }) => (
            <span
              key={key}
              className="flex items-center gap-1.5 rounded-md bg-white/60 px-2.5 py-1 text-xs font-medium text-blue-900 ring-1 ring-blue-200 dark:bg-slate-900/60 dark:text-blue-100 dark:ring-blue-500/40"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-800/80 dark:text-blue-200/60">
          {t("storage.previewLimitation")}
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("storage.searchPlaceholder")}
          data-testid="storage-search"
        />
        <select
          value={sortAsc ? "asc" : "desc"}
          onChange={(e) => setSortAsc(e.target.value === "asc")}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-4 py-2 text-sm"
          aria-label={t("storage.sortLabel")}
        >
          <option value="asc">{t("storage.sortAsc")}</option>
          <option value="desc">{t("storage.sortDesc")}</option>
        </select>
      </div>
      <FileBrowser
        files={files}
        folderChain={folderChain}
        fileActions={[ChonkyActions.OpenFiles, ChonkyActions.DownloadFiles]}
        onFileAction={handleAction}
      >
        <FileNavbar />
        <FileToolbar />
        <FileList />
      </FileBrowser>
      <Modal open={!!preview} onClose={() => setPreview(null)}>
        {preview && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {React.createElement(previewIcons[preview.mode], {
                  className: "size-5 text-muted-foreground",
                  "aria-hidden": true,
                })}
                <div>
                  <p className="text-lg font-semibold">{preview.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("storage.mimeLabel", { mime: preview.mime })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}
                  title={t("storage.downloadHint")}
                >
                  <ArrowDownTrayIcon className="size-4" aria-hidden />
                  {t("storage.download")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreview(null)}
                  aria-label={t("close")}
                >
                  <XMarkIcon className="size-5" aria-hidden />
                </Button>
              </div>
            </div>
            {preview.mode === "image" && (
              <img
                srcSet={`${preview.thumbnailUrl || preview.inlineUrl} 1x, ${preview.inlineUrl} 2x`}
                sizes="(max-width: 800px) 100vw, 800px"
                src={preview.thumbnailUrl || preview.inlineUrl}
                alt=""
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            )}
            {preview.mode === "video" && (
              <video
                src={preview.inlineUrl}
                controls
                className="max-h-[70vh] w-full rounded-lg bg-black"
              />
            )}
            {preview.mode === "pdf" && (
              <iframe
                src={preview.inlineUrl}
                title={t("storage.previewTitle") ?? "PDF"}
                className="max-h-[70vh] w-full rounded-lg border"
              />
            )}
            {preview.mode === "text" && (
              <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
                {preview.loading && (
                  <p className="text-muted-foreground">{t("storage.previewLoading")}</p>
                )}
                {preview.error && !preview.loading && (
                  <p className="text-destructive">{preview.error}</p>
                )}
                {!preview.loading && !preview.error && (
                  <pre className="whitespace-pre-wrap break-words text-left text-muted-foreground">
                    {preview.content}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
