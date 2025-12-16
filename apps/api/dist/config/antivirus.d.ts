export type AntivirusVendor = 'ClamAV' | 'Signature';
interface AntivirusBaseConfig {
    enabled: boolean;
    vendor: AntivirusVendor;
}
export interface ClamAvConfig extends AntivirusBaseConfig {
    vendor: 'ClamAV';
    host: string;
    port: number;
    timeout: number;
    chunkSize: number;
}
export interface SignatureConfig extends AntivirusBaseConfig {
    vendor: 'Signature';
    maxFileSize: number;
    signatures: string[];
}
export type AntivirusConfig = ClamAvConfig | SignatureConfig;
export declare const antivirusConfig: AntivirusConfig;
export {};
