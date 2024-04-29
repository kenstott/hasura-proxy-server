import base64
import json
import logging
import sys

import pyarrow as pa
from pyhasura import HasuraClient, ExportFormat


def main():
    try:
        hasura_client = HasuraClient(logging_=logging)
        logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)
        logging.info("Loading data...")

        # Read the string from stdin
        # in form of { clusters: number, data: { [dataset_name]: <base64 encoded arrow table IPC> } }
        request = json.loads(sys.stdin.readline().strip())
        if request.get('clusters') is not None:
            logging.info(f"Will cluster into {request['clusters']} buckets.")
        else:
            logging.info("Will cluster into optimum number of buckets")
        data = request.get('data')
        clusters = request.get('clusters')

        if data is None:
            raise Exception("No data provided")

        if clusters is not None:
            clusters = int(clusters)

        logging.info(f"Clustering: {','.join(list(data.keys()))}")

        # Convert arrow tables to JSON arrays
        for key, value in data.items():
            data[key] = pa.ipc.open_stream(pa.py_buffer(base64.b64decode(value))).read_all().to_pylist()

        # initialize pyhasura with data
        hasura_client.set_data(data)

        # define # of clusters
        result = {}
        if request.get('clusters') is None:
            result = hasura_client.optimal_number_of_clusters(2, 50)
        else:
            for key, value in request.get('data').items():
                result[key] = request.get('clusters')

        # get clustered datasets
        result = hasura_client.clusters(result)

        # send back result
        print(json.dumps(result))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        # sys.exit(1)


if __name__ == "__main__":
    main()
