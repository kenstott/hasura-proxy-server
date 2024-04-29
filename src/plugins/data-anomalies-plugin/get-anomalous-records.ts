import { PythonShell } from 'python-shell'
import * as aq from 'arquero'
import { altPath, altProcess } from '../../common/index.js'
import type { ObjMap } from '../helpers/index.js'
import _ from 'lodash'
import { MONGODB_CONNECTION_STRING } from '../../proxy-server/config.js'

export enum ModelOutput {
  base64 = 'BASE64',
  selectionSet = 'SELECTION_SET',
  operationName = 'OPERATION_NAME',
  none = 'NONE'
}

export interface GetScoresOptions {
  data: ObjMap<unknown>
  threshold: number
  modelOut?: ModelOutput
  modelIn?: ModelOutput
  modelInData?: string
  selectionSetHash?: string
  operationName?: string
}

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

  getScores = async (options: GetScoresOptions): Promise<ObjMap<unknown>> => {
    const { data } = options
    options.data = Object.entries(data).reduce<ObjMap<unknown>>((acc, [key, dataset]) => {
      const cleansed = (dataset as Array<Record<string, unknown>>).map((i: Record<string, unknown>) => _.omit(i, ['_timestamp', 'replayID', '_index']))
      return { ...acc, [key]: Buffer.from(aq.from(cleansed).toArrowBuffer()).toString('base64') }
    }, {})
    return await new Promise<ObjMap<unknown>>((resolve, reject) => {
      this.shell.on('message', (msg: string) => {
        resolve(JSON.parse(msg) as ObjMap<unknown>)
      })
      this.shell.on('error', (error) => {
        reject(error)
      })
      this.shell.send(JSON.stringify({ ...options, MONGODB_CONNECTION_STRING }))
    })
  }
}
