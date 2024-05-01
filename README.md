# @bahmutov/cypress-toy-visual-testing [![main](https://github.com/bahmutov/cypress-toy-visual-testing/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/bahmutov/cypress-toy-visual-testing/actions/workflows/main.yml)

> A simple local visual testing for Cypress users

## Install

Add this plugin as a dev dependency

```shell
npm i -D @bahmutov/cypress-toy-visual-testing
```

Set it up from your `` hook in the Cypress config file:

```js
// cypress.config.js

const { defineConfig } = require('cypress')
// https://github.com/bahmutov/cypress-toy-visual-testing
const {
  setupVisualTesting,
} = require('@bahmutov/cypress-toy-visual-testing/dist/plugin/setup')

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      setupVisualTesting(on, config)
      return config
    },
  },
})
```

Add custom commands to your support file:

```js
// cypress/support/e2e.js

// https://github.com/bahmutov/cypress-toy-visual-testing
import '@bahmutov/cypress-toy-visual-testing/dist/support/commands'
```

## Use

Take full page screenshots

```js
cy.imageDiff('added-todos')
```
