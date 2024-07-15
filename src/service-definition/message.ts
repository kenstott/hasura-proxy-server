import { Field, type IField } from './field'

interface IMessage {
  name: string
  description?: string
  fields: Array<Partial<IField>>
}

/**
 * Represents a message. This is an intermediate form of an object type that can generate a version for each supported RPC.
 */
export class Message implements IMessage {
  description?: string
  fields: Field[]

  constructor (props: IMessage) {
    this.name = props.name
    this.description = props.description
    this.fields = props.fields.map(i => new Field(i))
  }

  _name: string

  get name (): string {
    return this._name
  }

  set name (value) {
    this._name = value
  }

  addField (field: Field): void {
    this.fields.push(field)
  }

  print (): string {
    return `message ${this.name} {` + '\n' +
            this.fields.map((i, index) => '   ' + i.print(index + 1)).join('\n') +
            '\n}\n'
  }

  jsonSchema (): Record<string, any> {
    return {
      type: 'object',
      description: this.description || '',
      properties: this.fields.reduce((acc, i) => {
        return { ...acc, [i.name || '']: i.jsonSchema() }
      }, {}),
      required: this.fields.filter((i) => i.required).map((i) => i.name)
    }
  }
}
