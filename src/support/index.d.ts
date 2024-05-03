/// <reference types="cypress" />

type ImageDiffOptions = {
  /**
   * Synchronous mode takes a screenshot and immediately compares it to the gold image.
   * @default 'sync'
   */
  mode?: 'sync' | 'async'
  /**
   * CSS selector or an array of CSS selectors to ignore when comparing images
   */
  ignoreElements?: string | string[]
  /**
   * By default, we capture the entire application in pieces and then
   * stitch the pieces together. This is necessary when the application
   * is too large for the viewport. If you want to _only_ capture the
   * application's viewport, set this option to "clipToViewport".
   */
  capture?: 'clipToViewport'
}

declare namespace Cypress {
  interface Chainable {
    /**
     * Takes the page screenshot and compares it to the gold image
     * using the cy.task "diffImage". If the image is new (per-platform)
     * then it is copied to the "cypress/gold" folder.
     * If the image does not match, throws an error. The diff images
     * are saved to the screenshots folder. By default, the image diffing
     * is synchronous.
     * @example
     *  cy.imageDiff('landing-page', {mode: 'sync'})
     * @example
     *  cy.imageDiff('landing-page', {mode: 'sync', ignoreElements: '.footer'})
     * @example
     *  // You can take image diffs of an element
     *  cy.get('menu').imageDiff('menu')
     */
    imageDiff(name: string, options?: ImageDiffOptions): void

    /**
     * Fill the current form (the parent subject)
     * with the given values. The argument is an object
     * with the keys being selectors and values being the strings
     * to type into the input fields.
     * @example
     *  cy.get('form').fillForm({ '#name': 'Joe' }).submit()
     */
    fillForm(selectorsValues: object): Chainable<JQuery<HTMLFormElement>>

    /**
     * Returns elements that have "data-test" attribute with the given value
     * @example
     *  getByTest('checkout').should('be.visible')
     */
    getByTest(testId: string, text?: string): Chainable<JQuery<HTMLElement>>
  }
}
