export { ReceiptExtractor } from './extractor';
export type { TransactionRecord, ExtractorConfig, ExtractResult, TransactionStatus } from './types';

// Convenience factory
import { ReceiptExtractor } from './extractor';
import { ExtractorConfig } from './types';

export function createExtractor(config: ExtractorConfig) {
    return new ReceiptExtractor(config);
}
