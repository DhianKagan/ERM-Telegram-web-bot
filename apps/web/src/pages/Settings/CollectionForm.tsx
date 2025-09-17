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
  valueLabel?: string;
  renderValueField?: (
    form: ItemForm,
    onChange: (form: ItemForm) => void,
  ) => React.ReactNode;
}

export default function CollectionForm({
  form,
  onChange,
  onSubmit,
  onDelete,
  onReset,
  valueLabel = "Значение",
  renderValueField,
}: Props) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const isTokenField = !renderValueField && valueLabel === "Token";
  const [showToken, setShowToken] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const canCopy = React.useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.clipboard),
    [],
  );

  React.useEffect(() => {
    if (!isTokenField) return;
    setCopied(false);
  }, [form.value, isTokenField]);

  const handleCopy = async () => {
    if (!isTokenField || !canCopy || !form.value) return;
    try {
      await navigator.clipboard.writeText(form.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

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
        <label className="block text-sm font-medium">{valueLabel}</label>
        {renderValueField ? (
          renderValueField(form, onChange)
        ) : isTokenField ? (
          <>
            <div className="flex gap-2">
              <input
                className="h-10 w-full rounded border px-3"
                type={showToken ? "text" : "password"}
                value={form.value}
                onChange={(e) => onChange({ ...form, value: e.target.value })}
                required
              />
              <button
                type="button"
                className="h-10 rounded border px-3"
                onClick={() => setShowToken((prev) => !prev)}
              >
                {showToken ? "Скрыть" : "Показать"}
              </button>
              <button
                type="button"
                className="h-10 rounded border px-3"
                onClick={handleCopy}
                disabled={!canCopy || !form.value}
              >
                Копировать
              </button>
            </div>
            {copied && (
              <span className="text-xs text-green-600">Токен скопирован</span>
            )}
          </>
        ) : (
          <input
            className="h-10 w-full rounded border px-3"
            value={form.value}
            onChange={(e) => onChange({ ...form, value: e.target.value })}
            required
          />
        )}
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
