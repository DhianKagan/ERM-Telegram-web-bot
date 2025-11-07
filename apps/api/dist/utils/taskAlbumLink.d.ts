interface TaskAlbumLinkSource {
    telegram_photos_chat_id?: unknown;
    telegram_photos_message_id?: unknown;
    telegram_photos_topic_id?: unknown;
}
interface TaskAlbumLinkContext {
    fallbackChatId?: string | number | null;
    fallbackTopicId?: number | null;
}
export declare function resolveTaskAlbumLink(source: TaskAlbumLinkSource, context?: TaskAlbumLinkContext): string | null;
export default resolveTaskAlbumLink;
