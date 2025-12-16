import { type HistoryEntry } from '../db/model';
interface DescribeActionOptions {
    escapeDatesFully?: boolean;
}
export type ActionKind = 'created' | 'status' | 'updated';
export interface ActionDescription {
    kind: ActionKind;
    details: string | null;
}
export declare function describeAction(entry: HistoryEntry, options?: DescribeActionOptions): ActionDescription;
export {};
