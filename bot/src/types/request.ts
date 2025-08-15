// Назначение файла: общий тип расширенного запроса
// Основные модули: express
import { Request, ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

export interface UserInfo {
  id?: number;
  telegram_id?: number;
  username?: string;
  role?: string;
  access?: number;
}

export interface TaskInfo {
  created_by?: number;
  assigned_user_id?: number;
  controller_user_id?: number;
  assignees?: number[];
  controllers?: number[];
}

export type RequestWithUser<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  user?: UserInfo;
  task?: TaskInfo;
};

export default RequestWithUser;
