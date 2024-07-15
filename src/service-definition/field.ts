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

export const mapJsonSchemaType = (t: string, description?: string): Record<string, string | Record<string, string>> => {
  if (t.startsWith('repeated ')) {
    return {
      description: description || '',
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
  get repeated (): boolean | undefined {
    return this._repeated
  }

  set repeated (value: boolean) {
    this._repeated = value
  }

  get required (): boolean | undefined {
    return this._required
  }

  set required (value: boolean) {
    this._required = value
  }

  get type (): string | undefined {
    return this._type
  }

  set type (value: string) {
    this._type = value
  }

  get name (): string | undefined {
    return this._name
  }

  set name (value: string) {
    this._name = value
  }

  private _name?: string
  private _type?: string
  private _required?: boolean
  private _repeated?: boolean
  description?: string

  constructor (props: Partial<IField>) {
    this._name = props.name
    this._type = props.type
    this._required = props.required
    this._repeated = props.repeated
    this.description = props.description
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
