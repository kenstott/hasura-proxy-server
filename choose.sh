#!/bin/bash

if [ "$RUNTIME" = "deno" ]; then
    # Run the "run-deno" npm script
    npm run run-deno
else
    # Run the "run-node" npm script
    npm run run-node
fi
