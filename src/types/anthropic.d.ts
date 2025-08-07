/**
 * Type declarations for Anthropic API
 * These are simplified type definitions for the parts we use
 */

declare module '@anthropic/sdk' {
  // Event types
  export type StreamEventType =
    | 'message_start'
    | 'message_delta'
    | 'message_stop'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'error';

  // Base event interface
  export interface BaseStreamEvent {
    type: StreamEventType;
  }

  // Core message events
  export interface MessageStreamEvent extends BaseStreamEvent {
    type: Exclude<StreamEventType, 'error'>;
  }

  // Content block delta with text
  export interface ContentBlockDeltaEvent extends MessageStreamEvent {
    type: 'content_block_delta';
    index: number;
    delta: {
      type: 'text_delta';
      text: string;
    };
  }

  // Error event
  export interface MessageErrorEvent extends BaseStreamEvent {
    type: 'error';
    error: string;
  }

  // Union type for all possible stream events
  export type AnyStreamEvent = MessageStreamEvent | MessageErrorEvent;

  // Content types
  export type ContentBlockType = 'text' | 'image';

  // Content block interface
  export interface ContentBlock {
    type: ContentBlockType;
    text?: string;
  }

  // Text content block
  export interface TextContentBlock extends ContentBlock {
    type: 'text';
    text: string;
  }

  // Image content block
  export interface ImageContentBlock extends ContentBlock {
    type: 'image';
    source: {
      type: 'base64' | 'url';
      media_type: string;
      data: string;
    };
  }
}