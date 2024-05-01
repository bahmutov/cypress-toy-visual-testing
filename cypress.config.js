const { defineConfig } = require('cypress')
const { setupVisualTesting } = require('./dist/plugin/setup')

module.exports = defineConfig({
  e2e: {
    // baseUrl, etc
    supportFile: false,
    fixturesFolder: false,
    scrollBehavior: 'center',
    setupNodeEvents(on, config) {
      setupVisualTesting(on, config)

      return config
    },
  },
})
