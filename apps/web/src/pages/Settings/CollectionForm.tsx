// Назначение: форма элемента коллекции с подтверждением действий
// Основные модули: React, ConfirmDialog
import React from 'react';

import { Button } from '@/components/ui/button';
import ConfirmDialog from '../../components/ConfirmDialog';

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
  valueLabel?: string;
  renderValueField?: (
    form: ItemForm,
    onChange: (form: ItemForm) => void,
    options?: { readonly?: boolean },
  ) => React.ReactNode;
  readonly?: boolean;
  readonlyNotice?: string;
}

export default function CollectionForm({
  form,
  onChange,
  onSubmit,
  onDelete,
  onReset,
  valueLabel = 'Значение',
  renderValueField,
  readonly = false,
  readonlyNotice,
}: Props) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmSave, setConfirmSave] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly) return;
    setConfirmSave(true);
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div>
        <label className="block text-sm font-medium">Имя</label>
        <input
          id="collection-form-name"
          name="collectionName"
          className="h-10 w-full rounded border px-3"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          required
          disabled={readonly}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">{valueLabel}</label>
        {renderValueField ? (
          renderValueField(form, readonly ? () => undefined : onChange, {
            readonly,
          })
        ) : (
          <input
            id="collection-form-value"
            name="collectionValue"
            className="h-10 w-full rounded border px-3"
            value={form.value}
            onChange={(e) => onChange({ ...form, value: e.target.value })}
            required
            disabled={readonly}
          />
        )}
      </div>
      {readonly ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
          {readonlyNotice ?? 'Элемент доступен только для чтения.'}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={readonly}>
          Сохранить
        </Button>
        {form._id ? (
          <Button
            type="button"
            variant="destructive"
            disabled={readonly}
            onClick={() => {
              if (readonly) return;
              setConfirmDelete(true);
            }}
          >
            Удалить
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={readonly}
          >
            Очистить
          </Button>
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
