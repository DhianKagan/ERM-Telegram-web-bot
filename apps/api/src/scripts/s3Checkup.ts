// Назначение: CLI-проверка готовности S3-конфигурации и доступа к bucket.
// Основные модули: services/s3Health
import { runS3Healthcheck } from '../services/s3Health';

const formatDetails = (
  report: Awaited<ReturnType<typeof runS3Healthcheck>>,
) => {
  const details: string[] = [];

  if (report.metadata.endpoint) {
    details.push(`endpoint=${report.metadata.endpoint}`);
  }
  if (report.metadata.bucket) {
    details.push(`bucket=${report.metadata.bucket}`);
  }
  if (report.metadata.region) {
    details.push(`region=${report.metadata.region}`);
  }
  if (report.metadata.missing?.length) {
    details.push(`missing=${report.metadata.missing.join(',')}`);
  }
  if (report.metadata.invalid?.length) {
    details.push(`invalid=${report.metadata.invalid.join(',')}`);
  }

  return details.length > 0 ? ` (${details.join(' | ')})` : '';
};

const main = async (): Promise<void> => {
  const report = await runS3Healthcheck();
  const details = formatDetails(report);

  if (report.status === 'ok') {
    console.log(
      `[s3-checkup] OK latency=${report.latencyMs}ms checkedAt=${report.checkedAt}${details}`,
    );
    process.exitCode = 0;
    return;
  }

  const errorSuffix = report.error
    ? ` kind=${report.error.kind} message=${report.error.message}`
    : '';

  console.error(
    `[s3-checkup] DEGRADED latency=${report.latencyMs}ms checkedAt=${report.checkedAt}${details}${errorSuffix}`,
  );
  process.exitCode = 1;
};

void main();
