# hasura-proxy-server

A simple solution which proxies a Hasura GraphQL Engine (HGE).

The HGE is a phenomenal low-code product that lets you generate GraphQL endpoints at a fraction of the cost
of many other tools.

## Why?
The hasura-proxy-server facilitates a special class of plugins to augment Hasura features. Overtime I expect
some of the good ideas may become part of the Hasura offering and/or a more robust plugin architecture will become
available.

This repo includes the hasura proxy server, along with several sample plugins.

You can try this out in several ways, which is explained in [Getting Started](#gettingstarted)

## Prerequisites

- If you want to rebuild from source:
  - Typescript
  - NodeJS 20> or Deno
  - Python - for the anomaly detection plugin
- or alternatively download docker (you cand find it at [Docker.com](https://www.docker.com/products/docker-desktop/) for a quick demo without having to download any additional development tools.
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

## Limitations

- Subscriptions have not been tested, and will almost certainly not work without additional coding

## Plugins

### Field-Tracking-Plugin

This plugin will provide span traces with attributes identifying the Object Types and
Fields referenced in a query. The plugin can optionally write field access records with relevant metadata
to a mongodb collection.

You may have good metadata, and good role based access control to make sure the right people get to the right
data. This plugin audits access, and provides a true history of access at the field level. This information
is invaluable to data governance teams who must attest to controls, and is invaluable to data management
and technology teams to assess impact of planned changes.

###
