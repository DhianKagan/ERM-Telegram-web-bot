// Назначение: форма элемента коллекции с подтверждением действий
// Основные модули: React, ConfirmDialog
import React from 'react';

import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '../../components/ConfirmDialog';

export interface CollectionFormState {
  _id?: string;
  name: string;
  value: string;
  meta?: Record<string, unknown>;
  address?: string;
  latitude?: string;
  longitude?: string;
}

interface Props {
  form: CollectionFormState;
  onChange: (form: CollectionFormState) => void;
  onSubmit: () => void;
  onDelete: () => void;
  onReset: () => void;
  valueLabel?: string;
  renderValueField?: (
    form: CollectionFormState,
    onChange: (form: CollectionFormState) => void,
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
    <Card className="bg-background" bodyClassName="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          Основные параметры
        </h3>
        {form._id ? (
          <Badge
            variant="pill"
            size="sm"
            className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            ID {form._id}
          </Badge>
        ) : null}
      </div>
      <form
        onSubmit={submit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FormGroup
          className="sm:col-span-2 lg:col-span-1"
          label="Имя"
          htmlFor="collection-form-name"
        >
          <Input
            id="collection-form-name"
            name="collectionName"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            required
            disabled={readonly}
          />
        </FormGroup>
        <FormGroup
          className="sm:col-span-2 lg:col-span-2"
          label={valueLabel}
          htmlFor="collection-form-value"
        >
          {renderValueField ? (
            renderValueField(form, readonly ? () => undefined : onChange, {
              readonly,
            })
          ) : (
            <Input
              id="collection-form-value"
              name="collectionValue"
              value={form.value}
              onChange={(e) => onChange({ ...form, value: e.target.value })}
              required
              disabled={readonly}
            />
          )}
        </FormGroup>
        {readonly ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
              <div className="font-semibold">Режим только для чтения</div>
              <div className="mt-1">
                {readonlyNotice ?? 'Элемент доступен только для чтения.'}
              </div>
            </div>
          </div>
        ) : null}
        <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
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
      </form>
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
    </Card>
  );
}
