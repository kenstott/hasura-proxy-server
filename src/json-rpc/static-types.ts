export const staticTypes = {
  Authorization: {
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

export interface Auth {
  'x-hasura-admin-secret'?: string
  baseAuth?: string
  username?: string
  password?: string
  jwt?: string
}
