export interface TaskField {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: readonly string[];
    default?: string;
}
export declare const taskFields: TaskField[];
export default taskFields;
