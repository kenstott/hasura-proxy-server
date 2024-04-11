# hasura-proxy-server

Add new features and capabilities to an existing Hasura GraphQL endpoint using the Hasura Proxy Server.

For example, field-level traces, data validation, data profiling, and naming standards enforcement are all simple and easy to do with the hasura-proxy-server.

The HGE is a phenomenal low-code product that lets you generate GraphQL endpoints at a fraction of the cost
of many other tools.

## Why?
The hasura-proxy-server facilitates a special class of plugins to augment Hasura features. Overtime I expect
some of the good ideas may become part of the Hasura offering and/or a plugin architecture will become
available.

This repo includes the hasura proxy server, along with several sample plugins.

[Getting Started](#getting-started) explains your alternatives in demoing it. 

## Prerequisites

- If you want to rebuild from source:
  - Typescript
  - NodeJS 20+ or Deno
  - Python - for the anomaly detection plugin
- or alternatively download docker (you can find it at [Docker.com](https://www.docker.com/products/docker-desktop/) for a quick demo without having to download any additional development tools.
- optionally a Hasura GraphQL Engine login. (If you don't have one head to [Hasura Cloud](http://cloud.hasura.io) and sign-up). Otherwise we'll use a demo account setup just to illustrate the use of the proxy server.
- optionally a MongoDB login (you can create one here: [MongoDB Atlas](https://www.mongodb.com/lp/cloud/atlas)).

## Getting Started

### Alternative #1: Docker

If you don't have it already, download docker at [Docker.com](https://www.docker.com/products/docker-desktop/).

once docker is installed, navigate to the root of this repo, and:

```shell
docker compose up
```

Connect to http://localhost:8080 - and you should see something like this:

![Initial Query Screen](/docs/images/intro-screen.png)

You will be connected to a demo instance of Hasura GraphQL Engine. To verify that its working, enter this query in the operation window:

```gql
query listCarts {
  carts {
    id
    created_at
  }
}
```

Enter this in the headers area:

```json
{
  "x-hasura-admin-secret": "6vzvekRIQ22nR7B5wJLYPXopg4IdcctCHyevpEI4QFQH7ErgPEL6I540qFwDj60q"
}
```

Click on the query button, and you should see this:

![Sample Query Results](/docs/images/query-results.png)

The demo has 9 different plugins installed. One of them is the field-tracking plugin. If you go to your docker container and look in the logs you would see something like this:

![Query Log](/docs/images/log.png)

You can see that trace has been created with an attribute that references card.id. Telling you that the field was queried, the query (or context) it was queried, and the authenticated
userid (if there is one).

## Limitations

- Subscriptions are not supported.

## Plugins

### Field-Tracking-Plugin

This plugin will provide span traces with attributes identifying the Object Types and
Fields referenced in a query. The plugin can optionally write field access records with relevant metadata
to a mongodb collection, to simplify reporting.

You may have good metadata, and good role based access control to make sure the right people get to the right
data. This plugin audits access, and provides a true history of access at the field level. This information
is invaluable to data governance teams who must attest to controls, and is invaluable to data management
and technology teams to assess impact of planned changes.

###
