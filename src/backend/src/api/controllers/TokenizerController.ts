// express version: ^4.18.0
// winston version: ^3.8.0
// express-rate-limit version: ^6.7.0

import { Request, Response } from 'express';
import { Logger } from 'winston';
import { RateLimit } from 'express-rate-limit';
import { TokenizerService } from '../../services/TokenizerService';
import { ITokenizer } from '../../core/tokenizers/interfaces/ITokenizer';
import { validateTokenizerConfigMiddleware } from '../middleware/validator';
import { TokenizerConfig } from '../../core/tokenizers/TokenizerConfig';
import { TokenizerType, TokenizationResult } from '../../types/tokenizer';
import { ProcessingStatus } from '../../types/common';

/**
 * Controller class for handling tokenizer-related HTTP requests
 * Provides endpoints for tokenization, detokenization, and metrics
 */
export class TokenizerController {
  constructor(
    private readonly tokenizerService: TokenizerService,
    private readonly logger: Logger,
    private readonly rateLimiter: RateLimit
  ) {}

  /**
   * Creates a new tokenizer instance with validation
   * @route POST /api/v1/tokenizers
   */
  public async createTokenizer(req: Request, res: Response): Promise<void> {
    try {
      const config = new TokenizerConfig(
        req.body.type as TokenizerType,
        req.body.compressionRatio,
        req.body.resolution
      );

      const tokenizer = await this.tokenizerService.createTokenizer(config);
      
      this.logger.info('Created new tokenizer', {
        type: config.type,
        compressionRatio: config.compressionRatio,
        resolution: `${config.resolution.width}x${config.resolution.height}`
      });

      res.status(201).json({
        status: 'success',
        data: await tokenizer.getConfig()
      });

    } catch (error) {
      this.logger.error('Failed to create tokenizer', { error });
      res.status(400).json({
        status: 'error',
        message: error.message,
        details: error.details || {}
      });
    }
  }

  /**
   * Tokenizes video data with safety checks and metrics
   * @route POST /api/v1/tokenizers/:id/tokenize
   */
  public async tokenize(req: Request, res: Response): Promise<void> {
    try {
      const tokenizerId = req.params.id;
      const videoData = req.body.videoData;

      if (!Buffer.isBuffer(videoData)) {
        throw new Error('Invalid video data format');
      }

      const result: TokenizationResult = await this.tokenizerService.tokenize(
        tokenizerId,
        videoData
      );

      if (result.status === ProcessingStatus.COMPLETED) {
        this.logger.info('Tokenization completed', {
          tokenizerId,
          metrics: result.metrics
        });

        res.status(200).json({
          status: 'success',
          data: {
            tokens: result.tokens,
            metrics: result.metrics
          }
        });
      } else {
        throw new Error('Tokenization failed');
      }

    } catch (error) {
      this.logger.error('Tokenization failed', {
        error,
        tokenizerId: req.params.id
      });

      res.status(500).json({
        status: 'error',
        message: error.message,
        details: error.details || {}
      });
    }
  }

  /**
   * Reconstructs video from tokens with quality validation
   * @route POST /api/v1/tokenizers/:id/detokenize
   */
  public async detokenize(req: Request, res: Response): Promise<void> {
    try {
      const tokenizerId = req.params.id;
      const tokens = req.body.tokens;

      if (!Buffer.isBuffer(tokens)) {
        throw new Error('Invalid token data format');
      }

      const videoData = await this.tokenizerService.detokenize(
        tokenizerId,
        tokens
      );

      this.logger.info('Detokenization completed', {
        tokenizerId,
        outputSize: videoData.length
      });

      res.status(200).json({
        status: 'success',
        data: {
          video: videoData
        }
      });

    } catch (error) {
      this.logger.error('Detokenization failed', {
        error,
        tokenizerId: req.params.id
      });

      res.status(500).json({
        status: 'error',
        message: error.message,
        details: error.details || {}
      });
    }
  }

  /**
   * Retrieves comprehensive tokenizer metrics
   * @route GET /api/v1/tokenizers/:id/metrics
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const tokenizerId = req.params.id;
      const metrics = await this.tokenizerService.getMetrics(tokenizerId);

      this.logger.info('Retrieved tokenizer metrics', {
        tokenizerId,
        metrics
      });

      res.status(200).json({
        status: 'success',
        data: {
          metrics,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      this.logger.error('Failed to retrieve metrics', {
        error,
        tokenizerId: req.params.id
      });

      res.status(500).json({
        status: 'error',
        message: error.message,
        details: error.details || {}
      });
    }
  }
}

export default TokenizerController;