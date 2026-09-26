module.exports = {
  apps: [{
    name: 'telegram-bot',
    script: 'bot-poll.js',
    cwd: '/home/ubuntu/classroom-update/backend',
    env: {
      NODE_ENV: 'production',
    },
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
