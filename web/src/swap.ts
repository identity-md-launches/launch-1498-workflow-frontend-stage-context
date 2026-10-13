import { encodeAbiParameters, parseAbi, type Address, type Hex } from "viem";
import type { Runtime } from "./config";
export const quoterAbi = parseAbi([
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)",
]);
export const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
export const permitAbi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
const keyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;
export function swapPayload(
  runtime: Runtime,
  input: Address,
  amountIn: bigint,
  minimum: bigint,
) {
  const key = runtime.config.poolKey;
  const zeroForOne = input.toLowerCase() === key.currency0.toLowerCase();
  if (!zeroForOne && input.toLowerCase() !== key.currency1.toLowerCase())
    throw Error("Input is outside the attested pool.");
  const output = zeroForOne ? key.currency1 : key.currency0;
  const fields = [
    { name: "poolKey", type: "tuple", components: keyComponents },
    { name: "zeroForOne", type: "bool" },
    { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" },
    ...(runtime.config.network.uniswapV4.extendedSwapParams
      ? [{ name: "minHopPriceX36", type: "uint256" }]
      : []),
    { name: "hookData", type: "bytes" },
  ];
  const tuple: Record<string, unknown> = {
    poolKey: key,
    zeroForOne,
    amountIn,
    amountOutMinimum: minimum,
    hookData: "0x",
  };
  if (runtime.config.network.uniswapV4.extendedSwapParams)
    tuple.minHopPriceX36 = 0n;
  const params = [
    encodeAbiParameters([{ type: "tuple", components: fields }], [tuple]),
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [input, amountIn],
    ),
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [output, minimum],
    ),
  ];
  return {
    commands: "0x10" as Hex,
    inputs: [
      encodeAbiParameters(
        [{ type: "bytes" }, { type: "bytes[]" }],
        ["0x060c0f", params],
      ),
    ],
    output,
  };
}
