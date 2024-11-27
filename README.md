# @bahmutov/cypress-toy-visual-testing [![main](https://github.com/bahmutov/cypress-toy-visual-testing/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/bahmutov/cypress-toy-visual-testing/actions/workflows/main.yml)

> A simple local visual testing for Cypress users

## Learn

- 🎓 online course [Visual Testing With Cypress](https://cypress.tips/courses/visual-testing)

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

### Capture options

- `fullPage` (default) takes screenshots of the entire page and stitches them into a single image
- `viewport` takes the screenshot of the currently visible portion
- `clipToViewport` takes the screenshot of the entire test runner and the clips the image to the viewport.
- `diffPercentage` lets you ignore image differences for up to N percent of pixels. If the diff is below this percentage, the gold image won't be overwritten
- `failOnLayoutDiff` fails the image comparison if the dimensions differ, true by default
- `dimensionTolerance` allow each dimension to be different by this ratio if `failOnLayoutDiff: true`

For example, let's ignore all image differences for up to half a percentage of pixels

```js
cy.imageDiff('app', { diffPercentage: 0.5 })
```

Compare the images, allow each dimension to be within 5% of the gold image

```js
cy.imageDiff('app', {
  failOnLayoutDiff: true,
  dimensionTolerance: 0.05,
})
```

## CI options

The following Cypress env variables can change how the image diffs are approved or rejected:

- `updateGoldImages` overwrites the gold images with the new screenshots, even if there are differences. Useful for branches in the pull request to overwrite the images which can be then added to the source branch. Then the user can see the difference between the changed gold images and the main branch's gold images.

- `failOnMissingGoldImage`, default `false` can be used to automatically fail the `cy.imageDiff` if the screenshot does not have a gold image to compare itself to. For example, on the `main` branch, we could require all gold images to be present.

```yml
- name: Run Cypress tests 🧪
  # https://github.com/cypress-io/github-action
  uses: cypress-io/github-action@v6
  with:
    start: npm start
    # if there is no gold image to compare a screenshot to
    # it is a problem, and we should fail the tests
    env: failOnMissingGoldImage=true
```

## Development

Use `npm run watch` to compile TS into JS

Use the following icons to refer to images:

- 🖼️ gold image
- 📸 current screenshot
- ✅ image match
- 🔥 image mismatch
