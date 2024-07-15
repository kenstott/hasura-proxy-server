interface IEnum {
  name: string
  descriptions?: Record<string, string | null>
  values: Record<string, string | number>
}

/**
 * Represents an enumeration in an intermediate form that can create a version for each type of supported RPC.
 * @implements {IEnum}
 */
export class Enum implements IEnum {
  values: Record<string, string | number>
  descriptions?: Record<string, string | null>

  constructor (props: IEnum) {
    this.name = props.name
    this.descriptions = props.descriptions
    this.values = props.values
  }

  _name: string

  get name (): string {
    return this._name
  }

  set name (value) {
    this._name = value
  }

  print (): string {
    return `enum ${this.name} {` + '\n' +
            Object.entries(this.values).map(([name, _], index) => '   ' + name + ' = ' + index + ';').join('\n') +
            '\n}\n'
  }

  jsonSchema (): Record<string, any> {
    return {
      type: 'string',
      enum: Object.values(this.values)
    }
  }
}
