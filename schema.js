import { z } from 'zod';

export const nginxConfigSchema = z.object({
  name: z.string().min(1),
  fqdn: z.string().min(1),
  backends: z.array(z.string().regex(/^[^:]+:\d+$/)).min(1),
  tls: z.boolean().optional(),
  port: z.number().optional(),
  httpToHttps: z.boolean().optional(),
  websocket: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
  clientMaxBodySize: z.string().optional(),
  proxyTimeout: z.string().optional(),
  buffers: z.object({
    proxyBuffers: z.string().optional(),
    proxyBufferSize: z.string().optional(),
    proxyBusyBuffersSize: z.string().optional()
  }).optional(),
  extraDirectives: z.string().optional(),
  locations: z.array(
    z.object({
      path: z.string(),
      proxyPass: z.string().optional(),
      extra: z.string().optional()
    })
  ).optional(),
  auth: z.object({
    basic: z.object({
      realm: z.string()
    }).optional()
  }).optional(),
  ipAllow: z.array(z.string()).optional(),
  ipDeny: z.array(z.string()).optional(),
  accessLog: z.boolean().optional(),
  errorLog: z.boolean().optional(),
  logPaths: z.object({
    access: z.string().optional(),
    error: z.string().optional()
  }).optional()
});
