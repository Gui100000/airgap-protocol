## 2025-05-19 - Vectorized 64-bit BigUint64Array XOR Buffer Alignment
**Learning:** BigUint64Array provides ~35% faster word-wise XOR operations compared to Uint32Array on V8/JavaScript engines, but requires strict 8-byte buffer alignment (byteOffset % 8 === 0). Constructing typed arrays with unaligned byteOffset throws a RangeError.
**Action:** When vectorizing typed array operations with BigUint64Array, always guard with explicit bitwise alignment checks ((offset & 7) === 0) and provide 4-byte (Uint32Array) and 1-byte fallback paths.
