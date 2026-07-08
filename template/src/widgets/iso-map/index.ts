// TODO(iso-promote): the shared drill-chain logic this widget depends on
// (widgets/composed-map/model/shared-drill-bus.svelte.ts) is a lateral
// widget->widget import (FSD boundary note, RFC-036 Risk R-3) — move it to
// entities/ on a later graduation pass. This is the ONE canonical copy of
// this note (EVID-100 Finding #5); no other file under widgets/iso-map/
// repeats it.
export { default as IsoMinimap } from "./ui/IsoMinimap.svelte";
