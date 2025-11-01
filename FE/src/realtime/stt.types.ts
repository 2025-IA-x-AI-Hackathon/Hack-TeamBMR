import type { LlmReport, OcrReport } from '../types/domain';

export interface WsMessage<Event extends string, Payload> {
  event: Event;
  data: Payload;
}

export interface SessionInitPayload {
  locale: 'ko-KR';
  diarization: boolean;
  minSpeakers: number;
  maxSpeakers: number;
}

export interface SessionReadyPayload {
  session_id: string;
}

export interface SessionClosePayload {
  reason?: string;
}

export interface RtcOfferPayload {
  sdp: string;
  type: RTCSdpType;
}

export interface RtcAnswerPayload {
  sdp: string;
  type: RTCSdpType;
  reportid?: string;
  report_id?: string;
}

export interface RtcCandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface SttPartialPayload {
  text: string;
}

export interface SttSegment {
  speaker: number | null;
  text: string;
  start: number;
  end: number;
}

export interface SttFinalSegmentsPayload {
  segments: SttSegment[];
}

export interface SttQaPair {
  q_text: string;
  q_speaker: number | null;
  q_time: number;
  a_text: string;
  a_speaker: number | null;
  a_time: number;
  confidence: number;
}

export interface SttQaPairsPayload {
  pairs: SttQaPair[];
  final?: boolean;
}

export interface SttErrorPayload {
  code: string;
  message: string;
}

export interface SttStatsPayload {
  bytes: number;
  chunks: number;
  partials: number;
  finals: number;
}

export interface GenericErrorPayload {
  code: string;
  message: string;
}

export interface OcrProgressPayload {
  ocr_id: string;
  stage: string;
}

export interface LlmProgressPayload {
  report_id: string;
  stage: string;
}

export interface LlmErrorPayload {
  report_id: string;
  code: string;
  message: string;
}

export type OutgoingRealtimeEvent =
  | WsMessage<'session.init', SessionInitPayload>
  | WsMessage<'rtc.offer', RtcOfferPayload>
  | WsMessage<'rtc.candidate', RtcCandidatePayload>
  | WsMessage<'rtc.start', { track: 'audio' }>
  | WsMessage<'rtc.stop', Record<string, never>>
  | WsMessage<'session.close', SessionClosePayload>;

export type IncomingRealtimeEvent =
  | WsMessage<'session.ready', SessionReadyPayload>
  | WsMessage<'session.close', SessionClosePayload>
  | WsMessage<'rtc.answer', RtcAnswerPayload>
  | WsMessage<'rtc.candidate', RtcCandidatePayload>
  | WsMessage<'stt.partial', SttPartialPayload>
  | WsMessage<'stt.final_segments', SttFinalSegmentsPayload>
  | WsMessage<'stt.qa_pairs', SttQaPairsPayload>
  | WsMessage<'stt.error', SttErrorPayload>
  | WsMessage<'stt.stats', SttStatsPayload>
  | WsMessage<'ocr.progress', OcrProgressPayload>
  | WsMessage<'ocr.done', OcrReport>
  | WsMessage<'llm.progress', LlmProgressPayload>
  | WsMessage<'llm.result', LlmReport>
  | WsMessage<'llm.error', LlmErrorPayload>
  | WsMessage<'error', GenericErrorPayload>;
