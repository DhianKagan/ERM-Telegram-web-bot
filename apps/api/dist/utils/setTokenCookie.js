"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setTokenCookie;
const config_1 = __importDefault(require("../config"));
function setTokenCookie(res, token, cfg = config_1.default) {
    const secure = process.env.NODE_ENV === 'production';
    const cookieOpts = {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    if (secure) {
        cookieOpts.domain = cfg.cookieDomain || new URL(cfg.appUrl).hostname;
    }
    res.cookie('token', token, cookieOpts);
    const preview = token.slice(0, 8);
    console.log(`Установлена cookie token:${preview} domain:${cookieOpts.domain || 'none'}`);
}
