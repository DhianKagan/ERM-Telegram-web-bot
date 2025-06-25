// Компонент выбора точки на карте Google
import React from "react";
import parseGoogleAddress from "../utils/parseGoogleAddress";
import { validateURL } from "../utils/validation";

export default function MapSelector({ onSelect, onClose }) {
  const [link, setLink] = React.useState("");

  const submit = () => {
    if (!link) return;
    const address = parseGoogleAddress(link);
    if (onSelect) onSelect({ link, address });
    if (onClose) onClose();
  };

  return (
    <div className="bg-opacity-30 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-xl space-y-2 rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800">
        <iframe
          src="https://www.google.com/maps"
          className="h-64 w-full rounded"
          allowFullScreen
        ></iframe>
        <input
          value={link}
          onChange={(e) => {
            const sanitizedLink = validateURL(e.target.value);
            setLink(sanitizedLink);
          }}
          placeholder='Вставьте ссылку "Поделиться"'
          className="w-full rounded border px-2 py-1"
        />
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
