const jsonSchemaTypeMap = {
  int32: 'integer',
  string: 'string',
  float: 'number',
  bool: 'boolean'
}

const mapJsonSchemaType = (t: string): Record<string, string> => {
  if (jsonSchemaTypeMap[t]) {
    return { type: jsonSchemaTypeMap[t] }
  }
  return {
    $ref: `#/components/schemas/${t}`
  }
}
export interface IField {
  name?: string
  type?: string
  required?: boolean
  repeated?: boolean
}

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

  constructor (props: Partial<IField>) {
    this._name = props.name
    this._type = props.type
    this._required = props.required
    this._repeated = props.repeated
  }

  print (fieldNumber: number): string {
    return `${this.repeated ? 'repeated ' : ''}${this.required ? 'required ' : ''}${this.type} ${this.name} = ${fieldNumber};`
  }

  jsonSchema (): Record<string, any> {
    if (this.repeated) {
      return {
        type: 'array',
        items: mapJsonSchemaType(this.type || '')
      }
    } else {
      return mapJsonSchemaType(this.type || '')
    }
  }
}
