/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it('takes a visual diff', { viewportWidth: 300, viewportHeight: 100 }, () => {
  cy.get('body').invoke('html', '<h1>Hello, world!</h1>')
  cy.imageDiff('hello-world')
})
