// Поле редактирования текста на базе React Quill
import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string
  onChange?: (val: string) => void
  readOnly?: boolean
}

export default function RichTextEditor({ value, onChange, readOnly }: RichTextEditorProps) {
  if (readOnly) {
    return (
      <div className="ql-snow">
        <div className="ql-editor" dangerouslySetInnerHTML={{ __html: value }} />
      </div>
    );
  }
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={(val) => onChange && onChange(val)}
      className="bg-white"
    />
  );
}
