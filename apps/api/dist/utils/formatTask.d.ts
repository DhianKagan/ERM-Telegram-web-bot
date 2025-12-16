import { type Task, type User } from 'shared';
type UsersIndex = Record<number | string, Pick<User, 'name' | 'username'>>;
type TaskData = Task & {
    request_id?: string;
    task_number?: string;
    task_type?: string;
    due_date?: string | Date;
    start_date?: string | Date;
    start_location?: string | null;
    end_location?: string | null;
    start_location_link?: string | null;
    end_location_link?: string | null;
    transport_type?: string;
    payment_method?: Task['payment_method'];
    priority?: string;
    status?: string;
    route_distance_km?: number | null;
    controllers?: number[];
    created_by?: number;
    comments?: {
        author_id?: number;
        text?: string;
    }[];
    task_description?: string;
};
declare const SECTION_SEPARATOR = "\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
type InlineImage = {
    url: string;
    alt?: string;
};
type FormatTaskSectionKey = 'header' | 'info' | 'logistics' | 'participants' | 'description';
type FormatTaskSection = {
    key: FormatTaskSectionKey;
    content: string;
};
type FormatTaskResult = {
    text: string;
    inlineImages: InlineImage[];
    sections: FormatTaskSection[];
};
export declare const convertHtmlToMarkdown: (html: string) => string;
export default function formatTask(task: TaskData, users?: UsersIndex): FormatTaskResult;
export type { InlineImage, FormatTaskResult, FormatTaskSection };
export { SECTION_SEPARATOR };
