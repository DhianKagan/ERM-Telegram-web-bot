// Поле редактирования текста на базе React Quill
import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string
  onChange?: (val: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={(val) => onChange && onChange(val)}
      className="bg-white"
    />
  );
}
