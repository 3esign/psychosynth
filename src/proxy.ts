import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createPublicClient, createWalletClient, http, hexToSignature, verifyTypedData, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { dbAdmin } from '@/modules/core/db';

const usdcContractAddress = getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');

const usdcAbi = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'external',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  }
] as const;

const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

const payoutAddress = getAddress(process.env.X402_PAYOUT_ADDRESS!);
const settlementPrivateKey = process.env.SETTLEMENT_PRIVATE_KEY!;

const settlementAccount = privateKeyToAccount(settlementPrivateKey as `0x${string}`);
const walletClient = createWalletClient({
  account: settlementAccount,
  chain: base,
  transport: http(rpcUrl),
});

function safeBase64Decode(data: string): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    return globalThis.atob(data);
  }
  return Buffer.from(data, 'base64').toString('utf-8');
}

export async function proxy(request: NextRequest) {
  // Only paywall /api/v1/query/:path*
  if (request.nextUrl.pathname.startsWith('/api/v1/query/')) {
    const xPayment = request.headers.get('X-PAYMENT');

    const paymentQuote = {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          price: '$0.01',
          network: 'base',
          payTo: payoutAddress,
          maxAmountRequired: '10000', // $0.01 USDC (6 decimals)
          asset: usdcContractAddress,
          maxTimeoutSeconds: 86400,
          resource: request.url,
          description: 'Synthetic Big Five personality profiles - per query',
          mimeType: 'application/json',
          extra: {
            name: 'USD Coin',
            version: '2',
          },
        },
      ],
    };

    if (!xPayment) {
      return NextResponse.json(paymentQuote, {
        status: 402,
        headers: { 'x-402-payment-required': 'true' },
      });
    }

    try {
      // Decode X-PAYMENT header
      const decoded = safeBase64Decode(xPayment);
      const paymentPayload = JSON.parse(decoded);

      const { scheme, network, payload } = paymentPayload;
      if (scheme !== 'exact' || network !== 'base') {
        throw new Error('Unsupported scheme or network');
      }

      const { signature, authorization } = payload;
      const { from, to, value, validAfter, validBefore, nonce } = authorization;

      // 1. Off-chain EIP-3009 Signature Verification (Free)
      const isValid = await verifyTypedData({
        address: from as `0x${string}`,
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 8453, // Base Mainnet
          verifyingContract: usdcContractAddress,
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: from as `0x${string}`,
          to: to as `0x${string}`,
          value: BigInt(value),
          validAfter: BigInt(validAfter),
          validBefore: BigInt(validBefore),
          nonce: nonce as `0x${string}`,
        },
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      // Check recipient and value match our quote
      if (to.toLowerCase() !== payoutAddress.toLowerCase()) {
        throw new Error('Payout recipient address mismatch');
      }
      if (BigInt(value) < BigInt(10000)) {
        throw new Error('Insufficient payment amount');
      }

      // Check authorization time window off-chain — the chain would reject these
      // anyway, but only AFTER we spent settlement gas on the attempt.
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      if (BigInt(validBefore) <= nowSec) {
        throw new Error('Payment authorization expired (validBefore in the past)');
      }
      if (BigInt(validAfter) > nowSec) {
        throw new Error('Payment authorization not yet valid (validAfter in the future)');
      }

      // 2. Replay protection: reject signatures we have already settled.
      // payment_sig has a unique index (migration 0005); tx_ref holds the tx hash.
      const { data: existingPayment } = await dbAdmin
        .from('x402_payments')
        .select('id')
        .eq('payment_sig', signature)
        .maybeSingle();

      if (existingPayment) {
        throw new Error('Payment signature already used (replay)');
      }

      // 3. Submit transaction on-chain using the settlement key
      const { r, s, v } = hexToSignature(signature as `0x${string}`);
      const txHash = await walletClient.writeContract({
        address: usdcContractAddress,
        abi: usdcAbi,
        functionName: 'transferWithAuthorization',
        args: [
          from as `0x${string}`,
          to as `0x${string}`,
          BigInt(value),
          BigInt(validAfter),
          BigInt(validBefore),
          nonce as `0x${string}`,
          Number(v),
          r,
          s,
        ],
      });

      // 4. Wait for receipt to guarantee settlement before serving request
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        throw new Error('USDC transferWithAuthorization transaction failed on-chain');
      }

      // Forward buyer details to route handler using request headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-buyer-wallet', from);
      requestHeaders.set('x-tx-ref', txHash); // Actual on-chain settlement tx hash
      requestHeaders.set('x-payment-sig', signature); // Client signature — stored for replay protection
      requestHeaders.set('x-next-pathname', request.nextUrl.pathname);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (e: any) {
      console.error('[payment-gate-error]', e);
      return NextResponse.json(
        { error: 'Payment verification failed', message: e.message || String(e) },
        { status: 400 }
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', request.nextUrl.pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/v1/query/:path*', '/lab', '/lab/:path*'],
};
