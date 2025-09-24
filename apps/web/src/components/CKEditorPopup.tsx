// Поле редактирования текста в модальном окне CKEditor 5
// Модули: React, CKEditor 5, DOMPurify, Modal
import React, { useState } from "react";
import DOMPurify from "dompurify";
import Modal from "./Modal";
import { ensureWebpackNonce } from "../utils/ensureWebpackNonce";

ensureWebpackNonce();

const LazyCKEditor = React.lazy(async () => {
  const [{ CKEditor }, { default: ClassicEditor }] = await Promise.all([
    import("@ckeditor/ckeditor5-react"),
    import("@ckeditor/ckeditor5-build-classic"),
  ]);
  type Props = React.ComponentProps<typeof CKEditor>;
  return {
    default: (props: Props) => <CKEditor editor={ClassicEditor} {...props} />,
  };
});

interface Props {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
}

export default function CKEditorPopup({ value, onChange, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  if (readOnly) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div
          className="ql-snow"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="min-h-[4rem] w-full cursor-text rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed transition-colors hover:bg-slate-100 focus-within:ring focus-within:ring-brand-200"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        dangerouslySetInnerHTML={{
          __html: value
            ? DOMPurify.sanitize(value)
            : "<p class='text-gray-500'>Нажмите для редактирования</p>",
        }}
      />
      {open && (
        // Модальное окно рендерится только при открытии, что откладывает загрузку CKEditor
        <Modal open onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <React.Suspense fallback={<div>Загрузка...</div>}>
              <LazyCKEditor
                data={draft}
                onChange={(_e, editor) => setDraft(editor.getData())}
              />
            </React.Suspense>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-slate-200 px-4 py-2"
                onClick={() => setOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded bg-indigo-600 px-4 py-2 text-white"
                onClick={() => {
                  onChange?.(draft);
                  setOpen(false);
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
