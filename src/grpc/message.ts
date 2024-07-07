import { Field, type IField } from './field'
import { JSONSchemaType } from 'ajv'

export interface IMessage {
  name: string
  fields: Array<Partial<IField>>
}

export class Message implements IMessage {
  _name: string
  fields: Field[]

  constructor (props: IMessage) {
    this.name = props.name
    this.fields = props.fields.map(i => new Field(i))
  }

  get name (): string {
    return this._name
  }

  set name (value) {
    this._name = value
  }

  print (): string {
    return `message ${this.name} {` + '\n' +
        this.fields.map((i, index) => '   ' + i.print(index + 1)).join('\n') +
        '\n}\n'
  }

  jsonschema (): Record<string, any> {
    return {
      type: 'object',
      properties: this.fields.reduce((acc, i) => {
        return { ...acc, [i.name || '']: i.jsonSchema() }
      }, {}),
      required: this.fields.filter((i) => i.required).map((i) => i.name)
    }
  }
}
