// Назначение: форма элемента коллекции с подтверждением действий
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
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmSave, setConfirmSave] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmSave(true);
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
            onClick={() => setConfirmDelete(true)}
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
        open={confirmSave}
        message="Сохранить изменения?"
        onConfirm={() => {
          setConfirmSave(false);
          onSubmit();
        }}
        onCancel={() => setConfirmSave(false)}
        confirmText="Сохранить"
      />
      <ConfirmDialog
        open={confirmDelete}
        message="Удалить элемент?"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
