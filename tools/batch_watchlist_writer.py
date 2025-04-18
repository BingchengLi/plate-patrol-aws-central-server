import boto3
import random
import string

def generate_license_plate():
    """Generate a random license plate with 3 uppercase letters and 4 digits."""
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    numbers = ''.join(random.choices(string.digits, k=4))
    return f"{letters}{numbers}"

def batch_insert_plates(table_name, number_of_plates=500):
    # Create a DynamoDB resource
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    # Generate unique license plates
    plates = set()
    while len(plates) < number_of_plates:
        plates.add(generate_license_plate())

    # Batch write items to DynamoDB
    with table.batch_writer() as batch:
        for plate in plates:
            batch.put_item(Item={'plate_number': plate})

    print(f"Successfully inserted {number_of_plates} license plates into {table_name}.")

if __name__ == "__main__":
    table_name = 'global_watchlist_dev'
    batch_insert_plates(table_name)
