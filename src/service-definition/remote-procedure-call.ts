import { mapJsonSchemaType } from './field'

interface IRemoteProcedureCall {
  name: string
  service?: string
  returns: Record<string, string>
  args: Record<string, string>
  argType: string
  query?: string
}

/**
 * Represents a remote procedure call. This is an intermediate form of an RPC type that can generate a version for each supported RPC.
 */
export class RemoteProcedureCall implements IRemoteProcedureCall {
  _name: string
  service: string
  returns: Record<string, string>
  args: Record<string, string>
  argType: string
  query?: string

  auth = {
    name: 'auth',
    schema: {
      type: 'object',
      properties: {
        'x-hasura-admin-secret': {
          type: 'string'
        },
        basicAuth: {
          type: 'string'
        },
        username: {
          type: 'string'
        },
        password: {
          type: 'string'
        },
        jwt: {
          type: 'string'
        }
      }
    }
  }

  constructor (props: IRemoteProcedureCall) {
    this.name = props.name
    this.returns = props.returns
    this.argType = props.argType
    this.args = props.args
    this.query = props.query
    this.service = props.service || 'GraphQLService'
  }

  get name (): string {
    return this._name
  }

  set name (value) {
    this._name = value
  }

  print (): string {
    return `rpc ${this.name} ${this.argType ? '(' + this.argType + ')' : ''} returns (${Object.values(this.returns).join(',')});`
  }

  jsonSchema (): Record<string, any> {
    return {}
  }

  jsonRpc (): Record<string, any> {
    const _serviceName = this.service.replace('GraphQLService', '').replace('Service', '')
    return {
      name: (_serviceName.length ? _serviceName + '__' : '') + this.name,
      description: this.query,
      params: [this.auth, ...Object.entries(this.args).map(([name, type]) => ({ name, schema: mapJsonSchemaType(type || '') }))],
      result: {
        name: 'result',
        schema: {
          $ref: `#/components/schemas/${Object.values(this.returns)[0]}`
        }
      }
    }
  }
}
