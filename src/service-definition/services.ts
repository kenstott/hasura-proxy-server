import { RemoteProcedureCall } from './remote-procedure-call.js'
import { Message } from './message'
import path from 'path'
import { traverseDirectories } from '../common/index.js'
import fs from 'fs'
import gql from 'graphql-tag'
import { Kind, type TypeNode } from 'graphql'
import { Field } from './field'
import { ScalarTypeToGrpcType } from './generate-field-from-type'

export const convertType = (typeNode: TypeNode): string => {
  if (typeNode.kind === Kind.NAMED_TYPE) {
    return ScalarTypeToGrpcType[typeNode.name.value] || typeNode.name.value
  } else if (typeNode.kind === Kind.LIST_TYPE) {
    return `repeated ${convertType(typeNode.type)}`
  } else if (typeNode.kind === Kind.NON_NULL_TYPE) {
    return convertType(typeNode.type)
  }
  return 'undefined'
}
export const generateServices = (): {
  services: Record<string, Record<string, RemoteProcedureCall>>
  supportingMessages: Record<string, Message>
} => {
  if (!process.env.RESTIFIED_OPS) {
    return { services: {}, supportingMessages: {} }
  }
  const services = {}
  const supportingMessages = {}
  const basePath = path.resolve(process.env.RESTIFIED_OPS)
  let argType = ''
  traverseDirectories(basePath, (filePath: string, _stat: fs.Stats) => {
    const restOp = path.basename(filePath)
    if (['get', 'post'].includes(restOp)) {
      const servicePath = path.parse(filePath).dir.replace(basePath, '').split(/[/\\]/).slice(1).join('__')
      const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
      for (const filename of files) {
        const opName = path.parse(filename).name
        const query = fs.readFileSync(path.resolve(filePath, filename)).toString('utf-8')
        const opParsed = gql(query)
        const args = opParsed.definitions.reduce<Record<string, string>>((acc, i) => {
          if (i.kind === Kind.OPERATION_DEFINITION && i.variableDefinitions) {
            for (const variable of i.variableDefinitions) {
              if (variable.kind === Kind.VARIABLE_DEFINITION) {
                acc = { ...acc, [variable.variable.name.value]: convertType(variable.type) }
              }
            }
          }
          return acc
        }, {})
        if (Object.keys(args).length) {
          argType = `${opName}Request`
          supportingMessages[argType] = new Message({
            name: argType,
            fields: Object.entries(args).map(([name, type]) => new Field({ name, type }))
          })
        }
        const service = new RemoteProcedureCall({
          service: servicePath ? servicePath + 'Service' : undefined,
          name: opName,
          args,
          argType,
          query,
          returns: { [`${opName}SelectionSet`]: `${opName}Result` }
        })
        if (!services[service.service]) {
          services[service.service] = {}
        }
        services[service.service] = { ...services[service.service], [service.name]: service }
      }
    }
  })
  return { services, supportingMessages }
}
