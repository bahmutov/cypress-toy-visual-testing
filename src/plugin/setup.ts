import * as path from 'path'
import * as fs from 'fs'
const { compare } = require('odiff-bin')
const _ = require('lodash')
const pluralize = require('pluralize')
const ghCore = require('@actions/core')
require('console.table')
const fastify = require('fastify')
const { imageSizeFromFile } = require('image-size/fromFile')

type ImageSize = {
  width: number
  height: number
}

const label = 'cypress-toy-visual-testing'

function imageSizeDiffer(image1: ImageSize, image2: ImageSize) {
  if (image1.width === image2.width && image1.height === image2.height) {
    return false
  }

  // compute relative difference for each dimension
  const widthDiff = Math.abs(image1.width - image2.width) / image1.width
  const heightDiff = Math.abs(image1.height - image2.height) / image1.height

  return {
    widthDiff,
    heightDiff,
  }
}

async function diffAnImage(options, config) {
  if (!options) {
    throw new Error('Missing diff options')
  }
  const { screenshotPath, goldPath } = options
  if (!fs.existsSync(goldPath)) {
    console.log('New image %s', screenshotPath)
    if (config.env.failOnMissingGoldImage) {
      console.error('Missing gold image %s', goldPath)
      console.error(
        'Adding new gold images not allowed failOnMissingGoldImage=true',
      )
      throw new Error(`Missing gold image ${goldPath}`)
    }

    console.log('Copied to %s', goldPath)
    // ensure the target folder exists
    const goldFolder = path.dirname(goldPath)
    if (!fs.existsSync(goldFolder)) {
      fs.mkdirSync(goldFolder, { recursive: true })
      console.log('Created folder %s', goldFolder)
    }
    fs.copyFileSync(screenshotPath, goldPath)
    return {
      match: true,
      newImage: true,
      reason: 'Copied new image to gold',
      elapsed: 0,
    }
  } else {
    const basename = path.basename(screenshotPath, '.png')
    const diffImagePath = path.join(
      config.screenshotsFolder,
      `${basename}-diff.png`,
    )
    const odiffOptions = {
      diffColor: '#ff00ff', // cyan
      antialiasing: true,
      threshold: 0.1,
      ignoreRegions: options.ignoreRegions,
      failOnLayoutDiff: options.failOnLayoutDiff,
    }

    console.log(odiffOptions)
    const started = +Date.now()
    const goldImageSize = await imageSizeFromFile(goldPath)
    const screenshotImageSize = await imageSizeFromFile(screenshotPath)
    const dimensionDifference = imageSizeDiffer(
      goldImageSize,
      screenshotImageSize,
    )

    if (dimensionDifference === false) {
      // images are then exact same size
    } else {
      console.log('image size difference:')
      // use tab character to align the columns in the terminal
      console.log(
        '🖼️\t%dx%d gold image size %s',
        goldImageSize.width,
        goldImageSize.height,
        goldPath,
      )
      console.log(
        '📸\t%dx%d screenshot image size %s',
        screenshotImageSize.width,
        screenshotImageSize.height,
        screenshotPath,
      )
      console.log('📲\t%d device pixel ratio', options.devicePixelRatio)
      console.log(
        '📏\t%d width diff ratio %d height diff ratio',
        dimensionDifference.widthDiff,
        dimensionDifference.heightDiff,
      )

      if (config.env.updateGoldImages) {
        console.log('Updating gold image %s', goldPath)
        fs.copyFileSync(screenshotPath, goldPath)
        return {
          match: true,
          diffImagePath,
          elapsed: 0,
          reason: 'Updated gold image',
        }
      }
    }

    if (
      options.failOnLayoutDiff &&
      options.dimensionTolerance > 0 &&
      dimensionDifference
    ) {
      if (
        dimensionDifference.widthDiff > options.dimensionTolerance ||
        dimensionDifference.heightDiff > options.dimensionTolerance
      ) {
        console.error(
          'Image dimensions differ by more than %d%%',
          options.dimensionTolerance * 100,
        )
        return {
          match: false,
          elapsed: 0,
          reason: 'Image dimensions differ above tolerance',
        }
      } else {
        console.log(
          'Image dimensions differ within tolerance, disabling layout diff',
        )
        odiffOptions.failOnLayoutDiff = false
      }
    }

    const result = await compare(
      goldPath,
      screenshotPath,
      diffImagePath,
      odiffOptions,
    )
    const finished = +Date.now()
    const elapsed = finished - started

    if (options.ignoreRegions && options.ignoreRegions.length) {
      console.log(
        'diffing %s and %s with %d ignored regions, took %dms',
        screenshotPath,
        goldPath,
        options.ignoreRegions.length,
        elapsed,
      )
    } else {
      console.log(
        'diffing %s and %s, took %dms',
        screenshotPath,
        goldPath,
        elapsed,
      )
    }
    const projectRoot = config.projectRoot
    const relativeDiffImageName = path.relative(projectRoot, diffImagePath)
    console.log('with result diff in image %s', relativeDiffImageName)
    console.dir(result)

    // if we work on a PR we want to update the Gold images
    // so that the user reviews the changes
    if (result.match === false) {
      if (
        'diffPercentage' in options &&
        options.diffPercentage > 0 &&
        result.diffPercentage < options.diffPercentage
      ) {
        console.log(
          'image difference below threshold %d',
          options.diffPercentage,
        )
        result.match = true
        result.reason = 'Diff below threshold'
      }
    }

    if (result.match === false && config.env.updateGoldImages) {
      console.log('Updating gold image %s', goldPath)
      fs.copyFileSync(screenshotPath, goldPath)
      result.match = true
      result.reason = 'Updated gold image'
    }

    console.log('%s: images matched? %s', label, result.match)
    return {
      ...result,
      match: Boolean(result.match),
      diffImagePath,
      elapsed,
    }
  }
}

export function setupVisualTesting(on, config) {
  // Create a local server to receive image approval
  const server = fastify({ logger: true })
  server.options('/approve', (req, res) => {
    res
      .headers({
        Allow: 'OPTIONS, POST',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type',
      })
      .status(200)
      .send()
  })

  server.post('/approve', async (req, res) => {
    const options = req.body
    const { screenshotPath, goldPath } = options
    console.log(
      '👍 User approved image %s to replace %s',
      screenshotPath,
      goldPath,
    )
    // ensure the target folder exists
    const goldFolder = path.dirname(goldPath)
    if (!fs.existsSync(goldFolder)) {
      fs.mkdirSync(goldFolder, { recursive: true })
      console.log('Created folder %s', goldFolder)
    }
    fs.copyFileSync(screenshotPath, goldPath)

    res
      .headers({
        'access-control-allow-origin': '*',
        'access-control-request-headers': 'Content-Type',
      })
      .send({ status: 'ok' })
  })
  server.listen({ port: 9555 }).then(() => {
    console.log('image server listening on port 9555')
  })

  // keep track of images even in sync or async modes
  let newImages = 0
  let matchingImages = 0
  let differentImages = 0

  const imagesToDiff = []
  on('before:run', () => {
    imagesToDiff.length = 0
    newImages = 0
    matchingImages = 0
    differentImages = 0
  })

  on('after:run', async () => {
    if (imagesToDiff.length) {
      console.log('Need to diff %d images', imagesToDiff.length)
      const bySpec = _.groupBy(imagesToDiff, (o) => o.relativeSpecName)
      const specNames = Object.keys(bySpec)

      const specsText = pluralize('spec', specNames.length, true)
      const imagesText = pluralize('image', imagesToDiff.length, true)
      const title = `Visual testing: ${specsText}, ${imagesText}`
      if (process.env.GITHUB_ACTIONS) {
        ghCore.summary.addHeading(title)
      } else {
        console.log(title)
      }

      for (const specName of specNames) {
        console.log('diffing images for spec %s', specName)
        const images = bySpec[specName]
        // output github summary rows for this spec
        const rows = []

        for (const options of images) {
          const result = await diffAnImage(options, config)
          if (result.newImage) {
            newImages += 1
            rows.push(['🖼️', options.name, '--'])
          } else if (result.match === true) {
            matchingImages += 1
            rows.push(['✅', options.name, '--'])
          } else {
            differentImages += 1
            rows.push(['❌', options.name, result.diffPercentage.toFixed(3)])
          }
        }

        if (process.env.GITHUB_ACTIONS) {
          ghCore.summary.addHeading(specName, 2).addTable([
            [
              { data: 'Status', header: true },
              { data: 'Name', header: true },
              { data: 'Diff %', header: true },
            ],
            ...rows,
          ])
        } else {
          console.log('spec %s', specName)
          console.table(['Status', 'Name', 'Diff %'], rows)
        }
      }
    }

    // print the final stats
    // end of all diffing
    const countsText = `Visual testing: ${newImages} 🖼️ ${matchingImages} ✅ ${differentImages} ❌`
    if (process.env.GITHUB_ACTIONS) {
      ghCore.summary.addRaw(countsText, true).write()
      // set the job outputs
      ghCore.setOutput('new_images', newImages)
      ghCore.setOutput('matching_images', matchingImages)
      ghCore.setOutput('different_images', differentImages)
      const countsWords = `${newImages} new images ${matchingImages} matching ${differentImages} different`
      ghCore.setOutput('visual_description', countsWords)
      // match the github action status
      ghCore.setOutput(
        'visual_status',
        differentImages > 0 ? 'failure' : 'success',
      )
    } else {
      console.log(countsText)
    }
  })

  on('task', {
    rememberToDiffImage(options) {
      const { screenshotPath, goldPath } = options
      console.log(
        '💾 Remember to diff images\n - %s\n - %s',
        screenshotPath,
        goldPath,
      )
      imagesToDiff.push(options)
      return null
    },

    approveImage(options) {
      const { screenshotPath, goldPath } = options
      console.log(
        '👍 User approved image %s to replace %s',
        screenshotPath,
        goldPath,
      )
      // ensure the target folder exists
      const goldFolder = path.dirname(goldPath)
      if (!fs.existsSync(goldFolder)) {
        fs.mkdirSync(goldFolder, { recursive: true })
        console.log('Created folder %s', goldFolder)
      }
      fs.copyFileSync(screenshotPath, goldPath)

      return null
    },

    async diffImage(options) {
      const result = await diffAnImage(options, config)

      if (result.newImage) {
        newImages += 1
      } else if (result.match === true) {
        matchingImages += 1
      } else {
        if ('diffPercentage' in options && options.diffPercentage > 0) {
          if (result.diffPercentage < options.diffPercentage) {
            console.log(
              '👍 Image %s diff %d is within diff percentage %d',
              options.name,
              result.diffPercentage,
              options.diffPercentage,
            )
            matchingImages += 1
            result.match = true
          } else {
            differentImages += 1
          }
        } else {
          differentImages += 1
        }
      }

      return result
    },
  })
}
