import base64
import json
import logging
import os
import sys
import pprint

import pyarrow as pa
from pyhasura import HasuraClient


def main():
    try:

        hasura_client = HasuraClient(logging_=logging)
        logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)
        logging.error("Loading data...")

        # Read the string from stdin
        # in form of { threshold: number, data: { [dataset_name]: <base64 encoded arrow table IPC> } }
        request = json.loads(sys.stdin.readline().strip())
        data = request.get('data')
        threshold = request.get('threshold')
        model_out = request.get('modelOut')
        model_in = request.get('modelIn')
        model_in_data = request.get('modelInData')
        selection_set_hash = request.get('selectionSetHash')
        operation_name = request.get('operationName')
        os.environ['MONGODB_CONNECTION_STRING'] = request.get('MONGODB_CONNECTION_STRING')
        if threshold is None:
            threshold = 0
        logging.error("Default threshold: 0")

        if data is None:
            raise Exception("No data provided")

        logging.error(f"Analyzing: {','.join(list(data.keys()))}")

        # Convert arrow tables to JSON arrays
        for key, value in data.items():
            data[key] = pa.ipc.open_stream(pa.py_buffer(base64.b64decode(value))).read_all().to_pylist()

        # initialize pyhasura with data
        hasura_client.set_data(data, operation_name=operation_name)
        result = {}
        if model_out is None:
            logging.info("Evaluating dataset for suspicious records.")
            if model_in == 'SELECTION_SET':
                logging.info(f'Will attempt to use model from selectionSetHash: {selection_set_hash}.')
                result = hasura_client.anomalies(threshold=threshold, selection_set_hash=selection_set_hash)
            elif model_in == 'OPERATION_NAME':
                logging.info(f'Will attempt to use model from operationName: {operation_name}.')
                result = hasura_client.anomalies(threshold=threshold, operation_name=operation_name)
            elif model_in == 'BASE64':
                logging.info('Will attempt to use model from base64 representation.')
                result = hasura_client.anomalies(threshold=threshold, training_base64=json.dumps(model_in_data))
            else:
                logging.info('Will generate model from input dataset.')
                result = hasura_client.anomalies(threshold=threshold)
        else:
            logging.info("Generating anomaly detection model from dataset.")
            if model_out == 'BASE64':
                logging.info("Anomaly output as BASE64 encoded.")
                result['model'] = json.dumps(hasura_client.anomalies_training(base64_encoded_data=True))
            elif model_out == 'SELECTION_SET':
                logging.info(f"Anomaly output saved under selectionSetHash: {selection_set_hash}.")
                result['model'] = json.dumps(hasura_client.anomalies_training(
                    database_output=True, selection_set_hash=selection_set_hash))
            elif model_out == 'OPERATION_NAME':
                logging.info(f"Anomaly output saved under operationName: {operation_name}.")
                result['model'] = json.dumps(hasura_client.anomalies_training(database_output=True))

        print(json.dumps(result))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        # sys.exit(1)


if __name__ == "__main__":
    main()
