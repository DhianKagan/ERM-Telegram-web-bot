// Назначение: единая обработка ошибок API в формате RFC 9457
// Основные модули: prom-client, service, problem utils
import { Response, NextFunction } from "express";
import client from "prom-client";
import { writeLog } from "../services/service";
import { randomUUID } from "crypto";
import type { RequestWithUser } from "../types/request";
import { sendProblem } from "../utils/problem";
import { ProblemDetails } from "../types/problem";
import { apiErrors } from "../api/middleware";

const csrfErrors = new client.Counter({
  name: "csrf_errors_total",
  help: "Количество ошибок CSRF",
});

export default function errorMiddleware(
  err: unknown,
  req: RequestWithUser,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const error = err as { [key: string]: unknown; message: string; type?: string; code?: string };
  const traceId =
    ((req as unknown as Record<string, string>).traceId as
      | string
      | undefined) || randomUUID();
  if (error.type === "request.aborted") {
    const problem: Omit<ProblemDetails, "instance"> = {
      type: "about:blank",
      title: "Некорректный запрос",
      status: 400,
      detail: "Клиент оборвал соединение",
    };
    sendProblem(req, res, problem);
    apiErrors.inc({ method: req.method, path: req.originalUrl, status: 400 });
    return;
  }
  if (error.code === "EBADCSRFTOKEN" || /CSRF token/.test(error.message)) {
    if (process.env.NODE_ENV !== "test") {
      csrfErrors.inc();
      const header = req.headers["x-xsrf-token"]
        ? String(req.headers["x-xsrf-token"]).slice(0, 8)
        : "none";
      const cookie =
        req.cookies && (req.cookies as Record<string, string>)["XSRF-TOKEN"]
          ? String((req.cookies as Record<string, string>)["XSRF-TOKEN"]).slice(0, 8)
          : "none";
      const uid = req.user ? `${req.user.id}/${req.user.username}` : "anon";
      writeLog(
        `Ошибка CSRF-токена header:${header} cookie:${cookie} user:${uid} trace:${traceId} instance:${traceId}`,
      ).catch(() => {});
    }
    const problem: Omit<ProblemDetails, "instance"> = {
      type: "about:blank",
      title: "Ошибка CSRF",
      status: 403,
      detail: "Токен недействителен или отсутствует. Обновите страницу и попробуйте ещё раз.",
    };
    sendProblem(req, res, problem);
    apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
    return;
  }
  console.error(error);
  writeLog(
    `Ошибка ${error.message} path:${req.originalUrl} ip:${req.ip} trace:${traceId} instance:${traceId}`,
    "error",
  ).catch(() => {});
  const status = res.statusCode >= 400 ? res.statusCode : 500;
  const problem: Omit<ProblemDetails, "instance"> = {
    type: "about:blank",
    title: "Внутренняя ошибка",
    status,
    detail: error.message,
  };
  sendProblem(req, res, problem);
  apiErrors.inc({ method: req.method, path: req.originalUrl, status });
}
