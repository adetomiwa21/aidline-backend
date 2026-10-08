import type { Db } from '../db/pool.js';
import type { FastifyBaseLogger } from 'fastify';

/**
 * #25 – Daily stats history for charts.
 *
 * Runs once per day and upserts a row into `daily_stats` with the
 * platform-wide snapshot for today's date. Can be called more than once per
 * day safely (ON CONFLICT DO UPDATE).
 */
export class DailyStatsJob {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly db: Db,
    private readonly log: FastifyBaseLogger,
  ) {}

  start(): void {
    this.stopped = false;
    // Run immediately at boot, then every 24 h.
    void this.snapshot();
    this.timer = setInterval(() => void this.snapshot(), 24 * 60 * 60 * 1000);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async snapshot(): Promise<void> {
    if (this.stopped) return;
    try {
      await this.db.query(`
        INSERT INTO daily_stats (date, campaigns, donations, "totalDonated", "totalReleased")
        SELECT
          now()::date,
          (SELECT count(*)::int  FROM campaigns),
          (SELECT count(*)::int  FROM donations),
          (SELECT COALESCE(sum(amount), 0) FROM donations),
          (SELECT COALESCE(sum(released), 0) FROM campaigns)
        ON CONFLICT (date) DO UPDATE SET
          campaigns      = EXCLUDED.campaigns,
          donations      = EXCLUDED.donations,
          "totalDonated"  = EXCLUDED."totalDonated",
          "totalReleased" = EXCLUDED."totalReleased"
      `);
      this.log.info('daily stats snapshot written');
    } catch (err) {
      this.log.error({ err }, 'daily stats snapshot failed');
    }
  }
}
