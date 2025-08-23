// Назначение файла: общий тип расширенного запроса
// Основные модули: express
import { Request, ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { User, Task } from 'shared';

export type UserInfo = Partial<User> & { id?: number; access?: number };

export type TaskInfo = Partial<Task>;

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
