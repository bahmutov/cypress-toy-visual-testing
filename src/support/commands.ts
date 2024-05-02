import * as path from 'path'

const goldImages = 'cypress/gold'

type ODiffResult =
  | { match: true; reason?: string }
  | { match: true; newImage: true; reason: 'Copied new image to gold' }
  | {
      match: false
      result: string
      reason: string
      diffPercentage: number
      diffImagePath: string
    }

type IgnoreRegion = {
  x1: number
  y1: number
  x2: number
  y2: number
}

Cypress.Commands.add(
  'imageDiff',
  { prevSubject: 'optional' },
  (subject, name: string, options: ImageDiffOptions = { mode: 'sync' }) => {
    cy.log(`imageDiff **${name}**`)
    const devicePixelRatio = window.devicePixelRatio

    const ignoreRegions: IgnoreRegion[] = []
    let ignoreElementsMessage: string | undefined

    if (options.ignoreElements) {
      if (typeof options.ignoreElements === 'string') {
        options.ignoreElements = [options.ignoreElements]
      }
      if (options.ignoreElements.length) {
        ignoreElementsMessage = options.ignoreElements
          .map((s) => '"' + s + '"')
          .join(', ')
        // console.log('ignoring elements', options.ignoreElements.join(', '))
        // @ts-ignore
        const win = cy.state('window')
        const doc = win.document
        options.ignoreElements.forEach((selector) => {
          // maybe we need to query all elements and loop through them
          const el = doc.querySelector(selector)
          if (el) {
            const { x, y, width, height } = el.getBoundingClientRect()
            ignoreRegions.push({
              x1: Math.floor(x * devicePixelRatio),
              y1: Math.floor(y * devicePixelRatio),
              x2: Math.ceil((x + width) * devicePixelRatio),
              y2: Math.ceil((y + height) * devicePixelRatio),
            })
          }
        })
      }
    }

    const screenshotOptions: Partial<
      Cypress.ScreenshotOptions & Cypress.Loggable
    > = {
      overwrite: true,
      capture: options.capture === 'clipToViewport' ? 'runner' : 'viewport',
      onAfterScreenshot($el, screenshot) {
        screenshotPath = screenshot.path
      },
      log: false,
    }

    if (options.capture === 'clipToViewport') {
      // we will capture the full screenshot
      // but then we need to clip it back to
      // the application under test
      const applicationIframe =
        window.parent.document.querySelector('.aut-iframe')
      console.log('app iframe', applicationIframe)
      const { x, y, width, height } = applicationIframe!.getBoundingClientRect()
      screenshotOptions.clip = {
        x,
        y,
        width,
        height,
      }
    }

    // grab the real screenshot path
    let screenshotPath: string
    ;(subject ? cy.wrap(subject, { log: false }) : cy)
      .screenshot(name, screenshotOptions)
      // @ts-ignore
      .then(() => {
        const rootFolder = Cypress.config('projectRoot')
        const specName = path.relative(rootFolder, Cypress.spec.absolute)

        const diffNameDirname = specName
        const goldNameFolder = diffNameDirname
          .replaceAll('/', '-')
          .replaceAll('.', '-')

        const mode = Cypress.config('isTextTerminal') ? 'run' : 'open'
        const goldPath = path.join(
          goldImages,
          goldNameFolder,
          Cypress.platform,
          mode,
        )
        const diffName = path.join(goldPath, `${name}.png`)
        const relativeScreenshotPath = path.relative(rootFolder, screenshotPath)

        const diffOptions = {
          name,
          screenshotPath: relativeScreenshotPath,
          goldPath: diffName,
          relativeSpecName: Cypress.spec.relative,
          ignoreRegions,
        }

        if (options.mode === 'async') {
          cy.log(`will diff image ${relativeScreenshotPath} later 👋`)
          cy.task('rememberToDiffImage', diffOptions)
        } else {
          if (ignoreElementsMessage) {
            cy.log(
              `diffing ${relativeScreenshotPath} against ${diffName} while ignoring elements ${ignoreElementsMessage}`,
            )
          } else {
            cy.log(`diffing ${relativeScreenshotPath} against ${diffName}`)
          }
          cy.task<ODiffResult>('diffImage', diffOptions).then((result) => {
            // report the image diffing result, which could be
            // 1: a new image (no previous gold image found)
            // 2: images match
            // 3: images do not match
            // In that case log the diff image path
            // and the percentage of different pixels
            // and then grab the diff image and insert it into the DOM
            // using cy.document and base64 encoded image
            // https://on.cypress.io/document
            // https://on.cypress.io/readfile
            // Tip: make sure to throw an error at the end to fail the test
            if (result.match === true) {
              if ('newImage' in result && result.newImage) {
                cy.log('🖼️ new gold image')
              } else {
                cy.log('✅ images match')
                if (result.reason) {
                  cy.log(result.reason)
                }
              }
            } else {
              cy.log('🔥 images do not match')
              if (result.reason === 'pixel-diff') {
                cy.log(`pixels different: ${result.diffPercentage}`)
                const relativeDiffPath = path.relative(
                  rootFolder,
                  result.diffImagePath,
                )
                cy.log(relativeDiffPath)
                cy.readFile(result.diffImagePath, 'base64', {
                  log: false,
                }).then((diffImage) => {
                  cy.document({ log: false })
                    .its('body', { log: false })
                    .then((el) => {
                      // if element is not a jQuery object, convert it
                      const $body = Cypress.$(el)
                      const approveImage = `
                        const options = {
                          screenshotPath: '${relativeScreenshotPath}',
                          goldPath: '${diffName}',
                        }
                        fetch('http://localhost:9555/approve', {
                          method: 'POST',
                          cors: 'cors',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify(options),
                        }).then(() => {
                          document.getElementById('approve-image').innerText = '✅ approved'
                        })
                      `
                      // reset the body styles to make sure the diff image
                      // is 100% by 100%
                      $body.css({
                        background: 'null',
                        padding: '0',
                        margin: '0',
                        width: '100%',
                      })

                      // remove all class names
                      $body.attr('class', '')
                      const approveButtonStyle =
                        'position:fixed;top:20px;right:20px;padding:10px;border-radius:3px;background-color:white;border:1px solid gray;'

                      $body[0].innerHTML =
                        '<img style="width:100%" src="data:image/png;base64,' +
                        diffImage +
                        '"/><button id="approve-image" style="' +
                        approveButtonStyle +
                        '" onclick="' +
                        approveImage +
                        '" title="Approve new image">👍</button>'
                      throw new Error(
                        `image "${name}" did not match the gold image`,
                      )
                    })
                })
              }
            }
          })
        }
      })
  },
)
