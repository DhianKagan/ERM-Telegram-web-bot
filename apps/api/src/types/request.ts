// Назначение файла: общий тип расширенного запроса
// Основные модули: express
import type { Request } from 'express';
import type { ParsedQs } from 'qs';
import type { User, Task } from 'shared';

export type UserInfo = Partial<User> & { id?: number; access?: number };

export type TaskInfo = Partial<Task>;

type ParamsDict = Record<string, string>;

export type RequestWithUser<
  P = ParamsDict,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  user?: UserInfo;
  task?: TaskInfo;
};

export default RequestWithUser;
