// Назначение файла: тесты функции buildTaskFormData.
// Основные модули: buildTaskFormData, FormData, Jest.
import { buildTaskFormData } from "./buildTaskFormData";

describe("buildTaskFormData", () => {
  it("корректно сериализует массив вложений в JSON", () => {
    const attachments = [
      {
        name: "Отчёт",
        url: "/api/v1/files/abc123",
        thumbnailUrl: "/uploads/thumb.png",
        uploadedBy: 10,
        uploadedAt: "2024-01-01T00:00:00.000Z",
        type: "application/pdf",
        size: 1024,
      },
    ];
    const formData = buildTaskFormData({
      attachments,
      assignees: [1, 2],
      metadata: { flag: true },
    });
    expect(formData.get("formVersion")).toBe("1");
    expect(formData.getAll("assignees")).toEqual(["1", "2"]);
    expect(formData.get("attachments")).toBe(JSON.stringify(attachments));
    expect(formData.get("metadata")).toBe(JSON.stringify({ flag: true }));
  });
});
