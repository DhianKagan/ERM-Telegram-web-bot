"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFile = checkFile;
// Проверка расширения и MIME файла
// Модули: path
const path_1 = __importDefault(require("path"));
const allowed = {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/bmp': ['.bmp'],
    'image/svg+xml': ['.svg'],
    'image/heic': ['.heic'],
    'image/heif': ['.heif'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
    ],
    'application/vnd.ms-word.document.macroEnabled.12': ['.docm'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template': [
        '.dotx',
    ],
    'application/vnd.ms-word.template.macroEnabled.12': ['.dotm'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
    ],
    'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12': ['.xlsb'],
    'application/vnd.ms-excel.template.macroEnabled.12': ['.xltm'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template': [
        '.xltx',
    ],
    'application/vnd.ms-excel.addin.macroEnabled.12': ['.xlam'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
        '.pptx',
    ],
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12': ['.pptm'],
    'application/vnd.openxmlformats-officedocument.presentationml.template': [
        '.potx',
    ],
    'application/vnd.ms-powerpoint.template.macroEnabled.12': ['.potm'],
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow': [
        '.ppsx',
    ],
    'application/vnd.ms-powerpoint.slideshow.macroEnabled.12': ['.ppsm'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/vnd.oasis.opendocument.text': ['.odt'],
    'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
    'application/vnd.oasis.opendocument.presentation': ['.odp'],
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    'application/vnd.rar': ['.rar'],
    'application/x-7z-compressed': ['.7z'],
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
    'video/x-matroska': ['.mkv'],
};
const allowedExtensions = new Set(Object.values(allowed).flatMap((values) => values.map((ext) => ext.toLowerCase())));
const extensionToMime = new Map();
for (const [mime, extensions] of Object.entries(allowed)) {
    for (const extension of extensions) {
        const extLower = extension.toLowerCase();
        if (!extensionToMime.has(extLower)) {
            extensionToMime.set(extLower, mime);
        }
    }
}
function checkFile(file) {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (!ext) {
        return false;
    }
    const mime = file.mimetype.toLowerCase();
    const matches = allowed[mime];
    if (matches) {
        return matches.includes(ext);
    }
    if (mime === '' ||
        mime === 'application/octet-stream' ||
        mime === 'binary/octet-stream') {
        const isAllowed = allowedExtensions.has(ext);
        if (isAllowed) {
            const canonical = extensionToMime.get(ext);
            if (canonical) {
                file.mimetype = canonical;
            }
        }
        return isAllowed;
    }
    return false;
}
