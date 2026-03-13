'use strict';

/**
 * api/ecosystem.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PM2 ecosystem configuration for the SulMotor Payment API.
 *
 * Usage:
 *   cd /home/user/webapp
 *   pm2 start api/ecosystem.config.js
 *   pm2 status
 *   pm2 logs sulmtr-payment-api --nostream
 *   pm2 restart sulmtr-payment-api
 *   pm2 stop sulmtr-payment-api
 *
 * In production (with --env production):
 *   pm2 start api/ecosystem.config.js --env production
 */

module.exports = {
    apps: [
        {
            // ── App identity ──────────────────────────────────────────────────
            name:        'sulmtr-payment-api',
            script:      'api/server.js',
            cwd:         '/home/user/webapp',   // adjust to your deployment path

            // ── Env vars ──────────────────────────────────────────────────────
            // Dotenv is loaded inside server.js from .env.server — PM2 env
            // vars here are only fallbacks / overrides.
            env: {
                NODE_ENV: 'development',
                PORT:     '3001',
            },
            env_production: {
                NODE_ENV:    'production',
                PORT:        '3001',
            },

            // ── Clustering / stability ────────────────────────────────────────
            instances:       1,          // set to 'max' to use all CPU cores
            exec_mode:       'fork',     // 'cluster' for multi-core
            watch:           false,      // set to true only in dev
            max_memory_restart: '256M',

            // ── Logging ───────────────────────────────────────────────────────
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            out_file:        'logs/api-out.log',
            error_file:      'logs/api-err.log',
            merge_logs:      true,

            // ── Restart policy ────────────────────────────────────────────────
            autorestart:     true,
            restart_delay:   2000,
            max_restarts:    10,
            min_uptime:      '5s',
        },
    ],
};
