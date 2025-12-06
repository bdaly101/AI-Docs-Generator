import Anthropic from '@anthropic-ai/sdk';
import type { Config } from '../../types/index.js';

/**
 * Wrapper around the Anthropic SDK for documentation generation.
 */
export class AIClient {
  private client: Anthropic;
  private model: string;

  constructor(config: Config['ai']) {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required. Set it in config or as an environment variable.'
      );
    }

    this.client = new Anthropic({
      apiKey,
    });
    this.model = config.model;
  }

  /**
   * Generate text using Claude.
   * @param prompt - The user prompt/request
   * @param systemPrompt - System instructions for the AI
   * @returns Generated text response
   */
  async generate(prompt: string, systemPrompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock?.text ?? '';
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate a structured JSON response.
   * @param prompt - The user prompt/request
   * @param systemPrompt - System instructions for the AI
   * @param schema - JSON schema description for the expected response
   * @returns Parsed JSON response
   */
  async generateWithStructure<T>(
    prompt: string,
    systemPrompt: string,
    schema: string
  ): Promise<T> {
    const structuredSystemPrompt = `${systemPrompt}

IMPORTANT: You must respond with valid JSON only. No markdown code blocks, no explanations.
The response must match this schema:
${schema}`;

    const response = await this.generate(prompt, structuredSystemPrompt);

    try {
      // Try to extract JSON from the response (in case AI wraps it in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse AI response as JSON: ${response.slice(0, 200)}...`);
    }
  }

  /**
   * Check if the client is configured and ready.
   */
  isConfigured(): boolean {
    return Boolean(this.client);
  }

  /**
   * Get the configured model name.
   */
  getModel(): string {
    return this.model;
  }
}

