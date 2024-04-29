import { PythonShell } from 'python-shell'
import * as aq from 'arquero'
import { altPath, altProcess } from '../../common/index.js'
import { type ObjMap } from '../helpers/index.js'

export class GetClusters {
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
    this.shell = new PythonShell('clusters.py', options)
  }

  destroy = (): void => {
    this.shell.end(() => {
    })
  }

  getClusters = async (data: ObjMap<unknown>, clusters: number): Promise<ObjMap<unknown>> => {
    const outData = Object.entries(data).reduce<ObjMap<unknown>>((acc, [key, dataset]) => {
      return { ...acc, [key]: Buffer.from(aq.from(dataset as unknown[]).toArrowBuffer()).toString('base64') }
    }, {})
    return await new Promise<ObjMap<unknown>>((resolve, reject) => {
      this.shell.on('message', (msg: string) => {
        resolve(JSON.parse(msg) as ObjMap<unknown>)
      })
      this.shell.on('error', (error) => {
        reject(error)
      })
      this.shell.send(JSON.stringify({ clusters, data: outData }))
    })
  }
}
