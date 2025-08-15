// Поле редактирования текста в модальном окне CKEditor 5
// Модули: React, CKEditor 5, DOMPurify, Modal
import React, { useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import DOMPurify from "dompurify";
import Modal from "./Modal";

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
        className="ql-snow"
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
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <CKEditor
            editor={ClassicEditor}
            data={draft}
            onChange={(_e, editor) => setDraft(editor.getData())}
          />
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
    </>
  );
}
