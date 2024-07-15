# sample-plugin

This plugin reduce the original dataset to subset. But any analysis plugins continue to operate against the full
dataset.

It should be placed after any analysis plugins - since the original dataset is truncated once this plug-in runs.

## Parameters

```graphql
@sample(count: Int!, random: Boolean = false, fromEnd: Boolean = false)
```

| Name    | Type    | Purpose                                                                                                                                          |
|---------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| count   | Int!    | This is the only required field. It defines the number of records to return in the subset of results.                                            |
| random  | Boolean | Defaults to false. If true, records returned are randomized.                                                                                     |
| fromEnd | Boolean | Defaults to false. If true, and `random` is false, return the records from the end of the dataset, other wise from the beginning of the dataset. |
