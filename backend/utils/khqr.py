import hashlib


def crc16_ccitt(data: bytes) -> int:
    """CRC-16 CCITT (0xFFFF seed, 0x1021 poly) — required by EMVCo/KHQR spec."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


def build_tlv(tag: str, value: str) -> str:
    """Tag-Length-Value encoding used by EMVCo QR spec."""
    return f"{tag}{len(value):02d}{value}"


def generate_bakong_khqr(
    account_id: str,
    merchant_name: str,
    amount: float,
    currency: str,
    order_number: str,
) -> str:
    """
    Generate a Bakong-compliant dynamic KHQR string.

    Tag 29 structure per NBC KHQR Implementation Guide:
        00 → globally-unique identifier = "bakong.gov.kh"
        01 → merchant Bakong account ID  (e.g. loum_vanchha@bkrt)
    """
    # 00 — Payload Format Indicator
    payload = build_tlv("00", "01")

    # 01 — Point of Initiation Method: 12 = dynamic QR (has amount)
    payload += build_tlv("01", "12")

    # 29 — Merchant Account Information (Bakong)
    #   sub-tag 00: AID  = "bakong.gov.kh"
    #   sub-tag 01: account id
    acct_info = build_tlv("00", "bakong.gov.kh") + build_tlv("01", account_id)
    payload += build_tlv("29", acct_info)

    # 52 — Merchant Category Code (5999 = misc. retail)
    payload += build_tlv("52", "5999")

    # 53 — Transaction Currency: 840 = USD, 116 = KHR
    curr_code = "840" if currency.upper() == "USD" else "116"
    payload += build_tlv("53", curr_code)

    # 54 — Transaction Amount
    payload += build_tlv("54", f"{amount:.2f}")

    # 58 — Country Code
    payload += build_tlv("58", "KH")

    # 59 — Merchant Name (max 25 chars per spec)
    payload += build_tlv("59", merchant_name[:25])

    # 60 — Merchant City
    payload += build_tlv("60", "Phnom Penh")

    # 62 — Additional Data Field
    #   sub-tag 08: Reference Label (maps to our order_number)
    add_data = build_tlv("08", order_number[:25])
    payload += build_tlv("62", add_data)

    # 63 — CRC (computed over everything up to and including the tag+length "6304")
    crc_prefix = payload + "6304"
    crc_val = crc16_ccitt(crc_prefix.encode("utf-8"))
    return crc_prefix + f"{crc_val:04X}"


def get_khqr_md5(khqr_string: str) -> str:
    """MD5 of the KHQR string — used by Bakong's check_transaction_by_md5 endpoint."""
    return hashlib.md5(khqr_string.encode("utf-8")).hexdigest()
