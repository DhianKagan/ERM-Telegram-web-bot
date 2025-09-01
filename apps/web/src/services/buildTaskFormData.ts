// Назначение: создание FormData для задач
// Основные модули: FormSchema, shared
import { taskFormSchema as formSchemaJson } from "shared";
import type { FormSchema } from "../../../api/src/form";

const formSchema = formSchemaJson as FormSchema;

export const buildTaskFormData = (
  data: Record<string, unknown>,
  files?: FileList | File[],
): FormData => {
  const body = new FormData();
  body.append("formVersion", String(formSchema.formVersion));
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      v.forEach((val) => body.append(k, String(val)));
    } else if (typeof v === "object") {
      body.append(k, JSON.stringify(v));
    } else {
      body.append(k, String(v));
    }
  });
  if (files) Array.from(files).forEach((f) => body.append("files", f));
  return body;
};
