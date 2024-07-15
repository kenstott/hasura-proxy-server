import fs from 'fs'
import path from 'node:path'

/**
 * Traverses the directories in the given directory and executes the provided callback function for each encountered directory.
 *
 * @param {string} dir - The path of the directory to traverse.
 * @param {(filePath: string, stat: fs.Stats) => void} callback - The function to be executed for each directory.
 * @return {void}
 */
export function traverseDirectories (dir: string, callback: (filePath: string, stat: fs.Stats) => void): void {
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      callback(filePath, stat)
      traverseDirectories(filePath, callback)
    }
  })
}
