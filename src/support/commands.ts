import * as path from 'path-browserify'

const goldImages = 'cypress/gold'

type ODiffResult =
  | { match: true; reason?: string; elapsed: number }
  | {
      match: true
      newImage: true
      elapsed: number
      reason: 'Copied new image to gold'
    }
  | {
      match: false
      result: string
      reason: string
      diffPercentage: number
      diffImagePath: string
      elapsed: number
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
    const devicePixelRatio = window.devicePixelRatio
    cy.log(`imageDiff **${name}**, device pixel ratio ${devicePixelRatio}`)

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
        const win: Window = cy.state('window')
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

    let whatToCapture: 'viewport' | 'fullPage' | 'runner' = 'fullPage'
    if ('capture' in options) {
      if (options.capture === 'viewport') {
        whatToCapture = 'viewport'
      } else if (options.capture === 'clipToViewport') {
        whatToCapture = 'runner'
      }
    }

    const screenshotOptions: Partial<
      Cypress.ScreenshotOptions & Cypress.Loggable
    > = {
      overwrite: true,
      // capture the entire application under test
      capture: whatToCapture,
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
      // console.log('app iframe', applicationIframe)
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
        const specName: string = path.relative(
          rootFolder,
          Cypress.spec.absolute,
        )

        const diffNameDirname = specName
        const goldNameFolder = diffNameDirname
          .replaceAll('/', '-')
          .replaceAll('.', '-')

        const mode = Cypress.config('isTextTerminal') ? 'run' : 'open'
        const fullGoldPath: string = path.join(
          goldImages,
          goldNameFolder,
          Cypress.platform,
          mode,
        )
        const diffName: string = path.join(fullGoldPath, `${name}.png`)
        const relativeScreenshotPath: string = path.relative(
          rootFolder,
          screenshotPath,
        )

        const diffOptions = {
          name,
          screenshotPath: relativeScreenshotPath,
          goldPath: diffName,
          relativeSpecName: Cypress.spec.relative,
          ignoreRegions,
          diffPercentage: options.diffPercentage,
          devicePixelRatio,
          failOnLayoutDiff:
            'failOnLayoutDiff' in options ? options.failOnLayoutDiff : true,
          dimensionTolerance: options.dimensionTolerance,
        }

        if (options.mode === 'async') {
          cy.log(`will diff image ${relativeScreenshotPath} later 👋`)
          cy.task('rememberToDiffImage', diffOptions)
        } else {
          let message = `diffing ${relativeScreenshotPath} against ${diffName}`
          if (ignoreElementsMessage) {
            message += ` while ignoring elements ${ignoreElementsMessage}`
            cy.log(
              `diffing ${relativeScreenshotPath} against ${diffName} while ignoring elements ${ignoreElementsMessage}`,
            )
          }
          if (options.diffPercentage > 0) {
            message += ` with max ${options.diffPercentage}% difference`
          }

          cy.log(message)
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
                cy.log(`✅ images match, took ${result.elapsed}ms`)
                if (result.reason) {
                  cy.log(result.reason)
                }
              }
            } else {
              cy.log(`🔥 images do not match, took ${result.elapsed}ms`).then(
                () => {
                  if (result.reason === 'pixel-diff') {
                    cy.log(`pixels different: ${result.diffPercentage} %`)
                    const relativeDiffPath: string = path.relative(
                      rootFolder,
                      result.diffImagePath,
                    )
                    cy.log(relativeDiffPath)
                    cy.readFile(result.diffImagePath, 'base64', {
                      log: false,
                    }).then((diffImage: string) => {
                      cy.readFile(relativeScreenshotPath, 'base64', {
                        log: false,
                      }).then((screenshotImage: string) => {
                        cy.readFile(diffName, 'base64', {
                          log: false,
                        }).then((goldImage: string) => {
                          const log = Cypress.log({
                            name: 'imageDiff',
                            displayName: 'Image diff',
                            type: 'parent',
                            autoEnd: false,
                          }).snapshot('DOM')

                          cy.document({ log: false })
                            .its('body', { log: false })
                            .then((el) => {
                              // if element is not a jQuery object, convert it
                              const $body = Cypress.$(el)

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
                              const styles = `
                                .diff-buttons {
                                  position:fixed;
                                  top:20px;
                                  right:10px;
                                  display: flex;
                                  flex-direction: row;
                                }
                                button.diff-button {
                                  margin-right:10px;
                                  padding:5px 10px;
                                  border-radius:3px;
                                  background-color:white;
                                  border:1px solid lightGray;
                                }
                                button.diff-button:hover {
                                  background-color:lightGray;
                                }
                                button.diff-button.selected {
                                  background-color: gray;
                                  border-color: black;
                                }
                              `

                              $body[0].innerHTML =
                                '<style>' +
                                styles +
                                '</style>' +
                                '<img id="current-diff-image" style="width:100%" src="data:image/png;base64,' +
                                screenshotImage +
                                '"/>'
                              log.snapshot('current image')
                              // @ts-ignore
                              const doc = cy.state('document')
                              doc.getElementById('current-diff-image').src =
                                `data:image/png;base64,${goldImage}`
                              log.snapshot('gold image')
                              doc.getElementById('current-diff-image').src =
                                `data:image/png;base64,${diffImage}`

                              // show the current image in the browser and take the DOM snapshot

                              if (Cypress.config('isInteractive')) {
                                // we are running in the "cypress open" mode
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
                                const showScreenshotImage = `
                                  document.querySelectorAll('button.diff-button').forEach((btn) => {
                                    btn.classList.remove('selected')
                                  })
                                  document.getElementById('screenshot-image').classList.add('selected')
                                  document.getElementById('current-diff-image').src = 'data:image/png;base64,${screenshotImage}'
                                `
                                const showGoldImage = `
                                  document.querySelectorAll('button.diff-button').forEach((btn) => {
                                    btn.classList.remove('selected')
                                  })
                                  document.getElementById('gold-image').classList.add('selected')
                                  document.getElementById('current-diff-image').src = 'data:image/png;base64,${goldImage}'
                                `
                                const showDiffImage = `
                                  document.querySelectorAll('button.diff-button').forEach((btn) => {
                                    btn.classList.remove('selected')
                                  })
                                  document.getElementById('diff-image').classList.add('selected')
                                  document.getElementById('current-diff-image').src = 'data:image/png;base64,${diffImage}'
                                `

                                const screenshotImageButton =
                                  '<button id="screenshot-image" class="diff-button" onclick="' +
                                  showScreenshotImage +
                                  '" title="Current screenshot">📸</button>'

                                const goldImageButton =
                                  '<button id="gold-image" class="diff-button" onclick="' +
                                  showGoldImage +
                                  '" title="Gold image">🖼️</button>'

                                const diffImageButton =
                                  '<button id="diff-image" class="diff-button selected" onclick="' +
                                  showDiffImage +
                                  '" title="Diff image">👀</button>'

                                const approveButton =
                                  '<button id="approve-image" class="diff-button" onclick="' +
                                  approveImage +
                                  '" title="Approve new image">👍</button>'

                                $body[0].innerHTML =
                                  '<style>' +
                                  styles +
                                  '</style>' +
                                  '<img id="current-diff-image" style="width:100%" src="data:image/png;base64,' +
                                  diffImage +
                                  '"/>' +
                                  '<div class="diff-buttons">' +
                                  screenshotImageButton +
                                  goldImageButton +
                                  diffImageButton +
                                  approveButton +
                                  '</div>'
                              }
                              const message = `image "${name}" did not match the gold image`
                              const error = new Error(message)
                              log.snapshot('diff image').error(error)

                              throw error
                            })
                        })
                      })
                    })
                  } else {
                    throw new Error(
                      `image "${name}" mismatch due to ${result.reason}`,
                    )
                  }
                },
              )
            }
          })
        }
      })
  },
)
