import { ValidationChain } from 'express-validator';
export type FieldOption = {
    value: string;
    label: string;
};
export type Field = {
    name: string;
    type: 'text' | 'datetime' | 'segment' | 'textarea';
    label: string;
    required?: boolean;
    options?: FieldOption[];
};
export type Section = {
    name: string;
    label: string;
    fields: Field[];
};
export type FormSchema = {
    formVersion: number;
    sections: Section[];
};
export declare const formSchema: FormSchema;
export declare const buildValidators: (schema: FormSchema) => ValidationChain[];
export declare const taskFormValidators: ValidationChain[];
