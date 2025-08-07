// Назначение: проверка типов RequestWithUser
import { expectType, expectError } from 'tsd';
import { RequestWithUser } from '../src/types/request';

const req = {} as RequestWithUser;
expectType<number | undefined>(req.user?.id);
expectError(req.user?.unknown);

