// Build-only stub for two three.js example loaders that widgets/iso-map
// never uses (grep confirms: only OrbitControls, interactivity,
// MeshLineGeometry, MeshLineMaterial, Edges, HTML, useOrbitControls are
// imported from @threlte/extras). @threlte/extras' barrel `index.js` also
// re-exports useDraco/useGltf/useKtx2, and DRACOLoader.js/KTX2Loader.js each
// carry a MODULE-TOP-LEVEL `new URL('../libs/.../*.wasm', import.meta.url)`
// — Vite's asset pipeline emits that file the moment the module is reached
// by the import graph, regardless of whether the exported class is ever
// instantiated. @threlte/extras has no `sideEffects: false` and ships no
// deep-import subpaths (package.json `exports` = "." only), so there is no
// way to avoid pulling these two files in other than aliasing them away.
//
// Aliased in vite.config.ts onto the exact specifiers
// 'three/examples/jsm/loaders/DRACOLoader.js' and
// '.../KTX2Loader.js' — never onto the bare 'three' package, so any future
// real usage of these loaders elsewhere would need its own explicit import
// path (not silently stubbed).
export class DRACOLoader {}
export class KTX2Loader {}
export const DRACO_GLTF_CONFIG = {};
