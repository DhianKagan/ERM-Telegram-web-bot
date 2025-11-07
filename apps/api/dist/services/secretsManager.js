"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.rotateSecret = rotateSecret;
// Назначение: работа с HashiCorp Vault и AWS Secrets Manager
// Модули: @aws-sdk/client-secrets-manager, node-vault, crypto
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const node_vault_1 = __importDefault(require("node-vault"));
const crypto_1 = __importDefault(require("crypto"));
async function getSecret(name) {
    if (process.env.SECRETS_MANAGER === 'aws') {
        const client = new client_secrets_manager_1.SecretsManager({ region: process.env.AWS_REGION });
        const res = await client.getSecretValue({ SecretId: name });
        return res.SecretString || '';
    }
    if (process.env.SECRETS_MANAGER === 'vault') {
        const v = (0, node_vault_1.default)({
            endpoint: process.env.VAULT_ADDR,
            token: process.env.VAULT_TOKEN,
        });
        const res = await v.read(name);
        return res.data?.data?.value || res.data?.value || '';
    }
    return process.env[name] || '';
}
async function rotateSecret(name) {
    const newValue = crypto_1.default.randomBytes(32).toString('hex');
    if (process.env.SECRETS_MANAGER === 'aws') {
        const client = new client_secrets_manager_1.SecretsManager({ region: process.env.AWS_REGION });
        await client.putSecretValue({ SecretId: name, SecretString: newValue });
    }
    else if (process.env.SECRETS_MANAGER === 'vault') {
        const v = (0, node_vault_1.default)({
            endpoint: process.env.VAULT_ADDR,
            token: process.env.VAULT_TOKEN,
        });
        await v.write(name, { value: newValue });
    }
}
