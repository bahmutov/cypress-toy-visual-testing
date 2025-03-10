// @ts-check
/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it(
  'shows images as DOM snapshots',
  { viewportWidth: 300, viewportHeight: 200 },
  () => {
    cy.get('body').invoke('html', '<h1>Hello, world!</h1>')
    cy.imageDiff('dom-snapshots')
  },
)
