export declare const graphhopperConfig: {
    matrixUrl: string | undefined;
    apiKey: string | undefined;
    profile: string;
};
export declare const botToken: string | undefined;
export declare const botApiUrl: string | undefined;
export declare const getChatId: () => string | undefined;
export declare const chatId: string | undefined;
export declare const jwtSecret: string | undefined;
export declare const mongoUrl: string;
export declare const appUrl: string;
export declare const vrpOrToolsEnabled: boolean;
export declare const port: number;
export declare const locale: string;
export declare const osrmBaseUrl: string;
export declare const routingUrl: string;
export declare const cookieDomain: string;
declare const config: {
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
};
export default config;
