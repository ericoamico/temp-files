import { randomBytes } from 'node:crypto';

/**
 * Gera um identificador público aleatório e imprevisível
 * (22 caracteres base64url de 128 bits de entropia), usado
 * futuramente no link de compartilhamento.
 */
export function generateShareId(): string {
  return randomBytes(16).toString('base64url');
}
