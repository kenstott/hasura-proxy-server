# sample.py
import base64
import json
import logging
import sys

import pyarrow as pa
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction import DictVectorizer


def flatten_nested_dicts(data):
    """
    Flattens an array of nested JSON dictionaries.
    :param data: List of dictionaries
    :return: List of flattened dictionaries
    """

    def flatten(d, parent_key='', sep='_'):
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(flatten(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                for i, item in enumerate(v):
                    items.extend(flatten(item, f"{new_key}{sep}{i}", sep=sep).items())
            else:
                items.append((new_key, v))
        return dict(items)

    return [flatten(d) for d in data]


def main():
    try:

        logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)
        logging.info("Loading data...")

        # Read the base64-encoded data from stdin
        base64_data = sys.stdin.readline().strip()

        # Decode the base64 string to obtain the binary data
        binary_data = base64.b64decode(base64_data)

        # Create an Arrow stream from the binary data
        stream = pa.py_buffer(binary_data)

        # Read the stream and create an Arrow table
        table_from_binary = pa.ipc.open_stream(stream).read_all()

        # Create a array of json dictionaries from
        json_data = table_from_binary.to_pylist()

        # Flatten it
        flattened_json = flatten_nested_dicts(json_data)

        # Vectorize it
        v = DictVectorizer(sparse=False)
        x = v.fit_transform(flattened_json)

        # Generate anomaly scores
        isolation_forest = IsolationForest(n_estimators=100, contamination='auto', random_state=42)
        isolation_forest.fit(x)
        anomaly_scores = isolation_forest.decision_function(x)

        print(json.dumps(anomaly_scores.tolist()))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        # sys.exit(1)


if __name__ == "__main__":
    main()
