import type { FastifyReply } from 'fastify';
import { z } from 'zod';

export const stellarAddress = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, 'must be a Stellar account address');

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function notFound(reply: FastifyReply, what: string) {
  return reply.code(404).send({ error: 'not_found', message: `${what} not found` });
}
