/**
 * Base error class for NLAP errors
 */
export class NLAPError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'NLAPError';
  }
}

/**
 * Error thrown when action argument validation fails
 */
export class ValidationError extends NLAPError {
  constructor(
    message: string,
    public action: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when an LLM provider fails
 */
export class ProviderError extends NLAPError {
  constructor(provider: string, message: string) {
    super(`Provider error (${provider}): ${message}`, 'PROVIDER_ERROR');
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends NLAPError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}
