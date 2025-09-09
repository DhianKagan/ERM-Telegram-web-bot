// Форма редактирования элементов коллекций
// Основные модули: React
import React from "react";

interface ItemForm {
  _id?: string;
  name: string;
  value: string;
}

interface Props {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  onReset: () => void;
}

export default function CollectionForm({
  form,
  onChange,
  onSubmit,
  onDelete,
  onReset,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div>
        <label className="block text-sm font-medium">Имя</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Значение</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.value}
          onChange={(e) => onChange({ ...form, value: e.target.value })}
          required
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-blue rounded">
          Сохранить
        </button>
        {form._id ? (
          <button
            type="button"
            className="btn btn-red rounded"
            onClick={onDelete}
          >
            Удалить
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-gray rounded"
            onClick={onReset}
          >
            Очистить
          </button>
        )}
      </div>
    </form>
  );
}
