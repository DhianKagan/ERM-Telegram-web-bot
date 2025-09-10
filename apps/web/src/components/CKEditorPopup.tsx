// Поле редактирования текста в модальном окне CKEditor 5
// Модули: React, CKEditor 5, DOMPurify, Modal
// DOMPurify очищает HTML, исключая скрипты и вызовы new Function
import React, { useState } from "react";
import DOMPurify from "dompurify";
import Modal from "./Modal";

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
      <div
        className="ck-content"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
      />
    );
  }

  return (
    <>
      <div
        className="min-h-[4rem] w-full cursor-text rounded border px-2 py-1"
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
