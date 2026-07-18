import base64
import json
import os
import secrets
import time
import requests
from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3

class PsychosynthConfig:
    def __init__(self, private_key, rpc_url=None, api_url=None):
        self.private_key = private_key
        self.rpc_url = rpc_url or "https://mainnet.base.org"
        self.api_url = api_url or "https://psychosynth.vercel.app"

class PsychosynthClient:
    def __init__(self, config: PsychosynthConfig):
        pk = config.private_key
        self.private_key = pk if pk.startswith("0x") else f"0x{pk}"
        self.rpc_url = config.rpc_url
        self.api_url = config.api_url
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.account = Account.from_key(self.private_key)
        # USDC verification contract must match exactly
        self.usdc_contract = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"

    def list_products(self):
        res = requests.get(f"{self.api_url}/api/v1/products")
        res.raise_for_status()
        return res.json()

    def preview_records(self, slug, filters=None):
        params = filters or {}
        res = requests.get(f"{self.api_url}/api/v1/preview/{slug}", params=params)
        res.raise_for_status()
        return res.json()

    def query_records(self, slug, filters=None):
        url = f"{self.api_url}/api/v1/query/{slug}"
        params = filters or {}
        
        # 1. Check if the resource returns 200 without payment (e.g. preview / free)
        res = requests.get(url, params=params)
        if res.status_code == 200:
            return res.json()
            
        if res.status_code != 402:
            res.raise_for_status()
            
        # 2. Handle x402 payment quote
        quote = res.json()
        accept = quote["accepts"][0]
        
        payout_recipient = accept["payTo"]
        max_amount_required = int(accept["maxAmountRequired"])
        
        # Calculate time drift against latest block
        try:
            latest_block = self.w3.eth.get_block("latest")
            block_timestamp = latest_block["timestamp"]
            drift = int(time.time()) - block_timestamp
        except Exception:
            drift = 0
            
        valid_after = 0
        valid_before = int(time.time()) - drift + 86400  # 1 day window
        nonce = secrets.token_bytes(32)
        
        # 3. Create EIP-712 Typed Data dictionary for eth-account encode_typed_data
        domain_data = {
            "name": "USD Coin",
            "version": "2",
            "chainId": 8453,  # Base Mainnet
            "verifyingContract": Web3.to_checksum_address(self.usdc_contract)
        }
        
        types = {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"}
            ]
        }
        
        message_data = {
            "from": self.account.address,
            "to": Web3.to_checksum_address(payout_recipient),
            "value": max_amount_required,
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce
        }
        
        # Encode EIP-712 structured data
        typed_data = encode_typed_data(
            domain_data=domain_data,
            message_types={"TransferWithAuthorization": types["TransferWithAuthorization"]},
            message_data=message_data
        )
        
        # Sign typed data
        signed = Account.sign_message(typed_data, self.private_key)
        signature = signed.signature.hex()
        
        # Format payload and base64 encode
        x_payment_payload = {
            "scheme": "exact",
            "network": "base",
            "payload": {
                "signature": signature,
                "authorization": {
                    "from": self.account.address,
                    "to": payout_recipient,
                    "value": str(max_amount_required),
                    "validAfter": valid_after,
                    "validBefore": valid_before,
                    "nonce": "0x" + nonce.hex()
                }
            }
        }
        
        payload_json = json.dumps(x_payment_payload).encode("utf-8")
        x_payment_header = base64.b64encode(payload_json).decode("utf-8")
        
        # 4. Resend request with signature header
        headers = {"X-PAYMENT": x_payment_header}
        final_res = requests.get(url, params=params, headers=headers)
        final_res.raise_for_status()
        return final_res.json()
