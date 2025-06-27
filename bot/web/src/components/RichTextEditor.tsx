// Простое поле редактирования с меню форматирования
import React from "react";

interface RichTextEditorProps {
  value: string
  onChange?: (val: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (command) => document.execCommand(command, false);

  const handleInput = () => {
    if (onChange) onChange(editorRef.current.innerHTML);
  };

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <button type="button" className="btn-gray" onClick={() => exec("bold")}>
          B
        </button>
        <button
          type="button"
          className="btn-gray"
          onClick={() => exec("italic")}
        >
          I
        </button>
        <button
          type="button"
          className="btn-gray"
          onClick={() => exec("underline")}
        >
          U
        </button>
        <select
          onChange={(e) => exec("fontSize", e.target.value)}
          className="rounded border px-1"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <option key={s} value={s}>
              A{s}
            </option>
          ))}
        </select>
        <select
          onChange={(e) => exec("fontName", e.target.value)}
          className="rounded border px-1"
        >
          {["Arial", "Times New Roman", "Courier New"].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={editorRef}
        onInput={handleInput}
        contentEditable
        className="min-h-[80px] rounded border p-2 focus:outline-none"
      />
    </div>
  );
}
