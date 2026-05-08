import Groq from 'groq-sdk';
import { ExtractorConfig, ExtractResult, TransactionRecord } from './types';

export class ReceiptExtractor {
    private client: Groq;

    constructor(private config: ExtractorConfig) {
        if (!config.groqApiKey) {
            throw new Error('Groq API key is required');
        }
        this.client = new Groq({ apiKey: config.groqApiKey });
    }

    async extractFromBase64(
        base64: string,
        mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    ): Promise<ExtractResult> {
        return this._extract(base64, mediaType);
    }

    async extractFromUrl(url: string): Promise<ExtractResult> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return this.extractFromBase64(base64, mimeType as any);
    }

    private async _extract(base64Image: string, mediaType: string): Promise<ExtractResult> {
        const dataUrl = `data:${mediaType};base64,${base64Image}`;

        const chatCompletion = await this.client.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: this.getPrompt() },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                },
            ],
            temperature: 0,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const rawResponse = chatCompletion.choices[0]?.message?.content;
        if (!rawResponse) {
            throw new Error('No response from Groq');
        }

        return this.parseResponse(rawResponse);
    }

    private getPrompt(): string {
        return `You are extracting transaction data from a Nigerian fintech receipt (OPay, PalmPay, Kuda, Moniepoint, GTBank, Access, Zenith, UBA, Wema, etc.).

Extract all available fields and return ONLY a valid JSON object:
{
  "amount": number (in Naira, no commas),
  "currency": "NGN",
  "sender": "string or null",
  "recipient": "string or null",
  "recipient_account": "account number string or null",
  "bank": "recipient bank name or null",
  "reference": "transaction reference/ID or null",
  "transaction_date": "ISO 8601 or null",
  "transaction_type": "transfer | payment | airtime | bill | other",
  "status": "successful | failed | pending",
  "platform": "opay | palmpay | kuda | moniepoint | gtb | access | zenith | uba | wema | other",
  "narration": "transaction narration/description or null"
}

Rules:
- Return ONLY the JSON object, no markdown, no explanation.
- If a field is not visible, use null.
- Amount should be a plain number e.g. 5000 not "5,000".`;
    }

    private parseResponse(rawResponse: string): ExtractResult {
        // Remove any markdown code fences if present
        const cleaned = rawResponse.replace(/```json|```/g, '').trim();
        const transaction: TransactionRecord = JSON.parse(cleaned);
        return { transaction, rawResponse };
    }
}
