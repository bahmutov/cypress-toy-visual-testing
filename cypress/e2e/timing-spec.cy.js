// @ts-check
/// <reference path="../../src/support/index.d.ts" />

import '../../dist/support/commands'

it('reports timing', { viewportWidth: 300, viewportHeight: 100 }, () => {
  cy.get('body').invoke('html', '<h1>Hello, world!</h1>')
  cy.spy(cy, 'log').as('log')
  cy.imageDiff('hello-world')
  cy.get('@log').should((spy) => {
    // @ts-ignore
    const logMessages = spy.getCalls().map((call) => call.lastArg)
    const message = logMessages.find((msg) =>
      msg.match(/✅ images match, took \d+ms/),
    )
    expect(message, 'timing log message').to.be.a('string')
  })
})
