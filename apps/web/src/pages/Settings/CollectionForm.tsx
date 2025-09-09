// Назначение: форма элемента коллекции с подтверждением удаления
// Основные модули: React, ConfirmDialog
import React from "react";
import ConfirmDialog from "../../components/ConfirmDialog";

interface ItemForm {
  _id?: string;
  name: string;
  value: string;
}

interface Props {
  form: ItemForm;
  onChange: (form: ItemForm) => void;
  onSubmit: () => void;
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
  const [confirm, setConfirm] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="space-y-2">
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
            onClick={() => setConfirm(true)}
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
      <ConfirmDialog
        open={confirm}
        message="Удалить элемент?"
        onConfirm={() => {
          setConfirm(false);
          onDelete();
        }}
        onCancel={() => setConfirm(false)}
      />
    </form>
  );
}
