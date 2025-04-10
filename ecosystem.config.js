module.exports = {
  apps: [{
    name: 'web-server',
    script: 'index.js',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'twitch-bot',
    script: 'twitch.js',
    env: {
      NODE_ENV: 'production'
    }
  }]
}; 