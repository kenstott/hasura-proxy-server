export const getKeyMap = (keyMap: Map<[string, string], string>, datasetKey: string, columnKey: string): string => {
  const oldKey = keyMap.get([datasetKey, columnKey])
  if (!oldKey) {
    const newKey = convertKey(columnKey)
    keyMap.set([datasetKey, columnKey], newKey)
    return newKey
  }
  return oldKey
}

export const convertKey = (columnKey: string): string => columnKey.split('.').filter(i => isNaN(parseInt(i))).join('.')
