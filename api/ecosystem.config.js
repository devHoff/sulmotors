'use strict';

/**
 * api/ecosystem.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PM2 ecosystem configuration for the SulMotor Payment API.
 *
 * Apps defined:
 *   sulmtr-payment-api   — Express HTTP server (port 3001)
 *
 * The cron scheduler is embedded INSIDE the server process via node-cron,
 * so no separate PM2 cron app is needed. The cron starts automatically
 * when server.js boots (cronJob.start() is called in the listen() callback).
 *
 * Usage:
 *   cd /home/user/webapp
 *   pm2 start api/ecosystem.config.js
 *   pm2 status
 *   pm2 logs sulmtr-payment-api --nostream
 *   pm2 restart sulmtr-payment-api
 *   pm2 stop sulmtr-payment-api
 *
 * Production:
 *   pm2 start api/ecosystem.config.js --env production
 *   pm2 save          ← persist after reboot
 *   pm2 startup       ← generate init script
 *
 * Check cron health:
 *   curl http://localhost:3001/api/cron/stats \
 *        -H "x-cron-secret: $CRON_SECRET_KEY"
 *
 * Trigger cron manually:
 *   curl -X POST http://localhost:3001/api/cron/expire-boosts \
 *        -H "x-cron-secret: $CRON_SECRET_KEY"
 */

module.exports = {
    apps: [
        {
            // ── App identity ──────────────────────────────────────────────────
            name:   'sulmtr-payment-api',
            script: 'api/server.js',
            cwd:    '/home/user/webapp',   // adjust to your deployment path

            // ── Env vars ──────────────────────────────────────────────────────
            // Dotenv is loaded inside server.js from .env.server — PM2 env
            // vars here are only fallbacks / overrides.
            env: {
                NODE_ENV: 'development',
                PORT:     '3001',
            },
            env_production: {
                NODE_ENV: 'production',
                PORT:     '3001',
            },

            // ── Clustering / stability ────────────────────────────────────────
            // NOTE: keep instances=1 so the cron scheduler only runs once.
            // If you scale to multiple instances, move cron to a dedicated
            // process or use a distributed lock (e.g. Supabase advisory lock).
            instances:          1,
            exec_mode:          'fork',
            watch:              false,
            max_memory_restart: '256M',

            // ── Logging ───────────────────────────────────────────────────────
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            out_file:        'logs/api-out.log',
            error_file:      'logs/api-err.log',
            merge_logs:      true,

            // ── Restart policy ────────────────────────────────────────────────
            autorestart:  true,
            restart_delay: 2000,
            max_restarts: 10,
            min_uptime:   '5s',

            // ── Cron-specific notes ───────────────────────────────────────────
            // The internal node-cron scheduler starts when the server boots.
            // Schedule is controlled by the CRON_SCHEDULE environment variable
            // (default: "*/10 * * * *" — every 10 minutes, UTC).
            //
            // To override schedule without redeploying:
            //   pm2 restart sulmtr-payment-api --update-env \
            //       --env CRON_SCHEDULE="*/5 * * * *"
        },
    ],
};
