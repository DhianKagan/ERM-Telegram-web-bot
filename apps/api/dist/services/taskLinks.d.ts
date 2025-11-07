import type { TaskDocument } from '../db/model';
export declare const normalizeManagedShortLink: (value: string) => string;
export declare const ensureTaskLinksShort: (data?: Partial<TaskDocument>) => Promise<void>;
