/* eslint-env jest */
// Назначение: проверка authFetch при отсутствии заголовков ответа
// Основные модули: authFetch, XMLHttpRequest
import authFetch from "./authFetch";

jest.mock("./csrfToken", () => ({
  getCsrfToken: () => "token",
  setCsrfToken: () => undefined,
}));

jest.mock("./toast", () => ({
  showToast: () => undefined,
}));

class MockXHR {
  response = "ok";
  status = 200;
  statusText = "OK";
  withCredentials = false;
  upload = { onprogress: () => undefined };
  onload: () => void = () => undefined;
  onerror: () => void = () => undefined;
  onabort: () => void = () => undefined;
  open() {}
  setRequestHeader() {}
  getAllResponseHeaders() {
    return "";
  }
  send() {
    this.onload();
  }
}

(globalThis as any).XMLHttpRequest = MockXHR as any;

describe("authFetch", () => {
  it("возвращает пустой Headers при отсутствии заголовков", async () => {
    const res = await authFetch("/test", { onProgress: () => undefined });
    expect(res.headers).toBeInstanceOf(Headers);
    expect(res.headers.get("x-test")).toBeNull();
  });
});
