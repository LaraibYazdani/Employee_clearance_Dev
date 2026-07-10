module.exports = {
  apps: [
    {
      name: 'employee-clearance-dev',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8000',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '8000',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
    },
  ],
}
