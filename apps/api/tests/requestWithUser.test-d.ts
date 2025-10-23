// Назначение: проверка типов RequestWithUser
import { expectType, expectError } from 'tsd';
import { RequestWithUser } from '../src/types/request';

const req = {} as RequestWithUser;
expectType<string | number | undefined>(req.user?.id);
expectType<number | undefined>(req.user?.telegram_id);
expectError(req.user?.unknown);
