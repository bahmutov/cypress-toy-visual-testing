// @ts-check
/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it(
  'ignores image diff up to N percent',
  { viewportWidth: 300, viewportHeight: 100 },
  () => {
    cy.get('body').invoke('html', '<h1>Hello, world</h1>')
    cy.imageDiff('image-diff', { diffPercentage: 0.3 })
  },
)
