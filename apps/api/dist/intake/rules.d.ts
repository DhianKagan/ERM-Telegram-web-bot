import type { TaskDocument } from '../db/model';
interface Rule {
    description: string;
    condition: (task: Partial<TaskDocument>) => boolean;
    action: (task: Partial<TaskDocument>) => void;
}
export declare const rules: Rule[];
export declare function applyIntakeRules(task: Partial<TaskDocument>): void;
export {};
