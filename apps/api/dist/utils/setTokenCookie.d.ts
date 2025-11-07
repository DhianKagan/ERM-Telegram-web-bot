import { Response } from 'express';
export default function setTokenCookie(res: Response, token: string, cfg?: {
    botToken: string | undefined;
    botApiUrl: string | undefined;
    readonly chatId: string | undefined;
    jwtSecret: string | undefined;
    mongoUrl: string;
    appUrl: string;
    port: number;
    locale: string;
    osrmBaseUrl: string;
    routingUrl: string;
    cookieDomain: string;
    vrpOrToolsEnabled: boolean;
    graphhopperConfig: {
        matrixUrl: string | undefined;
        apiKey: string | undefined;
        profile: string;
    };
    graphhopper: {
        matrixUrl: string | undefined;
        apiKey: string | undefined;
        profile: string;
    };
}): void;
