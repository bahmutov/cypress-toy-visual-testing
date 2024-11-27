// @ts-check
/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it(
  'ignores image layout differences',
  // to produce screenshot with a different size
  // change the viewport size
  { viewportWidth: 300, viewportHeight: 100 },
  () => {
    cy.get('body').invoke('html', '<h1>Hello, world!</h1>')
    cy.imageDiff('hello-world', { failOnLayoutDiff: false })
  },
)
