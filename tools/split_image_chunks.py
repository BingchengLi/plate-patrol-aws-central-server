import base64

# Load the image file
file_path = 'tests/assets/4kb-cropped.png'
# Ensure the file exists
with open(file_path, 'rb') as f:
    image_data = f.read()

# Split into raw binary chunks
chunk_size = 2 * 1024  # 2KB in bytes
binary_chunks = [image_data[i:i + chunk_size] for i in range(0, len(image_data), chunk_size)]

# Encode each chunk separately into base64
base64_chunks = [base64.b64encode(chunk).decode('utf-8') for chunk in binary_chunks]

# Output
for idx, chunk in enumerate(base64_chunks):
    print(f"Chunk {idx + 1} ({len(chunk)} bytes base64):\n{chunk}\n")

# Optionally, prepare a payload list
data_payload = [{'chunk_id': idx, 'data': chunk} for idx, chunk in enumerate(base64_chunks)]

print(f"Generated {len(data_payload)} chunks.")

