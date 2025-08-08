// Назначение: автотесты. Модули: jest, supertest.
// Тест проверки функции verifyInitData
process.env.BOT_TOKEN = "x";
process.env.CHAT_ID = "1";
process.env.JWT_SECRET = "s";
process.env.MONGO_DATABASE_URL = "mongodb://localhost/db";
process.env.APP_URL = "https://localhost";
const crypto = require("crypto");
const verify = require("../src/utils/verifyInitData").default;

function buildInitData(ts) {
  const data = {
    query_id: "1",
    user: JSON.stringify({ id: 1 }),
    auth_date: String(ts),
  };
  const str = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update("x").digest();
  const hash = crypto.createHmac("sha256", secret).update(str).digest("hex");
  return `query_id=1&user=%7B%22id%22%3A1%7D&auth_date=${ts}&hash=${hash}`;
}

test("корректная строка возвращает true", () => {
  const now = Math.floor(Date.now() / 1000);
  const initData = buildInitData(now);
  expect(verify(initData)).toBe(true);
});

test("неверная подпись возвращает false", () => {
  const now = Math.floor(Date.now() / 1000);
  const initData = `query_id=1&user=%7B%22id%22%3A1%7D&auth_date=${now}&hash=bad`;
  expect(verify(initData)).toBe(false);
});

test("просроченный auth_date возвращает false", () => {
  const old = Math.floor(Date.now() / 1000) - 600;
  const initData = buildInitData(old);
  expect(verify(initData)).toBe(false);
});
