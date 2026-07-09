/* eslint-env node */
module.exports = {
  apps: [
    {
      name: 'watsim-backend',
      script: 'dist/server.js',
      cwd: '/var/www/watsim/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      // Log files
      out_file: '/var/log/watsim/backend-out.log',
      error_file: '/var/log/watsim/backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
