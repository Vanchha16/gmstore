import sys
sys.path.append(r"E:\VideCode\GMstore\backend")

from utils.khqr import generate_bakong_khqr, get_khqr_md5

# Generate a sample string matching the user's details
khqr = generate_bakong_khqr(
    account_id="loum_vanchha@bkrt",
    merchant_name="GM Store",
    amount=10.00,
    currency="USD",
    order_number="ORDER999"
)

print("\n--- GENERATED DYNAMIC KHQR STRING ---")
print(khqr)
print("\n--- MD5 HASH FOR STATUS CHECKING ---")
print(get_khqr_md5(khqr))
print("------------------------------------\n")
