type TelegramUser = {
    id?: number;
    username?: string;
    [key: string]: unknown;
} | null;
interface InitDataRecord {
    [key: string]: unknown;
    user?: TelegramUser;
    receiver?: Record<string, unknown> | null;
    chat?: Record<string, unknown> | null;
    auth_date?: number;
    authDate?: number;
}
export default function verifyInitData(initData: string): InitDataRecord;
export type InitData = ReturnType<typeof verifyInitData>;
export {};
