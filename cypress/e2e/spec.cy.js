// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="cypress" />

it('takes a visual diff', { viewportWidth: 200, viewportHeight: 100 }, () => {
  cy.get('body').invoke('html', '<h1>Hello, world!</h1>')
})
