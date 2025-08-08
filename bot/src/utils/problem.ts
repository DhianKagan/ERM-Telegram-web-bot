// Назначение: вспомогательные функции для ответов об ошибках RFC 9457
// Основные модули: express
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { ProblemDetails } from "../types/problem";

export function sendProblem(
  req: Request,
  res: Response,
  problem: Omit<ProblemDetails, "instance">,
): void {
  const traceId =
    ((req as unknown as Record<string, string>).traceId as
      | string
      | undefined) || randomUUID();
  const body: ProblemDetails = { ...problem, instance: traceId };
  res.status(problem.status);
  if (typeof (res as unknown as Record<string, unknown>).type === "function") {
    (res as unknown as { type: (v: string) => void }).type(
      "application/problem+json",
    );
  } else if (typeof (res as unknown as Record<string, unknown>).setHeader === "function") {
    (res as unknown as { setHeader: (k: string, v: string) => void }).setHeader(
      "Content-Type",
      "application/problem+json",
    );
  }
  res.json(body);
}
