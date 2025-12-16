export interface TelegramTopicInfo {
    chatId: string;
    topicId: number;
}
export declare const parseTelegramTopicUrl: (raw: unknown) => TelegramTopicInfo | null;
declare const _default: {
    parseTelegramTopicUrl: (raw: unknown) => TelegramTopicInfo | null;
};
export default _default;
