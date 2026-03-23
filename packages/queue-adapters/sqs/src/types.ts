/**
 * @module @carpentry/queue-sqs
 * @description Type definitions for the AWS SQS queue adapter.
 */

/** Configuration for SqsQueueAdapter */
export interface SqsConfig {
  /** AWS region (default: 'us-east-1') */
  region?: string;
  /** SQS queue URL */
  queueUrl: string;
  /** AWS access key ID (uses default credential chain if omitted) */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
  /** Custom SQS endpoint (for LocalStack or testing) */
  endpoint?: string;
  /** Visibility timeout in seconds (default: 30) */
  visibilityTimeout?: number;
  /** Long-poll wait time in seconds (default: 20) */
  waitTimeSeconds?: number;
}
