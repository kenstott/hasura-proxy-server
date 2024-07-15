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
