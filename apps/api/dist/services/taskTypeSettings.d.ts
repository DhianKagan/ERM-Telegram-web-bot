type TaskTypeSetting = {
    type: string;
    displayName: string;
    tg_theme_url?: string;
    tg_chat_id?: string;
    tg_topic_id?: number;
    tg_photos_url?: string;
    tg_photos_chat_id?: string;
    tg_photos_topic_id?: number;
};
export declare const invalidateTaskTypeSettingsCache: () => void;
export declare const resolveTaskTypeSetting: (taskType: unknown) => Promise<TaskTypeSetting | null>;
export declare const resolveTaskTypeTopicId: (taskType: unknown) => Promise<number | undefined>;
export declare const resolveTaskTypePhotosTarget: (taskType: unknown) => Promise<{
    chatId?: string;
    topicId?: number;
} | null>;
declare const _default: {
    resolveTaskTypeSetting: (taskType: unknown) => Promise<TaskTypeSetting | null>;
    resolveTaskTypeTopicId: (taskType: unknown) => Promise<number | undefined>;
    resolveTaskTypePhotosTarget: (taskType: unknown) => Promise<{
        chatId?: string;
        topicId?: number;
    } | null>;
    invalidateTaskTypeSettingsCache: () => void;
};
export default _default;
