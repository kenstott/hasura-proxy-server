export const getKeyMap = (keyMap: Map<[string, string], string>, datasetKey: string, columnKey: string): string => {
  const oldKey = keyMap.get([datasetKey, columnKey])
  if (!oldKey) {
    const newKey = columnKey.replace(/[0-9.]+$/, '')
    keyMap.set([datasetKey, columnKey], newKey)
    return newKey
  }
  return oldKey
}
