// Компонент выбора точки на карте Google
import React from "react";
import parseGoogleAddress from "../utils/parseGoogleAddress";
import { validateURL } from "../utils/validation";
import extractCoords from "../utils/extractCoords";

interface MapSelectorProps {
  onSelect?: (res: { link: string; address: string; coords: { lat: number; lng: number } | null }) => void
  onClose?: () => void
}

export default function MapSelector({ onSelect, onClose }: MapSelectorProps) {
  const [link, setLink] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = () => {
    const sanitized = validateURL(link);
    if (!sanitized) {
      setError("Некорректная ссылка");
      return;
    }
    const address = parseGoogleAddress(sanitized);
    const coords = extractCoords(sanitized);
    if (onSelect) onSelect({ link: sanitized, address, coords });
    if (onClose) onClose();
  };

  return (
    <div className="bg-opacity-30 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-xl space-y-2 rounded-xl bg-white p-4 shadow-lg">
        <iframe
          src="https://www.google.com/maps?q=%D0%9E%D0%B4%D0%B5%D1%81%D1%81%D0%B0&hl=ru&output=embed"
          className="h-64 w-full rounded"
          allowFullScreen
        ></iframe>
        <p className="text-sm text-gray-600">
          После выбора места нажмите в Google Maps «Поделиться» и скопируйте
          ссылку
        </p>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder='Вставьте ссылку "Поделиться"'
          className="w-full rounded border px-2 py-1"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end space-x-2">
          <button className="btn-gray" onClick={onClose}>
            Отмена
          </button>
          <button className="btn-blue" onClick={submit}>
            Вставить
          </button>
        </div>
      </div>
    </div>
  );
}
