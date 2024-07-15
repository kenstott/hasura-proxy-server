import { type JSONSchema7 } from 'json-schema'

const jsonSchemaTypeMap = {
  int32: 'integer',
  string: 'string',
  float: 'number',
  bool: 'boolean',
  object: 'object'
}

const protobufSubstitutionsMap = {
  GraphQLError: 'google.protobuf.Struct',
  object: 'google.protobuf.Struct'
}

export const mapJsonSchemaType = (t: string, description?: string): JSONSchema7 => {
  if (t.startsWith('repeated ')) {
    return {
      type: 'array',
      items: {
        $ref: `#/components/schemas/${t.replace('repeated ', '')}`
      }
    }
  }
  if (jsonSchemaTypeMap[t]) {
    return {
      description: description || '',
      type: jsonSchemaTypeMap[t]
    }
  }
  return {
    description: description || '',
    $ref: `#/components/schemas/${t}`
  }
}

export interface IField {
  name?: string
  type?: string
  required?: boolean
  repeated?: boolean
  description?: string
}

/**
 * Represents a field in a data structure in an intermediate form that can create a version for each type of supported RPC.
 *
 * @class Field
 * @implements {IField}
 */
export class Field implements IField {
  description?: string

  constructor (props: Partial<IField>) {
    this._name = props.name
    this._type = props.type
    this._required = props.required
    this._repeated = props.repeated
    this.description = props.description
  }

  private _name?: string

  get name (): string | undefined {
    return this._name
  }

  set name (value: string) {
    this._name = value
  }

  private _type?: string

  get type (): string | undefined {
    return this._type
  }

  set type (value: string) {
    this._type = value
  }

  private _required?: boolean

  get required (): boolean | undefined {
    return this._required
  }

  set required (value: boolean) {
    this._required = value
  }

  private _repeated?: boolean

  get repeated (): boolean | undefined {
    return this._repeated
  }

  set repeated (value: boolean) {
    this._repeated = value
  }

  print (fieldNumber: number): string {
    return `${this.repeated ? 'repeated ' : ''}${protobufSubstitutionsMap[this.type || ''] ?? this.type} ${this.name} = ${fieldNumber};`
  }

  jsonSchema (): Record<string, any> {
    if (this.repeated) {
      return {
        type: 'array',
        description: this.description,
        items: mapJsonSchemaType(this.type || '')
      }
    } else {
      return mapJsonSchemaType(this.type || '', this.description)
    }
  }
}
