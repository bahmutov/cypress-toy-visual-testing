// @ts-check
/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it(
  'takes a visual diff of a tall page',
  { viewportWidth: 300, viewportHeight: 100 },
  () => {
    const page = `
      <h1>Tall page</h1>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
        <li>Item 4</li>
        <li>Item 5</li>
      </ul>
    `

    cy.get('body').invoke('html', page)
    // by default it is the full page
    cy.imageDiff('tall-page')
    // only capture the viewport
    cy.imageDiff('tall-page-viewport', { capture: 'viewport' })
    // capture the runner then clip
    cy.imageDiff('tall-page-viewport-clip', { capture: 'clipToViewport' })
  },
)
