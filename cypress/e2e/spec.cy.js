/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it('takes a visual diff', { viewportWidth: 300, viewportHeight: 100 }, () => {
  cy.get('body').invoke('html', '<h1>Hello, world!</h1>')
  cy.imageDiff('hello-world')
})

it(
  'removes classes on failure',
  { viewportWidth: 300, viewportHeight: 100 },
  () => {
    cy.get('body')
      .invoke('html', '<h1>Hello, world 1!</h1>')
      .invoke('addClass', 'foo')
    cy.imageDiff('no-classes')
    // if you change the text on the page and the diff fails
    // the screenshot "body" should not have the 'foo' class
  },
)

it.skip(
  'shows buttons on failure',
  { viewportWidth: 700, viewportHeight: 400 },
  () => {
    cy.get('body')
      .invoke('html', '<h1>Hello, world 5!</h1>')
      .invoke('addClass', 'foo')
    cy.imageDiff('buttons on failure')
  },
)
