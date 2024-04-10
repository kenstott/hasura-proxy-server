import { PythonShell } from 'python-shell'
import * as aq from 'arquero'
import { altPath, altProcess } from '../../common/index.js'

export class GetAnomalousRecords {
  shell: PythonShell

  constructor (pythonPath: string) {
    const options = {
      mode: 'text' as 'text',
      pythonPath,
      scriptPath: altPath.resolve(altProcess.cwd(), 'src/python-scripts'), // Path to the directory containing sample.py
      stderrParser: (msg: string) => {
        console.log(msg)
      }
    }
    this.shell = new PythonShell('anomaly-detection.py', options)
  }

  destroy = (): void => {
    this.shell.end(() => {
    })
  }

  getScores = async (dataset: Array<Record<string, unknown>>, threshold: number): Promise<Array<Record<string, unknown>>> => {
    const arrowTable = aq.from(dataset)
    const arrowTableAsBase64 = Buffer.from(arrowTable.toArrowBuffer()).toString('base64')
    return await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      this.shell.on('message', (msg: string) => {
        const scores = { ...JSON.parse(msg) as number[] }
        const augmentedRecords = Object.entries(scores).reduce<Array<Record<string, unknown>>>((acc, [strIndex, score]) => {
          if ((score as number) < threshold) {
            const index = parseInt(strIndex)
            acc.push({
              ...dataset[index],
              score,
              index
            })
          }
          return acc
        },
        [])
        resolve(augmentedRecords)
      })
      this.shell.on('error', (error) => {
        reject(error)
      })
      this.shell.send(arrowTableAsBase64)
    })
  }
}
