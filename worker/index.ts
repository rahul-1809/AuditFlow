import { handleApiRequest, ensureRecurringOccurrences, type Env } from './handler.ts';

export default {
  /**
   * Main fetch handler for Cloudflare Workers & Static Assets
   */
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. API Requests -> Process with Cloudflare D1
    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env, ctx);
    }

    // 2. Static Assets -> Serve Vite React SPA from ./dist
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('AuditFlow Edge Worker: Ready. Assets binding not configured.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  },

  /**
   * Scheduled cron trigger handler for Cloudflare Free Tier
   * Automatically rolls over recurring tasks monthly at midnight
   */
  async scheduled(_event: any, env: Env, _ctx: any): Promise<void> {
    console.log('[AuditFlow Cloudflare Cron] Running automated recurring tasks occurrence check...');
    try {
      const created = await ensureRecurringOccurrences(env.DB);
      console.log(`[AuditFlow Cloudflare Cron] Completed recurrence check. Created: ${created} tasks.`);
    } catch (err) {
      console.error('[AuditFlow Cloudflare Cron] Recurrence error:', err);
    }
  },
};
