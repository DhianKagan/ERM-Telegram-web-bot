// Назначение файла: guard проверки initData мини-приложения
// Основные модули: verifyInitData
import type { Request, Response, NextFunction } from "express";
import verifyInitData from "../utils/verifyInitData";

export default function tmaAuthGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = req.headers.authorization;
  let initData: string | null = null;
  if (auth && auth.startsWith("tma ")) {
    initData = auth.slice(4).trim();
  } else if (req.headers["x-telegram-init-data"]) {
    initData = String(req.headers["x-telegram-init-data"]);
  }
  if (!initData || !verifyInitData(initData)) {
    res.sendStatus(401);
    return;
  }
  res.locals.initData = initData;
  next();
}
