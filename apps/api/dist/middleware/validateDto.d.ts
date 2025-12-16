import { RequestHandler } from 'express';
interface ValidatableDto {
    rules(): RequestHandler[];
}
export default function validateDto(Dto: ValidatableDto): RequestHandler[];
export {};
