// Назначение: работа с HashiCorp Vault и AWS Secrets Manager
// Модули: @aws-sdk/client-secrets-manager, node-vault, crypto
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import vault from 'node-vault';
import crypto from 'crypto';

export async function getSecret(name: string): Promise<string> {
  if (process.env.SECRETS_MANAGER === 'aws') {
    const client = new SecretsManager({ region: process.env.AWS_REGION });
    const res = await client.getSecretValue({ SecretId: name });
    return res.SecretString || '';
  }
  if (process.env.SECRETS_MANAGER === 'vault') {
    const v = vault({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });
    const res = await v.read(name);
    return res.data?.data?.value || res.data?.value || '';
  }
  return process.env[name] || '';
}

export async function rotateSecret(name: string): Promise<void> {
  const newValue = crypto.randomBytes(32).toString('hex');
  if (process.env.SECRETS_MANAGER === 'aws') {
    const client = new SecretsManager({ region: process.env.AWS_REGION });
    await client.putSecretValue({ SecretId: name, SecretString: newValue });
  } else if (process.env.SECRETS_MANAGER === 'vault') {
    const v = vault({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });
    await v.write(name, { value: newValue });
  }
}
